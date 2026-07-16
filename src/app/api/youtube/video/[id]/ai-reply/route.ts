import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { fetchVideoDetails, postCommentReply, refreshYouTubeToken } from '@/lib/youtube';
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
    const { commentId, commentText } = body;

    if (!videoId || !commentId || !commentText) {
      return NextResponse.json({ error: 'videoId, commentId, and commentText are required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user?.youtube?.connected || !user.youtube?.accessToken) {
      return NextResponse.json({ error: 'YouTube not connected' }, { status: 404 });
    }

    let accessToken = user.youtube.accessToken;

    // Fetch video context for Gemini (with token refresh retry)
    let videoDetails;
    try {
      videoDetails = await fetchVideoDetails(accessToken, videoId);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && user.youtube?.refreshToken) {
        accessToken = await refreshYouTubeToken(user.youtube.refreshToken);
        await User.findByIdAndUpdate(session.userId, { 'youtube.accessToken': accessToken });
        videoDetails = await fetchVideoDetails(accessToken, videoId);
      } else {
        throw err;
      }
    }

    // Build Gemini prompt
    const prompt = `You are a YouTube channel owner replying to a comment on your video. Generate a professional, engaging, and authentic reply.

## Video Context
- Title: ${videoDetails.title}
- Description: ${videoDetails.description?.slice(0, 1000) || 'No description'}
- Tags: ${videoDetails.tags?.join(', ') || 'None'}
- Views: ${videoDetails.views}
- Likes: ${videoDetails.likes}

## Comment to Reply To
"${commentText}"

## Instructions
- Reply as the channel owner, be genuine and engaging
- Keep the reply concise (1-3 sentences)
- Be helpful, friendly, or grateful as appropriate
- If the comment is a question, answer it helpfully
- If the comment is positive, thank them
- If the comment is negative, respond professionally without being defensive
- Do NOT use hashtags, emojis, or promotional language
- Return ONLY the reply text, nothing else`;

    // Call Gemini (this also checks/increments AI usage)
    const replyText = await geminiServerCall({ prompt, maxTokens: 512, jsonMode: false });

    // Clean up the reply (remove quotes if Gemini wraps it)
    const cleanReply = replyText.trim().replace(/^["']|["']$/g, '');

    // Post the reply to YouTube
    try {
      await postCommentReply(accessToken, commentId, cleanReply);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && user.youtube?.refreshToken) {
        accessToken = await refreshYouTubeToken(user.youtube.refreshToken);
        await User.findByIdAndUpdate(session.userId, { 'youtube.accessToken': accessToken });
        await postCommentReply(accessToken, commentId, cleanReply);
      } else {
        // If posting fails, return the generated reply so user can copy-paste it
        return NextResponse.json({
          reply: cleanReply,
          posted: false,
          error: e.message,
          message: 'AI reply generated but failed to post. You can copy and post it manually.',
        });
      }
    }

    return NextResponse.json({ reply: cleanReply, posted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI reply';
    console.error('[AI Reply Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}