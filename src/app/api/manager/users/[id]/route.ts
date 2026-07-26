import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

// PUT /api/manager/users/[id]
// Manager edits a user's plan. This is a SCOPED version of the admin route:
//   ✅ Allowed: change plan (free <-> pro), add/reduce/set days
//   ❌ NOT allowed: change role, delete user, change isCustomPlan/customPlan
//
// The 'custom plan' concept has been removed from the UI entirely. Managers
// can only assign Free or Pro. Pro assigned by a manager is always
// planSource='manual' (Easypaisa/JazzCash/offline payment).
//
// body: { plan?, addDays?, reduceDays?, setDays? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden. Manager access required.' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const body = await req.json();
    const { plan, addDays, reduceDays, setDays } = body;

    await connectDB();

    // Manager can only edit standard users — not admins or other managers
    const user = await User.findById(id).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role !== 'user') {
      return NextResponse.json(
        { error: 'Managers can only edit standard user accounts.' },
        { status: 403 }
      );
    }

    const update: Record<string, unknown> = {};

    // ── Plan change (free <-> pro only — no custom) ──
    if (plan && ['free', 'pro'].includes(plan)) {
      update.plan = plan;
      if (plan === 'free') {
        // Downgrade clears everything
        update.planExpiresAt = 0;
        update.planSource = null;
        update.isCustomPlan = false;
        update.customPlan = { isCustom: false, customLabel: '', customDays: 0 };
      } else if (plan === 'pro' && user.plan !== 'pro') {
        // Upgrading free → pro via manager = manual source
        update.planSource = 'manual';
      }
    }

    // ── Add days to existing expiry ──
    if (typeof addDays === 'number' && addDays > 0) {
      const base =
        user.planExpiresAt && user.planExpiresAt > Date.now()
          ? user.planExpiresAt
          : Date.now();
      update.planExpiresAt = base + addDays * 24 * 60 * 60 * 1000;
      if (user.plan !== 'pro') update.plan = 'pro';
      if (!user.stripe?.subscriptionId) update.planSource = 'manual';
    }

    // ── Reduce days from existing expiry ──
    if (typeof reduceDays === 'number' && reduceDays > 0) {
      if (user.planExpiresAt && user.planExpiresAt > Date.now()) {
        const reduced = user.planExpiresAt - reduceDays * 24 * 60 * 60 * 1000;
        const newExpiry = Math.max(Date.now(), reduced);
        update.planExpiresAt = newExpiry;
        if (newExpiry <= Date.now()) {
          update.plan = 'free';
          update.planExpiresAt = 0;
          update.planSource = null;
          update.isCustomPlan = false;
          update.customPlan = { isCustom: false, customLabel: '', customDays: 0 };
        }
      }
    }

    // ── Set exact number of days from now ──
    if (typeof setDays === 'number') {
      if (setDays <= 0) {
        update.plan = 'free';
        update.planExpiresAt = 0;
        update.planSource = null;
        update.isCustomPlan = false;
        update.customPlan = { isCustom: false, customLabel: '', customDays: 0 };
      } else {
        update.planExpiresAt = Date.now() + setDays * 24 * 60 * 60 * 1000;
        if (user.plan !== 'pro') update.plan = 'pro';
        if (!user.stripe?.subscriptionId) update.planSource = 'manual';
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    // Managers are never allowed to touch role/isCustomPlan — strip them defensively
    delete update.role;

    const updatedUser = await User.findByIdAndUpdate(id, update, { new: true }).select('-password');
    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    const now = Date.now();
    const expiry = updatedUser.planExpiresAt || 0;
    const stripePeriodEnd = updatedUser.stripe?.currentPeriodEnd || 0;
    let effectiveExpiry = expiry;
    if (updatedUser.plan === 'pro' && stripePeriodEnd > 0) {
      if (expiry === 0 || Math.abs(expiry - stripePeriodEnd) > 24 * 60 * 60 * 1000) {
        effectiveExpiry = stripePeriodEnd;
      }
    }
    const diff = effectiveExpiry - now;
    const daysLeft = updatedUser.plan === 'pro' && diff > 0
      ? Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      : 0;

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        plan: updatedUser.plan,
        planExpiresAt: effectiveExpiry,
        planDaysLeft: daysLeft,
        planSource: updatedUser.planSource || null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    console.error('[Manager Update User Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// NOTE: DELETE is intentionally NOT implemented.
// Managers cannot delete users — only admins can (via /api/admin/users/[id]).
