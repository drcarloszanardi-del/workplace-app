import { NextRequest, NextResponse } from 'next/server';
import { getPilarAdminClient } from '@/lib/pilar-server';
import { addFallbackDebt, readFallbackStore } from '@/lib/pilar-fallback-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = getPilarAdminClient();
    const { data, error } = await supabase.from('pilar_deudas').select('*').order('concepto');
    if (error) throw error;
    return NextResponse.json({ ok: true, mode: 'supabase', data });
  } catch (error) {
    const store = await readFallbackStore();
    return NextResponse.json({ ok: true, mode: 'fallback', data: store.debts, warning: error instanceof Error ? error.message : 'fallback' });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const supabase = getPilarAdminClient();
    const payload = {
      concepto: body.concepto,
      monto: Number(body.monto || 0),
      vencimiento: body.vencimiento || null,
    };
    const { data, error } = await supabase.from('pilar_deudas').insert(payload).select();
    if (error) throw error;
    return NextResponse.json({ ok: true, mode: 'supabase', data }, { status: 201 });
  } catch (error) {
    const debt = await addFallbackDebt({
      concept: body.concepto,
      amount: Number(body.monto || 0),
      dueDate: body.vencimiento || null,
    });
    return NextResponse.json({ ok: true, mode: 'fallback', data: debt, warning: error instanceof Error ? error.message : 'fallback' }, { status: 201 });
  }
}
