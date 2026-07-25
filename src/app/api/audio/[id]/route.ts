// ── Serve saved audio files ──────────────────────────
// GET /api/audio/[id]
// Serves saved audio (WAV or MP3) for a scene from disk storage.

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

    // Try WAV first, then MP3 (legacy)
    const wavPath = join(process.cwd(), 'data', 'audio', `${id}.wav`);
    const mp3Path = join(process.cwd(), 'data', 'audio', `${id}.mp3`);
    
    let filePath = '';
    let contentType = 'audio/wav';
    if (existsSync(wavPath)) {
      filePath = wavPath;
      contentType = 'audio/wav';
    } else if (existsSync(mp3Path)) {
      filePath = mp3Path;
      contentType = 'audio/mpeg';
    } else {
      return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const fileStat = await stat(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load audio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
