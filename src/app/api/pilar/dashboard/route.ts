import { NextRequest, NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/pilar-data';
import { getPilarAdminClient } from '@/lib/pilar-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getSupabaseSnapshot() {
  try {
    const supabase = getPilarAdminClient();
    const [transaccionesRes, deudasRes, cajaRes, cuentaUsdRes] = await Promise.all([
      supabase.from('transacciones').select('fecha,mes,anio,cobro_total,pendiente,gastos,saldo,moneda,monto_usd,rubros(nombre,tipo,grupo_proveedor)').order('fecha', { ascending: true }).limit(5000),
      supabase.from('deudas').select('*').order('concepto'),
      supabase.from('caja').select('*').order('orden'),
      supabase.from('cuenta_usd').select('*').order('fecha', { ascending: true }).limit(1000),
    ]);

    const errors = [transaccionesRes.error, deudasRes.error, cajaRes.error, cuentaUsdRes.error].filter(Boolean);
    if (errors.length) {
      return { ok: false, reason: errors.map((item) => item?.message).join(' | ') };
    }

    return {
      ok: true,
      transacciones: transaccionesRes.data || [],
      deudas: deudasRes.data || [],
      caja: cajaRes.data || [],
      cuentaUsd: cuentaUsdRes.data || [],
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown-error' };
  }
}

function emptyCategoryMap(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace('.', '')
    .replace(/^./, (m) => m.toUpperCase());
}

function buildDashboardFromSupabase(snapshot: Awaited<ReturnType<typeof getSupabaseSnapshot>>, selectedYear?: number) {
  if (!snapshot.ok) return null;

  const incomeCategories = ['Ventas Maxi Pisos', 'Ventas Mozzetto', 'Ventas Flex-Color', 'Ventas Lamparas', 'Ventas Mobile', 'Ventas Muresco', 'Ventas Otros', 'Liquidación USD'] as const;
  const expenseCategories = ['Maxi Pisos - Pagos', 'Mozzetto - Pagos', 'Flex-Color - Pagos', 'Lamparas - Pagos', 'Mobile - Pagos', 'Muresco - Pagos', 'Otros Proveedores - Pagos', 'Impuestos', 'Viaticos/Combustible', 'Ferreteria', 'Publicidad', 'Alquiler', 'Colocación', 'Servicios', 'Fletes', 'Gastos Generales', 'Contador', 'AFIP', 'Showroom'] as const;
  const utilityCategories = ['Compra Dolares', 'Utilidades Pilar', 'Utilidades Male'] as const;

  const transacciones = snapshot.transacciones || [];
  const deudas = snapshot.deudas || [];
  const caja = snapshot.caja || [];
  const cuentaUsd = snapshot.cuentaUsd || [];

  const grouped = new Map();
  for (const tx of transacciones) {
    if (!tx.fecha || !tx.mes || !tx.anio) continue;
    const key = `${tx.anio}-${String(tx.mes).padStart(2, '0')}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: monthLabel(Number(tx.anio), Number(tx.mes)),
        year: Number(tx.anio),
        month: Number(tx.mes),
        initialBalance: 0,
        incomeByCategory: emptyCategoryMap(incomeCategories),
        pendingByCategory: emptyCategoryMap(incomeCategories),
        expenseByCategory: emptyCategoryMap(expenseCategories),
        utilityByCategory: emptyCategoryMap(utilityCategories),
        totals: { income: 0, pending: 0, expense: 0, utility: 0, periodBalance: 0, accumulatedBalance: 0 },
      });
    }
    const month = grouped.get(key);
    const rubro = Array.isArray(tx.rubros) ? tx.rubros[0] : tx.rubros;
    const category = rubro?.nombre || 'Sin rubro';
    const tipo = rubro?.tipo || 'ingreso';
    const cobroTotal = Number(tx.cobro_total || 0);
    const pendiente = Number(tx.pendiente || 0);
    const gastos = Number(tx.gastos || 0);

    if (tipo === 'ingreso') {
      month.incomeByCategory[category] = (month.incomeByCategory[category] || 0) + cobroTotal;
      month.pendingByCategory[category] = (month.pendingByCategory[category] || 0) + pendiente;
      month.totals.income += cobroTotal;
      month.totals.pending += pendiente;
    } else if (tipo === 'egreso') {
      month.expenseByCategory[category] = (month.expenseByCategory[category] || 0) + gastos;
      month.totals.expense += gastos;
    } else if (tipo === 'utilidad') {
      month.utilityByCategory[category] = (month.utilityByCategory[category] || 0) + gastos;
      month.totals.utility += gastos;
    }
  }

  const allMonths = Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key));
  let running = 0;
  for (const month of allMonths) {
    month.initialBalance = running;
    month.totals.periodBalance = month.totals.income + month.totals.pending - month.totals.expense - month.totals.utility;
    running += month.totals.periodBalance;
    month.totals.accumulatedBalance = running;
  }

  const years = [...new Set(allMonths.map((item) => item.year))].sort((a, b) => b - a);
  const activeYear = selectedYear && years.includes(selectedYear) ? selectedYear : years[0];
  const visibleMonths = allMonths.filter((item) => item.year === activeYear);
  const latestMonth = visibleMonths[visibleMonths.length - 1] || null;

  const base = getDashboardData(activeYear);
  const deudaTotal = deudas.reduce((acc, item) => acc + Number(item.monto || 0), 0);
  const cajaCuentas = caja.map((item) => ({ concepto: item.concepto, monto: Number(item.monto || 0) }));
  const baseCaja = cajaCuentas.filter((item) => item.concepto !== 'Dolares').reduce((acc, item) => acc + item.monto, 0);
  const saldoUsd = cuentaUsd.reduce((acc, item) => {
    const monto = Number(item.monto_usd || 0);
    if (item.tipo === 'pago_proveedor' || item.tipo === 'retiro_pilar') return acc - monto;
    return acc + monto;
  }, 0);
  const pendienteDeCobrar = latestMonth?.totals.pending || 0;
  const cajaMobile = baseCaja + pendienteDeCobrar;
  const cajaTeorica = latestMonth?.totals.accumulatedBalance || 0;

  return {
    ...base,
    flujo: {
      ...base.flujo,
      generatedAt: `supabase-live:${new Date().toISOString()}`,
      debts: deudas.map((item) => ({ concept: item.concepto, amount: Number(item.monto || 0), dueDate: item.vencimiento || null })),
      recordsPreview: base.flujo.recordsPreview,
      metrics: {
        ...base.flujo.metrics,
        totalDebt: deudaTotal,
      },
      summary: allMonths,
    },
    selectedYear: activeYear,
    years,
    months: visibleMonths,
    latestMonth,
    caja: {
      pendienteDeCobrar,
      cajaMobile,
      cajaTeorica,
      diferencia: cajaMobile - cajaTeorica,
      deudas: deudaTotal,
      dineroDisponible: cajaMobile - deudaTotal,
      dolaresCantidad: saldoUsd,
      cuentas: cajaCuentas,
    },
    notifications: base.notifications,
  };
}

export async function GET(req: NextRequest) {
  const yearParam = req.nextUrl.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  const snapshot = await getSupabaseSnapshot();
  const liveData = buildDashboardFromSupabase(snapshot, Number.isFinite(year) ? year : undefined);
  if (liveData) return NextResponse.json(liveData);
  const data = getDashboardData(Number.isFinite(year) ? year : undefined);
  return NextResponse.json({ ...data, source: 'json-fallback', sourceError: snapshot.ok ? null : snapshot.reason });
}
