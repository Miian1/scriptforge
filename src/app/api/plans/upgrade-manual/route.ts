import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { transactionId, note } = body;

    if (!transactionId?.trim()) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.plan === 'pro') {
      return NextResponse.json({ error: 'You already have a Pro plan.' }, { status: 400 });
    }

    // Store the manual payment request on the user document
    // Admin will review and upgrade manually
    (user as unknown as Record<string, unknown>).manualPayment = {
      transactionId: transactionId.trim(),
      note: (note || '').trim(),
      status: 'pending',
      requestedAt: new Date(),
    };
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Payment proof submitted. Admin will verify and upgrade your account.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}