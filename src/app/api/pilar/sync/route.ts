import { NextResponse } from 'next/server';
import { syncPilarToSupabase } from '@/lib/pilar-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function runSync() {
  try {
    const result = await syncPilarToSupabase();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo sincronizar Pilar.' },
      { status: 500 },
    );
  }
}

export async function POST() {
  return runSync();
}

export async function GET() {
  return runSync();
}
