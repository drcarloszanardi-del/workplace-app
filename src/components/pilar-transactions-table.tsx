'use client';

import { formatArs } from '@/lib/pilar-data';
import type { FlujoRecordPreview } from '@/lib/pilar-types';

export function PilarTransactionsTable({ records }: { records: FlujoRecordPreview[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121a31]">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="text-sm font-medium text-slate-200">Transacciones</div>
        <div className="mt-1 text-xs text-amber-300">Por ahora esta pantalla es solo de lectura. La carga y edición de pagos, gastos o movimientos todavía no está implementada en la interfaz.</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-[#0f1730] text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-left">Rubro</th>
              <th className="px-4 py-3 text-right">Presupuesto</th>
              <th className="px-4 py-3 text-right">Cobro 1</th>
              <th className="px-4 py-3 text-right">Cobro 2</th>
              <th className="px-4 py-3 text-right">Cobro Total</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-right">Gastos</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-white/5">
                <td className="px-4 py-3">{record.date || '-'}</td>
                <td className="px-4 py-3">{record.client || '-'}</td>
                <td className="px-4 py-3">{record.product || '-'}</td>
                <td className="px-4 py-3">{record.category || '-'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatArs(record.budget || 0)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatArs(record.collection1 || 0)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatArs(record.collection2 || 0)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatArs(record.totalCollection || 0)}</td>
                <td className={`px-4 py-3 text-right whitespace-nowrap ${(record.balance || 0) > 0 ? 'text-amber-300' : ''}`}>{formatArs(record.balance || 0)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatArs(record.expense || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-500">
        Tabla conectada al backend de Pilar. Revise alta de movimientos USD y carga histórica completa en la base para consolidar todo el circuito.
      </div>
    </div>
  );
}
