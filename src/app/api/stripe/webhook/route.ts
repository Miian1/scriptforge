import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getStripeClient } from '@/lib/stripe';

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

    const stripeClient = getStripeClient();
    let event: Stripe.Event;

    try {
      event = stripeClient.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // ── 1. Checkout completed (first payment / new subscription) ──
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId) {
        await connectDB();

        // Retrieve subscription details from Stripe
        let customerId = '';
        let subscriptionId = '';
        let currentPeriodEnd = 0;

        if (session.subscription) {
          try {
            const subscription = await stripeClient.subscriptions.retrieve(
              session.subscription as string
            );
            customerId = session.customer as string || subscription.customer as string || '';
            subscriptionId = subscription.id;
            currentPeriodEnd = subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).getTime()
              : 0;
          } catch (err) {
            console.error('[Stripe Webhook] Failed to retrieve subscription:', err);
          }
        }

        // planExpiresAt = currentPeriodEnd (Stripe billing period end = 30 days)
        const planExpiresAt = currentPeriodEnd || (Date.now() + 30 * 24 * 60 * 60 * 1000);

        await User.findByIdAndUpdate(userId, {
          plan: 'pro',
          planExpiresAt,
          stripe: {
            customerId,
            subscriptionId,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
        });

        console.log(`[Stripe Webhook] User ${userId} upgraded to Pro. Sub: ${subscriptionId}. Expires: ${new Date(planExpiresAt).toISOString()}`);
      }
    }

    // ── 2. Invoice payment failed ──
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      if (customerId) {
        await connectDB();
        const user = await User.findOne({ 'stripe.customerId': customerId });

        if (user && user.plan === 'pro') {
          // Stripe will retry for ~23 days before cancelling.
          // We mark cancelAtPeriodEnd so the user knows payment failed.
          await User.findByIdAndUpdate(user._id, {
            'stripe.cancelAtPeriodEnd': true,
            'stripe.currentPeriodEnd': invoice.period_end
              ? new Date(invoice.period_end * 1000).getTime()
              : user.stripe.currentPeriodEnd,
          });

          console.log(`[Stripe Webhook] Payment failed for user ${user._id}. Marked cancelAtPeriodEnd=true.`);
        }
      }
    }

    // ── 3. Subscription updated (user cancels at period end, or plan change) ──
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      if (customerId) {
        await connectDB();
        const user = await User.findOne({ 'stripe.customerId': customerId });

        if (user) {
          const cancelAtEnd = subscription.cancel_at_period_end === true;
          const periodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).getTime()
            : 0;

          // If subscription is active and was previously cancelled, user re-enabled
          if (!cancelAtEnd && user.plan === 'pro') {
            await User.findByIdAndUpdate(user._id, {
              'stripe.cancelAtPeriodEnd': false,
              'stripe.currentPeriodEnd': periodEnd,
              'stripe.subscriptionId': subscription.id,
              planExpiresAt: periodEnd,
            });
          } else {
            await User.findByIdAndUpdate(user._id, {
              'stripe.cancelAtPeriodEnd': cancelAtEnd,
              'stripe.currentPeriodEnd': periodEnd,
              'stripe.subscriptionId': subscription.id,
              planExpiresAt: periodEnd,
            });
          }

          console.log(`[Stripe Webhook] Subscription updated for user ${user._id}. cancelAtPeriodEnd=${cancelAtEnd}`);
        }
      }
    }

    // ── 4. Subscription deleted (cancelled / expired) ──
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Try metadata first, fallback to customerId lookup
      const userId = subscription.metadata?.userId;

      await connectDB();

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          plan: 'free',
          planExpiresAt: 0,
          stripe: {
            customerId: '',
            subscriptionId: '',
            currentPeriodEnd: 0,
            cancelAtPeriodEnd: false,
          },
        });
      } else if (customerId) {
        const user = await User.findOne({ 'stripe.customerId': customerId });
        if (user) {
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
        }
      }

      console.log(`[Stripe Webhook] Subscription deleted. User downgraded to free.`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook failed';
    console.error('[Stripe Webhook Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}