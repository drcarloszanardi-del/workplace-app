import 'server-only';
import { buildNotifications, buildProviderRows, buildProviderTotals, getDashboardData, getAvailableYears } from '@/lib/pilar-data';
import { getPilarAdminClient, getPilarEnvState } from '@/lib/pilar-server';
import type { PilarDashboardData } from '@/lib/pilar-types';

function normalizeScalarText(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  return normalized === 'undefined' || normalized === 'null' ? null : trimmed;
}

function toOptionalNumber(value: unknown) {
  const normalizedValue = normalizeScalarText(value);
  if (normalizedValue === null || normalizedValue === undefined || normalizedValue === '') return null;
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRecordId(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toAmount(value: unknown) {
  return toOptionalNumber(value) ?? 0;
}

function toText(value: unknown) {
  const normalizedValue = normalizeScalarText(value);
  return typeof normalizedValue === 'string' ? normalizedValue : '';
}

function normalizeDateText(value: unknown) {
  const normalizedValue = normalizeScalarText(value);
  if (typeof normalizedValue !== 'string') return null;
  const match = normalizedValue.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : normalizedValue;
}

export function normalizePilarSourceError(reason: string, fallbackLabel = 'fallback JSON estático') {
  const lowered = reason.toLowerCase();
  if (reason.includes('Supabase env missing') || reason.includes('Supabase public env missing')) {
    return `${reason}. Se usa ${fallbackLabel} mientras tanto.`;
  }
  if (reason.includes('relation') && reason.includes('does not exist')) {
    return 'Supabase respondió pero faltan tablas de Pilar en este entorno.';
  }
  if (lowered.includes('permission denied') || lowered.includes('jwt')) {
    return 'Supabase rechazó el acceso a las tablas de Pilar en este entorno.';
  }
  if (
    lowered.includes('enoent') ||
    lowered.includes('cannot find module') ||
    lowered.includes('module not found') ||
    lowered.includes('unexpected token') ||
    lowered.includes('json') ||
    lowered.includes('serialization') ||
    lowered.includes('serialize') ||
    lowered.includes('date')
  ) {
    return `El entorno serverless no pudo cargar datos serializables en runtime; se mantiene ${fallbackLabel}.`;
  }
  return 'Supabase no devolvió datos útiles todavía.';
}

async function getSupabaseSnapshot() {
  const envState = getPilarEnvState();
  if (!envState.hasSupabaseUrl || !envState.hasServiceRoleKey) {
    return {
      ok: false,
      reason: normalizePilarSourceError(
        'Supabase env missing: falta configurar [NEXT_PUBLIC_PILAR_SUPABASE_URL | PILAR_SUPABASE_URL] + [PILAR_SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SERVICE_ROLE_KEY]',
      ),
    };
  }

  try {
    const supabase = getPilarAdminClient();
    const [transaccionesRes, deudasRes, cajaRes, cuentaUsdRes] = await Promise.all([
      supabase.from('pilar_transacciones').select('numero,cliente,producto,presupuesto,presupuesto_proveedor,cobro_1,fecha_2,mes_2,anio_2,cobro_2,fecha,mes,anio,cobro_total,pendiente,gastos,saldo,moneda,monto_usd,pilar_rubros(nombre,tipo,grupo_proveedor)').order('fecha', { ascending: true }).limit(5000),
      supabase.from('pilar_deudas').select('*').order('concepto'),
      supabase.from('pilar_caja').select('*').order('orden'),
      supabase.from('pilar_cuenta_usd').select('*').order('fecha', { ascending: true }).limit(1000),
    ]);

    const errors = [transaccionesRes.error, deudasRes.error, cajaRes.error, cuentaUsdRes.error].filter(Boolean);
    if (errors.length) {
      return { ok: false, reason: normalizePilarSourceError(errors.map((item) => item?.message).join(' | ')) };
    }

    return {
      ok: true,
      transacciones: transaccionesRes.data || [],
      deudas: deudasRes.data || [],
      caja: cajaRes.data || [],
      cuentaUsd: cuentaUsdRes.data || [],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown-error';
    return { ok: false, reason: normalizePilarSourceError(reason) };
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

function isUsdConcept(concepto: string) {
  const normalized = concepto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('dolar') || normalized.includes('usd');
}

function buildDashboardFromSupabase(
  snapshot: Awaited<ReturnType<typeof getSupabaseSnapshot>>,
  selectedYear?: number,
): PilarDashboardData | null {
  if (!snapshot.ok) return null;

  const hasUsefulLiveData =
    (snapshot.transacciones?.length || 0) > 0 ||
    (snapshot.deudas?.length || 0) > 0 ||
    (snapshot.caja?.length || 0) > 0 ||
    (snapshot.cuentaUsd?.length || 0) > 0;

  if (!hasUsefulLiveData) return null;

  const incomeCategories = ['Ventas Maxi Pisos', 'Ventas Mozzetto', 'Ventas Flex-Color', 'Ventas Lamparas', 'Ventas Mobile', 'Ventas Muresco', 'Ventas Otros', 'Liquidación USD'] as const;
  const expenseCategories = ['Maxi Pisos - Pagos', 'Mozzetto - Pagos', 'Flex-Color - Pagos', 'Lamparas - Pagos', 'Mobile - Pagos', 'Muresco - Pagos', 'Otros Proveedores - Pagos', 'Impuestos', 'Viaticos/Combustible', 'Ferreteria', 'Publicidad', 'Alquiler', 'Colocación', 'Servicios', 'Fletes', 'Gastos Generales', 'Contador', 'AFIP', 'Showroom'] as const;
  const utilityCategories = ['Compra Dolares', 'Utilidades Pilar', 'Utilidades Male'] as const;

  const transacciones = snapshot.transacciones || [];
  const deudas = snapshot.deudas || [];
  const caja = snapshot.caja || [];
  const cuentaUsd = snapshot.cuentaUsd || [];

  const grouped = new Map();
  for (const tx of transacciones) {
    const txDate = normalizeDateText(tx.fecha);
    const txMonth = toOptionalNumber(tx.mes);
    const txYear = toOptionalNumber(tx.anio);
    if (!txDate || !txMonth || !txYear) continue;
    const key = `${txYear}-${String(txMonth).padStart(2, '0')}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: monthLabel(txYear, txMonth),
        year: txYear,
        month: txMonth,
        initialBalance: 0,
        incomeByCategory: emptyCategoryMap(incomeCategories),
        pendingByCategory: emptyCategoryMap(incomeCategories),
        expenseByCategory: emptyCategoryMap(expenseCategories),
        utilityByCategory: emptyCategoryMap(utilityCategories),
        totals: { income: 0, pending: 0, expense: 0, utility: 0, periodBalance: 0, accumulatedBalance: 0 },
      });
    }
    const month = grouped.get(key);
    const rubro = Array.isArray((tx as { pilar_rubros?: unknown }).pilar_rubros)
      ? (tx as { pilar_rubros?: Array<{ nombre?: string; tipo?: string }> }).pilar_rubros?.[0]
      : (tx as { pilar_rubros?: { nombre?: string; tipo?: string } }).pilar_rubros;
    const category = toText(rubro?.nombre) || 'Sin rubro';
    const tipo = (toText(rubro?.tipo) || 'ingreso').trim().toLowerCase();
    const cobroTotal = toAmount(tx.cobro_total);
    const pendiente = toAmount(tx.pendiente);
    const gastos = toAmount(tx.gastos);

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

  const fallbackBase = getDashboardData();
  const fallbackYears = getAvailableYears(fallbackBase.flujo);
  const years = [...new Set([...allMonths.map((item) => item.year), ...fallbackYears])].sort((a, b) => b - a);
  const activeYear = selectedYear && years.includes(selectedYear) ? selectedYear : (years[0] ?? fallbackYears[0]);
  const visibleMonths = allMonths.filter((item) => item.year === activeYear);

  const base = activeYear === fallbackBase.selectedYear ? fallbackBase : getDashboardData(activeYear);
  const displayMonths = visibleMonths.length ? visibleMonths : base.months;
  const latestMonth = displayMonths[displayMonths.length - 1] || null;
  const deudaTotal = deudas.reduce((acc, item) => acc + toAmount(item.monto), 0);
  const cajaCuentas = caja.map((item) => ({ concepto: toText(item.concepto), monto: toAmount(item.monto) }));
  const baseCaja = cajaCuentas.filter((item) => !isUsdConcept(item.concepto)).reduce((acc, item) => acc + item.monto, 0);
  const saldoUsd = cuentaUsd.reduce((acc, item) => {
    const monto = toAmount(item.monto_usd);
    const tipo = toText(item.tipo).toLowerCase();
    if (tipo === 'pago_proveedor' || tipo === 'retiro_pilar') return acc - monto;
    return acc + monto;
  }, 0);
  const pendienteDeCobrar = visibleMonths.length ? latestMonth?.totals.pending || 0 : base.caja.pendienteDeCobrar;
  const cajaMobile = visibleMonths.length ? baseCaja + pendienteDeCobrar : base.caja.cajaMobile;
  const cajaTeorica = visibleMonths.length ? latestMonth?.totals.accumulatedBalance || 0 : base.caja.cajaTeorica;

  const flujo = {
    ...base.flujo,
    generatedAt: `supabase-live:${new Date().toISOString()}`,
    months: allMonths.map((item) => ({ key: item.key, label: item.label, year: item.year, month: item.month })),
    debts: deudas.map((item) => ({ concept: toText(item.concepto), amount: toAmount(item.monto), dueDate: normalizeDateText(item.vencimiento) })),
    recordsPreview: transacciones
      .slice()
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
      .slice(0, 500)
      .map((item, index) => {
        const rubro = Array.isArray((item as { pilar_rubros?: unknown }).pilar_rubros)
          ? (item as { pilar_rubros?: Array<{ nombre?: string }> }).pilar_rubros?.[0]
          : (item as { pilar_rubros?: { nombre?: string } }).pilar_rubros;
        return {
          id: toRecordId(item.numero, index + 1),
          date: normalizeDateText(item.fecha),
          month: toOptionalNumber(item.mes),
          year: toOptionalNumber(item.anio),
          client: toText(item.cliente),
          product: toText(item.producto),
          category: toText(rubro?.nombre),
          budget: toAmount(item.presupuesto),
          supplierBudget: toAmount(item.presupuesto_proveedor),
          collection1: toAmount(item.cobro_1),
          pending: toAmount(item.pendiente),
          date2: normalizeDateText(item.fecha_2),
          month2: toOptionalNumber(item.mes_2),
          year2: toOptionalNumber(item.anio_2),
          collection2: toAmount(item.cobro_2),
          totalCollection: toAmount(item.cobro_total),
          balance: toAmount(item.saldo),
          expense: toAmount(item.gastos),
        };
      }),
    metrics: {
      ...base.flujo.metrics,
      totalDebt: deudaTotal,
    },
    summary: allMonths,
  };
  const cajaData = {
    pendienteDeCobrar,
    cajaMobile,
    cajaTeorica,
    diferencia: cajaMobile - cajaTeorica,
    deudas: deudaTotal,
    dineroDisponible: cajaMobile - deudaTotal,
    dolaresCantidad: saldoUsd,
    cuentas: cajaCuentas,
  };

  return {
    ...base,
    source: 'supabase-live',
    sourceError: null,
    flujo,
    selectedYear: activeYear,
    years,
    months: displayMonths,
    latestMonth,
    providerRows: buildProviderRows(displayMonths),
    providerTotals: buildProviderTotals(displayMonths),
    caja: visibleMonths.length ? cajaData : base.caja,
    notifications: buildNotifications(displayMonths, visibleMonths.length ? cajaData : base.caja, flujo),
  };
}

export function normalizeYear(value?: number | null) {
  return Number.isInteger(value) && Number(value) >= 2000 ? Number(value) : undefined;
}

export async function getDashboardPayload(selectedYear?: number): Promise<PilarDashboardData> {
  const year = normalizeYear(selectedYear);
  const snapshot = await getSupabaseSnapshot();
  const liveData = buildDashboardFromSupabase(snapshot, year);
  if (liveData) return liveData;
  const data = getDashboardData(year);
  const sourceError = snapshot.ok
    ? 'Supabase no devolvió datos útiles todavía.'
    : snapshot.reason;
  return { ...data, source: 'json-static-fallback', sourceError };
}
