import { PilarTransactionsTable } from '@/components/pilar-transactions-table';
import type { FlujoRecordPreview } from '@/lib/pilar-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type TxDto = {
  id: string;
  fecha: string | null;
  mes: number;
  anio: number;
  cliente: string | null;
  producto: string | null;
  presupuesto: number;
  presupuesto_proveedor: number;
  cobro_1: number;
  pendiente: number;
  fecha_2: string | null;
  mes_2: number | null;
  anio_2: number | null;
  cobro_2: number;
  cobro_total: number;
  saldo: number;
  gastos: number;
  pilar_rubros?: { nombre?: string | null }[] | { nombre?: string | null } | null;
};

async function fetchTransactions() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/pilar/transacciones`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Transactions fetch failed: ${res.status}`);
  const payload = await res.json();
  return (payload.data || []) as TxDto[];
}

export default async function TransaccionesPage() {
  const data = await fetchTransactions();
  const records: FlujoRecordPreview[] = data.map((item, index) => {
    const rubro = Array.isArray(item.pilar_rubros) ? item.pilar_rubros[0] : item.pilar_rubros;
    return ({
    id: index + 1,
    date: item.fecha,
    month: Number(item.mes || 0),
    year: Number(item.anio || 0),
    client: item.cliente || '',
    product: item.producto || '',
    category: rubro?.nombre || '',
    budget: Number(item.presupuesto || 0),
    supplierBudget: Number(item.presupuesto_proveedor || 0),
    collection1: Number(item.cobro_1 || 0),
    pending: Number(item.pendiente || 0),
    date2: item.fecha_2,
    month2: Number(item.mes_2 || 0),
    year2: Number(item.anio_2 || 0),
    collection2: Number(item.cobro_2 || 0),
    totalCollection: Number(item.cobro_total || 0),
    balance: Number(item.saldo || 0),
    expense: Number(item.gastos || 0),
  });
  });
  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">App de Pilar</div>
          <h1 className="mt-2 text-3xl font-semibold">Transacciones</h1>
          <p className="mt-2 text-sm text-slate-400">Listado conectado a Supabase real.</p>
        </header>
        <PilarTransactionsTable records={records} />
      </div>
    </main>
  );
}
