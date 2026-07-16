import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { fetchVideoDetails, updateVideoMetadata, refreshYouTubeToken } from '@/lib/youtube';
import { geminiServerCall } from '@/lib/gemini-server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id: videoId } = await params;
    const body = await req.json();
    const { type } = body as { type: 'description' | 'tags' | 'both' };

    if (!videoId || !type) {
      return NextResponse.json({ error: 'videoId and type are required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user?.youtube?.connected || !user.youtube?.accessToken) {
      return NextResponse.json({ error: 'YouTube not connected' }, { status: 404 });
    }

    let accessToken = user.youtube.accessToken;

    // Fetch video context
    const videoDetails = await fetchVideoDetails(accessToken, videoId);

    // Build prompt based on type
    let prompt = '';
    if (type === 'description' || type === 'both') {
      prompt += `You are a YouTube SEO expert. Improve this video's description to maximize reach and engagement.

## Current Video Info
- Title: ${videoDetails.title}
- Current Description:
${videoDetails.description || 'No description'}

## Task
Write an improved, SEO-optimized YouTube description. Include:
1. A compelling first 2 lines (visible before "Show More")
2. Relevant keywords naturally woven in
3. A call-to-action (subscribe, like, etc.)
4. Relevant hashtags at the end (3-5 max)

Return ONLY a JSON object: { "description": "your improved description here" }`;
    }

    if (type === 'tags' || type === 'both') {
      if (type === 'both') prompt += '\n\n---\n\n';

      prompt += `You are a YouTube SEO expert. Generate optimized tags for this video.

## Current Video Info
- Title: ${videoDetails.title}
- Current Tags: ${videoDetails.tags?.join(', ') || 'None'}
- Description: ${videoDetails.description?.slice(0, 500) || 'No description'}

## Task
Generate 15-25 highly relevant, optimized YouTube tags. Mix broad and specific tags. Include trending and long-tail keywords.

Return ONLY a JSON object: { "tags": ["tag1", "tag2", ...] }`;
    }

    const responseText = await geminiServerCall({ prompt, maxTokens: 4096, jsonMode: true });

    // Parse JSON from response
    let improvedDescription: string | null = null;
    let improvedTags: string[] | null = null;

    try {
      // Try direct parse
      const parsed = JSON.parse(responseText);
      if (parsed.description) improvedDescription = parsed.description;
      if (parsed.tags) improvedTags = Array.isArray(parsed.tags) ? parsed.tags : null;
    } catch {
      // Try extracting JSON from text
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.description) improvedDescription = parsed.description;
          if (parsed.tags) improvedTags = Array.isArray(parsed.tags) ? parsed.tags : null;
        } catch { /* ignore */ }
      }
    }

    return NextResponse.json({
      description: improvedDescription,
      tags: improvedTags,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to improve metadata';
    console.error('[Improve Metadata Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: Apply the improved metadata to YouTube
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id: videoId } = await params;
    const body = await req.json();
    const { description, tags } = body as { description?: string; tags?: string[] };

    if (!videoId || (!description && !tags)) {
      return NextResponse.json({ error: 'videoId and at least description or tags are required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user?.youtube?.connected || !user.youtube?.accessToken) {
      return NextResponse.json({ error: 'YouTube not connected' }, { status: 404 });
    }

    let accessToken = user.youtube.accessToken;

    try {
      await updateVideoMetadata(accessToken, videoId, { description, tags });
      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && user.youtube?.refreshToken) {
        accessToken = await refreshYouTubeToken(user.youtube.refreshToken);
        await User.findByIdAndUpdate(session.userId, { 'youtube.accessToken': accessToken });
        await updateVideoMetadata(accessToken, videoId, { description, tags });
        return NextResponse.json({ success: true });
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update metadata';
    console.error('[Update Metadata Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}