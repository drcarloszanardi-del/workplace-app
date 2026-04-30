import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import { getMergedStatus } from '@/lib/workplace';

export const dynamic = 'force-dynamic';

const workspaceRoot = process.env.WORKPLACE_SOURCE_ROOT || '/Users/jarvis/.openclaw/workspace';
const statusPath = `${workspaceRoot}/CURRENT_STATUS.json`;
const logPath = `${workspaceRoot}/ACTIVITY.log.jsonl`;
const staleMinutes = Number(process.env.JARVIS_ACTIVITY_STALE_MINUTES || 20);

function parseDate(raw?: string) {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveState(status: any) {
  const last = parseDate(status?.last_evidence_at);
  if (!last) return 'available';
  const diffMin = (Date.now() - last.getTime()) / 60000;
  if (status?.state === 'blocked') return 'blocked';
  if (diffMin > staleMinutes) return 'stale';
  return status?.state || 'available';
}

export async function GET() {
  try {
    const merged = await getMergedStatus();
    const active = Object.values(merged.frentes || {}).find((frente: any) => frente?.avanceAutonomo === 'si') as any;

    const [statusRaw, logRaw] = await Promise.all([
      fs.readFile(statusPath, 'utf8').catch(() => ''),
      fs.readFile(logPath, 'utf8').catch(() => ''),
    ]);

    const parsedStatus = statusRaw ? JSON.parse(statusRaw) : null;
    const lines = logRaw.split('\n').filter(Boolean);
    const recentEvents = lines.slice(-25).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: 'parse_error', raw: line };
      }
    }).reverse();

    const fallbackStatus = {
      state: active ? 'working' : 'available',
      task: active?.proximaTarea || active?.ultimoAvance || 'sin tarea',
      last_evidence_at: merged.lastHeartbeat,
      last_artifact: active?.nombre || 'Workplace',
      note: active?.faseActual || 'Avance autónomo en curso',
    };

    const status = parsedStatus && parsedStatus.task ? parsedStatus : fallbackStatus;
    const derivedState = deriveState(status);

    const events = recentEvents.length
      ? recentEvents
      : [
          {
            event: active ? 'topic_sync' : 'idle',
            state: active ? 'working' : 'available',
            task: fallbackStatus.task,
            artifact: fallbackStatus.last_artifact,
            note: fallbackStatus.note,
            ts: merged.lastHeartbeat,
          },
        ];

    return NextResponse.json({
      ok: true,
      status: {
        ...status,
        derived_state: derivedState,
      },
      recentEvents: events,
      staleMinutes,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 },
    );
  }
}
