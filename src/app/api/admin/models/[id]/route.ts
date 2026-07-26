// ── Admin: Update/Delete single AI Model ─────────────
// PUT    /api/admin/models/[id]
// DELETE /api/admin/models/[id]

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { AIModel } from '@/lib/models/AIModel';
import { invalidateModelCache } from '@/lib/get-active-model';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Forbidden. Admin access required.');
  }
  return session;
}

// ── PUT: Update model ──
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const body = await req.json();
    const { name, modelId, category, description, isActive, sortOrder } = body;

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (modelId !== undefined) update.modelId = modelId;
    if (category !== undefined) update.category = category;
    if (description !== undefined) update.description = description;
    if (isActive !== undefined) update.isActive = isActive;
    if (sortOrder !== undefined) update.sortOrder = sortOrder;

    const model = await AIModel.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Invalidate cache so the change is picked up immediately on next request
    invalidateModelCache();

    return NextResponse.json({ model });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to update model';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: Delete model ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const model = await AIModel.findByIdAndDelete(id);
    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Invalidate cache in case the deleted model was the active one
    invalidateModelCache();

    return NextResponse.json({ message: 'Model deleted' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to delete model';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
