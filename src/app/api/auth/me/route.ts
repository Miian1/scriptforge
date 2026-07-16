import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { formatUserResponse } from '@/lib/usage';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: formatUserResponse(user) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}