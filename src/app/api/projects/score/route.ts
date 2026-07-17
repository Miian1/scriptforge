import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ProjectModel } from '@/lib/models/Project';
import { User } from '@/lib/models/User';
import { YouTubeCache } from '@/lib/models/YouTubeCache';
import { getSession } from '@/lib/auth';
import { PLAN_LIMITS, resetIfNewDay } from '@/lib/usage';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId } = body;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    await connectDB();

    // Fetch user and check plan
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plan = user.plan || 'free';
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
    const usage = resetIfNewDay(user.dailyUsage, plan as 'free' | 'pro');
    const isLifetime = plan === 'free';

    if (usage.aiGenerations >= limits.aiGenerationsPerDay) {
      return NextResponse.json({
        error: isLifetime
          ? `You've used all ${limits.aiGenerationsPerDay} AI generations on the Free plan. Upgrade to Pro for 100 daily generations.`
          : `Daily AI limit reached (${limits.aiGenerationsPerDay}). Upgrade to Pro for more.`,
      }, { status: 429 });
    }

    // Fetch project
    const project = await ProjectModel.findOne({
      _id: projectId,
      userId: session.userId,
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch YouTube channel data if connected
    let channelContext = '';
    if (user.youtube?.connected) {
      const cache = await YouTubeCache.findOne({ userId: session.userId });
      if (cache?.channel) {
        const ch = JSON.parse(JSON.stringify(cache.channel));
        channelContext = `
## Creator's Channel Context
- Channel: ${ch.title || 'Unknown'}
- Subscribers: ${ch.subscriberCount || 0}
- Total Views: ${ch.viewCount || 0}
- Total Videos: ${ch.videoCount || 0}
- Channel Description: ${ch.description || 'N/A'}`;

        // Add recent video titles/trends if available
        if (cache.videos && cache.videos.length > 0) {
          const vids = JSON.parse(JSON.stringify(cache.videos)).slice(0, 5);
          channelContext += `\n- Recent Videos: ${vids.map((v: { title: string; views: number }) => `"${v.title}" (${v.views} views)`).join(', ')}`;
        }
      }
    }

    // Build prompt
    const prompt = `You are a YouTube content strategy expert and AI analyst. Score the following video project for its potential success on YouTube.

${channelContext}

## Video Project to Score
- Title: ${project.title}
- Topic: ${project.topic}
- Description: ${project.description || 'No description'}
- Duration Setting: ${project.settings?.duration || 'medium'}
- Theme: ${project.settings?.theme || 'cinematic'}
- Writing Style: ${project.settings?.writingStyle || 'conversational'}
- Target Audience: ${project.settings?.targetAudience || 'general'}
- Language: ${project.settings?.language || 'english'}
- Tags: ${Array.isArray(project.tags) && project.tags.length > 0 ? project.tags.join(', ') : 'No tags yet'}

${channelContext ? `\nAnalyze this project considering the creator's channel niche, existing content, and audience.\nConsider trending topics in the "${project.topic}" niche.\n` : '\nAnalyze this project for general YouTube success potential.\n'}

## Scoring Criteria (each 0-100)
1. **titleScore** — How catchy, SEO-friendly, and click-worthy the title is
2. **descriptionScore** — How well the description supports discovery and engagement
3. **tagsScore** — Quality and relevance of tags for YouTube SEO
4. **nicheFit** — How well this fits the creator's channel niche and audience expectations
5. **trendScore** — Alignment with current YouTube trends in this topic area
6. **engagementScore** — Predicted viewer engagement (retention, CTR, likes/comments)
7. **seoScore** — Overall search optimization potential
8. **overallScore** — Weighted average of all factors

## IMPORTANT
- Return ONLY valid JSON — no markdown, no code fences.
- Be honest and constructive. Average videos score 50-70. Great videos score 75-90. Rare masterpieces score 90+.
- If tags are empty, score tagsScore as 0.
- If description is empty, score descriptionScore low (10-30).
- Provide a brief 1-2 sentence "tip" for the lowest-scoring area.

Return JSON in this exact format:
{
  "titleScore": number,
  "descriptionScore": number,
  "tagsScore": number,
  "nicheFit": number,
  "trendScore": number,
  "engagementScore": number,
  "seoScore": number,
  "overallScore": number,
  "tip": "string - one actionable improvement tip"
}`;

    // Call Gemini
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: { message: `Gemini error: ${res.status}` } }));
      const msg = (errData as Record<string, Record<string, string>>)?.error?.message || `Gemini API error: ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 500 });
    }

    // Parse and validate scores
    let scores;
    try {
      scores = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Clamp all scores to 0-100
    const scoreKeys = ['titleScore', 'descriptionScore', 'tagsScore', 'nicheFit', 'trendScore', 'engagementScore', 'seoScore', 'overallScore'];
    for (const key of scoreKeys) {
      if (typeof scores[key] !== 'number') scores[key] = 50;
      scores[key] = Math.max(0, Math.min(100, Math.round(scores[key])));
    }

    // Increment usage
    user.dailyUsage = { ...usage, aiGenerations: usage.aiGenerations + 1 };
    await user.save();

    return NextResponse.json({ scores });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}