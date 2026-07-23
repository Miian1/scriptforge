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
      const daysLeft = u.plan === 'pro' && planExpiresAt > 0
        ? Math.max(0, Math.ceil((planExpiresAt - now) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        provider: u.provider || 'email',
        role: u.role || 'user',
        plan: u.plan || 'free',
        isVerified: u.isVerified || false,
        isCustomPlan: u.isCustomPlan || false,
        customPlan: u.customPlan || { isCustom: false, customLabel: '', customDays: 0 },
        planExpiresAt,
        planDaysLeft: daysLeft,
        stripe: u.stripe || { customerId: '', subscriptionId: '', currentPeriodEnd: 0, cancelAtPeriodEnd: false },
        dailyUsage: u.dailyUsage || { date: '', projectsCreated: 0, aiGenerations: 0 },
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
