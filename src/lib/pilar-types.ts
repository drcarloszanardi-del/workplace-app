export type MonthKey = string;

export type MonthlySummary = {
  key: MonthKey;
  label: string;
  year: number;
  month: number;
  initialBalance: number;
  incomeByCategory: Record<string, number>;
  pendingByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  utilityByCategory: Record<string, number>;
  totals: {
    income: number;
    pending: number;
    expense: number;
    utility: number;
    periodBalance: number;
    accumulatedBalance: number;
  };
  excelCheck?: Record<string, number>;
};

export type FlujoMetrics = {
  recordCount: number;
  clientsCount: number;
  categoriesCount: number;
  monthsCount: number;
  openPendingCount: number;
  totalPending: number;
  totalDebt: number;
};

export type FlujoRecordPreview = {
  id: number;
  date: string | null;
  month: number | null;
  year: number | null;
  client: string;
  product: string;
  category: string;
  budget: number;
  supplierBudget: number;
  collection1: number;
  pending: number;
  date2: string | null;
  month2: number | null;
  year2: number | null;
  collection2: number;
  totalCollection: number;
  balance: number;
  expense: number;
};

export type DebtItem = {
  concept: string;
  amount: number;
  dueDate: string | null;
};

export type FlujoData = {
  sourceWorkbook: string;
  generatedAt: string;
  months: { key: MonthKey; label: string; year: number; month: number }[];
  summary: MonthlySummary[];
  metrics: FlujoMetrics;
  debts: DebtItem[];
  recordsPreview: FlujoRecordPreview[];
  pendingMetricsSource?: string;
  pendingMetricsRecalculatedFromJsonAt?: string;
};

export type ProviderRow = {
  provider: string;
  ingresos: number;
  gastos: number;
  diferencia: number;
  incidencia: number;
};

export type CajaSummary = {
  pendienteDeCobrar: number;
  cajaMobile: number;
  cajaTeorica: number;
  diferencia: number;
  deudas: number;
  dineroDisponible: number;
  dolaresCantidad: number;
  cuentas: { concepto: string; monto: number }[];
};

export type DashboardNotification = {
  tone: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
};

export type PilarDashboardData = {
  flujo: FlujoData;
  source?: 'supabase-live' | 'json-static-fallback';
  sourceError?: string | null;
  selectedYear: number;
  years: number[];
  months: MonthlySummary[];
  latestMonth: MonthlySummary | null;
  providerRows: ProviderRow[];
  providerTotals: {
    ventasTotales: number;
    gastosOperativos: number;
    resultado: number;
    rentabilidad: number;
  };
  caja: CajaSummary;
  notifications: DashboardNotification[];
};
