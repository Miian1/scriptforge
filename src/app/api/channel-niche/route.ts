import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';

// GET /api/channel-niche — fetch current user's channel niche
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId).select('-password');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const niche = user.channelNiche || {};
    return NextResponse.json({
      channelNiche: {
        visualTheme: niche.visualTheme || '',
        writingStyle: niche.writingStyle || '',
        audience: niche.audience || '',
        language: niche.language || '',
        description: niche.description || '',
        channelName: niche.channelName || '',
        channelDescription: niche.channelDescription || '',
        channelCategory: niche.channelCategory || '',
        channelUrl: niche.channelUrl || '',
        characters: Array.isArray(niche.characters)
          ? niche.characters.map((c) => ({
              id: c.id || '',
              name: c.name || '',
              role: c.role || '',
              description: c.description || '',
              visualPrompt: c.visualPrompt || '',
              personalityPrompt: c.personalityPrompt || '',
            }))
          : [],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch channel niche';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/channel-niche — update channel niche
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const {
      visualTheme,
      writingStyle,
      audience,
      language,
      description,
      channelName,
      channelDescription,
      channelCategory,
      channelUrl,
      characters,
    } = body;

    await connectDB();

    // Sanitize channel characters — keep only valid entries, ensure id exists
    const cleanCharacters: Array<{
      id: string;
      name: string;
      role: string;
      description: string;
      visualPrompt: string;
      personalityPrompt: string;
    }> = Array.isArray(characters)
      ? characters
          .filter((c) => {
            if (!c || typeof c !== 'object') return false;
            const obj = c as Record<string, unknown>;
            return typeof obj.name === 'string' && obj.name.trim().length > 0;
          })
          .map((c, i) => {
            const obj = c as Record<string, unknown>;
            return {
              id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `char_${Date.now()}_${i}`,
              name: String(obj.name || '').trim().slice(0, 100),
              role: String(obj.role || '').trim().slice(0, 100),
              description: String(obj.description || '').trim().slice(0, 2000),
              visualPrompt: String(obj.visualPrompt || '').trim().slice(0, 2000),
              personalityPrompt: String(obj.personalityPrompt || '').trim().slice(0, 2000),
            };
          })
          .slice(0, 30) // hard cap: 30 channel characters
      : [];

    const update: Record<string, unknown> = {
      channelNiche: {
        visualTheme: typeof visualTheme === 'string' ? visualTheme.trim() : '',
        writingStyle: typeof writingStyle === 'string' ? writingStyle.trim() : '',
        audience: typeof audience === 'string' ? audience.trim() : '',
        language: typeof language === 'string' ? language.trim() : '',
        description: typeof description === 'string' ? description.trim() : '',
        channelName: typeof channelName === 'string' ? channelName.trim() : '',
        channelDescription: typeof channelDescription === 'string' ? channelDescription.trim() : '',
        channelCategory: typeof channelCategory === 'string' ? channelCategory.trim() : '',
        channelUrl: typeof channelUrl === 'string' ? channelUrl.trim() : '',
        characters: cleanCharacters,
      },
    };

    const updatedUser = await User.findByIdAndUpdate(session.userId, update, {
      new: true,
    }).select('-password');

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      channelNiche: updatedUser.channelNiche,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update channel niche';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
