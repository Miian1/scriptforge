// ── ElevenLabs: Generate Speech ──────────────────────
// POST /api/elevenlabs/generate
// Body: { voiceId, text, settings?: Partial<VoiceSettings>, modelId?: string }
// Returns: audio/mpeg binary stream

import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { voiceId, text, settings, modelId } = body;

    if (!voiceId) {
      return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required and must be non-empty' }, { status: 400 });
    }

    // Limit text length to prevent abuse (ElevenLabs max is ~5000 chars)
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text is too long (max 5000 characters)' }, { status: 400 });
    }

    const audioBuffer = await generateSpeech({
      voiceId,
      text: text.trim(),
      settings: settings || undefined,
      modelId: modelId || undefined,
    });

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
