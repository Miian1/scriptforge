// ── Generated Audio: Get / Delete ────────────────────
// GET /api/tts/audios/[id] — returns audio metadata
// DELETE /api/tts/audios/[id] — deletes audio record + file from disk

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { GeneratedAudioModel } from '@/lib/models/GeneratedAudio';
import { SceneModel } from '@/lib/models/Scene';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    await connectDB();
    const audio = await GeneratedAudioModel.findOne({
      _id: id,
      userId: session.userId,
    }).lean();

    if (!audio) {
      return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: audio._id.toString(),
      sceneId: audio.sceneId.toString(),
      sceneNumber: audio.sceneNumber,
      sceneTitle: audio.sceneTitle,
      narration: audio.narration,
      voiceName: audio.voiceName,
      voiceDescription: audio.voiceDescription,
      voiceCategory: audio.voiceCategory,
      style: audio.style,
      pace: audio.pace,
      accent: audio.accent,
      instructions: audio.instructions,
      audioPath: audio.audioPath,
      audioSize: audio.audioSize,
      duration: audio.duration,
      createdAt: audio.createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get audio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    await connectDB();
    const audio = await GeneratedAudioModel.findOneAndDelete({
      _id: id,
      userId: session.userId,
    });

    if (!audio) {
      return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
    }

    // Delete file from disk
    const filePath = join(process.cwd(), 'data', 'audio', `${audio.sceneId}.wav`);
    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch {
        // file may already be gone
      }
    }

    // Clear narrationAudioPath on the scene
    await SceneModel.findByIdAndUpdate(audio.sceneId, {
      $set: { narrationAudioPath: '' },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete audio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
