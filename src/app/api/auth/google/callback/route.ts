import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { signToken, createSessionCookie } from '@/lib/auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://scriptforge-six.vercel.app';
const REDIRECT_URI = `${BASE_URL}/api/auth/google/callback`;

// Helper: build cookie string for Set-Cookie header
function cookieString(cookie: ReturnType<typeof createSessionCookie>): string {
  const parts = [`${cookie.name}=${cookie.value}`];
  parts.push(`Path=${cookie.path}`);
  parts.push('HttpOnly');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  parts.push(`SameSite=${cookie.sameSite}`);
  parts.push(`Max-Age=${cookie.maxAge}`);
  return parts.join('; ');
}

export async function GET(req: NextRequest) {
  try {
    // --- 1. Verify environment config ---
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${BASE_URL}/login?error=google_not_configured`
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state');
    const error = searchParams.get('error');

    // --- 2. Check for OAuth errors ---
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        `${BASE_URL}/login?error=oauth_failed`
      );
    }

    if (!code || !returnedState) {
      return NextResponse.redirect(
        `${BASE_URL}/login?error=missing_params`
      );
    }

    // --- 3. Verify CSRF state ---
    const cookieStore = await cookies();
    const storedState = cookieStore.get('google_oauth_state')?.value;

    // Clear state cookie immediately
    const clearStateCookie = 'google_oauth_state=; Path=/; HttpOnly; Max-Age=0';

    if (!storedState || storedState !== returnedState) {
      return NextResponse.redirect(
        `${BASE_URL}/login?error=invalid_state`,
        { headers: { 'Set-Cookie': clearStateCookie } }
      );
    }

    // --- 4. Exchange code for access token ---
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Google token exchange failed:', tokenError);
      return NextResponse.redirect(
        `${BASE_URL}/login?error=token_exchange_failed`,
        { headers: { 'Set-Cookie': clearStateCookie } }
      );
    }

    const tokenData = await tokenResponse.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      return NextResponse.redirect(
        `${BASE_URL}/login?error=no_id_token`,
        { headers: { 'Set-Cookie': clearStateCookie } }
      );
    }

    // --- 5. Decode ID token to get user info (no library needed for ID tokens) ---
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString('utf-8')
    );

    const googleId: string = payload.sub;
    const email: string = (payload.email || '').toLowerCase().trim();
    const name: string = payload.name || email.split('@')[0] || 'Google User';
    const emailVerified: boolean = payload.email_verified === true;

    if (!email) {
      return NextResponse.redirect(
        `${BASE_URL}/login?error=no_email`,
        { headers: { 'Set-Cookie': clearStateCookie } }
      );
    }

    // --- 6. Find or create user in MongoDB ---
    await connectDB();

    // Try to find existing user by Google ID first, then by email
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
    }

    if (user) {
      // Existing user — link Google account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        user.provider = 'google';
      }
      // Mark verified if Google confirms the email
      if (emailVerified && !user.isVerified) {
        user.isVerified = true;
        user.verificationToken = null;
        user.verificationTokenExpires = null;
      }
      await user.save();
    } else {
      // New user — create via Google
      user = await User.create({
        name,
        email,
        googleId,
        provider: 'google',
        isVerified: emailVerified,
        role: 'user',
      });
    }

    // --- 7. Create JWT session and redirect to app ---
    const token = await signToken({
      userId: (user._id as string).toString(),
      email: user.email,
      role: user.role,
    });

    const sessionCookie = cookieString(createSessionCookie(token));

    return NextResponse.redirect(BASE_URL, {
      headers: {
        'Set-Cookie': [clearStateCookie, sessionCookie].join(', '),
      },
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      `${BASE_URL}/login?error=server_error`
    );
  }
}