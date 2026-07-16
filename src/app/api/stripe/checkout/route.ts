import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const BASE_URL = process.env.BASE_URL || 'https://scriptforge-six.vercel.app';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please use "Pay Direct to Admin" instead.' },
        { status: 503 }
      );
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.plan === 'pro') {
      return NextResponse.json({ error: 'You already have a Pro plan.' }, { status: 400 });
    }

    // Dynamic import — safer for Vercel serverless
    const Stripe = (await import('stripe')).default;
    const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-06-30.basil',
    });

    // Try subscription mode first (recurring price), fall back to payment (one-time)
    let checkoutSession;
    try {
      checkoutSession = await stripeClient.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${BASE_URL}/plans?success=true`,
        cancel_url: `${BASE_URL}/plans?canceled=true`,
        customer_email: user.email,
        metadata: {
          userId: (user._id as string).toString(),
        },
      });
    } catch (subErr: unknown) {
      // If subscription mode fails, try one-time payment mode
      const subMessage = subErr instanceof Error ? subErr.message : 'Unknown';
      console.log('[Stripe] Subscription mode failed, trying payment mode:', subMessage);

      try {
        checkoutSession = await stripeClient.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
          success_url: `${BASE_URL}/plans?success=true`,
          cancel_url: `${BASE_URL}/plans?canceled=true`,
          customer_email: user.email,
          metadata: {
            userId: (user._id as string).toString(),
          },
        });
      } catch (payErr: unknown) {
        const payMessage = payErr instanceof Error ? payErr.message : 'Unknown';
        console.error('[Stripe] Both modes failed. Subscription:', subMessage, '| Payment:', payMessage);
        return NextResponse.json({
          error: `Stripe error: ${payMessage}. Check if PRICE_ID matches your Stripe account.`,
        }, { status: 500 });
      }
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    console.error('[Stripe Checkout Error]', message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}