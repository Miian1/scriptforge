import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

// PUT /api/admin/users/[id] — update user plan, days, custom flag
// body: { plan?, planExpiresAt?, isCustomPlan?, customPlan? }
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
    const { plan, planExpiresAt, isCustomPlan, customPlan, role } = body;

    await connectDB();

    const user = await User.findById(id).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update object
    const update: Record<string, unknown> = {};

    // Update plan
    if (plan && ['free', 'pro'].includes(plan)) {
      update.plan = plan;
      // If downgrading to free, clear expiry
      if (plan === 'free') {
        update.planExpiresAt = 0;
        update.isCustomPlan = false;
        update.customPlan = { isCustom: false, customLabel: '', customDays: 0 };
      }
      // If upgrading to pro and no expiry set, default to 30 days
      if (plan === 'pro' && !planExpiresAt && (!user.planExpiresAt || user.planExpiresAt <= Date.now())) {
        update.planExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      }
    }

    // Set plan expiry (days from now)
    if (planExpiresAt !== undefined && planExpiresAt !== null) {
      update.planExpiresAt = planExpiresAt;
    }

    // Add days to existing expiry
    if (body.addDays && typeof body.addDays === 'number' && body.addDays > 0) {
      const currentExpiry = user.planExpiresAt && user.planExpiresAt > Date.now()
        ? user.planExpiresAt
        : Date.now();
      update.planExpiresAt = currentExpiry + body.addDays * 24 * 60 * 60 * 1000;
      // Ensure plan is pro when adding days
      if (user.plan !== 'pro') {
        update.plan = 'pro';
      }
    }

    // Custom plan flag
    if (isCustomPlan !== undefined) {
      update.isCustomPlan = isCustomPlan;
    }

    // Custom plan details
    if (customPlan && typeof customPlan === 'object') {
      update.customPlan = {
        isCustom: customPlan.isCustom ?? user.customPlan?.isCustom ?? false,
        customLabel: customPlan.customLabel || user.customPlan?.customLabel || '',
        customDays: customPlan.customDays || user.customPlan?.customDays || 0,
      };
    }

    // Update role (admin can promote/demote)
    if (role && ['user', 'admin'].includes(role)) {
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
    const daysLeft = updatedUser.plan === 'pro' && expiry > 0
      ? Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)))
      : 0;

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        plan: updatedUser.plan,
        planExpiresAt: expiry,
        planDaysLeft: daysLeft,
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
