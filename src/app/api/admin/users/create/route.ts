import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { PLAN_CREDIT_LIMITS } from '@/lib/credits';

// POST /api/admin/users/create
// Admin creates a new user account with email + password.
// These accounts are pre-verified (isVerified=true) — no email verification
// is sent. Useful for accounts created via Easypaisa/JazzCash offline payment,
// OR for creating staff 'manager' accounts that can access the Manager Panel.
//
// Body: { name?, email, password, plan?, days?, role? }
//   - name (optional, defaults to email username)
//   - email (required)
//   - password (required, min 6 chars)
//   - plan (optional, 'free' | 'pro', defaults to 'free')
//   - days (optional, number of days for Pro if plan=pro, defaults to 30)
//   - role (optional, 'user' | 'admin' | 'manager', defaults to 'user')
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, plan, days, role } = body;

    // ── Validate ──
    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userName = (name?.trim() || normalizedEmail.split('@')[0]).slice(0, 100);
    const userRole: 'user' | 'admin' | 'manager' =
      role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'user';
    const userPlan = plan === 'pro' ? 'pro' : 'free';
    const daysNum = typeof days === 'number' && days > 0 ? Math.min(days, 365) : 30;

    await connectDB();

    // ── Check for existing user ──
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // ── Build the user document ──
    // Admin-created accounts are pre-verified — no email verification sent.
    // planSource='manual' for Pro (admin-granted), null for Free.
    // Credits: Pro = 150, Free = 10, Staff = bypass (balance set to 0, but
    // requireCredits short-circuits for admin/manager anyway).
    const todayDate = new Date().toISOString().split('T')[0];
    const newUserData: Record<string, unknown> = {
      name: userName,
      email: normalizedEmail,
      password,
      provider: 'email',
      role: userRole,
      plan: userPlan,
      isVerified: true, // ← no email verification for admin-created accounts
      verificationToken: null,
      verificationTokenExpires: null,
      credits: {
        // Staff get 0 balance but bypass via requireCredits. Regular users
        // start with their plan's daily limit so they can use the app
        // immediately.
        balance: userRole === 'admin' || userRole === 'manager'
          ? 0
          : (userPlan === 'pro' ? PLAN_CREDIT_LIMITS.pro : PLAN_CREDIT_LIMITS.free),
        dailyLimit: 0,                  // 0 = use plan default
        bonusCredits: 0,
        lastResetDate: todayDate,
        lifetimeUsed: 0,
        transactions: [],
      },
    };

    if (userPlan === 'pro') {
      newUserData.planExpiresAt = Date.now() + daysNum * 24 * 60 * 60 * 1000;
      newUserData.planSource = 'manual';
    } else {
      newUserData.planExpiresAt = 0;
      newUserData.planSource = null;
    }

    const created = await User.create(newUserData);

    return NextResponse.json({
      success: true,
      message: `Account created for ${created.email}. ${userPlan === 'pro' ? `Pro plan active for ${daysNum} days.` : 'Free plan.'}`,
      user: {
        id: created._id.toString(),
        name: created.name,
        email: created.email,
        role: created.role,
        plan: created.plan,
        planSource: created.planSource || null,
        planExpiresAt: created.planExpiresAt || 0,
        isVerified: created.isVerified,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    if (message.includes('duplicate key') || message.includes('E11000')) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }
    console.error('[Admin Create User Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
