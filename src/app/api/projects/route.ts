import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ProjectModel } from '@/lib/models/Project';
import { SceneModel } from '@/lib/models/Scene';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { PLAN_LIMITS, getTodayKey, resetIfNewDay } from '@/lib/usage';

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

// POST /api/projects — create project (with usage limit check)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    await connectDB();

    // ── Usage limit check ──
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plan = user.plan || 'free';
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
    const usage = resetIfNewDay(user.dailyUsage, plan as 'free' | 'pro');

    const isLifetime = plan === 'free';
    if (usage.projectsCreated >= limits.projectsPerDay) {
      return NextResponse.json({
        error: isLifetime
          ? `You've used your 1 free project. Upgrade to Pro for unlimited projects.`
          : `You've reached your daily project limit (${limits.projectsPerDay}). Upgrade to Pro for unlimited projects.`,
        code: 'PLAN_LIMIT_REACHED',
      }, { status: 429 });
    }

    // Increment usage and save
    user.dailyUsage = { ...usage, projectsCreated: usage.projectsCreated + 1 };
    await user.save();

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