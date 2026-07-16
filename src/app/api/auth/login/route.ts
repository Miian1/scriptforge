import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { signToken, createSessionCookie } from '@/lib/auth';
import { formatUserResponse } from '@/lib/usage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password +isVerified');
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Block unverified users
    if (!user.isVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in. Check your inbox for a verification link.', requiresVerification: true, email: user.email },
        { status: 403 }
      );
    }

    const token = await signToken({
      userId: (user._id as string).toString(),
      email: user.email,
      role: user.role,
    });

    const cookie = createSessionCookie(token);

    return NextResponse.json(
      { user: formatUserResponse(user) },
      { headers: { 'Set-Cookie': `${cookie.name}=${cookie.value}; Path=${cookie.path}; HttpOnly; SameSite=${cookie.sameSite}; Max-Age=${cookie.maxAge}` } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}