import Link from 'next/link';
import { getFlujoData } from '@/lib/pilar-data';
import { getPilarAdminClient } from '@/lib/pilar-server';
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
  try {
    const supabase = getPilarAdminClient();
    const { data, error } = await supabase
      .from('pilar_transacciones')
      .select('*, pilar_rubros(nombre, tipo, grupo_proveedor)')
      .order('fecha', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data || []) as TxDto[];
  } catch {
    return getFlujoData().recordsPreview.map((item) => ({
      id: String(item.id),
      fecha: item.date || null,
      mes: Number(item.month || 0),
      anio: Number(item.year || 0),
      cliente: item.client || '',
      producto: item.product || '',
      presupuesto: Number(item.budget || 0),
      presupuesto_proveedor: Number(item.supplierBudget || 0),
      cobro_1: Number(item.collection1 || 0),
      pendiente: Number(item.pending || 0),
      fecha_2: item.date2 || null,
      mes_2: Number(item.month2 || 0),
      anio_2: Number(item.year2 || 0),
      cobro_2: Number(item.collection2 || 0),
      cobro_total: Number(item.totalCollection || 0),
      saldo: Number(item.balance || 0),
      gastos: Number(item.expense || 0),
      pilar_rubros: item.category ? { nombre: item.category } : null,
    }));
  }
}

export default async function TransaccionesPage() {
  const data = await fetchTransactions();
  const records: FlujoRecordPreview[] = data.map((item, index) => {
    const rubro = Array.isArray(item.pilar_rubros) ? item.pilar_rubros[0] : item.pilar_rubros;
    return {
      id: Number(item.id || index + 1),
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
    };
  });
  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">App de Pilar</div>
          <h1 className="mt-2 text-3xl font-semibold">Transacciones</h1>
          <p className="mt-2 text-sm text-slate-400">Vista de revisión. Si la base no responde en producción, muestra respaldo histórico.</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Dashboard</Link>
            <Link href="/transacciones" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Transacciones</Link>
            <Link href="/deudas" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Deudas</Link>
          </div>
        </header>
        <PilarTransactionsTable records={records} />
      </div>
    </main>
  );
}
