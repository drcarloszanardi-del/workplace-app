import fs from 'fs/promises';
import { NextResponse } from 'next/server';

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
    const [statusRaw, logRaw] = await Promise.all([
      fs.readFile(statusPath, 'utf8').catch(() => '{}'),
      fs.readFile(logPath, 'utf8').catch(() => ''),
    ]);

    const status = JSON.parse(statusRaw || '{}');
    const lines = logRaw.split('\n').filter(Boolean);
    const recentEvents = lines.slice(-25).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: 'parse_error', raw: line };
      }
    }).reverse();

    const derivedState = deriveState(status);

    return NextResponse.json({
      ok: true,
      status: {
        ...status,
        derived_state: derivedState,
      },
      recentEvents,
      staleMinutes,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 },
    );
  }
}
