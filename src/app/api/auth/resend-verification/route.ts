import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { generateVerificationToken, getVerificationExpiry, sendVerificationEmail } from '@/lib/email';

// Simple in-memory rate limiter: 1 resend per email per 60 seconds
const resendAttempts = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email?.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Rate limit check
    const now = Date.now();
    const normalizedEmail = email.toLowerCase().trim();
    const lastAttempt = resendAttempts.get(normalizedEmail) || 0;
    if (now - lastAttempt < 60_000) {
      return NextResponse.json(
        { error: 'Please wait 60 seconds before requesting another verification email.' },
        { status: 429 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Don't reveal whether the email exists
      return NextResponse.json({ message: 'If an account exists with this email, a verification link has been sent.' });
    }

    if (user.isVerified) {
      return NextResponse.json(
        { error: 'This email is already verified. You can sign in.' },
        { status: 400 }
      );
    }

    // Generate new token (15 min expiry)
    const verificationToken = generateVerificationToken();
    const verificationTokenExpires = getVerificationExpiry();

    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    // Rate limit update
    resendAttempts.set(normalizedEmail, now);
    if (resendAttempts.size > 1000) {
      for (const [key, time] of resendAttempts.entries()) {
        if (now - time > 120_000) resendAttempts.delete(key);
      }
    }

    // Send email — await to catch errors
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailErr: unknown) {
      const errMsg = emailErr instanceof Error ? emailErr.message : 'Email send failed';
      return NextResponse.json({ error: `Failed to send email: ${errMsg}` }, { status: 500 });
    }

    return NextResponse.json({ message: 'Verification email sent successfully.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to resend verification email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}