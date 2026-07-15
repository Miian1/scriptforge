import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AppSettings } from '@/lib/models/AppSettings';
import { getSession } from '@/lib/auth';

// PUT /api/settings — admin only
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { geminiApiKey, action } = body;

    await connectDB();

    let settings = await AppSettings.findOne({});
    if (!settings) {
      settings = await AppSettings.create({ geminiApiKey: '' });
    }

    // Test action — validate the key before saving
    if (action === 'test' && geminiApiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Say "ok"' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message =
          (errorData as Record<string, Record<string, string>>)?.error?.message ||
          `HTTP ${res.status}`;
        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: 'API key is valid' });
    }

    // Save action
    if (typeof geminiApiKey === 'string') {
      settings.geminiApiKey = geminiApiKey.trim();
      await settings.save();
      return NextResponse.json({
        success: true,
        hasApiKey: !!settings.geminiApiKey,
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}