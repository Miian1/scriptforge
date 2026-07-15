import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ProjectModel } from '@/lib/models/Project';
import { SceneModel } from '@/lib/models/Scene';
import { getSession } from '@/lib/auth';

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
        settings: p.settings,
        status: p.status,
        createdAt: new Date(p.createdAt).getTime(),
        updatedAt: new Date(p.updatedAt).getTime(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects — create project
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    await connectDB();

    const project = await ProjectModel.create({
      userId: session.userId,
      title: body.title || 'Untitled Project',
      topic: body.topic || '',
      description: body.description || '',
      settings: body.settings || {},
      status: body.status || 'draft',
    });

    return NextResponse.json({
      project: {
        id: (project._id as string).toString(),
        title: project.title,
        topic: project.topic,
        description: project.description,
        settings: project.settings,
        status: project.status,
        createdAt: new Date(project.createdAt).getTime(),
        updatedAt: new Date(project.updatedAt).getTime(),
      },
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
        settings: project.settings,
        status: project.status,
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