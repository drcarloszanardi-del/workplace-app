import { PilarDebtsTable } from '@/components/pilar-debts-table';

type DebtDto = {
  concepto: string;
  monto: number;
  vencimiento: string | null;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchDebts() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/pilar/deudas`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Debts fetch failed: ${res.status}`);
  const payload = await res.json();
  return (payload.data || []) as DebtDto[];
}

export default async function DeudasPage() {
  const debts = await fetchDebts();
  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">App de Pilar</div>
          <h1 className="mt-2 text-3xl font-semibold">Deudas</h1>
          <p className="mt-2 text-sm text-slate-400">Vista conectada a Supabase real.</p>
        </header>
        <PilarDebtsTable debts={debts.map((item) => ({ concept: item.concepto, amount: Number(item.monto || 0), dueDate: item.vencimiento || null }))} />
      </div>
    </main>
  );
}
