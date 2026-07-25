import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const user = await User.findById(session.userId).select('notifications').lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return notifications sorted newest first, up to 20
    const notifs = (user.notifications || [])
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, 20)
      .map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.message,
        read: n.read,
        createdAt: n.createdAt,
      }));

    return NextResponse.json({ notifications: notifs });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { notificationId, readAll } = body;

    await connectDB();

    if (readAll) {
      await User.updateOne(
        { _id: session.userId },
        { $set: { 'notifications.$[].read': true } },
      );
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await User.updateOne(
        { _id: session.userId, 'notifications.id': notificationId },
        { $set: { 'notifications.$.read': true } },
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Provide notificationId or readAll' }, { status: 400 });
  } catch (error: any) {
    console.error('Mark notification error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
