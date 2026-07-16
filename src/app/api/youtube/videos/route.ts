import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { YouTubeCache } from '@/lib/models/YouTubeCache';
import { getSession } from '@/lib/auth';
import { fetchRecentVideos, refreshYouTubeToken } from '@/lib/youtube';

// Cache TTL: 15 minutes for videos
const VIDEOS_CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(req: NextRequest) {
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

    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cache = await YouTubeCache.findOne({ userId: session.userId });
      if (cache?.videos?.length && cache.videosFetchedAt) {
        const age = Date.now() - new Date(cache.videosFetchedAt).getTime();
        if (age < VIDEOS_CACHE_TTL_MS) {
          return NextResponse.json({ videos: cache.videos, cached: true });
        }
      }
    }

    // Fetch from YouTube API
    let accessToken = user.youtube.accessToken;

    try {
      const videos = await fetchRecentVideos(accessToken);

      // Silently save to cache
      await YouTubeCache.findOneAndUpdate(
        { userId: session.userId },
        {
          videos,
          videosFetchedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({ videos, cached: false });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && user.youtube?.refreshToken) {
        accessToken = await refreshYouTubeToken(user.youtube.refreshToken);
        await User.findByIdAndUpdate(session.userId, { 'youtube.accessToken': accessToken });

        const videos = await fetchRecentVideos(accessToken);

        // Silently save to cache
        await YouTubeCache.findOneAndUpdate(
          { userId: session.userId },
          {
            videos,
            videosFetchedAt: new Date(),
          },
          { upsert: true, new: true }
        );

        return NextResponse.json({ videos, cached: false });
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch videos';
    console.error('[YouTube Videos Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}