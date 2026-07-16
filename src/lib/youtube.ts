// ── YouTube API Helper ───────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';


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

// ── Video Details ───────────────────────────────────

export interface YouTubeVideoDetails extends YouTubeVideo {
  description: string;
  tags: string[];
  categoryId: string;
  duration: string;
  defaultLanguage: string;
}

export async function fetchVideoDetails(accessToken: string, videoId: string): Promise<YouTubeVideoDetails> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    throw new Error(`YouTube video API error: ${status}`);
  }

  const data = await res.json();
  if (!data.items?.length) throw new Error('Video not found');

  const v = data.items[0];
  const s = v.snippet;
  const stats = v.statistics;
  const thumbs = s.thumbnails || {};

  return {
    id: v.id,
    title: s.title || 'Untitled',
    thumbnail: thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || '',
    publishedAt: s.publishedAt || '',
    views: parseInt(stats.viewCount) || 0,
    likes: parseInt(stats.likeCount) || 0,
    comments: parseInt(stats.commentCount) || 0,
    description: s.description || '',
    tags: s.tags || [],
    categoryId: s.categoryId || '',
    duration: (v.contentDetails?.duration as string) || '',
    defaultLanguage: s.defaultLanguage || s.defaultAudioLanguage || '',
  };
}

// ── Video Comments ─────────────────────────────────────

export interface YouTubeComment {
  id: string;
  threadId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
  totalReplyCount: number;
}

export async function fetchVideoComments(accessToken: string, videoId: string, maxResults = 50): Promise<YouTubeComment[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&textFormat=plainText`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const status = res.status;
    // 403 from comments API often means comments are disabled — return empty
    if (status === 403) return [];
    if (status === 401) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    throw new Error(`YouTube comments API error: ${status}`);
  }

  const data = await res.json();
  if (!data.items?.length) return [];

  return data.items.map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, Record<string, unknown>>;
    const topComment = snippet.topLevelComment as Record<string, Record<string, unknown>>;
    const cs = topComment.snippet as Record<string, unknown>;
    const authorThumbs = (cs.authorProfileImageUrl as string) || '';

    return {
      id: topComment.id as string,
      threadId: item.id as string,
      authorName: (cs.authorDisplayName as string) || 'Unknown',
      authorAvatar: authorThumbs,
      text: (cs.textDisplay as string) || '',
      likeCount: parseInt(cs.likeCount as string) || 0,
      publishedAt: (cs.publishedAt as string) || '',
      updatedAt: (cs.updatedAt as string) || '',
      totalReplyCount: parseInt(snippet.totalReplyCount as string) || 0,
    };
  });
}

// ── Post Comment Reply ─────────────────────────────────

export async function postCommentReply(accessToken: string, parentId: string, text: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: {
        parentId,
        textOriginal: text,
      },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    const errData = await res.json().catch(() => ({ error: { message: `YouTube API error: ${status}` } }));
    throw new Error((errData as Record<string, Record<string, string>>)?.error?.message || `Failed to post reply (${status})`);
  }

  const data = await res.json();
  return data.id;
}

// ── Update Video Metadata (description, tags, title) ────

export async function updateVideoMetadata(
  accessToken: string,
  videoId: string,
  updates: { title?: string; description?: string; tags?: string[]; categoryId?: string }
): Promise<void> {
  // First get current snippet to preserve fields we're not updating
  const currentRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!currentRes.ok) {
    throw new Error('Failed to fetch current video data for update');
  }

  const currentData = await currentRes.json();
  if (!currentData.items?.length) throw new Error('Video not found for update');

  const currentSnippet = currentData.items[0].snippet;

  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        title: updates.title || currentSnippet.title,
        description: updates.description !== undefined ? updates.description : currentSnippet.description,
        tags: updates.tags !== undefined ? updates.tags : currentSnippet.tags || [],
        categoryId: updates.categoryId || currentSnippet.categoryId || '22',
        defaultLanguage: currentSnippet.defaultLanguage || undefined,
      },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      const err: Error & { status?: number } = new Error('YouTube auth expired');
      err.status = 401;
      throw err;
    }
    throw new Error(`Failed to update video (${status})`);
  }
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
      'https://www.googleapis.com/auth/youtube',
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