import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const { userId, title, message, type } = body;

    if (!userId || !title || !message) {
      return NextResponse.json({ error: 'userId, title, and message are required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: type || 'info',
      title,
      message,
      read: false,
      createdAt: Date.now(),
    };

    // Add to notifications array (max 50)
    const notifs = user.notifications || [];
    notifs.unshift(notification);
    if (notifs.length > 50) notifs.length = 50;

    await User.updateOne({ _id: userId }, { $set: { notifications: notifs } });

    return NextResponse.json({ success: true, notification });
  } catch (error: any) {
    console.error('Admin notify error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
