// ── Generated Audio: List ────────────────────────────
// GET /api/tts/audios?projectId=xxx
// Returns all generated audio records for the authenticated user + project.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { GeneratedAudioModel } from '@/lib/models/GeneratedAudio';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    await connectDB();

    const audios = await GeneratedAudioModel.find({
      userId: session.userId,
      projectId,
    })
      .sort({ sceneNumber: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      audios: audios.map((a) => ({
        id: a._id.toString(),
        sceneId: a.sceneId.toString(),
        sceneNumber: a.sceneNumber,
        sceneTitle: a.sceneTitle,
        narration: a.narration,
        voiceName: a.voiceName,
        voiceDescription: a.voiceDescription,
        voiceCategory: a.voiceCategory,
        style: a.style,
        pace: a.pace,
        accent: a.accent,
        instructions: a.instructions,
        audioPath: a.audioPath,
        audioSize: a.audioSize,
        duration: a.duration,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list audios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
