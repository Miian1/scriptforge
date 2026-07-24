import type { UserPlan, IDailyUsage, IChannelNiche } from './models/User';

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
  planExpiresAt?: number;
  isVerified: boolean;
  youtube?: { connected?: boolean } | null;
  channelNiche?: IChannelNiche | null;
  dailyUsage?: IDailyUsage;
  stripe?: { customerId?: string; subscriptionId?: string; currentPeriodEnd?: number; cancelAtPeriodEnd?: boolean } | null;
}) {
  const plan = (user.plan || 'free') as UserPlan;
  const usage = user.dailyUsage
    ? resetIfNewDay(user.dailyUsage, plan)
    : { date: getTodayKey(), projectsCreated: 0, aiGenerations: 0 };

  // Calculate plan days left
  const planExpiresAt = (user.planExpiresAt as number) || 0;
  let planDaysLeft = 0;
  if (plan === 'pro' && planExpiresAt > 0) {
    const diff = planExpiresAt - Date.now();
    planDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  // Channel niche
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
      };

  return {
    id: (user._id as string).toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    plan,
    planExpiresAt,
    planDaysLeft,
    isVerified: user.isVerified,
    youtubeConnected: user.youtube?.connected === true,
    channelNiche,
    dailyUsage: usage,
    stripe: {
      customerId: user.stripe?.customerId || '',
      subscriptionId: user.stripe?.subscriptionId || '',
      currentPeriodEnd: user.stripe?.currentPeriodEnd || 0,
      cancelAtPeriodEnd: user.stripe?.cancelAtPeriodEnd || false,
    },
  };
}