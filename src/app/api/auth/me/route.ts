import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { formatUserResponse } from '@/lib/usage';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── Auto-downgrade safety net ──
    // If the user is Pro with a Stripe subscription, check if the billing
    // period has expired and the DB wasn't updated (e.g., webhook missed).
    // This runs on every /api/auth/me call to guarantee consistency.
    let downgraded = false;

    if (
      user.plan === 'pro' &&
      user.stripe?.subscriptionId &&
      user.stripe?.currentPeriodEnd &&
      user.stripe.currentPeriodEnd > 0 &&
      Date.now() > user.stripe.currentPeriodEnd
    ) {
      // Period has expired — verify with Stripe before downgrading
      try {
        const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
        if (STRIPE_SECRET_KEY) {
          const Stripe = (await import('stripe')).default;
          const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
            apiVersion: '2025-06-30.basil',
          });

          const subscription = await stripeClient.subscriptions.retrieve(
            user.stripe.subscriptionId
          );

          if (subscription.status === 'canceled' || subscription.status === 'unpaid' || subscription.status === 'past_due') {
            // Subscription truly ended — downgrade in DB
            await User.findByIdAndUpdate(user._id, {
              plan: 'free',
              planExpiresAt: 0,
              stripe: {
                customerId: '',
                subscriptionId: '',
                currentPeriodEnd: 0,
                cancelAtPeriodEnd: false,
              },
            });
            console.log(`[Auto-Downgrade] User ${user._id} downgraded to free (subscription ${subscription.status})`);
            downgraded = true;
          } else if (
            subscription.status === 'active' &&
            subscription.current_period_end
          ) {
            // Stripe says still active — sync the period end and move on
            const newPeriodEnd = new Date(subscription.current_period_end * 1000).getTime();
            await User.findByIdAndUpdate(user._id, {
              'stripe.currentPeriodEnd': newPeriodEnd,
              'stripe.cancelAtPeriodEnd': subscription.cancel_at_period_end === true,
              planExpiresAt: newPeriodEnd,
            });
            // Re-fetch to get updated data
            const updatedUser = await User.findById(session.userId).select('-password');
            return NextResponse.json({ user: formatUserResponse(updatedUser!) });
          }
        }
      } catch (stripeErr) {
        console.error('[Auto-Downgrade] Stripe check failed, keeping current plan:', stripeErr);
        // If Stripe is unreachable, keep the user's current plan to avoid locking them out
      }
    }

    // Also check: Pro user with cancelAtPeriodEnd=true AND period expired
    // but the Stripe check didn't run (no API key) or didn't downgrade
    if (
      !downgraded &&
      user.plan === 'pro' &&
      user.stripe?.cancelAtPeriodEnd === true &&
      user.stripe?.currentPeriodEnd > 0 &&
      Date.now() > user.stripe.currentPeriodEnd
    ) {
      await User.findByIdAndUpdate(user._id, {
        plan: 'free',
        planExpiresAt: 0,
        stripe: {
          customerId: '',
          subscriptionId: '',
          currentPeriodEnd: 0,
          cancelAtPeriodEnd: false,
        },
      });
      console.log(`[Auto-Downgrade] User ${user._id} downgraded to free (cancelAtPeriodEnd + period expired)`);
      downgraded = true;
    }

    // Re-fetch user if we made any changes
    if (downgraded) {
      const freshUser = await User.findById(session.userId).select('-password');
      if (freshUser) {
        return NextResponse.json({ user: formatUserResponse(freshUser), planDowngraded: true });
      }
    }

    return NextResponse.json({ user: formatUserResponse(user) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}