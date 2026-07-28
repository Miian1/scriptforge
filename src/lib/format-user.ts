// ── Server-only user response formatter ────────────────
//
// This file is intentionally split out of `usage.ts` so that `usage.ts`
// remains pure and safe to import from Client Components.
//
// `formatUserResponse` needs `computeCreditState` from `./credits`, which
// transitively imports mongoose/mongodb — Node-only modules that break
// the Next.js browser bundle (`tls`, `net`, `fs` not found errors).
//
// By keeping it here, client components can safely import `PLAN_LIMITS`
// from `@/lib/usage` without dragging mongoose into the browser bundle.
//
// Importing this file from a Client Component is FORBIDDEN — only API
// route handlers (Server Components / server runtime) should import it.

import type {
  UserPlan,
  IDailyUsage,
  IChannelNiche,
  IChannelCharacter,
  ICredits,
} from '@/lib/models/User';
import { computeCreditState, getTodayKey as getCreditTodayKey } from '@/lib/credits';
import { getTodayKey } from '@/lib/usage';

export function formatUserResponse(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  plan?: string;
  planExpiresAt?: number;
  planSource?: 'stripe' | 'manual' | null;
  isVerified: boolean;
  youtube?: { connected?: boolean } | null;
  channelNiche?: IChannelNiche & { characters?: IChannelCharacter[] } | null;
  dailyUsage?: IDailyUsage;
  credits?: ICredits | null;
  stripe?: { customerId?: string; subscriptionId?: string; currentPeriodEnd?: number; cancelAtPeriodEnd?: boolean } | null;
}) {
  const plan = (user.plan || 'free') as UserPlan;
  const usage = user.dailyUsage
    ? resetIfNewDay(user.dailyUsage, plan)
    : { date: getTodayKey(), projectsCreated: 0, aiGenerations: 0 };

  // ── Calculate plan expiry & days left ──
  // For Stripe subscriptions, `stripe.currentPeriodEnd` is the source of truth
  // (Stripe sets it on every renewal). If `planExpiresAt` is missing or stale,
  // fall back to `stripe.currentPeriodEnd` so the UI shows the correct countdown.
  const stripePeriodEnd = user.stripe?.currentPeriodEnd || 0;
  let planExpiresAt = (user.planExpiresAt as number) || 0;

  // If this is a Stripe Pro user and planExpiresAt is missing/stale, use the
  // stripe currentPeriodEnd value instead.
  if (plan === 'pro' && stripePeriodEnd > 0) {
    // If planExpiresAt is 0, or differs from stripe by more than 1 day,
    // trust stripe.currentPeriodEnd (it's the billing truth).
    if (planExpiresAt === 0 || Math.abs(planExpiresAt - stripePeriodEnd) > 24 * 60 * 60 * 1000) {
      planExpiresAt = stripePeriodEnd;
    }
  }

  let planDaysLeft = 0;
  if (plan === 'pro' && planExpiresAt > 0) {
    const diff = planExpiresAt - Date.now();
    // Use Math.max(1, ...) so the UI shows at least "1 day left" when the
    // period is still valid (even if it ends later today). Only returns 0
    // when the expiry has fully passed.
    planDaysLeft = diff > 0
      ? Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      : 0;
  }

  // ── Credit state (lazy daily reset applied) ──
  // Returns the effective balance, dailyLimit, bonus, and staff flag.
  // For staff (admin/manager) we report Infinity-equivalent sentinel values
  // so the client can render "Unlimited" instead of a number.
  const creditsField = user.credits as ICredits | null | undefined;
  const isStaff = user.role === 'admin' || user.role === 'manager';
  let effectivePlanForCredits: 'free' | 'pro' = plan;
  if (plan === 'pro') {
    const stripeEnd = user.stripe?.currentPeriodEnd || 0;
    const planEnd = (user.planExpiresAt as number) || 0;
    const effectiveEnd = Math.max(stripeEnd, planEnd);
    if (effectiveEnd > 0 && Date.now() > effectiveEnd) {
      effectivePlanForCredits = 'free';
    }
  }
  const creditState = computeCreditState(effectivePlanForCredits, user.role, creditsField);

  // Channel niche (including channel characters)
  const niche = user.channelNiche;
  const channelNiche = niche
    ? {
        visualTheme: niche.visualTheme || '',
        writingStyle: niche.writingStyle || '',
        audience: niche.audience || '',
        language: niche.language || '',
        description: niche.description || '',
        channelName: niche.channelName || '',
        channelDescription: niche.channelDescription || '',
        channelCategory: niche.channelCategory || '',
        channelUrl: niche.channelUrl || '',
        characters: Array.isArray(niche.characters)
          ? niche.characters.map((c) => ({
              id: c.id || '',
              name: c.name || '',
              role: c.role || '',
              description: c.description || '',
              visualPrompt: c.visualPrompt || '',
              personalityPrompt: c.personalityPrompt || '',
            }))
          : [],
      }
    : {
        visualTheme: '',
        writingStyle: '',
        audience: '',
        language: '',
        description: '',
        channelName: '',
        channelDescription: '',
        channelCategory: '',
        channelUrl: '',
        characters: [],
      };

  return {
    id: (user._id as string).toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    plan,
    planExpiresAt,
    planDaysLeft,
    planSource: user.planSource || null,
    isVerified: user.isVerified,
    youtubeConnected: user.youtube?.connected === true,
    channelNiche,
    dailyUsage: usage,
    credits: {
      balance: isStaff ? -1 : creditState.balance,         // -1 sentinel = unlimited
      bonusCredits: isStaff ? 0 : creditState.bonusCredits,
      dailyLimit: isStaff || effectivePlanForCredits === 'pro' ? -1 : creditState.dailyLimit,    // -1 = no daily cap (pro has pool)
      totalAvailable: isStaff ? -1 : creditState.balance + creditState.bonusCredits,
      lifetimeUsed: creditsField?.lifetimeUsed ?? 0,
      lastResetDate: creditsField?.lastResetDate || getCreditTodayKey(),
      isStaff,
      plan: effectivePlanForCredits,
    },
    stripe: {
      customerId: user.stripe?.customerId || '',
      subscriptionId: user.stripe?.subscriptionId || '',
      currentPeriodEnd: user.stripe?.currentPeriodEnd || 0,
      cancelAtPeriodEnd: user.stripe?.cancelAtPeriodEnd || false,
    },
  };
}

// ── Local copy of resetIfNewDay (kept here to avoid circular import) ──
// For free users: limits are ONE-TIME (lifetime), never reset.
// For pro users: limits are daily and reset each day.
function resetIfNewDay(usage: IDailyUsage, plan: 'free' | 'pro' = 'free'): IDailyUsage {
  if (plan === 'free') {
    return usage;
  }
  const today = getTodayKey();
  if (usage.date !== today) {
    return { date: today, projectsCreated: 0, aiGenerations: 0 };
  }
  return usage;
}
