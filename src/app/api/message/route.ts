export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const OPENCLAW_URL = 'http://127.0.0.1:18789';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await fetch(OPENCLAW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'unknown' }, { status: 502 });
  }
}
