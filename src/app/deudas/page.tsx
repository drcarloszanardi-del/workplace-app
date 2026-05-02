import Link from 'next/link';
import { getDashboardData } from '@/lib/pilar-data';
import { getPilarAdminClient } from '@/lib/pilar-server';
import { PilarDebtsTable } from '@/components/pilar-debts-table';

type DebtDto = {
  concepto: string;
  monto: number;
  vencimiento: string | null;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchDebts() {
  try {
    const supabase = getPilarAdminClient();
    const { data, error } = await supabase.from('pilar_deudas').select('*').order('concepto');
    if (error) throw error;
    return (data || []) as DebtDto[];
  } catch {
    return (getDashboardData().flujo.debts || []).map((item) => ({
      concepto: item.concept,
      monto: Number(item.amount || 0),
      vencimiento: item.dueDate || null,
    }));
  }
}

export default async function DeudasPage() {
  const debts = await fetchDebts();
  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">App de Pilar</div>
          <h1 className="mt-2 text-3xl font-semibold">Deudas</h1>
          <p className="mt-2 text-sm text-slate-400">Vista de revisión. Si la base no responde en producción, muestra respaldo histórico.</p>
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
