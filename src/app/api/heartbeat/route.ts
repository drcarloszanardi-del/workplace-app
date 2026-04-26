export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readLocalStatus, syncStatusToSupabase, writeLocalStatus } from '@/lib/workplace';

export async function POST() {
  const status = await readLocalStatus();
  status.lastHeartbeat = new Date().toISOString();
  await writeLocalStatus(status);
  const error = await syncStatusToSupabase(status);
  return NextResponse.json({ ok: !error, error: error?.message ?? null, status });
}
