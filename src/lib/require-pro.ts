// ── Plan-gate helper ───────────────────────────────────
// Shared server-side guard for routes that should only be
// accessible to Pro-plan users (e.g. voice generation).
//
// Usage:
//   import { requirePro } from '@/lib/require-pro';
//   const guard = await requirePro();
//   if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
//   const userId = guard.userId; // proceed with route logic
//
// Admin and manager roles ALWAYS bypass the Pro requirement — they
// are staff accounts and should be able to test/demo features.

import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export interface ProGuardResult {
  ok: boolean;
  userId?: string;
  error?: string;
  status: number;
}

export async function requirePro(): Promise<ProGuardResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Not authenticated', status: 401 };
  }

  await connectDB();
  const user = await User.findById(session.userId).select('role plan planExpiresAt stripe');
  if (!user) {
    return { ok: false, error: 'User not found', status: 404 };
  }

  // Staff bypass: admins and managers can always use Pro-only features
  // (they're trusted internal accounts, often created to test or support).
  if (user.role === 'admin' || user.role === 'manager') {
    return { ok: true, userId: session.userId, status: 200 };
  }

  // Check Pro plan
  if (user.plan !== 'pro') {
    return {
      ok: false,
      error: 'Voice generation is a Pro-only feature. Please upgrade to the Pro plan to access AI voice generation.',
      status: 403,
    };
  }

  // Check plan expiry — if Pro but period already expired, treat as free.
  // Use whichever expiry source is the most recent truth.
  const stripeEnd = user.stripe?.currentPeriodEnd || 0;
  const planEnd = user.planExpiresAt || 0;
  const effectiveEnd = Math.max(stripeEnd, planEnd);

  if (effectiveEnd > 0 && Date.now() > effectiveEnd) {
    return {
      ok: false,
      error: 'Your Pro plan has expired. Please renew to access voice generation.',
      status: 403,
    };
  }

  return { ok: true, userId: session.userId, status: 200 };
}
