import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(`${process.env.BASE_URL || 'http://localhost:3000'}?verified=invalid`);
    }

    await connectDB();

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      // Token not found or expired
      return NextResponse.redirect(`${process.env.BASE_URL || 'http://localhost:3000'}?verified=expired`);
    }

    // Mark as verified and clear token
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    return NextResponse.redirect(`${process.env.BASE_URL || 'http://localhost:3000'}?verified=success`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.redirect(`${process.env.BASE_URL || 'http://localhost:3000'}?verified=error&msg=${encodeURIComponent(message)}`);
  }
}