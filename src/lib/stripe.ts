import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

/**
 * Centralized Stripe client instance.
 * All API routes should use this instead of creating their own client.
 */
export function getStripeClient(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-06-30.basil',
  });
}

/**
 * Returns the Stripe API key status (for health checks).
 */
export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}
