export const dynamic = 'force-dynamic';

import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const workspaceRoot = process.env.WORKPLACE_SOURCE_ROOT || '/Users/jarvis/.openclaw/workspace';

async function getProjectDetail(frente: string) {
  const projectPath = path.join(workspaceRoot, 'workplace', 'projects', frente, 'project.json');
  try {
    const raw = await fs.readFile(projectPath, 'utf8');
    const project = JSON.parse(raw);
    return {
      file: projectPath,
      name: project?.name || frente,
      description: project?.description || '',
      notes: Array.isArray(project?.notes) ? project.notes : [],
      documents: Array.isArray(project?.documents) ? project.documents : [],
      messages: Array.isArray(project?.messages) ? project.messages.slice(-5) : [],
      reels: Array.isArray(project?.reels) ? project.reels : [],
    };
  } catch {
    return { file: '', name: frente, description: '', notes: [], documents: [], messages: [], reels: [] };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const frente = searchParams.get('frente') || '';
  return NextResponse.json(await getProjectDetail(frente));
}
