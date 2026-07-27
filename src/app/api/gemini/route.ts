import { NextRequest, NextResponse } from 'next/server';
import { getActiveModelId } from '@/lib/get-active-model';
import { requireCredits, refundCredits } from '@/lib/credits';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FALLBACK_MODEL = 'gemini-2.5-flash';

export async function POST(request: NextRequest) {
  try {
    // ── Credit guard ──
    // This route is the main text-generation endpoint. Every call costs 1 credit.
    // The deduction is performed atomically inside requireCredits — if the call
    // below fails, we refund the credit so the user isn't penalised for our errors.
    const guard = await requireCredits('TEXT_GENERATION');
    if (!guard.ok || !guard.userId) {
      return NextResponse.json(
        { error: guard.error || 'Access denied', code: guard.status === 429 ? 'CREDITS_EXHAUSTED' : undefined },
        { status: guard.status },
      );
    }
    const userId = guard.userId;

    if (!GEMINI_API_KEY) {
      await refundCredits(userId, 'TEXT_GENERATION');
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { prompt, maxTokens } = body;

    if (!prompt || typeof prompt !== 'string') {
      await refundCredits(userId, 'TEXT_GENERATION');
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    const modelId = await getActiveModelId('text').catch(() => FALLBACK_MODEL);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

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
      // Refund on server-side Gemini error — the user didn't get their result.
      await refundCredits(userId, 'TEXT_GENERATION');
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
      await refundCredits(userId, 'TEXT_GENERATION');
      return NextResponse.json({ error: 'Empty response from Gemini.' }, { status: 502 });
    }

    return NextResponse.json({
      text,
      credits: guard.state,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}