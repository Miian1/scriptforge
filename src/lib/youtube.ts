// ── YouTube API Helper ───────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// ── Token Refresh ────────────────────────────────────────

export async function refreshYouTubeToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error('YouTube token refresh failed');
  }

  const data = await res.json();
  return data.access_token;
}

// ── Channel Info ─────────────────────────────────────────

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

export async function fetchChannel(accessToken: string): Promise<YouTubeChannel> {
  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    throw new Error(`YouTube API error: ${status}`);
  }

  const data = await res.json();

  if (!data.items?.length) {
    throw new Error('No YouTube channel found for this account');
  }

  const ch = data.items[0];
  return {
    id: ch.id,
    title: ch.snippet.title,
    description: ch.snippet.description || '',
    thumbnail: ch.snippet.thumbnails.high?.url || ch.snippet.thumbnails.medium?.url || ch.snippet.thumbnails.default?.url || '',
    subscriberCount: parseInt(ch.statistics.subscriberCount) || 0,
    videoCount: parseInt(ch.statistics.videoCount) || 0,
    viewCount: parseInt(ch.statistics.viewCount) || 0,
  };
}

// ── Recent Videos ────────────────────────────────────────

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
}

export async function fetchRecentVideos(accessToken: string, maxResults = 10): Promise<YouTubeVideo[]> {
  // Step 1: Search for user's recent videos
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=${maxResults}&mine=true`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const status = searchRes.status;
    if (status === 401 || status === 403) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    throw new Error(`YouTube search API error: ${status}`);
  }

  const searchData = await searchRes.json();
  if (!searchData.items?.length) return [];

  const videoIds = searchData.items.map((v: Record<string, unknown>) => (v.id as Record<string, string>).videoId).join(',');

  // Step 2: Get video details with statistics
  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`;
  const videosRes = await fetch(videosUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!videosRes.ok) {
    throw new Error(`YouTube videos API error: ${videosRes.status}`);
  }

  const videosData = await videosRes.json();

  return (videosData.items || []).map((v: Record<string, unknown>) => {
    const snippet = v.snippet as Record<string, unknown>;
    const stats = v.statistics as Record<string, string>;
    const thumbs = (snippet.thumbnails as Record<string, Record<string, string>>) || {};

    return {
      id: v.id as string,
      title: (snippet.title as string) || 'Untitled',
      thumbnail: thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || '',
      publishedAt: (snippet.publishedAt as string) || '',
      views: parseInt(stats.viewCount) || 0,
      likes: parseInt(stats.likeCount) || 0,
      comments: parseInt(stats.commentCount) || 0,
    };
  });
}

// ── Revoke Token (on disconnect) ─────────────────────────

export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`);
  } catch {
    // Ignore revoke errors
  }
}

// ── Auth URL Builder ─────────────────────────────────────

export function buildYouTubeAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid',
      'email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Exchange Code for Tokens ─────────────────────────────

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to exchange authorization code');
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
  };
}