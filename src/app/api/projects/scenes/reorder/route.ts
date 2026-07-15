import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SceneModel } from '@/lib/models/Scene';
import { getSession } from '@/lib/auth';

// POST /api/projects/scenes/reorder
// Body: { items: [{ id: string, sceneNumber: number }] }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const items: { id: string; sceneNumber: number }[] = body.items;
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    await connectDB();

    for (const item of items) {
      await SceneModel.updateOne(
        { _id: item.id },
        { $set: { sceneNumber: item.sceneNumber, updatedAt: new Date() } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reorder scenes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}