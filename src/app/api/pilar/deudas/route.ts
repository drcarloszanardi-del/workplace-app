import { NextResponse } from 'next/server';
import { getPilarAdminClient } from '@/lib/pilar-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = getPilarAdminClient();
  const { data, error } = await supabase.from('deudas').select('*').order('concepto');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
