import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

// GET /api/admin/users — list all users with plan info
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    await connectDB();

    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const now = Date.now();

    const formatted = users.map((u) => {
      const planExpiresAt = u.planExpiresAt || 0;
      const stripePeriodEnd = u.stripe?.currentPeriodEnd || 0;

      // For Stripe Pro users, fall back to stripe.currentPeriodEnd if
      // planExpiresAt is missing or stale. This fixes the “0 days left” bug
      // where the webhook updated stripe.currentPeriodEnd but planExpiresAt
      // wasn’t kept in sync.
      let effectiveExpiry = planExpiresAt;
      if (u.plan === 'pro' && stripePeriodEnd > 0) {
        if (planExpiresAt === 0 || Math.abs(planExpiresAt - stripePeriodEnd) > 24 * 60 * 60 * 1000) {
          effectiveExpiry = stripePeriodEnd;
        }
      }

      // Days-left calc: returns at least 1 day if the period hasn't ended yet,
      // even if expiry is later today. Only 0 when expiry has fully passed.
      const diff = effectiveExpiry - now;
      const daysLeft = u.plan === 'pro' && diff > 0
        ? Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
        : 0;

      // Determine plan source label for UI:
      //   - 'stripe' if they have a real Stripe subscription
      //   - 'manual' if Pro but no Stripe (admin upgraded)
      //   - null if Free
      const planSource = u.plan === 'pro'
        ? (u.stripe?.subscriptionId ? 'stripe' : (u.planSource || 'manual'))
        : null;

      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        provider: u.provider || 'email',
        role: u.role || 'user',
        plan: u.plan || 'free',
        planSource,
        isVerified: u.isVerified || false,
        isCustomPlan: u.isCustomPlan || false,
        customPlan: u.customPlan || { isCustom: false, customLabel: '', customDays: 0 },
        planExpiresAt: effectiveExpiry,
        planDaysLeft: daysLeft,
        stripe: u.stripe || { customerId: '', subscriptionId: '', currentPeriodEnd: 0, cancelAtPeriodEnd: false },
        dailyUsage: u.dailyUsage || { date: '', projectsCreated: 0, aiGenerations: 0 },
        // ── Credit system ──
        // For staff we report -1 (unlimited). For regular users we report
        // the actual balance, the effective daily limit (custom override or
        // plan default), and lifetime usage.
        credits: {
          balance: (u.role === 'admin' || u.role === 'manager') ? -1 : (u.credits?.balance ?? 0),
          bonusCredits: (u.role === 'admin' || u.role === 'manager') ? 0 : (u.credits?.bonusCredits ?? 0),
          dailyLimit: (() => {
            if (u.role === 'admin' || u.role === 'manager') return -1;
            const override = u.credits?.dailyLimit ?? 0;
            if (override > 0) return override;
            return u.plan === 'pro' ? 8000 : 30;
          })(),
          lifetimeUsed: u.credits?.lifetimeUsed ?? 0,
          lastResetDate: u.credits?.lastResetDate || '',
          transactionCount: Array.isArray(u.credits?.transactions) ? u.credits.transactions.length : 0,
        },
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

    return NextResponse.json({ users: formatted, total: formatted.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    console.error('[Admin Users Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
