import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';

// POST /api/manager/notify
// Manager sends a notification to a single standard user.
//   - Manager can only notify users with role='user' (not admins or other managers)
//   - Same payload shape as /api/admin/notify
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'manager') {
      return NextResponse.json({ error: 'Manager access required' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, title, message, type } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: 'userId, title, and message are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Scope check: managers can only notify standard users
    if (user.role !== 'user') {
      return NextResponse.json(
        { error: 'Managers can only notify standard user accounts.' },
        { status: 403 }
      );
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[Manager Notify Error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
