import { NextRequest, NextResponse } from 'next/server';
import { getPilarAdminClient } from '@/lib/pilar-server';
import { updateFallbackDebt } from '@/lib/pilar-fallback-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  try {
    const supabase = getPilarAdminClient();
    const { data, error } = await supabase
      .from('pilar_deudas')
      .update({ concepto: body.concepto, monto: Number(body.monto || 0), vencimiento: body.vencimiento || null })
      .eq('concepto', body.originalConcepto)
      .eq('vencimiento', body.originalVencimiento || null)
      .select();
    if (error) throw error;
    return NextResponse.json({ ok: true, mode: 'supabase', data });
  } catch (error) {
    const updated = await updateFallbackDebt(
      { concept: body.originalConcepto, dueDate: body.originalVencimiento || null },
      { concept: body.concepto, amount: Number(body.monto || 0), dueDate: body.vencimiento || null },
    );
    if (!updated) return NextResponse.json({ ok: false, error: 'Deuda no encontrada en fallback' }, { status: 404 });
    return NextResponse.json({ ok: true, mode: 'fallback', data: updated, warning: error instanceof Error ? error.message : 'fallback' });
  }
}
