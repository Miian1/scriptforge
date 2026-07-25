// ── ElevenLabs: Generate Scene Narration ─────────────
// POST /api/elevenlabs/generate-scene
// Body: { sceneId, voiceId, settings?, modelId? }
// Fetches scene narration from DB and generates speech.
// Returns: audio/mpeg binary stream

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { SceneModel } from '@/lib/models/Scene';
import { generateSpeech } from '@/lib/elevenlabs';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { sceneId, voiceId, settings, modelId } = body;

    if (!sceneId || !voiceId) {
      return NextResponse.json(
        { error: 'sceneId and voiceId are required' },
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

    if (narration.length > 5000) {
      return NextResponse.json(
        { error: 'Narration is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    const audioBuffer = await generateSpeech({
      voiceId,
      text: narration,
      settings: settings || undefined,
      modelId: modelId || undefined,
    });

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate scene narration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
