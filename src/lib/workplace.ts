import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import type { WorkplaceStatus } from '@/lib/workplace-types';

export const statusPath = '/Users/jarvis/workplace/status.json';
const workspaceRoot = process.env.WORKPLACE_SOURCE_ROOT || '/Users/jarvis/.openclaw/workspace';
const projectsRoot = `${workspaceRoot}/workplace/projects`;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ieznwnrhbroiaobheoan.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

type ProjectCard = {
  key: string;
  nombre: string;
  descripcion: string;
  folder: string;
  estado?: 'verde' | 'amarillo' | 'rojo';
  ultimoAvance?: string;
  proximaTarea?: string;
  necesitaDelUsuario?: string;
  extra?: string;
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

function summarizeProject(project: any, fallback: string) {
  const messages = Array.isArray(project?.messages) ? project.messages : [];
  const notes = Array.isArray(project?.notes) ? project.notes.filter(Boolean) : [];
  const documents = Array.isArray(project?.documents) ? project.documents : [];
  const reels = Array.isArray(project?.reels) ? project.reels : [];
  const lastMessage = [...messages].reverse().find((m) => m?.text)?.text || '';
  const pendingNote = notes.find((n: string) => /pend|definir|revis|pedir|agregar|mantener/i.test(n)) || '';

  return {
    estado: 'verde' as 'verde',
    ultimoAvance: lastMessage || fallback,
    proximaTarea: pendingNote || 'Abrir detalle y continuar trabajo del frente',
    extra: [
      documents.length ? `${documents.length} documento(s)` : '',
      reels.length ? `${reels.length} reel(es)` : '',
      notes.length ? `${notes.length} nota(s)` : '',
    ].filter(Boolean).join(' | '),
  };
}

async function readProjectCards(): Promise<ProjectCard[]> {
  const preferred = ['obracash', 'papers-cientificos', 'project-1776699923524', 'reel-cirugia-columna-001', 'clinica', 'inversiones', 'inmobiliaria', 'finanzas', 'jarvis-ui'];
  let dirs: string[] = [];

  try {
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    dirs = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();
  } catch {}

  const mergedDirs = [...new Set([...preferred, ...dirs])];
  const cards = await Promise.all(
    mergedDirs.map(async (folder) => {
      const readmePath = `${projectsRoot}/${folder}/README.md`;
      const projectJsonPath = `${projectsRoot}/${folder}/project.json`;
      try {
        const [readmeContent, projectRaw] = await Promise.all([
          fs.readFile(readmePath, 'utf8').catch(() => ''),
          fs.readFile(projectJsonPath, 'utf8').catch(() => ''),
        ]);

        const lines = readmeContent.split('\n').map((line) => line.trim());
        const headingFromReadme = lines.find((line) => line.startsWith('# '))?.replace(/^#\s+/, '').trim() || '';
        const descripcionFromReadme =
          lines.find((line) => line.startsWith('## Descripción'))
            ? lines[lines.findIndex((line) => line.startsWith('## Descripción')) + 1]?.trim() || ''
            : lines.find((line) => line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('##')) || '';

        let project: any = null;
        try {
          project = projectRaw ? JSON.parse(projectRaw) : null;
        } catch {}

        const summary = summarizeProject(project, project?.description || descripcionFromReadme || `Proyecto ${folder}`);

        return {
          key: project?.id || folder,
          nombre: project?.name || headingFromReadme || folderToTitle(folder),
          descripcion: project?.description || descripcionFromReadme || `Proyecto ${folder}`,
          folder,
          estado: summary.estado,
          ultimoAvance: summary.ultimoAvance,
          proximaTarea: summary.proximaTarea,
          necesitaDelUsuario: '',
          extra: [summary.extra, folder ? `Carpeta: ${folder}` : ''].filter(Boolean).join(' | '),
        };
      } catch {
        return {
          key: folder,
          nombre: folderToTitle(folder),
          descripcion: `Proyecto ${folder}`,
          folder,
          estado: 'amarillo' as 'amarillo',
          ultimoAvance: `Proyecto ${folder}`,
          proximaTarea: 'Abrir detalle y continuar trabajo del frente',
          necesitaDelUsuario: '',
          extra: `Carpeta: ${folder}`,
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

function fallbackStatus(): WorkplaceStatus {
  const now = new Date().toISOString();
  return {
    lastHeartbeat: now,
    frentes: {
      'jarvis-ui': {
        nombre: 'Interfaz Jarvis',
        estado: 'verde',
        ultimoAvance: 'Producción activa con dataset fallback.',
        fechaAvance: now,
        proximaTarea: 'Completar vista por proyecto, detalle y persistencia.',
        necesitaDelUsuario: '',
        extra: 'UI del workplace en ajuste.',
      },
      'project-1776699923524': {
        nombre: 'Tesis Doctorado Carlos Zanardi',
        estado: 'verde',
        ultimoAvance: 'Proyecto visible en producción.',
        fechaAvance: now,
        proximaTarea: 'Agregar próximos pasos reales y documentos asociados.',
        necesitaDelUsuario: '',
        extra: 'Frente académico prioritario.',
      },
      inmobiliaria: {
        nombre: 'Búsqueda inmobiliaria',
        estado: 'verde',
        ultimoAvance: 'Proyecto visible en producción.',
        fechaAvance: now,
        proximaTarea: 'Mostrar propiedades, correos y material asociado.',
        necesitaDelUsuario: '',
        extra: 'Flipping y oportunidades.',
      },
      'reel-cirugia-columna-001': {
        nombre: 'Reel cirugía de columna 001',
        estado: 'verde',
        ultimoAvance: 'Proyecto visible en producción.',
        fechaAvance: now,
        proximaTarea: 'Mostrar assets, guión y plan de publicación.',
        necesitaDelUsuario: '',
        extra: 'Contenido profesional médico.',
      },
    },
  };
}

async function buildTopicsStatus(): Promise<WorkplaceStatus> {
  const cards = await readProjectCards();
  const lastHeartbeat = await getLastUpdateStamp();
  const frentes: WorkplaceStatus['frentes'] = {};

  for (const card of cards) {
    frentes[card.key] = {
      nombre: card.nombre,
      estado: card.estado || 'verde',
      ultimoAvance: card.ultimoAvance || 'Topic visible en Workplace',
      fechaAvance: lastHeartbeat,
      proximaTarea: card.proximaTarea || 'Abrir detalle y continuar trabajo del frente',
      necesitaDelUsuario: card.necesitaDelUsuario || '',
      extra: [card.descripcion, card.extra].filter(Boolean).join(' | '),
    };
  }

  return { lastHeartbeat, frentes };
}

export async function getMergedStatus() {
  try {
    const remote = await readRemoteStatus();
    if (remote && Object.keys(remote.frentes || {}).length > 0) return remote;
  } catch {}

  try {
    const topics = await buildTopicsStatus();
    if (Object.keys(topics.frentes || {}).length > 0) return topics;
  } catch {}

  try {
    const local = await readLocalStatus();
    if (local && Object.keys(local.frentes || {}).length > 0) return local;
  } catch {}

  return fallbackStatus();
}
