import { NextRequest, NextResponse } from 'next/server';
import { getPilarAdminClient } from '@/lib/pilar-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = getPilarAdminClient();
  const mes = req.nextUrl.searchParams.get('mes');
  const anio = req.nextUrl.searchParams.get('anio');
  const rubroId = req.nextUrl.searchParams.get('rubro_id');
  const moneda = req.nextUrl.searchParams.get('moneda');

  let query = supabase
    .from('transacciones')
    .select('*, rubros(nombre, tipo, grupo_proveedor)')
    .order('fecha', { ascending: false })
    .limit(500);

  if (mes) query = query.eq('mes', Number(mes));
  if (anio) query = query.eq('anio', Number(anio));
  if (rubroId) query = query.eq('rubro_id', rubroId);
  if (moneda) query = query.eq('moneda', moneda);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const supabase = getPilarAdminClient();
  const body = await req.json();
  const { data, error } = await supabase.from('transacciones').insert(body).select();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
