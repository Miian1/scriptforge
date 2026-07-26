import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

// GET /api/manager/users
// Lists all end-users (role='user') for the manager panel.
// Manager cannot see other managers or admins (limited scope by design).
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden. Manager access required.' }, { status: 403 });
    }

    await connectDB();

    // Only show standard users — managers should not see admins or other managers
    const users = await User.find({ role: 'user' })
      .select('-password -verificationToken -verificationTokenExpires -googleId')
      .sort({ createdAt: -1 })
      .lean();

    const now = Date.now();

    const formatted = users.map((u) => {
      const planExpiresAt = u.planExpiresAt || 0;
      const stripePeriodEnd = u.stripe?.currentPeriodEnd || 0;

      // For Stripe Pro users, fall back to stripe.currentPeriodEnd if
      // planExpiresAt is missing or stale.
      let effectiveExpiry = planExpiresAt;
      if (u.plan === 'pro' && stripePeriodEnd > 0) {
        if (
          planExpiresAt === 0 ||
          Math.abs(planExpiresAt - stripePeriodEnd) > 24 * 60 * 60 * 1000
        ) {
          effectiveExpiry = stripePeriodEnd;
        }
      }

      // Days-left: at least 1 if the period hasn't ended yet, 0 only when fully expired.
      const diff = effectiveExpiry - now;
      const daysLeft = u.plan === 'pro' && diff > 0
        ? Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
        : 0;

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
        planExpiresAt: effectiveExpiry,
        planDaysLeft: daysLeft,
        stripe: u.stripe || {
          customerId: '',
          subscriptionId: '',
          currentPeriodEnd: 0,
          cancelAtPeriodEnd: false,
        },
        dailyUsage: u.dailyUsage || { date: '', projectsCreated: 0, aiGenerations: 0 },
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

    return NextResponse.json({ users: formatted, total: formatted.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch users';
    console.error('[Manager Users Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
