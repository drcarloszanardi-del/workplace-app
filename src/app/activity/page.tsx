'use client';

import { useEffect, useState } from 'react';

function fmt(raw?: string) {
  if (!raw) return 'sin fecha';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-AR');
}

type ActivityPayload = {
  status?: Record<string, any>;
  recentEvents?: Record<string, any>[];
  staleMinutes?: number;
};

export default function ActivityPage() {
  const [data, setData] = useState<ActivityPayload>({
    status: { derived_state: 'loading' },
    recentEvents: [],
    staleMinutes: 20,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/activity', { cache: 'no-store' });
        if (!res.ok) return;
        const next = await res.json();
        if (!cancelled) setData(next);
      } catch {}
    };
    void load();
  }, []);

  const status = data.status || {};
  const recentEvents = Array.isArray(data.recentEvents) ? data.recentEvents : [];

  return (
    <main className="min-h-screen bg-[#07111f] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Jarvis activity</div>
          <h1 className="mt-3 text-4xl font-semibold">Evidencia real de trabajo</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Esta vista muestra estado actual y eventos recientes derivados de evidencia local verificable.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Estado derivado', status.derived_state || 'available'],
            ['Tarea', status.task || 'sin tarea'],
            ['Última evidencia', fmt(status.last_evidence_at)],
            ['Artefacto', status.last_artifact || 'sin artefacto'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-[#0b1730] p-5">
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-3 break-words text-xl font-semibold">{String(value)}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-400">Eventos recientes</div>
              <h2 className="mt-1 text-2xl font-semibold">Últimos 25 eventos</h2>
            </div>
            <div className="text-xs text-slate-500">stale después de {data.staleMinutes || 20} min sin evidencia</div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-[#0b1730] text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Hora</th>
                  <th className="px-4 py-3 text-left font-medium">Evento</th>
                  <th className="px-4 py-3 text-left font-medium">Tarea</th>
                  <th className="px-4 py-3 text-left font-medium">Artefacto</th>
                  <th className="px-4 py-3 text-left font-medium">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#07111f]">
                {recentEvents.length ? recentEvents.map((event, idx) => (
                  <tr key={`${event.ts || 'row'}-${idx}`}>
                    <td className="px-4 py-3 text-slate-300">{fmt(String(event.ts || ''))}</td>
                    <td className="px-4 py-3">{String(event.event || '-')}</td>
                    <td className="px-4 py-3">{String(event.task || '-')}</td>
                    <td className="px-4 py-3">{String(event.artifact || '-')}</td>
                    <td className="px-4 py-3 text-slate-400">{String(event.note || '-')}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin eventos todavía</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
