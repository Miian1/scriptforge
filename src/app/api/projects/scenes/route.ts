import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SceneModel } from '@/lib/models/Scene';
import { ProjectModel } from '@/lib/models/Project';
import { getSession } from '@/lib/auth';

// GET /api/projects/scenes?projectId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await connectDB();

    // Verify project belongs to user
    const project = await ProjectModel.findOne({ _id: projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const scenes = await SceneModel.find({ projectId })
      .sort({ sceneNumber: 1 })
      .lean();

    return NextResponse.json({
      scenes: scenes.map((s) => ({
        id: (s._id as string).toString(),
        projectId: (s.projectId as string).toString(),
        sceneNumber: s.sceneNumber,
        title: s.title,
        estimatedDuration: s.estimatedDuration,
        goal: s.goal,
        narration: s.narration,
        imagePrompt: s.imagePrompt,
        animationPrompt: s.animationPrompt,
        notes: s.notes,
        createdAt: new Date(s.createdAt).getTime(),
        updatedAt: new Date(s.updatedAt).getTime(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch scenes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/scenes — create scene
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    await connectDB();

    // Verify project belongs to user
    const project = await ProjectModel.findOne({ _id: body.projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const scene = await SceneModel.create({
      projectId: body.projectId,
      sceneNumber: body.sceneNumber || 1,
      title: body.title || '',
      estimatedDuration: body.estimatedDuration || 0,
      goal: body.goal || '',
      narration: body.narration || '',
      imagePrompt: body.imagePrompt || '',
      animationPrompt: body.animationPrompt || '',
      notes: body.notes || {},
    });

    return NextResponse.json({
      scene: {
        id: (scene._id as string).toString(),
        projectId: (scene.projectId as string).toString(),
        sceneNumber: scene.sceneNumber,
        title: scene.title,
        estimatedDuration: scene.estimatedDuration,
        goal: scene.goal,
        narration: scene.narration,
        imagePrompt: scene.imagePrompt,
        animationPrompt: scene.animationPrompt,
        notes: scene.notes,
        createdAt: new Date(scene.createdAt).getTime(),
        updatedAt: new Date(scene.updatedAt).getTime(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create scene';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/projects/scenes — update scene
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...changes } = body;
    if (!id) {
      return NextResponse.json({ error: 'Scene ID is required' }, { status: 400 });
    }

    await connectDB();

    // Verify scene belongs to user's project
    const scene = await SceneModel.findById(id).lean();
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }
    const project = await ProjectModel.findOne({ _id: scene.projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updated = await SceneModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();

    return NextResponse.json({
      scene: {
        id: (updated!._id as string).toString(),
        projectId: (updated!.projectId as string).toString(),
        sceneNumber: updated!.sceneNumber,
        title: updated!.title,
        estimatedDuration: updated!.estimatedDuration,
        goal: updated!.goal,
        narration: updated!.narration,
        imagePrompt: updated!.imagePrompt,
        animationPrompt: updated!.animationPrompt,
        notes: updated!.notes,
        createdAt: new Date(updated!.createdAt).getTime(),
        updatedAt: new Date(updated!.updatedAt).getTime(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update scene';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/scenes?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Scene ID is required' }, { status: 400 });
    }

    await connectDB();

    // Verify scene belongs to user's project
    const scene = await SceneModel.findById(id).lean();
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }
    const project = await ProjectModel.findOne({ _id: scene.projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await SceneModel.deleteOne({ _id: id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete scene';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}