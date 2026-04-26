'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WorkplaceStatus } from '@/lib/workplace-types';

function parseDate(raw: string) {
  if (!raw) return null;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ago(raw: string) {
  const date = parseDate(raw);
  if (!date) return 'sin fecha';
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'recién';
  if (diff < 60) return `hace ${diff} min`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function DashboardClient({ initialStatus }: { initialStatus: WorkplaceStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState('');
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [openTask, setOpenTask] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const next = await res.json();
        setStatus(next);
      } catch {}
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const heartbeat = useMemo(() => {
    const d = parseDate(status.lastHeartbeat);
    if (!d) return { active: false, text: 'Sin heartbeat' };
    const diff = (Date.now() - d.getTime()) / 60000;
    return diff < 35 ? { active: true, text: 'Jarvis activo' } : { active: false, text: 'Jarvis inactivo' };
  }, [status.lastHeartbeat]);

  async function sendMessage() {
    if (!message.trim()) return;
    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) {
        alert('Mensajería no disponible en este deploy.');
        return;
      }
      setMessage('');
    } catch {
      alert('Mensajería no disponible en este deploy.');
    }
  }

  async function addTask(frente: string) {
    const tarea = taskInputs[frente]?.trim();
    if (!tarea) return;
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frente, tarea }),
      });
      if (!res.ok) {
        alert('Alta de tareas no disponible en este deploy.');
        return;
      }
      setTaskInputs((prev) => ({ ...prev, [frente]: '' }));
      setOpenTask(null);
    } catch {
      alert('Alta de tareas no disponible en este deploy.');
    }
  }

  async function forceHeartbeat() {
    try {
      const beat = await fetch('/api/heartbeat', { method: 'POST' });
      if (!beat.ok) {
        alert('Heartbeat remoto no disponible en este deploy.');
        return;
      }
      const res = await fetch('/api/status');
      if (!res.ok) return;
      setStatus(await res.json());
    } catch {
      alert('Heartbeat remoto no disponible en este deploy.');
    }
  }

  async function viewDetail(frente: string) {
    try {
      const res = await fetch(`/api/detail?frente=${encodeURIComponent(frente)}`);
      if (!res.ok) {
        alert('Detalle local no disponible en este deploy.');
        return;
      }
      const data = await res.json();
      alert(data.file || 'No encontré un archivo para este frente todavía.');
    } catch {
      alert('Detalle local no disponible en este deploy.');
    }
  }

  return (
    <main className="min-h-screen bg-[#1a1a2e] text-[#e0e0e0]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto_minmax(280px,420px)_auto] lg:items-center">
          <h1 className="text-3xl font-semibold">Jarvis Workplace</h1>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f3460] bg-white/5 px-4 py-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${heartbeat.active ? 'bg-[#1D9E75]' : 'bg-red-500'}`} />
            {heartbeat.text}
          </div>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribile a Jarvis..."
            className="w-full rounded-xl border border-[#0f3460] bg-[#0f1a31] px-4 py-3 outline-none"
          />
          <div className="flex gap-2">
            <button onClick={sendMessage} className="rounded-full border border-[#0f3460] bg-[#0f1a31] px-4 py-3 text-sm">Enviar</button>
            <button onClick={forceHeartbeat} className="rounded-full border border-[#0f3460] bg-[#0f1a31] px-4 py-3 text-sm">Forzar heartbeat</button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(status.frentes).map(([key, frente]) => {
            const color = frente.estado === 'verde' ? 'border-l-[#1D9E75]' : frente.estado === 'rojo' ? 'border-l-red-500' : 'border-l-[#EF9F27]';
            const badge = frente.estado === 'verde' ? 'bg-[#1D9E75]/15 text-[#1D9E75]' : frente.estado === 'rojo' ? 'bg-red-500/15 text-red-300' : 'bg-[#EF9F27]/15 text-[#EF9F27]';
            const badgeText = frente.estado === 'verde' ? 'activo' : frente.estado === 'rojo' ? 'bloqueado' : 'en seguimiento';
            return (
              <article key={key} className={`flex min-h-[290px] flex-col gap-4 rounded-2xl border border-[#0f3460] border-l-[3px] ${color} bg-[#16213e] p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-xl">{frente.nombre}</strong>
                  <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${badge}`}>{badgeText}</span>
                </div>
                <div>
                  <div className="text-sm text-[#a0a0a0]">Último avance</div>
                  <div className="mt-1 leading-relaxed">{frente.ultimoAvance}</div>
                  <div className="mt-1 text-xs text-[#a0a0a0]">{frente.fechaAvance} · {ago(frente.fechaAvance)}</div>
                </div>
                <div>
                  <div className="text-sm text-[#a0a0a0]">Próxima tarea</div>
                  <div className="mt-1 leading-relaxed">{frente.proximaTarea}</div>
                </div>
                {frente.necesitaDelUsuario ? (
                  <div className="rounded-xl border border-[#EF9F27]/35 bg-[#EF9F27]/12 px-3 py-2 text-sm text-[#ffd089]">
                    Necesita: {frente.necesitaDelUsuario}
                  </div>
                ) : null}
                {frente.extra ? <div className="border-t border-dashed border-white/10 pt-3 text-sm text-[#a0a0a0]">{frente.extra}</div> : null}
                <div className="mt-auto flex flex-wrap gap-2">
                  <button onClick={() => setOpenTask(openTask === frente.nombre ? null : frente.nombre)} className="rounded-full border border-[#0f3460] bg-[#0f1a31] px-3 py-2 text-sm">+ tarea</button>
                  <button onClick={() => viewDetail(key)} className="rounded-full border border-[#0f3460] bg-[#0f1a31] px-3 py-2 text-sm">ver detalle</button>
                  {openTask === frente.nombre ? (
                    <div className="flex w-full gap-2">
                      <input
                        value={taskInputs[frente.nombre] || ''}
                        onChange={(e) => setTaskInputs((prev) => ({ ...prev, [frente.nombre]: e.target.value }))}
                        placeholder={`Nueva tarea para ${frente.nombre}`}
                        className="flex-1 rounded-xl border border-[#0f3460] bg-[#0f1a31] px-3 py-2 outline-none"
                      />
                      <button onClick={() => addTask(frente.nombre)} className="rounded-full border border-[#0f3460] bg-[#0f1a31] px-3 py-2 text-sm">Guardar</button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
