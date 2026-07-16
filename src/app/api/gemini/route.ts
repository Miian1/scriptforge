import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { PLAN_LIMITS, resetIfNewDay } from '@/lib/usage';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 500 }
      );
    }

    // ── Usage limit check ──
    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plan = user.plan || 'free';
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
    const usage = resetIfNewDay(user.dailyUsage);

    if (usage.aiGenerations >= limits.aiGenerationsPerDay) {
      return NextResponse.json({
        error: `You've reached your daily AI generation limit (${limits.aiGenerationsPerDay}). Upgrade to Pro for 10x more generations.`,
        code: 'PLAN_LIMIT_REACHED',
      }, { status: 429 });
    }

    // Increment AI usage
    user.dailyUsage = { ...usage, aiGenerations: usage.aiGenerations + 1 };
    await user.save();

    const body = await request.json();
    const { prompt, maxTokens } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: maxTokens || 65536,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: { message: `Gemini API error: ${res.status}` } }));
      const message = (errorData as Record<string, Record<string, string>>)?.error?.message || `Gemini API error: ${res.status}`;

      if (res.status === 429) {
        return NextResponse.json({ error: message, retryAfter: true }, { status: 429 });
      }

      return NextResponse.json({ error: message }, { status: res.status });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json({ error: 'Empty response from Gemini.' }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}