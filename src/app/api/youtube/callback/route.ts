import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { getSession } from '@/lib/auth';
import { exchangeCodeForTokens } from '@/lib/youtube';

const BASE_URL = process.env.BASE_URL || 'https://scriptforge-six.vercel.app';
const SAFE_BASE = BASE_URL.startsWith('http') ? BASE_URL : `https://${BASE_URL}`;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(`${SAFE_BASE}/dashboard?youtube=error`);
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(`${SAFE_BASE}/dashboard?youtube=error`);
    }

    // Exchange code for tokens
    const redirectUri = `${SAFE_BASE}/api/youtube/callback`;
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code, redirectUri);

    // Save to user
    await connectDB();
    await User.findByIdAndUpdate(session.userId, {
      'youtube.connected': true,
      'youtube.accessToken': accessToken,
      'youtube.refreshToken': refreshToken || null,
    });

    return NextResponse.redirect(`${SAFE_BASE}/dashboard?youtube=connected`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'YouTube connection failed';
    console.error('[YouTube Callback Error]', message);
    return NextResponse.redirect(`${SAFE_BASE}/dashboard?youtube=error`);
  }
}