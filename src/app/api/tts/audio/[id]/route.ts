// ── Serve Saved TTS Audio Files ──────────────────────
// GET /api/tts/audio/[id]
// Serves saved WAV audio for a generated audio by sceneId.
// Used as the persistent download/play URL for generated voices.

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format (MongoDB ObjectId hex string)
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid audio ID' }, { status: 400 });
    }

    const wavPath = join(process.cwd(), 'data', 'audio', `${id}.wav`);

    if (!existsSync(wavPath)) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(wavPath);
    const fileStat = await stat(wavPath);

    // Support Content-Disposition for download
    const downloadParam = new URL(req.url).searchParams.get('download');
    const headers: Record<string, string> = {
      'Content-Type': 'audio/wav',
      'Content-Length': fileStat.size.toString(),
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    };

    if (downloadParam === '1') {
      headers['Content-Disposition'] = `attachment; filename="scene_${id}.wav"`;
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load audio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
