import { createClient } from '@supabase/supabase-js';

function cleanEnv(value?: string) {
  return value?.trim() || '';
}

function readPilarEnv() {
  return {
    supabaseUrl: cleanEnv(
      process.env.NEXT_PUBLIC_PILAR_SUPABASE_URL ||
        process.env.PILAR_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    serviceRoleKey: cleanEnv(
      process.env.PILAR_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    anonKey: cleanEnv(
      process.env.NEXT_PUBLIC_PILAR_SUPABASE_ANON_KEY ||
        process.env.PILAR_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
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
  const { supabaseUrl, serviceRoleKey } = readPilarEnv();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      getMissingEnvMessage('Supabase env missing', [
        ['NEXT_PUBLIC_PILAR_SUPABASE_URL', 'PILAR_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
        ['PILAR_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      ]),
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPilarPublicClient() {
  const { supabaseUrl, anonKey } = readPilarEnv();
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      getMissingEnvMessage('Supabase public env missing', [
        ['NEXT_PUBLIC_PILAR_SUPABASE_URL', 'PILAR_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
        ['NEXT_PUBLIC_PILAR_SUPABASE_ANON_KEY', 'PILAR_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
      ]),
    );
  }
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
