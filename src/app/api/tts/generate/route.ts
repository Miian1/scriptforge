// ── Gemini TTS: Generate Speech ──────────────────────
// POST /api/tts/generate
// Body: { voiceName, text, instructions?, modelId?, saveAudio?, sceneId?, projectId?, sceneNumber?, sceneTitle?, voiceDescription?, voiceCategory?, style?, pace?, accent? }
// If saveAudio=true and sceneId provided, saves to disk, creates GeneratedAudio record, updates scene.
// Returns: audio/wav binary stream (with audioPath and audioRecordId in headers)

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { SceneModel } from '@/lib/models/Scene';
import { GeneratedAudioModel } from '@/lib/models/GeneratedAudio';
import { generateSpeech, stripStageDirections, GEMINI_TTS_VOICES } from '@/lib/gemini-tts';
import { getActiveModelId } from '@/lib/get-active-model';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const {
      voiceName,
      text,
      instructions,
      modelId,
      saveAudio,
      sceneId,
      projectId,
      sceneNumber,
      sceneTitle,
      voiceDescription,
      voiceCategory,
      style,
      pace,
      accent,
    } = body;

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

    // Resolve voice metadata
    const voiceDef = GEMINI_TTS_VOICES.find(v => v.name === voiceName);
    const resolvedDescription = voiceDescription || voiceDef?.description || '';
    const resolvedCategory = voiceCategory || voiceDef?.category || '';

    // Optionally save audio to disk and create DB record
    let audioPath = '';
    let audioRecordId = '';

    if (saveAudio && sceneId && projectId) {
      try {
        await connectDB();

        const audioDir = join(process.cwd(), 'data', 'audio');
        await mkdir(audioDir, { recursive: true });
        const filePath = join(audioDir, `${sceneId}.wav`);
        await writeFile(filePath, audioBuffer);
        audioPath = `/api/tts/audio/${sceneId}`;

        // Upsert GeneratedAudio record (replace if exists for same scene)
        const audioDoc = await GeneratedAudioModel.findOneAndUpdate(
          { userId: session.userId, sceneId },
          {
            userId: session.userId,
            projectId,
            sceneId,
            sceneNumber: sceneNumber || 0,
            sceneTitle: sceneTitle || 'Untitled Scene',
            narration: cleanText,
            voiceName,
            voiceDescription: resolvedDescription,
            voiceCategory: resolvedCategory,
            style: style || '',
            pace: pace || '',
            accent: accent || '',
            instructions: instructions || '',
            audioPath,
            audioSize: audioBuffer.length,
            duration: estimateDuration(cleanText),
          },
          { new: true, upsert: true },
        );
        audioRecordId = audioDoc._id.toString();

        // Update scene in DB with audio path
        await SceneModel.findByIdAndUpdate(sceneId, {
          $set: { narrationAudioPath: audioPath },
        });
      } catch (saveErr) {
        console.error('[tts/generate] Failed to save audio:', saveErr);
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
    const message = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Estimate audio duration from text (rough: ~150 words/min for normal speech).
 */
function estimateDuration(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60); // seconds
}
