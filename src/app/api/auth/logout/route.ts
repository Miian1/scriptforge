import { NextResponse } from 'next/server';
import { deleteSessionCookie } from '@/lib/auth';

export async function POST() {
  const cookie = deleteSessionCookie();
  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': `${cookie.name}=${cookie.value}; Path=${cookie.path}; HttpOnly; SameSite=${cookie.sameSite}; Max-Age=${cookie.maxAge}`,
      },
    }
  );
}