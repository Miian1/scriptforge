import type { UserPlan, IDailyUsage } from './models/User';

// ── Plan Limits ────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    projectsPerDay: 3,
    aiGenerationsPerDay: 10,
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

export function resetIfNewDay(usage: IDailyUsage): IDailyUsage {
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
  dailyUsage?: IDailyUsage;
}) {
  const usage = user.dailyUsage
    ? resetIfNewDay(user.dailyUsage)
    : { date: getTodayKey(), projectsCreated: 0, aiGenerations: 0 };

  return {
    id: (user._id as string).toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    plan: (user.plan || 'free') as UserPlan,
    isVerified: user.isVerified,
    dailyUsage: usage,
  };
}