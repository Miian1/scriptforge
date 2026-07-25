// ── ElevenLabs: List Voices ──────────────────────────
// GET /api/elevenlabs/voices

import { NextResponse } from 'next/server';
import { listVoices } from '@/lib/elevenlabs';

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch voices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
