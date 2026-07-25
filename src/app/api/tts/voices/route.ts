// ── Gemini TTS: List Voices ──────────────────────────
// GET /api/tts/voices

import { NextResponse } from 'next/server';
import { listVoices, VOICE_CATEGORIES, TTS_STYLES, TTS_PACES, TTS_ACCENTS } from '@/lib/gemini-tts';

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({
      voices,
      categories: VOICE_CATEGORIES,
      styles: TTS_STYLES,
      paces: TTS_PACES,
      accents: TTS_ACCENTS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch voices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
