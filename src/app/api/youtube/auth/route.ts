import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { buildYouTubeAuthUrl } from '@/lib/youtube';

const BASE_URL = process.env.BASE_URL || 'https://scriptforge-six.vercel.app';
if (BASE_URL && !BASE_URL.startsWith('http')) {
  // handled in buildYouTubeAuthUrl
}

const REDIRECT_URI = `${BASE_URL.startsWith('http') ? BASE_URL : `https://${BASE_URL}`}/api/youtube/callback`;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = buildYouTubeAuthUrl(REDIRECT_URI);
    return NextResponse.redirect(url);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start YouTube auth';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}