'use client';

import flujoData from '@/data/flujo-fondos.json';
import { useMemo, useState } from 'react';

type SummaryMonth = (typeof flujoData.summary)[number];

type TabKey = 'resumen' | 'mensual' | 'movimientos' | 'deudas';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'deudas', label: 'Deudas' },
];

function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function diffColor(delta: number) {
  if (Math.abs(delta) < 1) return 'text-emerald-300';
  return 'text-amber-300';
}

export default function Home() {
  const [selectedMonthKey, setSelectedMonthKey] = useState(flujoData.summary[flujoData.summary.length - 1]?.key || '');
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');

  const selectedMonth = useMemo<SummaryMonth | undefined>(
    () => flujoData.summary.find((item) => item.key === selectedMonthKey),
    [selectedMonthKey],
  );

  const latest = flujoData.summary[flujoData.summary.length - 1];
  const previous = flujoData.summary[flujoData.summary.length - 2];

  const kpis = [
    {
      label: 'Saldo acumulado actual',
      value: money(latest?.totals.accumulatedBalance || 0),
      help: latest?.label || '',
    },
    {
      label: 'Resultado del período',
      value: money(latest?.totals.periodBalance || 0),
      help: latest?.label || '',
    },
    {
      label: 'Pendiente de cobro',
      value: money(latest?.totals.pending || 0),
      help: `${flujoData.metrics.openPendingCount} movimientos con saldo`,
    },
    {
      label: 'Deuda registrada',
      value: money(flujoData.metrics.totalDebt || 0),
      help: `${flujoData.debts.length} conceptos`,
    },
  ];

  const comparison = previous && latest
    ? latest.totals.accumulatedBalance - previous.totals.accumulatedBalance
    : 0;

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">APP FLUJO DE FONDOS PILAR</div>
              <h1 className="mt-3 text-4xl font-semibold">Tablero funcional y validado contra la planilla</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Construido a partir de {flujoData.sourceWorkbook}. Resume ingresos, pendientes, egresos, utilidades y saldo acumulado mes a mes.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              Generado: {new Date(flujoData.generatedAt).toLocaleString('es-AR')}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-[#0b1730] p-5">
                <div className="text-sm text-slate-400">{item.label}</div>
                <div className="mt-3 text-3xl font-semibold">{item.value}</div>
                <div className="mt-2 text-xs text-slate-500">{item.help}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab.key ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1730] px-4 py-3">
              <span className="text-sm text-slate-400">Mes analizado</span>
              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-sm outline-none"
              >
                {flujoData.months.map((month) => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-400">Situación comparada</div>
                <h2 className="mt-1 text-2xl font-semibold">{latest?.label}</h2>
              </div>
              <div className={`text-sm font-medium ${diffColor(comparison)}`}>
                Variación vs mes previo: {money(comparison)}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {flujoData.summary.slice(-6).map((month) => (
                <div key={month.key} className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
                  <div className="text-sm text-slate-400">{month.label}</div>
                  <div className="mt-3 text-xl font-semibold">{money(month.totals.accumulatedBalance)}</div>
                  <div className="mt-2 text-xs text-slate-500">Saldo acumulado</div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${Math.min(100, Math.max(10, pct(month.totals.accumulatedBalance, latest?.totals.accumulatedBalance || 1)))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-slate-400">Chequeo de consistencia</div>
            <h2 className="mt-1 text-2xl font-semibold">Validación contra Excel</h2>
            {selectedMonth ? (
              <div className="mt-5 space-y-3 text-sm">
                {[
                  ['Ingresos', selectedMonth.totals.income, selectedMonth.excelCheck.income],
                  ['Pendiente', selectedMonth.totals.pending, selectedMonth.excelCheck.pending],
                  ['Egresos', selectedMonth.totals.expense, selectedMonth.excelCheck.expense],
                  ['Utilidades', selectedMonth.totals.utility, selectedMonth.excelCheck.utility],
                  ['Saldo período', selectedMonth.totals.periodBalance, selectedMonth.excelCheck.periodBalance],
                  ['Saldo acumulado', selectedMonth.totals.accumulatedBalance, selectedMonth.excelCheck.accumulatedBalance],
                ].map(([label, appValue, excelValue]) => {
                  const delta = Number(appValue) - Number(excelValue);
                  return (
                    <div key={String(label)} className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="mt-1 text-xs text-slate-500">App: {money(Number(appValue))}</div>
                          <div className="text-xs text-slate-500">Excel: {money(Number(excelValue))}</div>
                        </div>
                        <div className={`text-sm font-medium ${diffColor(delta)}`}>
                          Δ {money(delta)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        {activeTab === 'resumen' && selectedMonth ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <CategoryCard title="Ingresos del mes" items={selectedMonth.incomeByCategory} total={selectedMonth.totals.income} />
            <CategoryCard title="Pendiente de cobro" items={selectedMonth.pendingByCategory} total={selectedMonth.totals.pending} />
            <CategoryCard title="Egresos del mes" items={selectedMonth.expenseByCategory} total={selectedMonth.totals.expense} />
            <CategoryCard title="Utilidades y retiros" items={selectedMonth.utilityByCategory} total={selectedMonth.totals.utility} />
          </section>
        ) : null}

        {activeTab === 'mensual' ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-slate-400">Serie completa</div>
            <h2 className="mt-1 text-2xl font-semibold">Evolución mensual</h2>
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-3 py-3">Mes</th>
                    <th className="px-3 py-3">Ingresos</th>
                    <th className="px-3 py-3">Pendiente</th>
                    <th className="px-3 py-3">Egresos</th>
                    <th className="px-3 py-3">Utilidades</th>
                    <th className="px-3 py-3">Saldo período</th>
                    <th className="px-3 py-3">Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {flujoData.summary.map((month) => (
                    <tr key={month.key} className="border-b border-white/5">
                      <td className="px-3 py-3 font-medium">{month.label}</td>
                      <td className="px-3 py-3">{money(month.totals.income)}</td>
                      <td className="px-3 py-3">{money(month.totals.pending)}</td>
                      <td className="px-3 py-3">{money(month.totals.expense)}</td>
                      <td className="px-3 py-3">{money(month.totals.utility)}</td>
                      <td className="px-3 py-3">{money(month.totals.periodBalance)}</td>
                      <td className="px-3 py-3">{money(month.totals.accumulatedBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'movimientos' ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm text-slate-400">Vista operativa</div>
                <h2 className="mt-1 text-2xl font-semibold">Movimientos relevantes</h2>
              </div>
              <div className="text-sm text-slate-500">Muestra inicial de 120 registros normalizados</div>
            </div>
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Producto</th>
                    <th className="px-3 py-3">Rubro</th>
                    <th className="px-3 py-3">Cobro total</th>
                    <th className="px-3 py-3">Saldo</th>
                    <th className="px-3 py-3">Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {flujoData.recordsPreview.map((record) => (
                    <tr key={record.id} className="border-b border-white/5 align-top">
                      <td className="px-3 py-3">{record.date || '—'}</td>
                      <td className="px-3 py-3">{record.client || '—'}</td>
                      <td className="px-3 py-3">{record.product || '—'}</td>
                      <td className="px-3 py-3">{record.category}</td>
                      <td className="px-3 py-3">{money(record.totalCollection)}</td>
                      <td className="px-3 py-3">{money(record.balance)}</td>
                      <td className="px-3 py-3">{money(record.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'deudas' ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-slate-400">Pendientes estructurales</div>
              <h2 className="mt-1 text-2xl font-semibold">Deudas declaradas</h2>
              <div className="mt-5 space-y-3">
                {flujoData.debts.map((debt) => (
                  <div key={debt.concept} className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{debt.concept}</div>
                        <div className="mt-1 text-xs text-slate-500">Vencimiento: {debt.dueDate || 'sin fecha'}</div>
                      </div>
                      <div className="text-sm font-medium">{money(debt.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-slate-400">Rankings rápidos</div>
              <h2 className="mt-1 text-2xl font-semibold">Focos principales</h2>
              <RankList title="Clientes con mayor cobro" items={flujoData.highlights.topClients} />
              <RankList title="Rubros con más ingresos" items={flujoData.highlights.topIncomeCategories} />
              <RankList title="Rubros con más egresos" items={flujoData.highlights.topExpenseCategories} />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function CategoryCard({ title, items, total }: { title: string; items: Record<string, number>; total: number }) {
  const sorted = Object.entries(items).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-400">Detalle</div>
          <h3 className="mt-1 text-2xl font-semibold">{title}</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-lg font-medium">{money(total)}</div>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {sorted.map(([name, value]) => (
          <div key={name} className="rounded-2xl border border-white/10 bg-[#0b1730] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{name}</div>
              <div>{money(value)}</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(4, pct(value, total))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankList({ title, items }: { title: string; items: { name: string; amount: number }[] }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b1730] p-4">
      <div className="font-medium">{title}</div>
      <div className="mt-4 space-y-3 text-sm">
        {items.map((item, index) => (
          <div key={`${title}-${item.name}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/20 text-xs text-cyan-200">{index + 1}</div>
              <span>{item.name}</span>
            </div>
            <span>{money(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
