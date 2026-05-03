import { NextRequest, NextResponse } from 'next/server';
import { getDashboardPayload } from '@/lib/pilar-dashboard-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get('year');
  const parsedYear = yearParam ? Number(yearParam) : undefined;
  const payload = await getDashboardPayload(parsedYear);

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
