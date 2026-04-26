export const dynamic = 'force-dynamic';

import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { readLocalStatus, syncStatusToSupabase } from '@/lib/workplace';

const DIARIO_PATH = '/Users/jarvis/DIARIO.md';

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function completeTask(frente: string) {
  const lines = (await fs.readFile(DIARIO_PATH, 'utf8')).split('\n');
  const heading = `## ${frente}`;
  const idx = lines.findIndex((line) => line.trim() === heading);
  if (idx === -1) return false;
  let taskIndex = -1;
  for (let i = idx + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) break;
    if (lines[i].startsWith('- [ ] ')) {
      taskIndex = i;
      break;
    }
  }
  if (taskIndex === -1) return false;
  const completed = lines[taskIndex].replace('- [ ] ', '');
  lines.splice(taskIndex, 1);
  const completadasIdx = lines.findIndex((line) => line.trim() === '## Completadas');
  const entry = `- ${nowStamp()}: [${frente}] ${completed}`;
  if (completadasIdx === -1) lines.push('', '## Completadas', entry);
  else lines.splice(completadasIdx + 1, 0, entry);
  await fs.writeFile(DIARIO_PATH, lines.join('\n'));
  return true;
}

export async function POST(req: NextRequest) {
  const { frente } = await req.json();
  const ok = await completeTask(frente || 'General');
  const status = await readLocalStatus();
  const error = await syncStatusToSupabase(status);
  return NextResponse.json({ ok, syncError: error?.message ?? null }, { status: ok ? 200 : 404 });
}
