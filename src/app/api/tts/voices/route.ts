// ── Gemini TTS: List Voices ──────────────────────────
// GET /api/tts/voices

import { NextResponse } from 'next/server';
import { listVoices } from '@/lib/gemini-tts';

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch voices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
