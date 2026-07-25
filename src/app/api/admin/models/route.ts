// ── Admin: AI Models CRUD ────────────────────────────
// GET   /api/admin/models          — list all models (optionally ?category=text|voice)
// POST  /api/admin/models          — create a new model
// PUT   /api/admin/models/[id]     — update a model
// DELETE /api/admin/models/[id]    — delete a model
// POST  /api/admin/models/seed     — seed default models (idempotent)

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { AIModel, type IAIModel } from '@/lib/models/AIModel';

// ── Auth guard ──
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Forbidden. Admin access required.');
  }
  return session;
}

// ── GET: List all models ──
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const filter: Record<string, unknown> = {};
    if (category && (category === 'text' || category === 'voice')) {
      filter.category = category;
    }

    const models = await AIModel.find(filter).sort({ category: 1, sortOrder: 1, createdAt: 1 }).lean();
    return NextResponse.json({ models });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: Create model ──
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await req.json();
    const { name, modelId, category, description, isActive, sortOrder } = body;

    if (!name || !modelId || !category) {
      return NextResponse.json(
        { error: 'name, modelId, and category are required' },
        { status: 400 }
      );
    }

    if (!['text', 'voice'].includes(category)) {
      return NextResponse.json({ error: 'category must be "text" or "voice"' }, { status: 400 });
    }

    const model = await AIModel.create({
      name,
      modelId,
      category,
      description: description || '',
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
    });

    return NextResponse.json({ model }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to create model';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Seed default models ──
export async function SEED() {
  try {
    await requireAdmin();
    await connectDB();

    const defaults: Array<Omit<IAIModel, keyof Document>> = [
      {
        name: 'Gemini 2.5 Flash',
        modelId: 'gemini-2.5-flash',
        category: 'text',
        description: 'Fast and capable text generation model',
        isActive: true,
        sortOrder: 0,
      },
      {
        name: 'Gemini 2.5 Pro',
        modelId: 'gemini-2.5-pro',
        category: 'text',
        description: 'Highest quality text generation, slower',
        isActive: false,
        sortOrder: 1,
      },
      {
        name: 'Gemini 2.0 Flash',
        modelId: 'gemini-2.0-flash',
        category: 'text',
        description: 'Legacy fast model, good for simple tasks',
        isActive: false,
        sortOrder: 2,
      },
      {
        name: 'Gemini 3.1 Flash TTS',
        modelId: 'gemini-3.1-flash-tts-preview',
        category: 'voice',
        description: 'Latest TTS preview, fast voice generation with 30 voices',
        isActive: true,
        sortOrder: 0,
      },
    ];

    // Upsert by modelId — won't overwrite existing
    let created = 0;
    for (const def of defaults) {
      const exists = await AIModel.findOne({ modelId: def.modelId });
      if (!exists) {
        await AIModel.create(def);
        created++;
      }
    }

    const total = await AIModel.countDocuments();
    return NextResponse.json({ message: `Seeded ${created} new models. Total: ${total}`, created, total });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : 'Failed to seed models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
