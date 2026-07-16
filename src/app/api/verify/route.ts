import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { signToken, createSessionCookie } from '@/lib/auth';
import { formatUserResponse } from '@/lib/usage';

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

    // 1. Check token exists in DB
    const user = await User.findOne({
      verificationToken: token,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid verification token. The token does not exist.' },
        { status: 400 }
      );
    }

    // 2. Check token not expired
    if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
      return NextResponse.json(
        { error: 'This verification link has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    // 3. Token is valid — verify the user
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    // 4. Auto-login: create JWT and set cookie
    const jwtToken = await signToken({
      userId: (user._id as string).toString(),
      email: user.email,
      role: user.role,
    });

    const cookie = createSessionCookie(jwtToken);

    // 5. Return success with session cookie set
    return NextResponse.json(
      {
        success: true,
        message: 'Email verified successfully!',
        user: formatUserResponse(user),
      },
      {
        headers: {
          'Set-Cookie': `${cookie.name}=${cookie.value}; Path=${cookie.path}; HttpOnly; SameSite=${cookie.sameSite}; Max-Age=${cookie.maxAge}`,
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json(
      { error: `Verification failed: ${message}` },
      { status: 500 }
    );
  }
}