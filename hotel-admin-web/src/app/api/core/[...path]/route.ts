import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CORE_API_BASE_URL = process.env.CORE_API_BASE_URL || 'http://localhost:8000';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'hotel_admin_access';

async function forward(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const { path } = await params;
  const pathStr = path.join('/');
  const target = new URL(`${CORE_API_BASE_URL}/${pathStr}`);
  // forward query params
  url.searchParams.forEach((v, k) => target.searchParams.append(k, v));

  const init: RequestInit = {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${token}`,
      // pass content-type if present
      ...(req.headers.get('content-type') ? { 'Content-Type': req.headers.get('content-type')! } : {}),
    },
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  const resp = await fetch(target.toString(), init);
  const contentType = resp.headers.get('content-type') || 'application/json';
  const bytes = await resp.arrayBuffer();
  return new NextResponse(bytes, { status: resp.status, headers: { 'Content-Type': contentType } });
}

export async function GET(req: Request, ctx: any) { return forward(req, ctx); }
export async function POST(req: Request, ctx: any) { return forward(req, ctx); }
export async function PUT(req: Request, ctx: any) { return forward(req, ctx); }
export async function DELETE(req: Request, ctx: any) { return forward(req, ctx); }
