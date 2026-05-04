import { NextRequest, NextResponse } from 'next/server';
import { getDashboardPayload } from '@/lib/pilar-dashboard-data';
import { getPilarEnvState } from '@/lib/pilar-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get('year');
  const parsedYear = yearParam ? Number(yearParam) : undefined;
  const payload = await getDashboardPayload(parsedYear);
  const sourceError = payload.sourceError?.replace(/\s+/g, ' ').slice(0, 180);
  const envState = getPilarEnvState();
  const envReady = envState.hasSupabaseUrl && envState.hasServiceRoleKey;
  const envMissing = envState.missingGroups.map((group) => group.join('|')).join(',');

  const headers = new Headers({
    'Cache-Control': 'no-store, max-age=0',
    'X-Pilar-Data-Source': payload.source || 'unknown',
    'X-Pilar-Source-Error': sourceError || 'none',
    'X-Pilar-Env-Ready': envReady ? 'yes' : 'no',
    'X-Pilar-Env-Missing': envMissing || 'none',
  });

  return NextResponse.json(payload, { headers });
}
