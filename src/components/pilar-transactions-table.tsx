'use client';

import { useMemo, useState } from 'react';
import { formatArs } from '@/lib/pilar-data';
import { PILAR_CATEGORY_OPTIONS } from '@/lib/pilar-categories';
import type { FlujoRecordPreview } from '@/lib/pilar-types';

const EMPTY_FORM = {
  fecha: '',
  cliente: '',
  producto: '',
  categoria: 'Ventas Otros',
  presupuesto: '',
  cobro_1: '',
  cobro_2: '',
  gastos: '',
};

export function PilarTransactionsTable({ records }: { records: FlujoRecordPreview[] }) {
  const [items, setItems] = useState(records);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.id) - Number(a.id)),
    [items],
  );

  function updateField(name: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function fillFormFromRecord(record: FlujoRecordPreview) {
    setEditingId(record.id);
    setForm({
      fecha: record.date || '',
      cliente: record.client || '',
      producto: record.product || '',
      categoria: record.category || 'Ventas Otros',
      presupuesto: String(record.budget || 0),
      cobro_1: String(record.collection1 || 0),
      cobro_2: String(record.collection2 || 0),
      gastos: String(record.expense || 0),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const fecha = form.fecha || new Date().toISOString().slice(0, 10);
      const presupuesto = Number(form.presupuesto || 0);
      const cobro1 = Number(form.cobro_1 || 0);
      const cobro2 = Number(form.cobro_2 || 0);
      const gastos = Number(form.gastos || 0);
      const cobroTotal = cobro1 + cobro2;
      const pendiente = Math.max(presupuesto - cobroTotal, 0);
      const payload = {
        fecha,
        mes: Number(fecha.slice(5, 7)),
        anio: Number(fecha.slice(0, 4)),
        cliente: form.cliente,
        producto: form.producto,
        categoria: form.categoria,
        presupuesto,
        cobro_1: cobro1,
        cobro_2: cobro2,
        cobro_total: cobroTotal,
        pendiente,
        saldo: pendiente,
        gastos,
        moneda: 'ARS',
      };
      const endpoint = editingId ? `/api/pilar/transacciones/${editingId}` : '/api/pilar/transacciones';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const response = await res.json();
      if (!res.ok || !response.ok) throw new Error(response.error || 'No se pudo guardar');
      const normalized: FlujoRecordPreview = response.mode === 'supabase'
        ? {
            id: Number(response.data[0]?.id || response.data[0]?.numero || editingId || Date.now()),
            date: response.data[0]?.fecha || fecha,
            month: Number(response.data[0]?.mes || payload.mes),
            year: Number(response.data[0]?.anio || payload.anio),
            client: response.data[0]?.cliente || form.cliente,
            product: response.data[0]?.producto || form.producto,
            category: form.categoria,
            budget: Number(response.data[0]?.presupuesto || presupuesto),
            supplierBudget: Number(response.data[0]?.presupuesto_proveedor || 0),
            collection1: Number(response.data[0]?.cobro_1 || cobro1),
            pending: Number(response.data[0]?.pendiente || pendiente),
            date2: response.data[0]?.fecha_2 || null,
            month2: Number(response.data[0]?.mes_2 || 0),
            year2: Number(response.data[0]?.anio_2 || 0),
            collection2: Number(response.data[0]?.cobro_2 || cobro2),
            totalCollection: Number(response.data[0]?.cobro_total || cobroTotal),
            balance: Number(response.data[0]?.saldo || pendiente),
            expense: Number(response.data[0]?.gastos || gastos),
          }
        : response.data;

      setItems((current) => {
        if (editingId) return current.map((item) => (item.id === editingId ? normalized : item));
        return [normalized, ...current];
      });
      resetForm();
      setMessage(editingId ? 'Movimiento actualizado.' : 'Movimiento agregado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121a31]">
      <form onSubmit={onSubmit} className="grid gap-3 border-b border-white/10 px-4 py-4 md:grid-cols-4 xl:grid-cols-8">
        <input value={form.fecha} onChange={(e) => updateField('fecha', e.target.value)} type="date" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <input value={form.cliente} onChange={(e) => updateField('cliente', e.target.value)} placeholder="Cliente" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <input value={form.producto} onChange={(e) => updateField('producto', e.target.value)} placeholder="Producto" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <select value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none">
          {PILAR_CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <input value={form.presupuesto} onChange={(e) => updateField('presupuesto', e.target.value)} placeholder="Presupuesto" type="number" step="0.01" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <input value={form.cobro_1} onChange={(e) => updateField('cobro_1', e.target.value)} placeholder="Cobro 1" type="number" step="0.01" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <input value={form.cobro_2} onChange={(e) => updateField('cobro_2', e.target.value)} placeholder="Cobro 2" type="number" step="0.01" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <input value={form.gastos} onChange={(e) => updateField('gastos', e.target.value)} placeholder="Gasto" type="number" step="0.01" className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-white outline-none" />
        <div className="md:col-span-4 xl:col-span-8 flex flex-wrap items-center gap-3">
          <button disabled={saving} className="rounded-xl border border-white/10 bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar movimiento'}</button>
          {editingId ? <button type="button" onClick={resetForm} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Cancelar edición</button> : null}
          {message ? <div className="text-xs text-slate-300">{message}</div> : null}
        </div>
      </form>
      <div className="overflow-x-auto">
        <table className="min-w-[1280px] w-full text-sm">
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
              <th className="px-4 py-3 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((record) => (
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
                <td className="px-4 py-3"><button type="button" onClick={() => fillFormFromRecord(record)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white">Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
