import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SiteConfig } from '@/lib/models/SiteConfig';

// GET /api/config — public endpoint, returns which tools are enabled
export async function GET() {
  try {
    await connectDB();

    const config = await SiteConfig.findOne().lean();

    return NextResponse.json({
      tools: {
        youtube: config?.tools?.youtube?.enabled !== false, // default true
      },
    });
  } catch {
    // If DB fails, return all tools enabled (graceful degradation)
    return NextResponse.json({
      tools: {
        youtube: true,
      },
    });
  }
}
