// ── Server-side Gemini helper ──────────────────────────
// Used by AI reply and improve-description routes.
// Directly calls the Gemini API (bypasses /api/gemini client route).

import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { PLAN_LIMITS, resetIfNewDay } from '@/lib/usage';
import { getSession } from '@/lib/auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

export interface GeminiCallOptions {
  prompt: string;
  maxTokens?: number;
  jsonMode?: boolean; // default true
}

export async function geminiServerCall(
  { prompt, maxTokens = 4096, jsonMode = false }: GeminiCallOptions,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  // Usage check
  await connectDB();
  const user = await User.findById(session.userId);
  if (!user) throw new Error('User not found');

  const plan = user.plan || 'free';
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  const usage = resetIfNewDay(user.dailyUsage, plan as 'free' | 'pro');

  const isLifetime = plan === 'free';
  if (usage.aiGenerations >= limits.aiGenerationsPerDay) {
    throw new Error(isLifetime
      ? `You've used all ${limits.aiGenerationsPerDay} AI generations on the Free plan. Upgrade to Pro for 100 daily generations.`
      : `Daily AI limit reached (${limits.aiGenerationsPerDay}). Upgrade to Pro for more.`);
  }

  // Increment usage
  user.dailyUsage = { ...usage, aiGenerations: usage.aiGenerations + 1 };
  await user.save();

  // Call Gemini
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
        maxOutputTokens: maxTokens,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: { message: `Gemini error: ${res.status}` } }));
    const msg = (errData as Record<string, Record<string, string>>)?.error?.message || `Gemini API error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('Empty response from Gemini.');
  return text;
}