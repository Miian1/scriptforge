// ── Gemini TTS: Generate Scene Narration ─────────────
// POST /api/tts/generate-scene
// Body: { sceneId, voiceName, instructions?, modelId?, saveAudio?, style?, pace?, accent? }
// Fetches scene narration from DB, strips stage directions, generates speech.
// If saveAudio=true, saves to disk, creates GeneratedAudio record, updates scene.
// Returns: audio/wav binary stream (with X-Audio-Path and X-Audio-Record-Id headers)

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SceneModel } from '@/lib/models/Scene';
import { ProjectModel } from '@/lib/models/Project';
import { GeneratedAudioModel } from '@/lib/models/GeneratedAudio';
import { generateSpeech, stripStageDirections, GEMINI_TTS_VOICES } from '@/lib/gemini-tts';
import { getActiveModelId } from '@/lib/get-active-model';
import { requirePro } from '@/lib/require-pro';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    // ── Pro-plan gate ──
    // Voice generation is a Pro-only feature. Free users get 403.
    const guard = await requirePro();
    if (!guard.ok || !guard.userId) {
      return NextResponse.json({ error: guard.error || 'Access denied' }, { status: guard.status });
    }
    const userId = guard.userId;

    const body = await req.json();
    const { sceneId, voiceName, instructions, modelId, saveAudio, style, pace, accent } = body;

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

    // Resolve voice model: use caller-specified modelId, else active from DB, else fallback
    const resolvedModelId = modelId || await getActiveModelId('voice');
    console.log('[tts/generate-scene] Resolved modelId:', resolvedModelId, '(from:', modelId ? 'client' : 'DB active', ')');

    const audioBuffer = await generateSpeech({
      voiceName,
      text: cleanNarration,
      instructions: instructions || undefined,
      modelId: resolvedModelId,
    });

    // Resolve voice metadata
    const voiceDef = GEMINI_TTS_VOICES.find(v => v.name === voiceName);
    const voiceDescription = voiceDef?.description || '';
    const voiceCategory = voiceDef?.category || '';

    // Save audio to disk and create DB record
    let audioPath = '';
    let audioRecordId = '';

    if (saveAudio) {
      try {
        const audioDir = join(process.cwd(), 'data', 'audio');
        await mkdir(audioDir, { recursive: true });
        const filePath = join(audioDir, `${sceneId}.wav`);
        await writeFile(filePath, audioBuffer);
        audioPath = `/api/tts/audio/${sceneId}`;

        // Upsert GeneratedAudio record
        const audioDoc = await GeneratedAudioModel.findOneAndUpdate(
          { userId, sceneId },
          {
            userId,
            projectId: scene.projectId,
            sceneId,
            sceneNumber: scene.sceneNumber || 0,
            sceneTitle: scene.title || 'Untitled Scene',
            narration: cleanNarration,
            voiceName,
            voiceDescription,
            voiceCategory,
            style: style || '',
            pace: pace || '',
            accent: accent || '',
            instructions: instructions || '',
            audioPath,
            audioSize: audioBuffer.length,
            duration: estimateDuration(cleanNarration),
          },
          { new: true, upsert: true },
        );
        audioRecordId = audioDoc._id.toString();

        // Update scene in DB
        await SceneModel.findByIdAndUpdate(sceneId, {
          $set: { narrationAudioPath: audioPath },
        });
      } catch (saveErr) {
        console.error('[tts/generate-scene] Failed to save audio:', saveErr);
      }
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
        ...(audioPath ? { 'X-Audio-Path': audioPath } : {}),
        ...(audioRecordId ? { 'X-Audio-Record-Id': audioRecordId } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate scene narration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function estimateDuration(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60);
}
