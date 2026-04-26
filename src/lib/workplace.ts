import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

export type Frente = {
  nombre: string;
  estado: 'verde' | 'amarillo' | 'rojo';
  ultimoAvance: string;
  fechaAvance: string;
  proximaTarea: string;
  necesitaDelUsuario: string;
  extra?: string;
};

export type WorkplaceStatus = {
  lastHeartbeat: string;
  frentes: Record<string, Frente>;
};

export const statusPath = '/Users/jarvis/workplace/status.json';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const defaultStatus: WorkplaceStatus = {
  lastHeartbeat: '',
  frentes: {
    obracash: {
      nombre: 'ObraCash',
      estado: 'amarillo',
      ultimoAvance: 'Reestructuración de rubros completada',
      fechaAvance: '2026-04-25 10:30',
      proximaTarea: 'Validar totales con arquitecta',
      necesitaDelUsuario: 'Lista de correcciones de Pilar',
    },
    tesis: {
      nombre: 'Tesis',
      estado: 'amarillo',
      ultimoAvance: 'Tema registrado en USER.md',
      fechaAvance: '2026-04-25',
      proximaTarea: 'Recibir proyecto de tesis',
      necesitaDelUsuario: 'Archivo del proyecto',
    },
    reels: {
      nombre: 'Reels',
      estado: 'verde',
      ultimoAvance: 'Reel preparado: celular y columna',
      fechaAvance: '2026-04-25 08:02',
      proximaTarea: 'Reel de mañana (auto 8am)',
      necesitaDelUsuario: '',
    },
    clinica: {
      nombre: 'Clínica',
      estado: 'amarillo',
      ultimoAvance: 'Skill de partes pendiente',
      fechaAvance: '2026-04-25',
      proximaTarea: 'Crear skill partes quirúrgicos',
      necesitaDelUsuario: 'Primer caso dictado',
    },
    papers: {
      nombre: 'Papers',
      estado: 'amarillo',
      ultimoAvance: 'Prioridad definida',
      fechaAvance: '2026-04-25',
      proximaTarea: 'Armar estructura research',
      necesitaDelUsuario: 'Ideas o datos de casos',
    },
    inmobiliario: {
      nombre: 'Inmobiliario',
      estado: 'verde',
      ultimoAvance: '3 propiedades en shortlist',
      fechaAvance: '2026-04-25 07:18',
      proximaTarea: 'Rastreo mañana 7:15',
      necesitaDelUsuario: '',
      extra: 'Irigoyen 400 USD 55K | Lartigau USD 55K | Laprida 316 USD 58K',
    },
    inversiones: {
      nombre: 'Inversiones',
      estado: 'verde',
      ultimoAvance: 'Informe importación entregado',
      fechaAvance: '2026-04-24',
      proximaTarea: 'Profundizar steel frame y mobiliario médico',
      necesitaDelUsuario: '',
    },
  },
};

export async function readLocalStatus(): Promise<WorkplaceStatus> {
  try {
    const raw = await fs.readFile(statusPath, 'utf8');
    return JSON.parse(raw) as WorkplaceStatus;
  } catch {
    return defaultStatus;
  }
}

export async function writeLocalStatus(status: WorkplaceStatus) {
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2) + '\n', 'utf8');
}

export function getAdminSupabase() {
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function readRemoteStatus() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from('workplace_status').select('status').eq('id', 1).single();
  if (error || !data) return null;
  return data.status as WorkplaceStatus;
}

export async function syncStatusToSupabase(status: WorkplaceStatus) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('workplace_status')
    .upsert({ id: 1, status, updated_at: new Date().toISOString() });
  return error;
}

export async function getMergedStatus() {
  const remote = await readRemoteStatus();
  if (remote) return remote;
  return readLocalStatus();
}
