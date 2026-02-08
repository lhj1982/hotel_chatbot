import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'hotel_admin_access';

export async function POST() {
  const cookieStore = cookies();
  cookieStore.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
