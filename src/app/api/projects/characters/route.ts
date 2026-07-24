import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { CharacterModel } from '@/lib/models/Character';
import { ProjectModel } from '@/lib/models/Project';
import { getSession } from '@/lib/auth';

// GET /api/projects/characters?projectId=xxx
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

    const project = await ProjectModel.findOne({ _id: projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const characters = await CharacterModel.find({ projectId })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      characters: characters.map((c) => ({
        id: String(c._id),
        projectId: String(c.projectId),
        name: c.name,
        design: c.design,
        imagePrompt: c.imagePrompt,
        createdAt: new Date(c.createdAt).getTime(),
        updatedAt: new Date(c.updatedAt).getTime(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch characters';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/characters — create character
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    await connectDB();

    const project = await ProjectModel.findOne({ _id: body.projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const character = await CharacterModel.create({
      projectId: body.projectId,
      name: body.name || 'Untitled Character',
      design: body.design || {},
      imagePrompt: body.imagePrompt || '',
    });

    return NextResponse.json({
      character: {
        id: String(character._id),
        projectId: String(character.projectId),
        name: character.name,
        design: character.design,
        imagePrompt: character.imagePrompt,
        createdAt: new Date(character.createdAt).getTime(),
        updatedAt: new Date(character.updatedAt).getTime(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create character';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/projects/characters — update character
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...changes } = body;
    if (!id) {
      return NextResponse.json({ error: 'Character ID is required' }, { status: 400 });
    }

    await connectDB();

    const character = await CharacterModel.findById(id).lean();
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const project = await ProjectModel.findOne({ _id: character.projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updated = await CharacterModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();

    return NextResponse.json({
      character: {
        id: String(updated!._id),
        projectId: String(updated!.projectId),
        name: updated!.name,
        design: updated!.design,
        imagePrompt: updated!.imagePrompt,
        createdAt: new Date(updated!.createdAt).getTime(),
        updatedAt: new Date(updated!.updatedAt).getTime(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update character';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/projects/characters?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Character ID is required' }, { status: 400 });
    }

    await connectDB();

    const character = await CharacterModel.findById(id).lean();
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const project = await ProjectModel.findOne({ _id: character.projectId, userId: session.userId });
    if (!project) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await CharacterModel.deleteOne({ _id: id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete character';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
