'use client';

import Link from 'next/link';
import { buildDashboardRows } from '@/lib/pilar-data';
import { formatArs, formatPercent, formatUsd } from '@/lib/pilar-format';
import type { PilarDashboardData } from '@/lib/pilar-types';

type Props = {
  data: PilarDashboardData;
};

function toneClasses(tone: 'danger' | 'warning' | 'info') {
  if (tone === 'danger') return 'border-red-400/30 bg-red-500/10 text-red-100';
  if (tone === 'warning') return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
}

function sourceBadgeClasses(source?: string) {
  return source === 'supabase-live'
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
    : 'border-amber-400/30 bg-amber-500/10 text-amber-100';
}

function formatGeneratedAt(value?: string) {
  if (!value) return null;
  const raw = value.startsWith('supabase-live:') ? value.slice('supabase-live:'.length) : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
}

function formatFallbackMessage(sourceError?: string | null) {
  if (!sourceError) return 'Fallback activo: Supabase no devolvió datos útiles todavía.';
  if (sourceError.includes('Supabase env missing')) return 'Fallback activo: faltan variables de entorno de Supabase en este deploy.';
  if (sourceError.includes('Supabase public env missing')) return 'Fallback activo: falta la configuración pública de Supabase en este deploy.';
  if (sourceError.includes('faltan tablas de Pilar')) return 'Fallback activo: este entorno responde a Supabase, pero todavía no tiene creadas las tablas de Pilar.';
  if (sourceError.includes('rechazó el acceso')) return 'Fallback activo: Supabase está configurado, pero este entorno no tiene permisos para leer Pilar.';
  if (sourceError.includes('no devolvió datos útiles')) return 'Fallback activo: las tablas de Pilar todavía no tienen datos útiles.';
  return `Fallback activo: ${sourceError}`;
}

export function PilarDashboard({ data }: Props) {
  const visibleMonth = data.latestMonth;
  const visibleRows = visibleMonth ? buildDashboardRows(visibleMonth) : [];
  const generatedAtLabel = formatGeneratedAt(data.flujo.generatedAt);
  const yearTotals = data.months.reduce<Record<string, number>>((acc, month) => {
    for (const row of buildDashboardRows(month)) {
      acc[row.label] = (acc[row.label] || 0) + row.value;
    }
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">PIL-001</div>
            <h1 className="mt-2 text-3xl font-semibold">App de Pilar</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Tablero financiero de Pilar con lógica de dashboard, caja y rentabilidad. Si Supabase responde, esta vista usa datos vivos; si no, cae al respaldo histórico.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <form method="GET" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <label className="block text-xs uppercase tracking-[0.18em] text-slate-400">Año</label>
              <div className="mt-2 flex items-center gap-2">
                <select name="year" defaultValue={String(data.selectedYear)} className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm text-slate-100 outline-none">
                  {data.years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <button className="rounded-xl border border-white/10 bg-[#0f1730] px-3 py-2 text-sm">Ver</button>
              </div>
            </form>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <div>Año visible: <strong>{data.selectedYear}</strong></div>
              <div className="mt-1">Meses cargados: {data.months.length}</div>
              <div className="mt-1">Mes visible: <strong>{visibleMonth?.label || 'sin datos'}</strong></div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>Fuente:</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${sourceBadgeClasses(data.source)}`}>
                  {data.source === 'supabase-live' ? 'Supabase real' : 'Respaldo JSON estático'}
                </span>
              </div>
              {generatedAtLabel ? <div className="mt-2 text-xs text-slate-400">Actualizado: {generatedAtLabel}</div> : null}
              {data.source !== 'supabase-live' ? (
                <div className="mt-2 text-xs text-amber-200">
                  {formatFallbackMessage(data.sourceError)}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {data.notifications.length ? (
          <section className="mb-6 grid gap-3 lg:grid-cols-3">
            {data.notifications.map((item) => (
              <div key={`${item.title}-${item.message}`} className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(item.tone)}`}>
                <div className="font-semibold">{item.title}</div>
                <div className="mt-1 opacity-90">{item.message}</div>
              </div>
            ))}
          </section>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Dashboard</Link>
          <Link href="/transacciones" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Transacciones</Link>
          <Link href="/deudas" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Deudas</Link>
          <Link href="/dashboard" className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Vista mensual</Link>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#121a31]">
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="bg-[#0f1730] text-slate-300">
                  <tr>
                    <th className="sticky left-0 z-20 border-b border-white/10 bg-[#0f1730] px-4 py-3 text-left">Rubro</th>
                    <th className="border-b border-white/10 px-4 py-3 text-right whitespace-nowrap">{visibleMonth?.label || 'Mes'}</th>
                    <th className="border-b border-white/10 px-4 py-3 text-right">Acumulado año</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const isSection = row.kind === 'section';
                    const isSaldo = row.kind === 'saldo';
                    const negative = row.value < 0;
                    return (
                      <tr key={row.label} className={isSection || isSaldo ? 'bg-white/5 font-semibold' : 'border-t border-white/5'}>
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-left">{row.label}</td>
                        <td className={`px-4 py-3 text-right whitespace-nowrap ${negative ? 'text-red-300' : ''}`}>
                          {formatArs(row.value)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {formatArs(yearTotals[row.label] || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#121a31] p-5">
              <h2 className="text-lg font-semibold">Rentabilidad por proveedor</h2>
              <div className="mt-4 space-y-3">
                {data.providerRows.map((row) => (
                  <div key={row.provider} className="rounded-2xl border border-white/10 bg-black/10 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{row.provider}</strong>
                      <span className="text-slate-400">{formatPercent(row.incidencia)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
                      <div>
                        <div className="text-slate-500">Ingresos</div>
                        <div>{formatArs(row.ingresos)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Gastos</div>
                        <div>{formatArs(row.gastos)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Diferencia</div>
                        <div className={row.diferencia < 0 ? 'text-red-300' : 'text-emerald-300'}>{formatArs(row.diferencia)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3 text-sm">
                <div>Ventas Totales: {formatArs(data.providerTotals.ventasTotales)}</div>
                <div className="mt-1">Gastos Operativos: {formatArs(data.providerTotals.gastosOperativos)}</div>
                <div className="mt-1">Resultado: {formatArs(data.providerTotals.resultado)}</div>
                <div className="mt-1">Rentabilidad: {formatPercent(data.providerTotals.rentabilidad)}</div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#121a31] p-5">
              <h2 className="text-lg font-semibold">Caja</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                {data.caja.cuentas.map((item) => (
                  <div key={item.concepto} className="flex items-center justify-between gap-3">
                    <span>{item.concepto}</span>
                    <strong>{item.concepto.includes('Dolares') ? formatUsd(item.monto) : formatArs(item.monto)}</strong>
                  </div>
                ))}
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between gap-3"><span>Pendiente de cobrar</span><strong>{formatArs(data.caja.pendienteDeCobrar)}</strong></div>
                  <div className="mt-2 flex items-center justify-between gap-3"><span>Caja Mobile</span><strong>{formatArs(data.caja.cajaMobile)}</strong></div>
                  <div className="mt-2 flex items-center justify-between gap-3"><span>Caja Teórica</span><strong>{formatArs(data.caja.cajaTeorica)}</strong></div>
                  <div className="mt-2 flex items-center justify-between gap-3"><span>Diferencia</span><strong className={data.caja.diferencia < 0 ? 'text-red-300' : 'text-emerald-300'}>{formatArs(data.caja.diferencia)}</strong></div>
                  <div className="mt-2 flex items-center justify-between gap-3"><span>Deudas</span><strong>{formatArs(data.caja.deudas)}</strong></div>
                  <div className="mt-2 flex items-center justify-between gap-3"><span>Dinero Disponible</span><strong>{formatArs(data.caja.dineroDisponible)}</strong></div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#121a31] p-5">
              <h2 className="text-lg font-semibold">Cuenta USD</h2>
              <div className="mt-4 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Saldo actual</span>
                  <strong>{formatUsd(data.caja.dolaresCantidad)}</strong>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Saldo calculado desde caja y movimientos USD disponibles en la base. Si faltan movimientos reales, este valor todavía puede requerir ajuste operativo.
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
