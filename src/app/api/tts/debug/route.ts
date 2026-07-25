// ── Gemini TTS: Debug Endpoint ────────────────────────
// POST /api/tts/debug
// Dumps the raw Gemini API response for troubleshooting

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceName } = body;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in server environment' }, { status: 500 });
    }

    const results: Record<string, unknown> = {};

    // ── Test 1: text:synthesize API ──
    try {
      const ttsBody = {
        input: {
          text: text || 'Hello, this is a test.',
        },
        voice: {
          languageCode: 'en-US',
          name: voiceName || 'Kore',
          model_name: 'gemini-3.1-flash-tts-preview',
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000,
        },
      };

      const ttsRes = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(ttsBody),
      });

      const ttsData = await ttsRes.json();
      results['text_synthesize'] = {
        status: ttsRes.status,
        keys: Object.keys(ttsData),
        hasAudioContent: !!ttsData.audioContent,
        audioContentLength: ttsData.audioContent?.length || 0,
        raw: JSON.stringify(ttsData).substring(0, 500),
      };
    } catch (err) {
      results['text_synthesize'] = { error: (err as Error).message };
    }

    // ── Test 2: Interactions API ──
    try {
      const intBody = {
        model: 'gemini-3.1-flash-tts-preview',
        input: text || 'Hello, this is a test.',
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [{ voice: voiceName || 'Kore' }],
        },
      };

      const intRes = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(intBody),
      });

      const intData = await intRes.json();

      // Truncate base64 for readability
      const truncated = JSON.parse(JSON.stringify(intData, (key, value) => {
        if (key === 'data' && typeof value === 'string' && value.length > 100) {
          return `[base64, ${value.length} chars]`;
        }
        return value;
      }));

      results['interactions'] = {
        status: intRes.status,
        keys: Object.keys(intData),
        interactionKeys: intData.interaction ? Object.keys(intData.interaction) : null,
        hasOutputAudio: !!intData.interaction?.output_audio || !!intData.interaction?.outputAudio,
        hasCandidates: !!(intData.interaction?.candidates || intData.candidates),
        raw: JSON.stringify(truncated).substring(0, 1000),
      };
    } catch (err) {
      results['interactions'] = { error: (err as Error).message };
    }

    return NextResponse.json({
      apiKeySet: !!GEMINI_API_KEY,
      apiKeyPrefix: GEMINI_API_KEY?.substring(0, 8) + '...',
      requestedVoice: voiceName || 'Kore',
      requestedText: (text || 'Hello, this is a test.').substring(0, 50),
      results,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
