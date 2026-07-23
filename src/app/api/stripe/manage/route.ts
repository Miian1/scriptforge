import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe';

// POST /api/stripe/manage — cancel or resume subscription at period end
// body: { action: 'cancel' | 'resume' }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { action } = body;
    if (!action || !['cancel', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "cancel" or "resume".' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.stripe?.subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found. Contact admin for manual cancellation.' }, { status: 400 });
    }

    const stripeClient = getStripeClient();

    if (action === 'cancel') {
      // Cancel at period end — user keeps access until current period expires
      await stripeClient.subscriptions.update(user.stripe.subscriptionId, {
        cancel_at_period_end: true,
      });

      // Update local record
      await User.findByIdAndUpdate(session.userId, {
        'stripe.cancelAtPeriodEnd': true,
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription will cancel at the end of your current billing period.',
        currentPeriodEnd: user.stripe.currentPeriodEnd,
      });
    }

    if (action === 'resume') {
      // Re-enable auto-renewal
      await stripeClient.subscriptions.update(user.stripe.subscriptionId, {
        cancel_at_period_end: false,
      });

      await User.findByIdAndUpdate(session.userId, {
        'stripe.cancelAtPeriodEnd': false,
      });

      return NextResponse.json({
        success: true,
        message: 'Auto-renewal has been re-enabled. Your subscription will continue.',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to manage subscription';
    console.error('[Stripe Manage Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}