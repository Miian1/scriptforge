import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Disable body parsing — Stripe needs the raw body for signature verification
export async function POST(req: NextRequest) {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    // Verify webhook signature
    const stripe = await import('stripe');
    const stripeClient = new stripe.default(STRIPE_WEBHOOK_SECRET);
    let event: stripe.default.Event;

    try {
      event = stripeClient.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as stripe.default.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId) {
        await connectDB();
        await User.findByIdAndUpdate(userId, { plan: 'pro' });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}