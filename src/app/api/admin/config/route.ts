import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SiteConfig } from '@/lib/models/SiteConfig';
import { getSession } from '@/lib/auth';

// GET /api/admin/config — fetch current tools config (admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    let config = await SiteConfig.findOne().lean();
    if (!config) {
      // Create default config if none exists
      config = await SiteConfig.create({ tools: { youtube: { enabled: true } } });
      config = config.toObject();
    }

    return NextResponse.json({ config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch config';
    console.error('[Admin Config GET Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/admin/config — update tools config (admin only)
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { tools } = body;

    // Accept both shapes for resilience:
    //   { youtube: false }                  (flat boolean — legacy/client shape)
    //   { youtube: { enabled: false } }     (nested object — DB shape)
    // Without this, a flat `false` would be read as `false?.enabled` → undefined → `?? true`
    // which silently re-enables the tool on every save.
    const yt = tools?.youtube;
    const youtubeEnabled =
      typeof yt === 'boolean'
        ? yt
        : typeof yt?.enabled === 'boolean'
          ? yt.enabled
          : true;

    await connectDB();

    // Upsert: find existing or create new
    const config = await SiteConfig.findOneAndUpdate(
      {},
      {
        tools: {
          youtube: { enabled: youtubeEnabled },
        },
      },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update config';
    console.error('[Admin Config PUT Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
