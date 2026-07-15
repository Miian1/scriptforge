import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const BASE_URL = process.env.BASE_URL || 'https://scriptforge-six.vercel.app';

const SCOPES = ['openid', 'email', 'profile'];
const REDIRECT_URI = `${BASE_URL}/api/auth/google/callback`;

// Simple state cookie for CSRF protection (valid for 10 minutes)
function createStateCookie(state: string) {
  return {
    name: 'google_oauth_state',
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
  };
}

export async function GET() {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured' },
      { status: 500 }
    );
  }

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  const cookie = createStateCookie(state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(googleAuthUrl, {
    headers: {
      'Set-Cookie': `${cookie.name}=${cookie.value}; Path=${cookie.path}; HttpOnly; SameSite=${cookie.sameSite}; Max-Age=${cookie.maxAge}`,
    },
  });
}