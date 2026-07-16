import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { fetchChannel, refreshYouTubeToken } from '@/lib/youtube';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user?.youtube?.connected || !user.youtube?.accessToken) {
      return NextResponse.json({ error: 'YouTube not connected' }, { status: 404 });
    }

    let accessToken = user.youtube.accessToken;

    try {
      const channel = await fetchChannel(accessToken);
      return NextResponse.json({ channel });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && user.youtube?.refreshToken) {
        // Token expired — refresh and retry
        accessToken = await refreshYouTubeToken(user.youtube.refreshToken);
        await User.findByIdAndUpdate(session.userId, { 'youtube.accessToken': accessToken });

        const channel = await fetchChannel(accessToken);
        return NextResponse.json({ channel });
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch channel';
    console.error('[YouTube Channel Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}