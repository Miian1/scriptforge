// ── Credit system core ────────────────────────────────
//
// Every billable AI action costs credits:
//   Text generation  → 1 credit
//   Voice generation → 2 credits
//   Project create   → 1 credit
//   Scoring, YouTube AI reply, SEO improve → 1 credit each
//
// Plan defaults:
//   free → 30 credits / day  (daily reset)
//   pro  → 8,000 credits      (lump sum — NO daily reset, lasts until plan ends)
//   admin / manager → unlimited (bypass)
//
// `dailyLimit` on the user record overrides the plan default when > 0.
// `bonusCredits` are admin-granted and never reset — they're consumed after
// the `balance` reaches 0.
//
// Daily reset (FREE ONLY) is triggered lazily inside `computeCreditState()`
// and `requireCredits()` — whenever `lastResetDate !== today`, the balance
// is refilled to 30 for free users. Pro users are NEVER auto-reset.

import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import type { ICredits } from '@/lib/models/User';

// ── Plan defaults ────────────────────────────────────────
export const PLAN_CREDIT_LIMITS = {
  free: 30,       // 30 credits per day, resets daily
  pro: 8000,      // 8000 credits lump sum, no daily reset
} as const;

// ── Billable actions ─────────────────────────────────────
export const CREDIT_ACTIONS = {
  TEXT_GENERATION:    { key: 'text_generation',    label: 'AI Text Generation',    cost: 1 },
  VOICE_GENERATION:   { key: 'voice_generation',   label: 'AI Voice Generation',   cost: 2 },
  PROJECT_CREATION:   { key: 'project_creation',   label: 'Project Creation',      cost: 1 },
  PROJECT_SCORING:    { key: 'project_scoring',    label: 'AI Project Scoring',    cost: 1 },
  AI_COMMENT_REPLY:   { key: 'ai_comment_reply',   label: 'AI Comment Reply',      cost: 1 },
  AI_SEO_IMPROVE:     { key: 'ai_seo_improve',     label: 'AI SEO Improve',        cost: 1 },
  PROJECT_PHASE:      { key: 'project_phase',      label: 'Project Phase Gen',     cost: 1 },
} as const;

export type CreditActionKey = keyof typeof CREDIT_ACTIONS;
export type CreditAction = typeof CREDIT_ACTIONS[CreditActionKey];

// ── Helpers ───────────────────────────────────────────────

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

/**
 * Resolve the effective credit limit for a user.
 * FREE users: returns the daily reset amount (30 by default, or custom override).
 * PRO users: returns the total pool (8000 by default, or custom override).
 * For Pro users, `dailyLimit` represents the total one-time pool, NOT a daily cap.
 */
export function getCreditLimit(plan: 'free' | 'pro', dailyLimitOverride: number): number {
  if (dailyLimitOverride && dailyLimitOverride > 0) return dailyLimitOverride;
  return PLAN_CREDIT_LIMITS[plan] ?? PLAN_CREDIT_LIMITS.free;
}

// Backward-compatible alias (kept so existing call sites don't break)
export const getDailyLimit = getCreditLimit;

/**
 * Compute the *effective* credit state for a user.
 *
 * FREE users: get a daily reset (balance refilled to 30 when new day).
 * PRO users: NO daily reset — their balance is a one-time pool of 8000
 *            credits that only depletes. We only reset when the plan
 *            is first activated (first Pro day) or admin explicitly resets.
 *
 * Does NOT mutate the DB — caller is responsible for persisting any reset.
 */
export interface CreditState {
  balance: number;
  bonusCredits: number;
  dailyLimit: number;
  totalAvailable: number;
  needsReset: boolean;
  plan: 'free' | 'pro';
  isStaff: boolean; // admin/manager → unlimited
}

export function computeCreditState(
  plan: 'free' | 'pro',
  role: string,
  credits: ICredits | null | undefined,
): CreditState {
  const today = getTodayKey();
  const dailyLimit = getCreditLimit(plan, credits?.dailyLimit ?? 0);
  const isStaff = role === 'admin' || role === 'manager';

  let balance = credits?.balance ?? 0;
  const bonusCredits = credits?.bonusCredits ?? 0;
  const lastResetDate = credits?.lastResetDate ?? '';
  let needsReset = false;

  if (plan === 'free') {
    // ── FREE: daily reset ──
    if (lastResetDate !== today) {
      balance = dailyLimit;
      needsReset = true;
    }
  } else {
    // ── PRO: no daily reset ──
    // Balance is a pool that only depletes.
    // We only auto-reset if balance is 0 AND lifetimeUsed is 0
    // (i.e. brand new Pro user who was just upgraded — give them 8000).
    // Otherwise, leave balance as-is (no refill).
    if (balance === 0 && (credits?.lifetimeUsed ?? 0) === 0) {
      balance = dailyLimit; // 8000 for fresh Pro users
      needsReset = true;
    }
  }

  return {
    balance,
    bonusCredits,
    dailyLimit,
    totalAvailable: balance + bonusCredits,
    needsReset,
    plan,
    isStaff,
  };
}

/**
 * Apply the lazy reset to the DB if needed. Mutates the user doc.
 * Returns the updated credits subdoc.
 */
export async function persistCreditResetIfNeeded(
  userId: string,
  state: CreditState,
): Promise<void> {
  if (!state.needsReset) return;
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'credits.balance': state.balance,
        'credits.lastResetDate': getTodayKey(),
      },
    },
  );
}

// ── Guard result ──────────────────────────────────────────
export interface CreditGuardResult {
  ok: boolean;
  userId?: string;
  error?: string;
  status: number;
  state?: CreditState;
  action?: CreditAction;
}

/**
 * Auth + credit guard for any billable AI route.
 *
 * Usage:
 *   const guard = await requireCredits('TEXT_GENERATION');
 *   if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
 *   // proceed — credits are ALREADY deducted atomically inside this call
 *   const userId = guard.userId;
 *
 * This performs:
 *   1. session check (401)
 *   2. user fetch
 *   3. staff bypass (admin/manager → no deduction, ok=true)
 *   4. lazy daily reset (FREE ONLY — Pro users never auto-reset)
 *   5. balance+bonus check (429 if insufficient)
 *   6. atomic deduction (balance first, then bonus)
 *   7. transaction log push (capped to last 50)
 *
 * Returns ok=true with userId if the deduction succeeded.
 */
export async function requireCredits(
  actionKey: CreditActionKey,
): Promise<CreditGuardResult> {
  const action = CREDIT_ACTIONS[actionKey];
  if (!action) {
    return { ok: false, error: 'Unknown credit action', status: 400 };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Not authenticated', status: 401 };
  }

  await connectDB();
  const user = await User.findById(session.userId).select('role plan planExpiresAt stripe credits');
  if (!user) {
    return { ok: false, error: 'User not found', status: 404 };
  }

  // Staff bypass — admins and managers do not consume credits
  if (user.role === 'admin' || user.role === 'manager') {
    return {
      ok: true,
      userId: session.userId,
      status: 200,
      state: {
        balance: Infinity,
        bonusCredits: 0,
        dailyLimit: Infinity,
        totalAvailable: Infinity,
        needsReset: false,
        plan: user.plan as 'free' | 'pro',
        isStaff: true,
      },
      action,
    };
  }

  const plan = (user.plan === 'pro' ? 'pro' : 'free') as 'free' | 'pro';

  // For Pro users, also gate on plan expiry — expired Pro = free limits
  let effectivePlan: 'free' | 'pro' = plan;
  if (plan === 'pro') {
    const stripeEnd = user.stripe?.currentPeriodEnd || 0;
    const planEnd = user.planExpiresAt || 0;
    const effectiveEnd = Math.max(stripeEnd, planEnd);
    if (effectiveEnd > 0 && Date.now() > effectiveEnd) {
      effectivePlan = 'free';
    }
  }

  const creditsField = user.credits as ICredits | undefined;
  const state = computeCreditState(effectivePlan, user.role, creditsField);

  // ── Persist the daily reset if needed (free users only in practice) ──
  if (state.needsReset) {
    if (!user.credits) {
      user.credits = {
        balance: state.balance,
        dailyLimit: 0,
        bonusCredits: 0,
        lastResetDate: getTodayKey(),
        lifetimeUsed: 0,
        transactions: [],
      } as ICredits;
    } else {
      user.credits.balance = state.balance;
      user.credits.lastResetDate = getTodayKey();
    }
  } else if (!user.credits) {
    // Edge case: legacy user without credits subdoc — initialize it
    user.credits = {
      balance: state.balance,
      dailyLimit: 0,
      bonusCredits: 0,
      lastResetDate: getTodayKey(),
      lifetimeUsed: 0,
      transactions: [],
    } as ICredits;
  }

  // ── Check balance ──
  const totalAvail = user.credits.balance + user.credits.bonusCredits;
  if (totalAvail < action.cost) {
    if (effectivePlan === 'free') {
      return {
        ok: false,
        error: `You've used all your daily credits. ${state.dailyLimit} credits reset tomorrow. Upgrade to Pro for 8,000 credits per plan.`,
        status: 429,
        state,
        action,
      };
    }
    return {
      ok: false,
      error: `You've used all your Pro credits. Contact an admin for more credits or renew your plan.`,
      status: 429,
      state,
      action,
    };
  }

  // ── Atomic deduction: balance first, then bonus ──
  let remaining: number = action.cost;
  if (user.credits.balance >= remaining) {
    user.credits.balance -= remaining;
    remaining = 0;
  } else {
    remaining -= user.credits.balance;
    user.credits.balance = 0;
    user.credits.bonusCredits = Math.max(0, user.credits.bonusCredits - remaining);
    remaining = 0;
  }

  user.credits.lifetimeUsed = (user.credits.lifetimeUsed || 0) + action.cost;

  // Push transaction log entry, cap to last 50
  const txEntry = {
    action: action.key,
    amount: action.cost,
    balanceAfter: user.credits.balance + user.credits.bonusCredits,
    at: Date.now(),
  };
  if (!Array.isArray(user.credits.transactions)) {
    user.credits.transactions = [];
  }
  user.credits.transactions.push(txEntry);
  if (user.credits.transactions.length > 50) {
    user.credits.transactions = user.credits.transactions.slice(-50);
  }

  // Mark subdoc modified (Mongoose sometimes can't detect nested changes)
  user.markModified('credits');
  await user.save();

  return {
    ok: true,
    userId: session.userId,
    status: 200,
    state: {
      balance: user.credits.balance,
      bonusCredits: user.credits.bonusCredits,
      dailyLimit: state.dailyLimit,
      totalAvailable: user.credits.balance + user.credits.bonusCredits,
      needsReset: false,
      plan: effectivePlan,
      isStaff: false,
    },
    action,
  };
}

/**
 * Refund credits (e.g. when an AI call fails after deduction).
 * This is a best-effort rollback.
 */
export async function refundCredits(
  userId: string,
  actionKey: CreditActionKey,
  amount?: number,
): Promise<void> {
  try {
    const action = CREDIT_ACTIONS[actionKey];
    if (!action) return;
    // Default to the action's cost if no amount specified
    const refundAmount = amount ?? action.cost;
    await connectDB();
    await User.updateOne(
      { _id: userId },
      {
        $inc: {
          'credits.balance': refundAmount,
          'credits.lifetimeUsed': -refundAmount,
        },
        $push: {
          'credits.transactions': {
            $each: [{
              action: `refund:${action.key}`,
              amount: -refundAmount,
              balanceAfter: -1, // unknown — caller can ignore
              at: Date.now(),
            }],
            $slice: -50,
          },
        },
      },
    );
  } catch (err) {
    console.error('[refundCredits] Failed to refund:', err);
  }
}

/**
 * Get the credit state for a user (read-only, no deduction).
 * Used by /api/auth/me and admin endpoints.
 */
export async function getUserCreditState(userId: string): Promise<CreditState | null> {
  await connectDB();
  const user = await User.findById(userId).select('role plan planExpiresAt stripe credits');
  if (!user) return null;

  if (user.role === 'admin' || user.role === 'manager') {
    return {
      balance: Infinity,
      bonusCredits: 0,
      dailyLimit: Infinity,
      totalAvailable: Infinity,
      needsReset: false,
      plan: user.plan as 'free' | 'pro',
      isStaff: true,
    };
  }

  const plan = user.plan === 'pro' ? 'pro' : 'free';
  let effectivePlan: 'free' | 'pro' = plan;
  if (plan === 'pro') {
    const stripeEnd = user.stripe?.currentPeriodEnd || 0;
    const planEnd = user.planExpiresAt || 0;
    const effectiveEnd = Math.max(stripeEnd, planEnd);
    if (effectiveEnd > 0 && Date.now() > effectiveEnd) {
      effectivePlan = 'free';
    }
  }

  const state = computeCreditState(effectivePlan, user.role, user.credits as ICredits);

  // If a reset is needed, persist it now so /api/auth/me reflects the truth
  if (state.needsReset) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'credits.balance': state.balance,
          'credits.lastResetDate': getTodayKey(),
        },
      },
    );
  }

  return state;
}

/**
 * Admin helper: set a custom daily credit limit override.
 * Pass 0 to clear the override (revert to plan default).
 */
export async function setCustomDailyLimit(userId: string, dailyLimit: number): Promise<void> {
  await connectDB();
  const limit = Math.max(0, Math.min(100000, Math.floor(dailyLimit)));
  await User.updateOne(
    { _id: userId },
    { $set: { 'credits.dailyLimit': limit } },
  );
}

/**
 * Admin helper: add bonus credits to a user (does not affect daily balance).
 */
export async function addBonusCredits(userId: string, amount: number): Promise<void> {
  await connectDB();
  const amt = Math.max(-100000, Math.min(100000, Math.floor(amount)));
  await User.updateOne(
    { _id: userId },
    { $inc: { 'credits.bonusCredits': amt } },
  );
}

/**
 * Admin helper: reset a user's balance to their plan limit immediately.
 * For free users: resets daily balance to 30.
 * For pro users: sets balance back to 8000 (lump sum).
 */
export async function resetUserCredits(userId: string): Promise<void> {
  await connectDB();
  const user = await User.findById(userId).select('role plan credits');
  if (!user) return;
  const plan = user.plan === 'pro' ? 'pro' : 'free';
  const limit = getCreditLimit(plan, (user.credits as ICredits | undefined)?.dailyLimit ?? 0);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'credits.balance': limit,
        'credits.lastResetDate': getTodayKey(),
      },
    },
  );
}

/**
 * Grant Pro credits — called when a user is upgraded to Pro (Stripe checkout,
 * admin manual, etc.). Sets their balance to 8000 if they haven't gotten
 * their lump sum yet (balance is 0 and lifetimeUsed is 0 or low).
 */
export async function grantProCredits(userId: string): Promise<void> {
  await connectDB();
  const user = await User.findById(userId).select('role plan credits');
  if (!user || user.plan !== 'pro') return;
  const credits = user.credits as ICredits | undefined;
  const dailyLimit = getCreditLimit('pro', credits?.dailyLimit ?? 0);
  // Only grant if they haven't received their lump sum yet
  if ((credits?.balance ?? 0) < dailyLimit) {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'credits.balance': dailyLimit,
          'credits.lastResetDate': getTodayKey(),
        },
      },
    );
  }
}
