// ── Gemini TTS: Generate Speech ──────────────────────
// POST /api/tts/generate
// Body: { voiceName, text, instructions?, modelId?, saveAudio?, sceneId? }
// If saveAudio=true and sceneId provided, saves to disk and returns audioPath.
// Returns: audio/wav binary stream (with audioPath in header)

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SceneModel } from '@/lib/models/Scene';
import { generateSpeech, stripStageDirections } from '@/lib/gemini-tts';
import { getActiveModelId } from '@/lib/get-active-model';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { voiceName, text, instructions, modelId, saveAudio, sceneId } = body;

    if (!voiceName) {
      return NextResponse.json({ error: 'voiceName is required' }, { status: 400 });
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required and must be non-empty' }, { status: 400 });
    }

    // Strip stage directions [pause], (dramatic), *music* etc.
    const cleanText = stripStageDirections(text.trim());

    if (!cleanText) {
      return NextResponse.json({ error: 'Text is empty after removing stage directions' }, { status: 400 });
    }

    if (cleanText.length > 5000) {
      return NextResponse.json({ error: 'Text is too long (max 5000 characters)' }, { status: 400 });
    }

    // Resolve voice model: use caller-specified modelId, else active from DB, else fallback
    const resolvedModelId = modelId || await getActiveModelId('voice');

    const audioBuffer = await generateSpeech({
      voiceName,
      text: cleanText,
      instructions: instructions || undefined,
      modelId: resolvedModelId,
    });

    // Optionally save audio to disk and update scene
    let audioPath = '';
    if (saveAudio && sceneId) {
      try {
        const audioDir = join(process.cwd(), 'data', 'audio');
        await mkdir(audioDir, { recursive: true });
        const filePath = join(audioDir, `${sceneId}.wav`);
        await writeFile(filePath, audioBuffer);
        audioPath = `/api/audio/${sceneId}`;

        // Update scene in DB
        await connectDB();
        await SceneModel.findByIdAndUpdate(sceneId, {
          $set: { narrationAudioPath: audioPath },
        });
      } catch (saveErr) {
        console.error('[gemini-tts] Failed to save audio:', saveErr);
        // Don't fail the request — still return the audio
      }
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
        ...(audioPath ? { 'X-Audio-Path': audioPath } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
