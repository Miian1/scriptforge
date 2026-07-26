// ── Gemini TTS: List Voices ──────────────────────────
// GET /api/tts/voices
//
// Pro-only: returns the list of available TTS voices, categories,
// styles, paces, and accents. Free users get 403 so the client can
// show an upgrade prompt instead of an empty voice dropdown.

import { NextResponse } from 'next/server';
import { listVoices, VOICE_CATEGORIES, TTS_STYLES, TTS_PACES, TTS_ACCENTS } from '@/lib/gemini-tts';
import { requirePro } from '@/lib/require-pro';

export async function GET() {
  try {
    // ── Pro-plan gate ──
    const guard = await requirePro();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error || 'Access denied' }, { status: guard.status });
    }

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
