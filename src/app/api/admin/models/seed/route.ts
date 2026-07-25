// ── Admin: Seed default AI Models ────────────────────
// POST /api/admin/models/seed

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { AIModel } from '@/lib/models/AIModel';

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    await connectDB();

    const defaults = [
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
    const message = error instanceof Error ? error.message : 'Failed to seed models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
