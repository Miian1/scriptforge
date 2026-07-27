// ── Client-safe plan limits & daily usage helpers ─────
//
// ⚠️  This file MUST stay pure (no mongoose / mongodb / credits imports).
// It is imported by Client Components (plans page, dashboard, editor).
//
// `formatUserResponse` was moved to `@/lib/format-user` (server-only)
// because it depends on `computeCreditState` from `./credits`, which
// transitively pulls in mongoose — breaking the browser bundle.

import type { UserPlan, IDailyUsage } from './models/User';

// ── Plan Limits ────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    projectsPerDay: 1,
    aiGenerationsPerDay: 3,
    canRegenerate: false,
    label: 'Free',
  },
  pro: {
    projectsPerDay: Infinity,
    aiGenerationsPerDay: 100,
    canRegenerate: true,
    label: 'Pro',
  },
} as const;

// ── Daily Usage Helpers ────────────────────────────────

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

// For free users: limits are ONE-TIME (lifetime), never reset.
// For pro users: limits are daily and reset each day.
export function resetIfNewDay(usage: IDailyUsage, plan: 'free' | 'pro' = 'free'): IDailyUsage {
  // Free plan: one-time limits, never reset
  if (plan === 'free') {
    return usage;
  }
  // Pro plan: daily reset
  const today = getTodayKey();
  if (usage.date !== today) {
    return { date: today, projectsCreated: 0, aiGenerations: 0 };
  }
  return usage;
}

// Re-export UserPlan for convenience (type-only, erased at compile time)
export type { UserPlan, IDailyUsage };
