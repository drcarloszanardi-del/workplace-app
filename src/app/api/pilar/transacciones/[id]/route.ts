import { NextRequest, NextResponse } from 'next/server';
import { getPilarAdminClient } from '@/lib/pilar-server';
import { updateFallbackTransaction } from '@/lib/pilar-fallback-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();
  try {
    const supabase = getPilarAdminClient();
    const payload = {
      fecha: body.fecha,
      mes: Number(body.mes || 0),
      anio: Number(body.anio || 0),
      cliente: body.cliente || '',
      producto: body.producto || '',
      presupuesto: Number(body.presupuesto || 0),
      presupuesto_proveedor: Number(body.presupuesto_proveedor || 0),
      cobro_1: Number(body.cobro_1 || 0),
      pendiente: Number(body.pendiente || 0),
      fecha_2: body.fecha_2 || null,
      mes_2: body.mes_2 ? Number(body.mes_2) : null,
      anio_2: body.anio_2 ? Number(body.anio_2) : null,
      cobro_2: Number(body.cobro_2 || 0),
      cobro_total: Number(body.cobro_total || 0),
      saldo: Number(body.saldo || 0),
      gastos: Number(body.gastos || 0),
      moneda: body.moneda || 'ARS',
      monto_usd: Number(body.monto_usd || 0),
      rubro_id: body.rubro_id || null,
      numero: body.numero || null,
    };
    const { data, error } = await supabase.from('pilar_transacciones').update(payload).eq('id', id).select();
    if (error) throw error;
    return NextResponse.json({ ok: true, mode: 'supabase', data });
  } catch (error) {
    const updated = await updateFallbackTransaction(Number(id), {
      date: body.fecha,
      month: Number(body.mes || 0),
      year: Number(body.anio || 0),
      client: body.cliente || '',
      product: body.producto || '',
      category: body.categoria || body.rubro_nombre || 'Ventas Otros',
      budget: Number(body.presupuesto || 0),
      supplierBudget: Number(body.presupuesto_proveedor || 0),
      collection1: Number(body.cobro_1 || 0),
      pending: Number(body.pendiente || 0),
      date2: body.fecha_2 || null,
      month2: Number(body.mes_2 || 0),
      year2: Number(body.anio_2 || 0),
      collection2: Number(body.cobro_2 || 0),
      totalCollection: Number(body.cobro_total || 0),
      balance: Number(body.saldo || 0),
      expense: Number(body.gastos || 0),
    });
    if (!updated) return NextResponse.json({ ok: false, error: 'Registro no encontrado en fallback' }, { status: 404 });
    return NextResponse.json({ ok: true, mode: 'fallback', data: updated, warning: error instanceof Error ? error.message : 'fallback' });
  }
}
