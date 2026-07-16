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
  // Step 1: Get the channel's uploads playlist ID
  const channelUrl = 'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true';
  const channelRes = await fetch(channelUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!channelRes.ok) {
    const status = channelRes.status;
    if (status === 401 || status === 403) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    throw new Error(`YouTube channel API error: ${status}`);
  }

  const channelData = await channelRes.json();
  if (!channelData.items?.length) return [];

  const uploadsPlaylistId = channelData.items[0].contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  // Step 2: Fetch videos from the uploads playlist
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,status&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`;
  const playlistRes = await fetch(playlistUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!playlistRes.ok) {
    const status = playlistRes.status;
    if (status === 401 || status === 403) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    throw new Error(`YouTube playlist API error: ${status}`);
  }

  const playlistData = await playlistRes.json();
  const playlistItems = (playlistData.items || []).filter(
    (item: Record<string, unknown>) => (item.status as Record<string, string>)?.privacyStatus !== 'private'
  );

  if (!playlistItems.length) return [];

  // Step 3: Get video IDs and fetch statistics in batch
  const videoIds = playlistItems
    .map((item: Record<string, unknown>) => (item.snippet as Record<string, Record<string, string>>)?.resourceId?.videoId)
    .filter(Boolean)
    .join(',');

  if (!videoIds) return [];

  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}`;
  const statsRes = await fetch(statsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let statsMap: Record<string, Record<string, string>> = {};
  if (statsRes.ok) {
    const statsData = await statsRes.json();
    (statsData.items || []).forEach((v: Record<string, unknown>) => {
      statsMap[v.id as string] = v.statistics as Record<string, string>;
    });
  }

  // Step 4: Merge playlist data with stats
  return playlistItems.map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown>;
    const thumbs = (snippet.thumbnails as Record<string, Record<string, string>>) || {};
    const videoId = (snippet as Record<string, Record<string, string>>)?.resourceId?.videoId || '';
    const stats = statsMap[videoId] || {};

    return {
      id: videoId,
      title: (snippet.title as string) || 'Untitled',
      thumbnail: thumbs.high?.url || thumbs.medium?.url || (thumbs.default?.url || '') || thumbs.standard?.url || '',
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