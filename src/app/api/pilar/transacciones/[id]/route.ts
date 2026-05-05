import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPilarAdminClient } from '@/lib/pilar-server';
import { updateFallbackTransaction } from '@/lib/pilar-fallback-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveRubroId(supabase: SupabaseClient, body: Record<string, unknown>, currentRubroId: string | null) {
  if (body.rubro_id) return String(body.rubro_id);
  const category = String(body.categoria || body.rubro_nombre || '').trim();
  if (!category) return currentRubroId;
  const { data, error } = await supabase.from('pilar_rubros').select('id').eq('nombre', category).maybeSingle();
  if (error) throw error;
  return data?.id || currentRubroId;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();
  try {
    const supabase = getPilarAdminClient();
    const { data: current, error: currentError } = await supabase
      .from('pilar_transacciones')
      .select('*')
      .eq('id', id)
      .single();
    if (currentError) throw currentError;

    const payload = {
      fecha: body.fecha ?? current.fecha,
      mes: body.mes != null ? Number(body.mes) : current.mes,
      anio: body.anio != null ? Number(body.anio) : current.anio,
      cliente: body.cliente ?? current.cliente ?? '',
      producto: body.producto ?? current.producto ?? '',
      presupuesto: body.presupuesto != null ? Number(body.presupuesto) : Number(current.presupuesto || 0),
      presupuesto_proveedor: body.presupuesto_proveedor != null ? Number(body.presupuesto_proveedor) : Number(current.presupuesto_proveedor || 0),
      cobro_1: body.cobro_1 != null ? Number(body.cobro_1) : Number(current.cobro_1 || 0),
      pendiente: body.pendiente != null ? Number(body.pendiente) : Number(current.pendiente || 0),
      fecha_2: body.fecha_2 !== undefined ? body.fecha_2 || null : current.fecha_2,
      mes_2: body.mes_2 !== undefined ? (body.mes_2 ? Number(body.mes_2) : null) : current.mes_2,
      anio_2: body.anio_2 !== undefined ? (body.anio_2 ? Number(body.anio_2) : null) : current.anio_2,
      cobro_2: body.cobro_2 != null ? Number(body.cobro_2) : Number(current.cobro_2 || 0),
      cobro_total: body.cobro_total != null ? Number(body.cobro_total) : Number(current.cobro_total || 0),
      saldo: body.saldo != null ? Number(body.saldo) : Number(current.saldo || 0),
      gastos: body.gastos != null ? Number(body.gastos) : Number(current.gastos || 0),
      moneda: body.moneda ?? current.moneda ?? 'ARS',
      monto_usd: body.monto_usd != null ? Number(body.monto_usd) : Number(current.monto_usd || 0),
      rubro_id: await resolveRubroId(supabase, body as Record<string, unknown>, current.rubro_id || null),
      numero: body.numero != null ? Number(body.numero) : current.numero,
    };
    const { data, error } = await supabase.from('pilar_transacciones').update(payload).eq('id', id).select('*, pilar_rubros(nombre, tipo, grupo_proveedor)');
    if (error) throw error;
    return NextResponse.json({ ok: true, mode: 'supabase', data });
  } catch (error) {
    if (Number.isNaN(Number(id))) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar en Supabase' }, { status: 500 });
    }
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
