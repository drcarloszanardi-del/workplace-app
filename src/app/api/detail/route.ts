export const dynamic = 'force-dynamic';

import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

function getLastFrontFile(frente: string) {
  const candidates = [
    `/Users/jarvis/.openclaw/workspace/reports/${frente}`,
    `/Users/jarvis/.openclaw/workspace/workplace/projects/${frente}`,
    `/Users/jarvis/.openclaw/workspace/workplace`,
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .map((name) => ({ name, full: path.join(dir, name) }))
      .filter((entry) => fs.statSync(entry.full).isFile())
      .sort((a, b) => fs.statSync(b.full).mtimeMs - fs.statSync(a.full).mtimeMs);
    if (files[0]) return files[0].full;
  }
  return '';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const frente = searchParams.get('frente') || '';
  return NextResponse.json({ file: getLastFrontFile(frente) });
}
