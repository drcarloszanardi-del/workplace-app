import flujoData from '@/data/flujo-fondos.json';
import type {
  CajaSummary,
  DashboardNotification,
  FlujoData,
  MonthlySummary,
  PilarDashboardData,
  ProviderRow,
} from '@/lib/pilar-types';

const INCOME_CATEGORIES = [
  'Ventas Maxi Pisos',
  'Ventas Mozzetto',
  'Ventas Flex-Color',
  'Ventas Lamparas',
  'Ventas Mobile',
  'Ventas Muresco',
  'Ventas Otros',
  'Liquidación USD',
] as const;

const PENDING_CATEGORIES = [
  'Ventas Maxi Pisos',
  'Ventas Mozzetto',
  'Ventas Flex-Color',
  'Ventas Lamparas',
  'Ventas Mobile',
  'Ventas Muresco',
  'Ventas Otros',
] as const;

const EXPENSE_CATEGORIES = [
  'Maxi Pisos - Pagos',
  'Mozzetto - Pagos',
  'Flex-Color - Pagos',
  'Lamparas - Pagos',
  'Mobile - Pagos',
  'Muresco - Pagos',
  'Otros Proveedores - Pagos',
  'Impuestos',
  'Viaticos/Combustible',
  'Ferreteria',
  'Publicidad',
  'Alquiler',
  'Colocación',
  'Servicios',
  'Fletes',
  'Gastos Generales',
  'Contador',
  'AFIP',
  'Showroom',
] as const;

const UTILITY_CATEGORIES = ['Compra Dolares', 'Utilidades Pilar', 'Utilidades Male'] as const;

const PROVIDER_GROUPS = [
  { provider: 'Maxi Pisos', income: 'Ventas Maxi Pisos', expense: 'Maxi Pisos - Pagos' },
  { provider: 'Mozzetto', income: 'Ventas Mozzetto', expense: 'Mozzetto - Pagos' },
  { provider: 'Flex-Color', income: 'Ventas Flex-Color', expense: 'Flex-Color - Pagos' },
  { provider: 'Lamparas', income: 'Ventas Lamparas', expense: 'Lamparas - Pagos' },
  { provider: 'Mobile', income: 'Ventas Mobile', expense: 'Mobile - Pagos' },
  { provider: 'Muresco', income: 'Ventas Muresco', expense: 'Muresco - Pagos' },
  { provider: 'Otros', income: 'Ventas Otros', expense: 'Otros Proveedores - Pagos' },
] as const;

const CAJA_BASE = [
  { concepto: 'Efectivo Pili', monto: 541800 },
  { concepto: 'Banco Nacion', monto: 602512.13 },
  { concepto: 'Banco pcia. Credito', monto: 0 },
  { concepto: 'Cheques', monto: 0 },
  { concepto: 'Dolares (cantidad)', monto: 5870 },
] as const;

const PILAR_FLUJO_DATA = flujoData as FlujoData;

export const pilarData: FlujoData = PILAR_FLUJO_DATA;

export function getFlujoData(): FlujoData {
  return pilarData;
}

export function getAvailableYears(data: FlujoData) {
  return [...new Set(data.summary.map((item) => item.year))].sort((a, b) => b - a);
}

export function getDashboardData(selectedYear?: number): PilarDashboardData {
  const flujo = getFlujoData();
  const years = getAvailableYears(flujo);
  const activeYear = selectedYear && years.includes(selectedYear) ? selectedYear : years[0];
  const months = flujo.summary.filter((item) => item.year === activeYear);
  const latestMonth = months[months.length - 1] || null;
  const providerRows = buildProviderRows(flujo.summary);
  const providerTotals = buildProviderTotals(flujo.summary);
  const caja = buildCajaSummary(flujo, months);
  const notifications = buildNotifications(months, caja, flujo);

  return {
    flujo,
    source: 'json-static-fallback',
    sourceError: null,
    selectedYear: activeYear,
    years,
    months,
    latestMonth,
    providerRows,
    providerTotals,
    caja,
    notifications,
  };
}

function sumValues(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}

function parseDebtDueDate(value: string | null) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildProviderRows(summary: MonthlySummary[]): ProviderRow[] {
  const rows = PROVIDER_GROUPS.map(({ provider, income, expense }) => {
    const ingresos = sumValues(
      summary.map((month) => (month.incomeByCategory[income] || 0) + (month.pendingByCategory[income] || 0)),
    );
    const gastos = sumValues(summary.map((month) => month.expenseByCategory[expense] || 0));
    const diferencia = ingresos - gastos;
    return { provider, ingresos, gastos, diferencia, incidencia: 0 };
  });

  const totalDiferencia = sumValues(rows.map((row) => row.diferencia)) || 1;
  return rows.map((row) => ({ ...row, incidencia: row.diferencia / totalDiferencia }));
}

export function buildProviderTotals(summary: MonthlySummary[]) {
  const ventasTotales = sumValues(summary.map((month) => month.totals.income + month.totals.pending));
  const gastosOperativos = sumValues(summary.map((month) => month.totals.expense));
  const resultado = ventasTotales - gastosOperativos;
  const rentabilidad = gastosOperativos === 0 ? 0 : ventasTotales / gastosOperativos - 1;
  return { ventasTotales, gastosOperativos, resultado, rentabilidad };
}

function buildCajaSummary(flujo: FlujoData, months: MonthlySummary[]): CajaSummary {
  const latestMonth = months[months.length - 1] || flujo.summary[flujo.summary.length - 1];
  const pendienteDeCobrar = latestMonth ? latestMonth.totals.pending : 0;
  const cuentas = CAJA_BASE.map((item) => ({ ...item }));
  const baseCaja = sumValues(cuentas.slice(0, 4).map((item) => item.monto));
  const cajaMobile = baseCaja + pendienteDeCobrar;
  const cajaTeorica = latestMonth ? latestMonth.totals.accumulatedBalance : 0;
  const deudas = flujo.metrics.totalDebt || 0;
  return {
    pendienteDeCobrar,
    cajaMobile,
    cajaTeorica,
    diferencia: cajaMobile - cajaTeorica,
    deudas,
    dineroDisponible: cajaMobile - deudas,
    dolaresCantidad: cuentas[4]?.monto || 0,
    cuentas,
  };
}

export function buildNotifications(
  months: MonthlySummary[],
  caja: CajaSummary,
  flujo: FlujoData,
): DashboardNotification[] {
  const notifications: DashboardNotification[] = [];
  const latestMonth = months[months.length - 1] || flujo.summary[flujo.summary.length - 1];

  if (latestMonth && latestMonth.totals.accumulatedBalance < 0) {
    notifications.push({
      tone: 'danger',
      title: 'Saldo acumulado negativo',
      message: `El mes ${latestMonth.label} cerró con saldo acumulado negativo.`,
    });
  }

  const now = new Date();
  const upcomingDebt = flujo.debts.find((debt) => {
    const due = parseDebtDueDate(debt.dueDate);
    if (!due) return false;
    const diffDays = (due.getTime() - now.getTime()) / 86400000;
    return diffDays >= 0 && diffDays <= 7;
  });

  if (upcomingDebt) {
    notifications.push({
      tone: 'warning',
      title: 'Deuda próxima a vencer',
      message: `${upcomingDebt.concept} vence dentro de los próximos 7 días.`,
    });
  }

  if (caja.dolaresCantidad < 500) {
    notifications.push({
      tone: 'info',
      title: 'Saldo USD bajo',
      message: 'La cuenta de dólares quedó por debajo del umbral de 500 USD.',
    });
  }

  return notifications;
}

export function buildDashboardRows(month: MonthlySummary) {
  return [
    { kind: 'saldo', label: 'SALDO INICIAL', value: month.initialBalance },
    { kind: 'section', label: 'TOTAL INGRESOS', value: month.totals.income },
    ...INCOME_CATEGORIES.map((label) => ({ kind: 'income', label, value: month.incomeByCategory[label] || 0 })),
    { kind: 'section', label: 'PENDIENTE DE COBRAR', value: month.totals.pending },
    ...PENDING_CATEGORIES.map((label) => ({ kind: 'pending', label, value: month.pendingByCategory[label] || 0 })),
    { kind: 'section', label: 'TOTAL EGRESOS', value: month.totals.expense },
    ...EXPENSE_CATEGORIES.map((label) => ({ kind: 'expense', label, value: month.expenseByCategory[label] || 0 })),
    { kind: 'section', label: 'TOTAL UTILIDADES', value: month.totals.utility },
    ...UTILITY_CATEGORIES.map((label) => ({ kind: 'utility', label, value: month.utilityByCategory[label] || 0 })),
    { kind: 'saldo', label: 'SALDO PERÍODO', value: month.totals.periodBalance },
    { kind: 'saldo', label: 'SALDO ACUMULADO', value: month.totals.accumulatedBalance },
  ] as const;
}
