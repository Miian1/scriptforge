import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { YouTubeCache } from '@/lib/models/YouTubeCache';
import { getSession } from '@/lib/auth';
import { revokeToken } from '@/lib/youtube';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId);

    if (user?.youtube?.accessToken) {
      // Revoke the token on Google's side
      await revokeToken(user.youtube.accessToken);
    }

    // Clear YouTube data from user
    await User.findByIdAndUpdate(session.userId, {
      'youtube.connected': false,
      'youtube.accessToken': null,
      'youtube.refreshToken': null,
    });

    // Clear cached YouTube data
    await YouTubeCache.deleteOne({ userId: session.userId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}