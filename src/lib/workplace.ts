import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import type { WorkplaceStatus } from '@/lib/workplace-types';

export const statusPath = '/Users/jarvis/workplace/status.json';
const workspaceRoot = '/Users/jarvis/.openclaw/workspace';
const projectsRoot = `${workspaceRoot}/workplace/projects`;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ieznwnrhbroiaobheoan.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

type ProjectCard = {
  key: string;
  nombre: string;
  descripcion: string;
  folder: string;
};

export async function readLocalStatus(): Promise<WorkplaceStatus> {
  try {
    const raw = await fs.readFile(statusPath, 'utf8');
    return JSON.parse(raw) as WorkplaceStatus;
  } catch {
    return { lastHeartbeat: '', frentes: {} };
  }
}

export async function writeLocalStatus(status: WorkplaceStatus) {
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2) + '\n', 'utf8');
}

export function getAdminSupabase() {
  if (!serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function readRemoteStatus() {
  const supabase = getAdminSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('workplace_status').select('status').eq('id', 1).single();
    if (error || !data) return null;
    return data.status as WorkplaceStatus;
  } catch {
    return null;
  }
}

export async function syncStatusToSupabase(status: WorkplaceStatus) {
  const supabase = getAdminSupabase();
  if (!supabase) return new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  try {
    const { error } = await supabase
      .from('workplace_status')
      .upsert({ id: 1, status, updated_at: new Date().toISOString() });
    return error;
  } catch (error) {
    return error instanceof Error ? error : new Error('unknown sync error');
  }
}

function folderToTitle(folder: string) {
  return folder
    .replace(/^project-\d+$/, 'Tesis')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function readProjectCards(): Promise<ProjectCard[]> {
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const cards = await Promise.all(
    dirs.map(async (folder) => {
      const readmePath = `${projectsRoot}/${folder}/README.md`;
      try {
        const content = await fs.readFile(readmePath, 'utf8');
        const lines = content.split('\n').map((line) => line.trim());
        const heading = lines.find((line) => line.startsWith('# '))?.replace(/^#\s+/, '').trim() || folderToTitle(folder);
        const descripcion =
          lines.find((line) => line.startsWith('## Descripción'))
            ? lines[lines.findIndex((line) => line.startsWith('## Descripción')) + 1]?.trim() || ''
            : lines.find((line) => line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('##')) || '';
        return {
          key: folder,
          nombre: heading,
          descripcion: descripcion || `Proyecto ${folder}`,
          folder,
        };
      } catch {
        return {
          key: folder,
          nombre: folderToTitle(folder),
          descripcion: `Proyecto ${folder}`,
          folder,
        };
      }
    }),
  );
  return cards;
}

async function getLastUpdateStamp() {
  try {
    const stat = await fs.stat(`${workspaceRoot}/PENDIENTES_ZANARDI.md`);
    return new Date(stat.mtime).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function buildTopicsStatus(): Promise<WorkplaceStatus> {
  const cards = await readProjectCards();
  const lastHeartbeat = await getLastUpdateStamp();
  const frentes: WorkplaceStatus['frentes'] = {};

  for (const card of cards) {
    frentes[card.key] = {
      nombre: card.nombre,
      estado: 'verde',
      ultimoAvance: 'Topic visible en Workplace',
      fechaAvance: lastHeartbeat,
      proximaTarea: 'Abrir detalle y continuar trabajo del frente',
      necesitaDelUsuario: '',
      extra: `Carpeta: workplace/projects/${card.folder}${card.descripcion ? ` | ${card.descripcion}` : ''}`,
    };
  }

  return { lastHeartbeat, frentes };
}

export async function getMergedStatus() {
  const remote = await readRemoteStatus();
  if (remote && Object.keys(remote.frentes || {}).length > 0) return remote;
  try {
    return await buildTopicsStatus();
  } catch {
    return readLocalStatus();
  }
}
