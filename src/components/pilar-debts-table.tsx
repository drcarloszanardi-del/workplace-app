import { formatArs } from '@/lib/pilar-data';
import type { DebtItem } from '@/lib/pilar-types';

export function PilarDebtsTable({ debts }: { debts: DebtItem[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121a31]">
      <table className="w-full text-sm">
        <thead className="bg-[#0f1730] text-slate-300">
          <tr>
            <th className="px-4 py-3 text-left">Concepto</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-left">Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          {debts.map((debt) => (
            <tr key={`${debt.concept}-${debt.dueDate || 'sin-fecha'}`} className="border-t border-white/5">
              <td className="px-4 py-3">{debt.concept}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">{formatArs(debt.amount || 0)}</td>
              <td className="px-4 py-3">{debt.dueDate || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
