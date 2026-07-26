import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

// PUT /api/admin/users/[id] — update user plan, days, custom flag
// body: { plan?, planExpiresAt?, isCustomPlan?, customPlan?, role?, addDays?, setDays?, reduceDays? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const body = await req.json();
    const { plan, planExpiresAt, isCustomPlan, customPlan, role, setDays, reduceDays } = body;

    await connectDB();

    const user = await User.findById(id).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update object
    const update: Record<string, unknown> = {};

    // ── Plan change ──
    if (plan && ['free', 'pro'].includes(plan)) {
      update.plan = plan;
      // If downgrading to free, clear everything
      if (plan === 'free') {
        update.planExpiresAt = 0;
        update.planSource = null;
        update.isCustomPlan = false;
        update.customPlan = { isCustom: false, customLabel: '', customDays: 0 };
      } else if (plan === 'pro' && user.plan !== 'pro') {
        // Upgrading free → pro via admin = manual source
        update.planSource = 'manual';
      }
    }

    // ── Set exact expiry timestamp ──
    if (planExpiresAt !== undefined && planExpiresAt !== null) {
      update.planExpiresAt = planExpiresAt;
    }

    // ── Add days to existing expiry ──
    if (body.addDays && typeof body.addDays === 'number' && body.addDays > 0) {
      const base = user.planExpiresAt && user.planExpiresAt > Date.now()
        ? user.planExpiresAt
        : Date.now();
      update.planExpiresAt = base + body.addDays * 24 * 60 * 60 * 1000;
      if (user.plan !== 'pro') update.plan = 'pro';
      // Admin adding days = manual upgrade (unless they’re already Stripe)
      if (!user.stripe?.subscriptionId) update.planSource = 'manual';
    }

    // ── Reduce days from existing expiry ──
    if (reduceDays && typeof reduceDays === 'number' && reduceDays > 0) {
      if (user.planExpiresAt && user.planExpiresAt > Date.now()) {
        const reduced = user.planExpiresAt - reduceDays * 24 * 60 * 60 * 1000;
        // Don't go below now
        const newExpiry = Math.max(Date.now(), reduced);
        update.planExpiresAt = newExpiry;
        // If reduced to 0 or below now, downgrade to free
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
    if (setDays !== undefined && setDays !== null && typeof setDays === 'number') {
      if (setDays <= 0) {
        update.plan = 'free';
        update.planExpiresAt = 0;
        update.planSource = null;
        update.isCustomPlan = false;
        update.customPlan = { isCustom: false, customLabel: '', customDays: 0 };
      } else {
        update.planExpiresAt = Date.now() + setDays * 24 * 60 * 60 * 1000;
        if (user.plan !== 'pro') update.plan = 'pro';
        // Admin setting days = manual source (unless already Stripe)
        if (!user.stripe?.subscriptionId) update.planSource = 'manual';
      }
    }

    // ── Custom plan ──
    if (isCustomPlan !== undefined) {
      update.isCustomPlan = isCustomPlan;
    }

    if (customPlan && typeof customPlan === 'object') {
      const newCustomPlan = {
        isCustom: customPlan.isCustom ?? user.customPlan?.isCustom ?? false,
        customLabel: customPlan.customLabel || user.customPlan?.customLabel || '',
        customDays: customPlan.customDays ?? user.customPlan?.customDays ?? 0,
      };

      update.customPlan = newCustomPlan;

      // ── Custom plan priority: when custom is enabled, use customDays as the plan expiry ──
      if (newCustomPlan.isCustom && newCustomPlan.customDays > 0) {
        update.planExpiresAt = Date.now() + newCustomPlan.customDays * 24 * 60 * 60 * 1000;
        update.plan = 'pro'; // custom plans always have pro access
        update.isCustomPlan = true;
        // Custom plans created via admin = manual source (unless Stripe)
        if (!user.stripe?.subscriptionId) update.planSource = 'manual';
      }
    }

    // ── Role ──
    if (role && ['user', 'admin', 'manager'].includes(role)) {
      update.role = role;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

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
    // Days-left: at least 1 if the period hasn't ended yet, 0 only when fully expired.
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
        isCustomPlan: updatedUser.isCustomPlan,
        customPlan: updatedUser.customPlan,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    console.error('[Admin Update User Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — delete a user (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Prevent admin from deleting themselves
    if (id === session.userId) {
      return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 });
    }

    await connectDB();
    const deleted = await User.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `User ${deleted.email} deleted` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    console.error('[Admin Delete User Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
