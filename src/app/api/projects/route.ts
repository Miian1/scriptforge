import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ProjectModel } from '@/lib/models/Project';
import { SceneModel } from '@/lib/models/Scene';
import { getSession } from '@/lib/auth';
import { requireCredits, refundCredits } from '@/lib/credits';

// GET /api/projects — list user's projects
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();
    const projects = await ProjectModel.find({ userId: session.userId })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: (p._id as string).toString(),
        title: p.title,
        topic: p.topic,
        description: p.description,
        thumbnailPrompt: p.thumbnailPrompt || '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        settings: p.settings,
        status: p.status,
        scoreHistory: Array.isArray(p.scoreHistory) ? p.scoreHistory : [],
        createdAt: new Date(p.createdAt).getTime(),
        updatedAt: new Date(p.updatedAt).getTime(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects — create project (1 credit deducted)
export async function POST(req: NextRequest) {
  try {
    // ── Credit guard ──
    const guard = await requireCredits('PROJECT_CREATION');
    if (!guard.ok || !guard.userId) {
      return NextResponse.json(
        { error: guard.error || 'Access denied', code: guard.status === 429 ? 'CREDITS_EXHAUSTED' : undefined },
        { status: guard.status },
      );
    }
    const userId = guard.userId;

    const body = await req.json();
    await connectDB();

    let project;
    try {
      project = await ProjectModel.create({
        userId,
        title: body.title || 'Untitled Project',
        topic: body.topic || '',
        description: body.description || '',
        settings: body.settings || {},
        status: body.status || 'draft',
      });
    } catch (err) {
      // Refund if project creation failed
      await refundCredits(userId, 'PROJECT_CREATION');
      throw err;
    }

    return NextResponse.json({
      project: {
        id: (project._id as string).toString(),
        title: project.title,
        topic: project.topic,
        description: project.description,
        thumbnailPrompt: project.thumbnailPrompt || '',
        tags: Array.isArray(project.tags) ? project.tags : [],
        settings: project.settings,
        status: project.status,
        scoreHistory: Array.isArray(project.scoreHistory) ? project.scoreHistory : [],
        createdAt: new Date(project.createdAt).getTime(),
        updatedAt: new Date(project.updatedAt).getTime(),
      },
      credits: guard.state,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/projects — update project
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...changes } = body;
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await connectDB();

    const project = await ProjectModel.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { $set: changes },
      { new: true }
    ).lean();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: (project._id as string).toString(),
        title: project.title,
        topic: project.topic,
        description: project.description,
        thumbnailPrompt: project.thumbnailPrompt || '',
        tags: Array.isArray(project.tags) ? project.tags : [],
        settings: project.settings,
        status: project.status,
        scoreHistory: Array.isArray(project.scoreHistory) ? project.scoreHistory : [],
        createdAt: new Date(project.createdAt).getTime(),
        updatedAt: new Date(project.updatedAt).getTime(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects?id=xxx — delete project and its scenes
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await connectDB();

    // Delete project and all its scenes
    await ProjectModel.deleteOne({ _id: id, userId: session.userId });
    await SceneModel.deleteMany({ projectId: id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}