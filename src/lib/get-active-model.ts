// ── Active AI Model Resolver ─────────────────────────
// Fetches the active model's modelId from the DB for a given category.
// Falls back to hardcoded defaults if DB is empty or unavailable.

import { connectDB } from '@/lib/mongodb';
import { AIModel } from '@/lib/models/AIModel';

// Cache for the current request to avoid repeated DB calls
let cache: Record<string, string | null> = {};
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

const FALLBACKS: Record<string, string> = {
  text: 'gemini-2.5-flash',
  voice: 'gemini-3.1-flash-tts-preview',
};

/**
 * Get the active modelId for a category ('text' or 'voice').
 * Returns the first active model sorted by sortOrder.
 * Falls back to defaults if DB has no models for the category.
 */
export async function getActiveModelId(category: 'text' | 'voice'): Promise<string> {
  const now = Date.now();

  // Return cached value if fresh
  if (cache[category] !== undefined && now - cacheTime < CACHE_TTL) {
    return cache[category]!;
  }

  try {
    await connectDB();
    const model = await AIModel.findOne({ category, isActive: true })
      .select('modelId')
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    if (model) {
      cache[category] = model.modelId;
    } else {
      cache[category] = FALLBACKS[category] || FALLBACKS.text;
    }
  } catch {
    // DB error — use fallback
    cache[category] = FALLBACKS[category] || FALLBACKS.text;
  }

  cacheTime = now;
  return cache[category]!;
}

/**
 * Invalidate the model cache (call after admin changes models).
 */
export function invalidateModelCache(): void {
  cache = {};
  cacheTime = 0;
}
