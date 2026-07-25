// ── Gemini TTS: Generate Scene Narration ─────────────
// POST /api/tts/generate-scene
// Body: { sceneId, voiceName, instructions?, modelId?, saveAudio? }
// Fetches scene narration from DB, strips stage directions, generates speech.
// If saveAudio=true, saves to disk and updates scene's narrationAudioPath.
// Returns: audio/wav binary stream

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { SceneModel } from '@/lib/models/Scene';
import { generateSpeech, stripStageDirections } from '@/lib/gemini-tts';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { sceneId, voiceName, instructions, modelId, saveAudio } = body;

    if (!sceneId || !voiceName) {
      return NextResponse.json(
        { error: 'sceneId and voiceName are required' },
        { status: 400 }
      );
    }

    // Fetch scene from DB
    await connectDB();
    const scene = await SceneModel.findById(sceneId);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const narration = scene.narration?.trim();
    if (!narration) {
      return NextResponse.json({ error: 'Scene has no narration text' }, { status: 400 });
    }

    // Strip stage directions [pause], (dramatic), *music* etc.
    const cleanNarration = stripStageDirections(narration);
    if (!cleanNarration) {
      return NextResponse.json({ error: 'Narration is empty after removing stage directions' }, { status: 400 });
    }

    if (cleanNarration.length > 5000) {
      return NextResponse.json(
        { error: 'Narration is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    const audioBuffer = await generateSpeech({
      voiceName,
      text: cleanNarration,
      instructions: instructions || undefined,
      modelId: modelId || undefined,
    });

    // Optionally save audio to disk
    let audioPath = '';
    if (saveAudio) {
      try {
        const audioDir = join(process.cwd(), 'data', 'audio');
        await mkdir(audioDir, { recursive: true });
        const filePath = join(audioDir, `${sceneId}.wav`);
        await writeFile(filePath, audioBuffer);
        audioPath = `/api/audio/${sceneId}`;

        // Update scene in DB
        await SceneModel.findByIdAndUpdate(sceneId, {
          $set: { narrationAudioPath: audioPath },
        });
      } catch (saveErr) {
        console.error('[gemini-tts] Failed to save audio:', saveErr);
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
    const message = error instanceof Error ? error.message : 'Failed to generate scene narration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
