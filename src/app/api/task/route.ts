export const dynamic = 'force-dynamic';

import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { readLocalStatus, syncStatusToSupabase } from '@/lib/workplace';

const DIARIO_PATH = '/Users/jarvis/DIARIO.md';

async function appendTask(frente: string, tarea: string) {
  let content = '# Jarvis — Tareas pendientes\n\n## Completadas\n';
  try {
    content = await fs.readFile(DIARIO_PATH, 'utf8');
  } catch {}

  const heading = `## ${frente}`;
  const taskLine = `- [ ] ${tarea}`;

  if (content.includes(heading)) {
    const lines = content.split('\n');
    const idx = lines.findIndex((line) => line.trim() === heading);
    let insertAt = idx + 1;
    while (insertAt < lines.length && !lines[insertAt].startsWith('## ')) insertAt += 1;
    lines.splice(insertAt, 0, taskLine);
    await fs.writeFile(DIARIO_PATH, lines.join('\n'));
    return;
  }

  const marker = '\n## Completadas';
  if (content.includes(marker)) {
    const next = content.replace(marker, `\n${heading}\n${taskLine}\n${marker}`);
    await fs.writeFile(DIARIO_PATH, next);
    return;
  }

  await fs.writeFile(DIARIO_PATH, `${content.trimEnd()}\n\n${heading}\n${taskLine}\n`);
}

export async function POST(req: NextRequest) {
  const { frente, tarea } = await req.json();
  await appendTask(frente || 'General', tarea || 'Tarea sin detalle');
  const status = await readLocalStatus();
  const error = await syncStatusToSupabase(status);
  return NextResponse.json({ ok: true, syncError: error?.message ?? null });
}
