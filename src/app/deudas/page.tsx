import Link from 'next/link';
import { getFlujoData } from '@/lib/pilar-data';
import { normalizePilarSourceError } from '@/lib/pilar-dashboard-data';
import { getPilarAdminClient, getPilarEnvState } from '@/lib/pilar-server';
import { PilarDebtsTable } from '@/components/pilar-debts-table';

type DebtDto = {
  concepto: string;
  monto: number;
  vencimiento: string | null;
};

type DebtsResult = {
  debts: DebtDto[];
  source: 'supabase-live' | 'json-fallback';
  sourceError: string | null;
};

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const normalized = trimmed.toLowerCase();
  return normalized === 'undefined' || normalized === 'null' ? '' : trimmed;
}

function normalizeDateText(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

async function fetchDebts(): Promise<DebtsResult> {
  const envState = getPilarEnvState();
  if (!envState.hasSupabaseUrl || !envState.hasServiceRoleKey) {
    const sourceError = normalizePilarSourceError(
      'Supabase env missing: falta configurar [NEXT_PUBLIC_PILAR_SUPABASE_URL | PILAR_SUPABASE_URL] + [PILAR_SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SERVICE_ROLE_KEY]',
      'respaldo histórico desde el import estático de flujo-fondos.json',
    );
    return {
      debts: (getFlujoData().debts || []).map((item) => ({
        concepto: normalizeText(item.concept),
        monto: Number(item.amount || 0),
        vencimiento: normalizeDateText(item.dueDate),
      })),
      source: 'json-fallback',
      sourceError,
    };
  }

  try {
    const supabase = getPilarAdminClient();
    const { data, error } = await supabase.from('pilar_deudas').select('*').order('concepto');
    if (error) throw error;
    return {
      debts: ((data || []) as DebtDto[]).map((item) => ({
        concepto: normalizeText(item.concepto),
        monto: Number(item.monto || 0),
        vencimiento: normalizeDateText(item.vencimiento),
      })),
      source: 'supabase-live',
      sourceError: null,
    };
  } catch (error) {
    const sourceError = normalizePilarSourceError(
      error instanceof Error ? error.message : 'No se pudo leer pilar_deudas desde Supabase.',
      'respaldo histórico desde el import estático de flujo-fondos.json',
    );
    return {
      debts: (getFlujoData().debts || []).map((item) => ({
        concepto: normalizeText(item.concept),
        monto: Number(item.amount || 0),
        vencimiento: normalizeDateText(item.dueDate),
      })),
      source: 'json-fallback',
      sourceError,
    };
  }
}

export default async function DeudasPage() {
  const { debts, source, sourceError } = await fetchDebts();
  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">App de Pilar</div>
          <h1 className="mt-2 text-3xl font-semibold">Deudas</h1>
          <p className="mt-2 text-sm text-slate-400">Vista de revisión. Si la base no responde en producción, muestra respaldo histórico desde el JSON estático trazable al bundle.</p>
          {sourceError ? (
            <p className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Fallback activo: {sourceError}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span>Fuente:</span>
            <span className={`rounded-full border px-2.5 py-1 font-medium ${source === 'supabase-live' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'}`}>
              {source === 'supabase-live' ? 'Supabase real' : 'Respaldo histórico'}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Dashboard</Link>
            <Link href="/transacciones" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Transacciones</Link>
            <Link href="/deudas" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Deudas</Link>
          </div>
        </header>
        <PilarDebtsTable debts={debts.map((item) => ({ concept: item.concepto, amount: Number(item.monto || 0), dueDate: item.vencimiento || null }))} />
      </div>
    </main>
  );
}
