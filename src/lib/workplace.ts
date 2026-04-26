import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { defaultStatus } from '@/lib/default-status';
import type { WorkplaceStatus } from '@/lib/workplace-types';

export const statusPath = '/Users/jarvis/workplace/status.json';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ieznwnrhbroiaobheoan.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';


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

function mapState(raw: string): 'verde' | 'amarillo' | 'rojo' {
  const value = raw.toLowerCase();
  if (value.includes('bloque') || value.includes('trab') || value.includes('error')) return 'rojo';
  if (value.includes('activo') || value.includes('curso') || value.includes('listo') || value.includes('desde ahora')) return 'verde';
  return 'amarillo';
}

function parsePendientes(content: string): WorkplaceStatus {
  const lines = content.split('\n');
  const lastUpdateLine = lines.find((line) => line.startsWith('Última actualización:')) || '';
  const lastHeartbeat = lastUpdateLine.replace('Última actualización:', '').trim();
  const frentes: WorkplaceStatus['frentes'] = {};

  const blocks = content.split(/^###\s+/m).slice(1);
  for (const block of blocks) {
    const rows = block.split('\n').filter(Boolean);
    const title = rows[0]?.replace(/^\d+\.\s*/, '').trim();
    if (!title) continue;

    const estado = rows.find((row) => row.startsWith('- Estado:'))?.replace('- Estado:', '').trim() || 'pendiente';
    const objetivo = rows.find((row) => row.startsWith('- Objetivo:'))?.replace('- Objetivo:', '').trim() || '';
    const proximo = rows.find((row) => row.startsWith('- Próximo paso:'))?.replace('- Próximo paso:', '').trim() || '';
    const deadline = rows.find((row) => row.startsWith('- Deadline:'))?.replace('- Deadline:', '').trim() || '';
    const criterio = rows.find((row) => row.startsWith('- Criterio de terminado:'))?.replace('- Criterio de terminado:', '').trim() || '';

    const key = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    frentes[key] = {
      nombre: title,
      estado: mapState(estado),
      ultimoAvance: estado.charAt(0).toUpperCase() + estado.slice(1),
      fechaAvance: lastHeartbeat,
      proximaTarea: proximo || objetivo || 'Sin próxima tarea definida',
      necesitaDelUsuario: '',
      extra: [deadline ? `Deadline: ${deadline}` : '', criterio ? `Terminado cuando: ${criterio}` : ''].filter(Boolean).join(' | '),
    };
  }

  return {
    lastHeartbeat,
    frentes: Object.keys(frentes).length ? frentes : defaultStatus.frentes,
  };
}

export async function getMergedStatus() {
  const remote = await readRemoteStatus();
  if (remote) return remote;
  try {
    const pendientes = await fs.readFile('/Users/jarvis/.openclaw/workspace/PENDIENTES_ZANARDI.md', 'utf8');
    return parsePendientes(pendientes);
  } catch {}
  return readLocalStatus();
}
