// ── Gemini TTS: Debug Endpoint ────────────────────────
// POST /api/tts/debug — tests all Gemini TTS API formats and returns response info

import { NextRequest, NextResponse } from 'next/server';

async function truncate(data: unknown, maxLen = 500): Promise<unknown> {
  const json = JSON.stringify(data);
  if (json.length <= maxLen) return data;
  return JSON.parse(json.substring(0, maxLen) + '..."');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceName } = body;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set in .env.local' }, { status: 500 });
    }

    const results: Record<string, unknown> = {};
    const voice = voiceName || 'Kore';
    const testText = text || 'Hello, this is a test.';

    // ── Test 1: generateContent (camelCase, ?key=) ──
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${GEMINI_API_KEY}`;
      const gcBody = {
        contents: [{ role: 'user', parts: [{ text: `Say cheerfully: ${testText}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gcBody),
      });

      const data = await res.json();
      const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
      const parts = candidates?.[0]?.content?.parts as Array<Record<string, unknown>> | undefined;
      const firstPart = parts?.[0] || {};

      results['generateContent_camelCase'] = {
        status: res.status,
        topKeys: Object.keys(data),
        candidatesCount: candidates?.length || 0,
        partsCount: parts?.length || 0,
        firstPartKeys: Object.keys(firstPart),
        hasInlineData: !!firstPart['inlineData'],
        hasInlineDataSnake: !!firstPart['inline_data'],
        hasText: !!firstPart['text'],
        inlineDataMime: (firstPart['inlineData'] as Record<string, string>)?.mimeType || null,
        inlineDataLen: ((firstPart['inlineData'] as Record<string, string>)?.data?.length) || 0,
        raw: await truncate(data, 600),
      };
    } catch (err) {
      results['generateContent_camelCase'] = { error: (err as Error).message };
    }

    // ── Test 2: generateContent (snake_case, ?key=) ──
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${GEMINI_API_KEY}`;
      const gcBody = {
        contents: [{ role: 'user', parts: [{ text: `Say cheerfully: ${testText}` }] }],
        generation_config: {
          response_modalities: ['AUDIO'],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: { voice_name: voice },
            },
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gcBody),
      });

      const data = await res.json();
      const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
      const parts = candidates?.[0]?.content?.parts as Array<Record<string, unknown>> | undefined;
      const firstPart = parts?.[0] || {};

      results['generateContent_snakeCase'] = {
        status: res.status,
        topKeys: Object.keys(data),
        candidatesCount: candidates?.length || 0,
        partsCount: parts?.length || 0,
        firstPartKeys: Object.keys(firstPart),
        hasInlineData: !!firstPart['inlineData'],
        hasInlineDataSnake: !!firstPart['inline_data'],
        hasText: !!firstPart['text'],
        error: data.error ? await truncate(data.error, 200) : null,
        raw: await truncate(data, 600),
      };
    } catch (err) {
      results['generateContent_snakeCase'] = { error: (err as Error).message };
    }

    // ── Test 3: Interactions API ──
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${GEMINI_API_KEY}`;
      const intBody = {
        model: 'gemini-3.1-flash-tts-preview',
        input: `Say cheerfully: ${testText}`,
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [{ voice: voice }],
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intBody),
      });

      const data = await res.json();
      const interaction = data.interaction as Record<string, unknown> | undefined;

      results['interactions_keyParam'] = {
        status: res.status,
        topKeys: Object.keys(data),
        hasInteraction: !!interaction,
        interactionKeys: interaction ? Object.keys(interaction) : null,
        hasOutputAudio: !!(interaction?.output_audio || interaction?.outputAudio),
        hasCandidates: !!(interaction?.candidates || data.candidates),
        error: data.error ? await truncate(data.error, 200) : null,
        raw: await truncate(data, 600),
      };
    } catch (err) {
      results['interactions_keyParam'] = { error: (err as Error).message };
    }

    return NextResponse.json({
      apiKeySet: true,
      apiKeyPrefix: GEMINI_API_KEY.substring(0, 8) + '...',
      requestedVoice: voice,
      results,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
