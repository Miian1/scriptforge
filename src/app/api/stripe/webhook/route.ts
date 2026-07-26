import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getStripeClient } from '@/lib/stripe';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ─── Helpers ─────────────────────────────────────────────────────────
// In Stripe API version 2026-06-24.dahlia (and recent versions), the
// `current_period_end` field was REMOVED from the Subscription object.
// The replacement is `latest_invoice.period_end` (the Invoice object still
// has period_end). We expand latest_invoice on retrieve() so we can read it.
//
// All Stripe timestamps are Unix seconds. Our DB stores milliseconds
// (consistent with Date.now() and planExpiresAt). Always convert through
// stripePeriodEndToMs to keep units consistent across the app.
function stripePeriodEndToMs(stripeSeconds: number | null | undefined): number {
  if (!stripeSeconds || typeof stripeSeconds !== 'number' || stripeSeconds <= 0) {
    return 0;
  }
  return stripeSeconds * 1000;
}

// Extract the billing period end from a Subscription object, trying
// multiple sources in order of preference:
//   1. latest_invoice.period_end (expanded object) — the canonical source
//   2. (legacy) subscription.current_period_end — works on older API versions
// Returns milliseconds, or 0 if no source had a value.
function extractPeriodEndMs(subscription: Stripe.Subscription): number {
  // Source 1: latest_invoice (preferred — works in all current API versions)
  const li = subscription.latest_invoice;
  if (li && typeof li === 'object' && 'period_end' in li) {
    const ms = stripePeriodEndToMs((li as Stripe.Invoice).period_end);
    if (ms) return ms;
  }
  // Source 2: legacy field (still works on older API versions)
  // Access via bracket notation so TypeScript doesn't complain about the
  // removed field — the runtime value may still be present depending on API version.
  const legacy = (subscription as unknown as Record<string, unknown>).current_period_end;
  if (typeof legacy === 'number' && legacy > 0) {
    return stripePeriodEndToMs(legacy);
  }
  return 0;
}

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
    // This is the PRIMARY event that upgrades a user to Pro.
    // We retrieve the subscription with `latest_invoice` expanded so we can
    // read `period_end` from the invoice (the canonical source in newer Stripe
    // API versions where `current_period_end` was removed from Subscription).
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId) {
        await connectDB();

        let customerId = (session.customer as string) || '';
        let subscriptionId = '';
        let currentPeriodEndMs = 0;
        let cancelAtPeriodEnd = false;

        if (session.subscription) {
          subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;

          try {
            // Always retrieve fresh with latest_invoice expanded — the inline
            // subscription object on the checkout session does not include
            // period_end information.
            const subscription = await stripeClient.subscriptions.retrieve(subscriptionId, {
              expand: ['latest_invoice'],
            });

            customerId =
              customerId ||
              (typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer?.id || '');

            currentPeriodEndMs = extractPeriodEndMs(subscription);
            cancelAtPeriodEnd = subscription.cancel_at_period_end === true;

            // ── Race condition mitigation ──
            // Right after checkout, Stripe may not yet have generated the
            // latest_invoice. If period_end is 0, retry once after 3 seconds.
            if (!currentPeriodEndMs) {
              console.warn(
                `[Stripe Webhook] period_end missing on first retrieve for sub ${subscriptionId}. Retrying in 3s...`
              );
              await new Promise((r) => setTimeout(r, 3000));
              const retried = await stripeClient.subscriptions.retrieve(subscriptionId, {
                expand: ['latest_invoice'],
              });
              currentPeriodEndMs = extractPeriodEndMs(retried);
              cancelAtPeriodEnd = retried.cancel_at_period_end === true;
            }
          } catch (err) {
            console.error(
              `[Stripe Webhook] Failed to retrieve subscription ${subscriptionId}:`,
              err
            );
            // Fall through — we still record customerId/subscriptionId so the
            // user is upgraded; the safety net in /api/auth/me will sync the
            // period end on the next session check.
          }
        }

        // planExpiresAt fallback: if we somehow still don't have currentPeriodEnd,
        // use a 30-day window so the user has access while the safety net catches up.
        const planExpiresAt =
          currentPeriodEndMs || Date.now() + 30 * 24 * 60 * 60 * 1000;

        await User.findByIdAndUpdate(userId, {
          plan: 'pro',
          planExpiresAt,
          stripe: {
            customerId,
            subscriptionId,
            currentPeriodEnd: currentPeriodEndMs,
            cancelAtPeriodEnd,
          },
        });

        console.log(
          `[Stripe Webhook] User ${userId} upgraded to Pro. Sub: ${subscriptionId}. ` +
            `Period end: ${currentPeriodEndMs ? new Date(currentPeriodEndMs).toISOString() : 'unknown — safety net will sync'}.`
        );
      }
    }

    // ── 2. Invoice payment succeeded (recurring renewal) ──
    // Fires on every successful renewal. This is the KEY event for keeping
    // currentPeriodEnd fresh — without it, the user would be downgraded after
    // the first month even though their subscription is still active.
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;

      // Only process recurring invoices (skip the first one — checkout.session.completed handles it)
      if (invoice.billing_reason === 'subscription_cycle') {
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id || '';

        if (customerId) {
          await connectDB();
          const user = await User.findOne({ 'stripe.customerId': customerId });

          if (user && user.plan === 'pro') {
            // We already have the user's subscriptionId in the DB — no need
            // to extract it from the invoice (the Invoice.subscription field
            // was removed in Stripe API 2026-06-24.dahlia).
            const subscriptionId = user.stripe?.subscriptionId || '';

            // invoice.period_end is the end of the NEW billing period (in seconds)
            const newPeriodEndMs = stripePeriodEndToMs(invoice.period_end);

            if (newPeriodEndMs) {
              await User.findByIdAndUpdate(user._id, {
                'stripe.currentPeriodEnd': newPeriodEndMs,
                'stripe.cancelAtPeriodEnd': false, // successful renewal clears any pending cancellation
                planExpiresAt: newPeriodEndMs,
              });

              console.log(
                `[Stripe Webhook] Renewal processed for user ${user._id}. ` +
                  `New period end: ${new Date(newPeriodEndMs).toISOString()}.`
              );
            } else if (subscriptionId) {
              // Fallback: retrieve the subscription to get the period end
              try {
                const sub = await stripeClient.subscriptions.retrieve(subscriptionId, {
                  expand: ['latest_invoice'],
                });
                const periodEndMs = extractPeriodEndMs(sub);

                if (periodEndMs) {
                  await User.findByIdAndUpdate(user._id, {
                    'stripe.currentPeriodEnd': periodEndMs,
                    'stripe.cancelAtPeriodEnd': sub.cancel_at_period_end === true,
                    planExpiresAt: periodEndMs,
                  });
                  console.log(
                    `[Stripe Webhook] Renewal synced via subscription retrieve for user ${user._id}. ` +
                      `Period end: ${new Date(periodEndMs).toISOString()}.`
                  );
                } else {
                  console.error(
                    `[Stripe Webhook] Could not determine period end for renewal of user ${user._id}. ` +
                      `invoice.period_end and subscription.latest_invoice.period_end both missing.`
                  );
                }
              } catch (err) {
                console.error(
                  `[Stripe Webhook] Failed to sync renewal for user ${user._id}:`,
                  err
                );
              }
            }
          }
        }
      }
    }

    // ── 3. Invoice payment failed ──
    // Stripe will retry for ~23 days before canceling. We mark cancelAtPeriodEnd
    // so the UI can warn the user, but we do NOT downgrade yet — they keep
    // access until the retry window expires.
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id || '';

      if (customerId) {
        await connectDB();
        const user = await User.findOne({ 'stripe.customerId': customerId });

        if (user && user.plan === 'pro') {
          const periodEndMs =
            stripePeriodEndToMs(invoice.period_end) ||
            user.stripe?.currentPeriodEnd ||
            0;

          await User.findByIdAndUpdate(user._id, {
            'stripe.cancelAtPeriodEnd': true,
            'stripe.currentPeriodEnd': periodEndMs,
          });

          console.log(
            `[Stripe Webhook] Payment failed for user ${user._id}. Marked cancelAtPeriodEnd=true. ` +
              `Stripe will retry. Period end stays at: ${periodEndMs ? new Date(periodEndMs).toISOString() : 'unknown'}.`
          );
        }
      }
    }

    // ── 4. Subscription updated (cancel/resume, plan change, period refresh) ──
    // This event fires on any change to the subscription object. We use it to
    // sync the local state with Stripe's truth.
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id || '';

      if (customerId) {
        await connectDB();
        const user = await User.findOne({ 'stripe.customerId': customerId });

        if (user) {
          const cancelAtEnd = subscription.cancel_at_period_end === true;

          // The webhook payload for subscription.updated may NOT include an
          // expanded latest_invoice. To get period_end reliably, retrieve the
          // subscription fresh with latest_invoice expanded.
          let periodEndMs = 0;
          try {
            const fresh = await stripeClient.subscriptions.retrieve(subscription.id, {
              expand: ['latest_invoice'],
            });
            periodEndMs = extractPeriodEndMs(fresh);
          } catch (err) {
            console.warn(
              `[Stripe Webhook] Could not retrieve fresh subscription ${subscription.id} for period_end:`,
              err
            );
          }

          // Always sync these fields from Stripe
          const update: Record<string, unknown> = {
            'stripe.cancelAtPeriodEnd': cancelAtEnd,
            'stripe.currentPeriodEnd': periodEndMs,
            'stripe.subscriptionId': subscription.id,
          };

          // Update planExpiresAt if we have a valid period end
          if (periodEndMs) {
            update.planExpiresAt = periodEndMs;
          }

          // If subscription status is no longer active, downgrade immediately
          // (covers scenarios like unpaid, past_due after retries exhausted)
          if (
            subscription.status === 'canceled' ||
            subscription.status === 'unpaid' ||
            subscription.status === 'incomplete_expired'
          ) {
            update.plan = 'free';
            update.planExpiresAt = 0;
            update.isCustomPlan = false;
            update.customPlan = { isCustom: false, customLabel: '', customDays: 0 };
            update.stripe = {
              customerId: '',
              subscriptionId: '',
              currentPeriodEnd: 0,
              cancelAtPeriodEnd: false,
            };
            console.log(
              `[Stripe Webhook] Subscription ${subscription.id} status=${subscription.status}. User ${user._id} downgraded to free.`
            );
          } else {
            console.log(
              `[Stripe Webhook] Subscription updated for user ${user._id}. ` +
                `cancelAtPeriodEnd=${cancelAtEnd}, periodEnd=${periodEndMs ? new Date(periodEndMs).toISOString() : 'unknown'}.`
            );
          }

          await User.findByIdAndUpdate(user._id, update);
        }
      }
    }

    // ── 5. Subscription deleted (cancelled / expired) ──
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id || '';

      // Try metadata first, fallback to customerId lookup
      const userId = subscription.metadata?.userId;

      await connectDB();

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          plan: 'free',
          planExpiresAt: 0,
          isCustomPlan: false,
          customPlan: { isCustom: false, customLabel: '', customDays: 0 },
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
            isCustomPlan: false,
            customPlan: { isCustom: false, customLabel: '', customDays: 0 },
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
