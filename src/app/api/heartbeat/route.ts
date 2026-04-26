export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { syncStatusToSupabase, writeLocalStatus } from '@/lib/workplace';
import { refreshStructuredStatus } from '@/lib/workplace-sync';

export async function POST() {
  const status = await refreshStructuredStatus();
  status.lastHeartbeat = new Date().toISOString();
  await writeLocalStatus(status);
  const error = await syncStatusToSupabase(status);
  return NextResponse.json({ ok: !error, error: error?.message ?? null, status });
}
