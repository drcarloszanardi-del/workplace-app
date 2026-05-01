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

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getDatasetFreshness(raw: string) {
  const generatedAt = new Date(raw);
  if (Number.isNaN(generatedAt.getTime())) {
    return {
      label: 'fecha de generación inválida',
      isStale: true,
    };
  }

  const ageHours = Math.floor((Date.now() - generatedAt.getTime()) / 3600000);
  if (ageHours < 24) {
    return {
      label: 'dataset regenerado en las últimas 24 h',
      isStale: false,
    };
  }

  const ageDays = Math.floor(ageHours / 24);
  return {
    label: `dataset sin regenerar hace ${ageDays} día${ageDays === 1 ? '' : 's'}`,
    isStale: true,
  };
}

export default function Home() {
  const lastActiveMonth = [...flujoData.summary].reverse().find((month) => month.totals.income || month.totals.pending || month.totals.expense || month.totals.utility || month.totals.periodBalance);
  const [selectedMonthKey, setSelectedMonthKey] = useState(lastActiveMonth?.key || flujoData.summary[flujoData.summary.length - 1]?.key || '');
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');

  const selectedMonth = useMemo<SummaryMonth | undefined>(
    () => flujoData.summary.find((item) => item.key === selectedMonthKey),
    [selectedMonthKey],
  );

  const datasetFreshness = getDatasetFreshness(flujoData.generatedAt);
  const latest = lastActiveMonth || flujoData.summary[flujoData.summary.length - 1];
  const latestIndex = flujoData.summary.findIndex((month) => month.key === latest?.key);
  const previous = latestIndex > 0 ? flujoData.summary[latestIndex - 1] : undefined;
  const totalPending = hasNumber(flujoData.metrics.totalPending) ? flujoData.metrics.totalPending : null;
  const pendingCount = hasNumber(flujoData.metrics.openPendingCount) ? flujoData.metrics.openPendingCount : null;
  const pendingMetricsSource = String(flujoData.pendingMetricsSource || '').trim();
  const totalPendingLabel = totalPending === null ? 'pendiente de regenerar desde la planilla' : money(totalPending);
  const totalPendingHelp = totalPending === null
    ? 'falta regenerar flujo-fondos.json para exponer el saldo abierto total'
    : pendingMetricsSource === 'records_preview_fallback'
      ? pendingCount === null
        ? 'saldo abierto reconstruido desde una vista parcial del JSON, pendiente confirmar cantidad exacta de movimientos'
        : `${pendingCount} movimientos abiertos reconstruidos desde recordsPreview, pendiente validar contra Excel`
      : pendingCount === null
        ? 'saldo abierto reconstruido, pendiente confirmar cantidad exacta de movimientos'
        : `${pendingCount} movimientos con saldo activo todavía sin cobrar`;
  const pendingSourceLabel = totalPending === null
    ? 'sin saldo reconstruido'
    : pendingMetricsSource === 'summary_totals_fallback'
      ? 'saldo abierto recompuesto desde el resumen mensual del JSON'
      : pendingMetricsSource === 'records_preview_fallback'
        ? 'saldo abierto recompuesto desde recordsPreview'
        : datasetFreshness.isStale
          ? 'saldo abierto validado, pero con dataset vencido'
          : 'saldo abierto validado con la última regeneración';

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
      label: 'Saldo pendiente activo',
      value: totalPendingLabel,
      help: totalPendingHelp,
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
            <div className={`rounded-2xl px-4 py-3 text-sm ${datasetFreshness.isStale ? 'border border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-100'}`}>
              <div>Generado: {new Date(flujoData.generatedAt).toLocaleString('es-AR')}</div>
              <div className="mt-1 text-xs opacity-80">{datasetFreshness.label}</div>
              <div className="mt-2 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]">
                {pendingSourceLabel}
              </div>
              {datasetFreshness.isStale ? (
                <div className="mt-2 space-y-2 text-xs font-medium">
                  <div>
                    {totalPending === null
                      ? 'Pendiente regenerar desde Excel cuando se habilite openpyxl fuera del cron.'
                      : pendingMetricsSource === 'summary_totals_fallback'
                        ? 'Dataset desactualizado: el saldo abierto visible se recompuso desde el resumen mensual del JSON, pero todavía falta regenerar desde Excel para refrescar métricas y movimientos.'
                        : pendingMetricsSource === 'records_preview_fallback'
                          ? 'Dataset desactualizado: el saldo abierto visible se recompuso desde recordsPreview y necesita validación contra Excel apenas se pueda regenerar.'
                          : 'Dataset desactualizado: regenerar desde Excel fuera del cron para refrescar métricas y movimientos, pero el saldo abierto visible ya quedó reconstruido desde el JSON.'}
                  </div>
                  <div className="rounded-xl border border-amber-300/20 bg-black/10 px-3 py-2 text-amber-50">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-amber-200/80">Acción recomendada</div>
                    <div className="mt-1">Rehacer <span className="font-semibold">src/data/flujo-fondos.json</span> fuera del cron para confirmar el saldo pendiente.</div>
                    <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 font-mono text-[11px] leading-5 text-amber-50/95">
                      python3 -m venv .venv && .venv/bin/python -m pip install openpyxl && .venv/bin/python scripts/build_flujo_data.py
                    </div>
                    <div className="mt-1 text-[11px] text-amber-100/80">
                      Regeneración completa sugerida por Codex para correr fuera del microciclo. No commitear <span className="font-semibold">.venv</span>.
                    </div>
                    <div className="mt-2 rounded-xl border border-amber-300/15 bg-black/10 px-3 py-2 text-[11px] text-amber-100/90">
                      <div className="uppercase tracking-[0.16em] text-amber-200/80">Fallback corto</div>
                      <div className="mt-1">Si solo hace falta recomponer el saldo abierto sin tocar Excel, correr:</div>
                      <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 font-mono leading-5 text-amber-50/95">
                        npm run flujo:data:recalc-pending
                      </div>
                    </div>
                    {totalPending !== null ? (
                      <div className="mt-1 text-amber-100/90">
                        Saldo abierto visible hoy: <span className="font-semibold">{money(totalPending)}</span>{pendingCount === null ? ' con cantidad de movimientos pendiente de confirmación.' : <> sobre {pendingCount} movimiento{pendingCount === 1 ? '' : 's'}.</>}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Registros normalizados', value: flujoData.metrics.recordCount, help: 'filas útiles procesadas' },
              { label: 'Clientes detectados', value: flujoData.metrics.clientsCount, help: 'clientes únicos en la base' },
              { label: 'Rubros activos', value: flujoData.metrics.categoriesCount, help: 'categorías con movimiento' },
              { label: 'Meses cubiertos', value: flujoData.metrics.monthsCount, help: 'ventana histórica disponible' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-[#091427] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold text-cyan-100">{item.value}</div>
                <div className="mt-1 text-xs text-slate-500">{item.help}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Último mes con movimiento', value: latest?.label || 'sin dato', help: 'último cierre detectado con actividad' },
              { label: 'Saldo abierto total', value: totalPendingLabel, help: totalPendingHelp },
              { label: 'Deuda total registrada', value: money(flujoData.metrics.totalDebt || 0), help: `${flujoData.debts.length} conceptos abiertos` },
              { label: 'Desvío acumulado vs Excel', value: money(selectedMonth ? selectedMonth.totals.accumulatedBalance - selectedMonth.excelCheck.accumulatedBalance : 0), help: selectedMonth ? `control del mes ${selectedMonth.label}` : 'sin mes seleccionado' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-cyan-400/10 bg-[#081326] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold text-cyan-100">{item.value}</div>
                <div className="mt-1 break-words text-xs text-slate-500">{item.help}</div>
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
              <div className="text-sm text-slate-500">Muestra inicial de 150 registros normalizados</div>
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
