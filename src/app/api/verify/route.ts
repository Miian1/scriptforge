import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { signToken, createSessionCookie } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'No verification token provided.' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid verification token.' },
        { status: 400 }
      );
    }

    if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
      return NextResponse.json(
        { error: 'This verification link has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    const jwtToken = await signToken({
      userId: (user._id as string).toString(),
      email: user.email,
      role: user.role,
    });

    const cookie = createSessionCookie(jwtToken);

    return NextResponse.json(
      { success: true, message: 'Email verified successfully!' },
      {
        headers: {
          'Set-Cookie': `${cookie.name}=${cookie.value}; Path=${cookie.path}; HttpOnly; SameSite=${cookie.sameSite}; Max-Age=${cookie.maxAge}`,
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}