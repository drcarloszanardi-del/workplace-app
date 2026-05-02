import { NextResponse } from 'next/server';
import { getPilarAdminClient } from '@/lib/pilar-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REQUIRED_TABLES = [
  'pilar_rubros',
  'pilar_transacciones',
  'pilar_cuenta_usd',
  'pilar_deudas',
  'pilar_caja',
  'pilar_cotizacion_usd_cache',
  'pilar_user_roles',
] as const;

export async function GET() {
  const supabase = getPilarAdminClient();
  const checks = await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error, data } = await supabase.from(table).select('*', { count: 'exact', head: true });
      return {
        table,
        exists: !error,
        error: error?.message || null,
        count: typeof data === 'undefined' ? null : null,
      };
    }),
  );

  const missing = checks.filter((item) => !item.exists).map((item) => item.table);

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    checks,
    nextStep: missing.length === 0
      ? 'Schema listo para continuar con migración y CRUD.'
      : 'Ejecutar supabase/pil001-schema.sql en el SQL Editor de Supabase y volver a consultar este endpoint.',
  });
}
