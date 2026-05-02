'use client';

import { useMemo, useState } from 'react';
import { formatArs } from '@/lib/pilar-data';
import type { DebtItem } from '@/lib/pilar-types';

export function PilarDebtsTable({ debts }: { debts: DebtItem[] }) {
  const [items, setItems] = useState(debts);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')) || a.concept.localeCompare(b.concept)),
    [items],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/pilar/deudas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concepto: concept, monto: Number(amount || 0), vencimiento: dueDate || null }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error || 'No se pudo guardar');
      const saved = payload.mode === 'supabase'
        ? { concept: payload.data[0]?.concepto || concept, amount: Number(payload.data[0]?.monto || amount || 0), dueDate: payload.data[0]?.vencimiento || dueDate || null }
        : payload.data;
      setItems((current) => [...current, saved]);
      setConcept('');
      setAmount('');
      setDueDate('');
      setMessage(payload.mode === 'supabase' ? 'Deuda guardada en la base.' : 'Deuda guardada en modo fallback temporal.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121a31]">
      <form onSubmit={onSubmit} className="grid gap-3 border-b border-white/10 px-4 py-4 md:grid-cols-4">
        <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Concepto" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" required />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto" type="number" step="0.01" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" required />
        <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <button disabled={saving} className="rounded-xl border border-white/10 bg-sky-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Agregar deuda'}</button>
        {message ? <div className="md:col-span-4 text-xs text-slate-300">{message}</div> : null}
      </form>
      <table className="w-full text-sm">
        <thead className="bg-[#0f1730] text-slate-300">
          <tr>
            <th className="px-4 py-3 text-left">Concepto</th>
            <th className="px-4 py-3 text-right">Monto</th>
            <th className="px-4 py-3 text-left">Vencimiento</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((debt) => (
            <tr key={`${debt.concept}-${debt.dueDate || 'sin-fecha'}-${debt.amount}`} className="border-t border-white/5">
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
