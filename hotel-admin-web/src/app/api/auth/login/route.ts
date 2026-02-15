import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CORE_API_BASE_URL = process.env.CORE_API_BASE_URL || 'http://localhost:8000';
const CORE_LOGIN_PATH = process.env.CORE_LOGIN_PATH || '/admin/auth/login';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'hotel_admin_access';

type LoginPayload = { email: string; password: string };

function extractAccessToken(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  // Common shapes
  if (typeof obj.access_token === 'string') return obj.access_token;
  if (typeof obj.token === 'string') return obj.token;
  if (obj.data && typeof obj.data.access_token === 'string') return obj.data.access_token;
  return null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<LoginPayload>;
  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Missing email/password' }, { status: 400 });
  }

  const res = await fetch(`${CORE_API_BASE_URL}${CORE_LOGIN_PATH}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
      // Do not cache auth
      cache: 'no-store',
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: data?.detail || data?.error || 'Login failed', raw: data },
      { status: res.status }
    );
  }

  const token = extractAccessToken(data);
  if (!token) {
    return NextResponse.json(
      { error: 'Core login succeeded but no access token found in response', raw: data },
      { status: 500 }
    );
  }

  // Store in httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return NextResponse.json({ ok: true });
}
