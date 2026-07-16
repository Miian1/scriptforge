import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { fetchVideoComments, refreshYouTubeToken } from '@/lib/youtube';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user?.youtube?.connected || !user.youtube?.accessToken) {
      return NextResponse.json({ error: 'YouTube not connected' }, { status: 404 });
    }

    let accessToken = user.youtube.accessToken;

    try {
      const comments = await fetchVideoComments(accessToken, id);
      return NextResponse.json({ comments });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && user.youtube?.refreshToken) {
        accessToken = await refreshYouTubeToken(user.youtube.refreshToken);
        await User.findByIdAndUpdate(session.userId, { 'youtube.accessToken': accessToken });
        const comments = await fetchVideoComments(accessToken, id);
        return NextResponse.json({ comments });
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch comments';
    console.error('[Video Comments Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}