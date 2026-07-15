import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { generateVerificationToken, getVerificationExpiry, sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    await connectDB();

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // First registered user becomes admin
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    // Generate unique verification token (15 min expiry)
    const verificationToken = generateVerificationToken();
    const verificationTokenExpires = getVerificationExpiry();

    // Store user in DB — NOT verified yet
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
    });

    // Send verification email — await it so errors are caught
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailErr: unknown) {
      const errMsg = emailErr instanceof Error ? emailErr.message : 'Email send failed';
      // Rollback: delete user since we can't verify them
      await User.deleteOne({ _id: user._id });
      return NextResponse.json(
        { error: `Could not send verification email: ${errMsg}` },
        { status: 500 }
      );
    }

    // Success — tell frontend to show "check your email" page
    return NextResponse.json({
      message: 'Account created. Please check your email to verify your account.',
      email: user.email,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    if (message.includes('duplicate key') || message.includes('E11000')) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}