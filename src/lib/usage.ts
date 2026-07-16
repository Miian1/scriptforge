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

export function formatUserResponse(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  plan?: string;
  isVerified: boolean;
  youtube?: { connected?: boolean } | null;
  dailyUsage?: IDailyUsage;
}) {
  const plan = (user.plan || 'free') as UserPlan;
  const usage = user.dailyUsage
    ? resetIfNewDay(user.dailyUsage, plan)
    : { date: getTodayKey(), projectsCreated: 0, aiGenerations: 0 };

  return {
    id: (user._id as string).toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    plan,
    isVerified: user.isVerified,
    youtubeConnected: user.youtube?.connected === true,
    dailyUsage: usage,
  };
}