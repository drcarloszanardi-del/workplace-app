import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Mantener este modulo limitado a clientes/env de Supabase.
// No cargar JSON ni archivos en runtime desde aca para no romper el bundle serverless.
// Si hace falta fallback estatico, debe vivir en src/lib/pilar-data.ts con imports estaticos trazables por el bundler.
function cleanEnv(value?: string) {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  const normalized = trimmed.toLowerCase();
  if (normalized === 'undefined' || normalized === 'null') return '';
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unwrapped = trimmed.slice(1, -1).trim();
    const unwrappedNormalized = unwrapped.toLowerCase();
    return unwrappedNormalized === 'undefined' || unwrappedNormalized === 'null' ? '' : unwrapped;
  }
  return trimmed;
}

export function getPilarLiveConfig() {
  return {
    supabaseUrl: cleanEnv(
      process.env.NEXT_PUBLIC_PILAR_SUPABASE_URL ||
        process.env.PILAR_SUPABASE_URL,
    ),
    serviceRoleKey: cleanEnv(
      process.env.PILAR_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}

export function getPilarEnvState() {
  const { supabaseUrl, serviceRoleKey } = getPilarLiveConfig();
  return {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  };
}

function getMissingEnvMessage(label: string, requiredGroups: string[][]) {
  const missingGroups = requiredGroups.filter(
    (group) => !group.some((name) => cleanEnv(process.env[name])),
  );
  const detail = missingGroups
    .map((group) => `[${group.join(' | ')}]`)
    .join(' + ');
  return `${label}: falta configurar ${detail}`;
}

export function getPilarAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getPilarLiveConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      getMissingEnvMessage('Supabase env missing', [
        ['NEXT_PUBLIC_PILAR_SUPABASE_URL', 'PILAR_SUPABASE_URL'],
        ['PILAR_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      ]),
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
