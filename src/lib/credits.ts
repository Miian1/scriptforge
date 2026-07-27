// ── Credit system core ────────────────────────────────
//
// Every billable AI action (text gen, voice gen, project create, AI score,
// YouTube AI reply, YouTube SEO improve) costs exactly 1 credit per call.
//
// Plan defaults:
//   free → 10 credits / day
//   pro  → 150 credits / day
//   admin / manager → unlimited (bypass)
//
// `dailyLimit` on the user record overrides the plan default when > 0.
// `bonusCredits` are admin-granted and never reset — they're consumed after
// the daily `balance` reaches 0. They are stored separately and decremented
// only when the daily balance is exhausted.
//
// Daily reset is triggered lazily inside `getUserCreditState()` and
// `deductCredits()` — whenever `lastResetDate !== today`, the balance is
// refilled to the plan/override limit before the operation runs.

import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import type { ICredits } from '@/lib/models/User';

// ── Plan defaults ────────────────────────────────────────
export const PLAN_CREDIT_LIMITS = {
  free: 10,
  pro: 150,
} as const;

// ── Billable actions ─────────────────────────────────────
// Each entry is a known action type. `cost` is normally 1 (the user's spec
// says "per generation reduce 1 limit"). Kept as a map so we can adjust
// per-action cost later without rewriting call sites.
export const CREDIT_ACTIONS = {
  TEXT_GENERATION:    { key: 'text_generation',    label: 'AI Text Generation',    cost: 1 },
  VOICE_GENERATION:   { key: 'voice_generation',   label: 'AI Voice Generation',   cost: 1 },
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
 * Resolve the effective daily credit limit for a user.
 * If `credits.dailyLimit > 0`, that overrides the plan default.
 */
export function getDailyLimit(plan: 'free' | 'pro', dailyLimitOverride: number): number {
  if (dailyLimitOverride && dailyLimitOverride > 0) return dailyLimitOverride;
  return PLAN_CREDIT_LIMITS[plan] ?? PLAN_CREDIT_LIMITS.free;
}

/**
 * Compute the *effective* credit state for a user, applying a lazy daily
 * reset if needed. Does NOT mutate the DB — caller is responsible for
 * persisting any reset.
 *
 * Returns:
 *   - balance: today's spendable daily credits (already reset if new day)
 *   - bonusCredits: separate, never-reset pool
 *   - dailyLimit: effective limit
 *   - totalAvailable: balance + bonusCredits
 *   - needsReset: true if the DB needs to be updated with the new balance
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
  const dailyLimit = getDailyLimit(plan, credits?.dailyLimit ?? 0);
  const isStaff = role === 'admin' || role === 'manager';

  let balance = credits?.balance ?? 0;
  const bonusCredits = credits?.bonusCredits ?? 0;
  const lastResetDate = credits?.lastResetDate ?? '';
  let needsReset = false;

  if (lastResetDate !== today) {
    balance = dailyLimit;
    needsReset = true;
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
 *   4. lazy daily reset
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
  // We need the full user doc (plan, role, credits subdoc) for the check
  // and the deduction. Using .save() ensures the transaction array cap
  // works correctly via $slice on save.
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

  // ── Persist the daily reset if needed ──
  // We do this BEFORE the deduction so the deduction reflects the new day.
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
    const dailyLimit = state.dailyLimit;
    return {
      ok: false,
      error:
        effectivePlan === 'free'
          ? `You've used all ${dailyLimit} daily credits on the Free plan. Upgrade to Pro for 150 credits/day.`
          : `You've used all ${dailyLimit} daily Pro credits. Credits reset tomorrow or contact an admin for bonus credits.`,
      status: 429,
      state,
      action,
    };
  }

  // ── Atomic deduction: daily balance first, then bonus ──
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
  amount: number = 1,
): Promise<void> {
  try {
    const action = CREDIT_ACTIONS[actionKey];
    if (!action) return;
    await connectDB();
    await User.updateOne(
      { _id: userId },
      {
        $inc: {
          'credits.balance': amount,
          'credits.lifetimeUsed': -amount,
        },
        $push: {
          'credits.transactions': {
            $each: [{
              action: `refund:${action.key}`,
              amount: -amount,
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
  const limit = Math.max(0, Math.min(10000, Math.floor(dailyLimit)));
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
  const amt = Math.max(-10000, Math.min(10000, Math.floor(amount)));
  await User.updateOne(
    { _id: userId },
    { $inc: { 'credits.bonusCredits': amt } },
  );
}

/**
 * Admin helper: reset a user's daily balance to their plan limit immediately.
 */
export async function resetUserCredits(userId: string): Promise<void> {
  await connectDB();
  const user = await User.findById(userId).select('role plan credits');
  if (!user) return;
  const plan = user.plan === 'pro' ? 'pro' : 'free';
  const limit = getDailyLimit(plan, (user.credits as ICredits | undefined)?.dailyLimit ?? 0);
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
