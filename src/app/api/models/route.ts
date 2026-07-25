// ── Public: Get active AI models ─────────────────────
// GET /api/models?category=text|voice
// Returns active models (no auth required — needed by VoiceGenerator component)

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AIModel } from '@/lib/models/AIModel';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const filter: Record<string, unknown> = { isActive: true };
    if (category && (category === 'text' || category === 'voice')) {
      filter.category = category;
    }

    const models = await AIModel.find(filter)
      .select('name modelId category description')
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
