import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import type { WorkplaceStatus } from '@/lib/workplace-types';

export const statusPath = '/Users/jarvis/workplace/status.json';
const workspaceRoot = process.env.WORKPLACE_SOURCE_ROOT || '/Users/jarvis/.openclaw/workspace';
const localProjectsRoot = `${workspaceRoot}/workplace/projects`;
const bundledProjectsRoot = `${process.cwd()}/workplace/projects`;
const supabaseUrl = process.env.NEXT_PUBLIC_PILAR_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.PILAR_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  faseActual?: string;
  avanceAutonomo?: 'si' | 'no';
  esperaRespuesta?: 'si' | 'no';
  actividadPct?: number;
  progresoPct?: number;
  totalItems?: number;
  completedItems?: number;
};

type ProjectTask = {
  status?: string;
  estado?: string;
};

type ProjectMessage = {
  text?: string;
};

type ProjectData = {
  id?: string;
  name?: string;
  description?: string;
  messages?: ProjectMessage[];
  notes?: string[];
  documents?: unknown[];
  reels?: unknown[];
  tasks?: ProjectTask[];
};

const ESTADO_AMARILLO = 'amarillo' as const;
const ESTADO_VERDE = 'verde' as const;
const AVANCE_NO = 'no' as const;
const AVANCE_SI = 'si' as const;

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

function summarizeProject(project: ProjectData | null, fallback: string) {
  const messages = Array.isArray(project?.messages) ? project.messages : [];
  const notes = Array.isArray(project?.notes) ? project.notes.filter((note): note is string => Boolean(note)) : [];
  const documents = Array.isArray(project?.documents) ? project.documents : [];
  const reels = Array.isArray(project?.reels) ? project.reels : [];
  const tasks = Array.isArray(project?.tasks) ? project.tasks : [];
  const lastMessage = [...messages].reverse().find((message) => message?.text)?.text || '';
  const pendingNote = notes.find((n) => /pend|definir|revis|pedir|agregar|mantener/i.test(n)) || '';

  const necesita = notes.find((n) => /necesita|aprobaci|respuesta|validaci|contestar/i.test(n)) || '';
  const completedTasks = tasks.filter((task) => {
    const state = String(task?.status || task?.estado || '').toLowerCase();
    return ['done', 'completed', 'complete', 'hecho', 'cerrado', 'closed'].includes(state);
  }).length;
  const totalItems = messages.length + notes.length + documents.length + reels.length + tasks.length;
  const completedItems = completedTasks;
  const progresoBase = tasks.length > 0 ? tasks.length : totalItems;
  const progresoPct = tasks.length > 0
    ? Math.round((completedItems / progresoBase) * 100)
    : Math.min(95, Math.max(10, messages.length * 10 + notes.length * 12 + documents.length * 14 + reels.length * 20));
  const activitySignals = [
    Math.min(messages.length * 12, 36),
    Math.min(notes.length * 10, 20),
    Math.min(documents.length * 12, 24),
    Math.min(reels.length * 18, 18),
    Math.min(completedTasks * 16, 32),
    necesita ? -10 : 10,
  ];
  const actividadPct = Math.max(5, Math.min(100, activitySignals.reduce((acc, n) => acc + n, 0)));

  return {
    estado: necesita ? ESTADO_AMARILLO : ESTADO_VERDE,
    ultimoAvance: lastMessage || fallback,
    proximaTarea: pendingNote || 'Abrir detalle y continuar trabajo del frente',
    faseActual: necesita ? 'Esperando respuesta del señor Zanardi' : 'Avance autónomo en curso',
    avanceAutonomo: necesita ? AVANCE_NO : AVANCE_SI,
    esperaRespuesta: necesita ? AVANCE_SI : AVANCE_NO,
    necesitaDelUsuario: necesita,
    actividadPct,
    progresoPct,
    totalItems,
    completedItems,
    extra: [
      documents.length ? `${documents.length} documento(s)` : '',
      reels.length ? `${reels.length} reel(es)` : '',
      notes.length ? `${notes.length} nota(s)` : '',
      tasks.length ? `${tasks.length} tarea(s)` : '',
    ].filter(Boolean).join(' | '),
  };
}

async function readProjectCards(): Promise<ProjectCard[]> {
  const preferred = ['obracash', 'papers-cientificos', 'project-1776699923524', 'reel-cirugia-columna-001', 'clinica', 'inversiones', 'inmobiliaria', 'finanzas', 'jarvis-ui'];
  let dirs: string[] = [];

  const candidateRoots = [localProjectsRoot, bundledProjectsRoot];
  let activeProjectsRoot = candidateRoots[0];

  for (const root of candidateRoots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      const found = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();
      if (found.length > 0) {
        dirs = found;
        activeProjectsRoot = root;
        break;
      }
    } catch {}
  }

  const mergedDirs = [...new Set([...preferred, ...dirs])];
  const cards = await Promise.all(
    mergedDirs.map(async (folder) => {
      const readmePath = `${activeProjectsRoot}/${folder}/README.md`;
      const projectJsonPath = `${activeProjectsRoot}/${folder}/project.json`;
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

        let project: ProjectData | null = null;
        try {
          project = projectRaw ? (JSON.parse(projectRaw) as ProjectData) : null;
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
          necesitaDelUsuario: summary.necesitaDelUsuario,
          faseActual: summary.faseActual,
          avanceAutonomo: summary.avanceAutonomo,
          esperaRespuesta: summary.esperaRespuesta,
          actividadPct: summary.actividadPct,
          progresoPct: summary.progresoPct,
          totalItems: summary.totalItems,
          completedItems: summary.completedItems,
          extra: [summary.extra, folder ? `Carpeta: ${folder}` : ''].filter(Boolean).join(' | '),
        };
      } catch {
        return {
          key: folder,
          nombre: folderToTitle(folder),
          descripcion: `Proyecto ${folder}`,
          folder,
          estado: ESTADO_AMARILLO,
          ultimoAvance: `Proyecto ${folder}`,
          proximaTarea: 'Abrir detalle y continuar trabajo del frente',
          necesitaDelUsuario: '',
          faseActual: 'Avance autónomo en curso',
          avanceAutonomo: AVANCE_SI,
          esperaRespuesta: AVANCE_NO,
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
        faseActual: 'Avance autónomo en curso',
        avanceAutonomo: 'si',
        esperaRespuesta: 'no',
        extra: 'UI del workplace en ajuste.',
      },
      'project-1776699923524': {
        nombre: 'Tesis Doctorado Carlos Zanardi',
        estado: 'verde',
        ultimoAvance: 'Proyecto visible en producción.',
        fechaAvance: now,
        proximaTarea: 'Agregar próximos pasos reales y documentos asociados.',
        necesitaDelUsuario: '',
        faseActual: 'Avance autónomo en curso',
        avanceAutonomo: 'si',
        esperaRespuesta: 'no',
        extra: 'Frente académico prioritario.',
      },
      inmobiliaria: {
        nombre: 'Búsqueda inmobiliaria',
        estado: 'verde',
        ultimoAvance: 'Proyecto visible en producción.',
        fechaAvance: now,
        proximaTarea: 'Mostrar propiedades, correos y material asociado.',
        necesitaDelUsuario: '',
        faseActual: 'Avance autónomo en curso',
        avanceAutonomo: 'si',
        esperaRespuesta: 'no',
        extra: 'Flipping y oportunidades.',
      },
      'reel-cirugia-columna-001': {
        nombre: 'Reel cirugía de columna 001',
        estado: 'verde',
        ultimoAvance: 'Proyecto visible en producción.',
        fechaAvance: now,
        proximaTarea: 'Mostrar assets, guión y plan de publicación.',
        necesitaDelUsuario: '',
        faseActual: 'Avance autónomo en curso',
        avanceAutonomo: 'si',
        esperaRespuesta: 'no',
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
      faseActual: card.faseActual || 'Avance autónomo en curso',
      avanceAutonomo: card.avanceAutonomo || 'si',
      esperaRespuesta: card.esperaRespuesta || 'no',
      actividadPct: card.actividadPct ?? 0,
      progresoPct: card.progresoPct ?? 0,
      totalItems: card.totalItems ?? 0,
      completedItems: card.completedItems ?? 0,
      extra: [card.descripcion, card.extra].filter(Boolean).join(' | '),
    };
  }

  return { lastHeartbeat, frentes };
}

export async function getMergedStatus() {
  try {
    const topics = await buildTopicsStatus();
    if (Object.keys(topics.frentes || {}).length > 0) return topics;
  } catch {}

  try {
    const remote = await readRemoteStatus();
    if (remote && Object.keys(remote.frentes || {}).length > 0) return remote;
  } catch {}

  try {
    const local = await readLocalStatus();
    if (local && Object.keys(local.frentes || {}).length > 0) return local;
  } catch {}

  return fallbackStatus();
}
