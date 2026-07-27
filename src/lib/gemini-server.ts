// ── Server-side Gemini helper ──────────────────────────
// Used by AI reply and improve-description routes.
// Directly calls the Gemini API (bypasses /api/gemini client route).
//
// Credit deduction is delegated to the caller via the `actionKey` param:
// each caller decides which credit action to charge. The deduction happens
// BEFORE the Gemini call. On failure, we refund so users aren't penalised
// for our server errors.

import { requireCredits, refundCredits, type CreditActionKey } from '@/lib/credits';
import { getActiveModelId } from '@/lib/get-active-model';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fallback if DB is unreachable
const FALLBACK_MODEL = 'gemini-2.5-flash';

export interface GeminiCallOptions {
  prompt: string;
  maxTokens?: number;
  jsonMode?: boolean; // default true
  actionKey?: CreditActionKey; // defaults to TEXT_GENERATION
}

export async function geminiServerCall(
  { prompt, maxTokens = 4096, jsonMode = false, actionKey = 'TEXT_GENERATION' }: GeminiCallOptions,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  // ── Credit guard ──
  const guard = await requireCredits(actionKey);
  if (!guard.ok || !guard.userId) {
    throw new Error(guard.error || 'Access denied');
  }
  const userId = guard.userId;

  // Call Gemini — use active model from DB
  const modelId = await getActiveModelId('text').catch(() => FALLBACK_MODEL);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

  let text: string;
  try {
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
    text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini.');
  } catch (err) {
    // Refund the credit we just deducted — the call failed, user got nothing
    await refundCredits(userId, actionKey);
    throw err;
  }

  return text;
}