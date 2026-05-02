import { NextResponse } from 'next/server';
import { getPilarAdminClient } from '@/lib/pilar-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = getPilarAdminClient();
  const { data, error } = await supabase.from('cuenta_usd').select('*').order('fecha', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const saldo = (data || []).reduce((acc, item) => acc + Number(item.monto_usd || 0), 0);
  return NextResponse.json({ ok: true, saldo_usd: saldo, data });
}
