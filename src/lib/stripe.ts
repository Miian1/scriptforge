import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

/**
 * Centralized Stripe client instance.
 * All API routes should use this instead of creating their own client.
 *
 * Note: We do NOT pin apiVersion. The Stripe SDK 22.x bundles types for
 * API version 2026-06-24.dahlia, in which `current_period_end` was removed
 * from the Subscription object. Code that needs the billing period end should
 * read it from `latest_invoice.period_end` instead (expand latest_invoice
 * on retrieve). Omitting apiVersion lets the SDK use its bundled version
 * and ensures type-safety.
 */
export function getStripeClient(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

/**
 * Returns the Stripe API key status (for health checks).
 */
export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}
