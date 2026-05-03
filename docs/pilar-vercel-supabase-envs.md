# Pilar Vercel envs pendientes

Estado: la app publica responde en `/` y el endpoint `/api/pilar/dashboard?year=2026`, pero queda en fallback estatico hasta cargar variables de Supabase en Vercel.

## Variables requeridas

Configurar en el proyecto de Vercel alguno de estos pares:

- `NEXT_PUBLIC_PILAR_SUPABASE_URL` o `PILAR_SUPABASE_URL`
- `PILAR_SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SERVICE_ROLE_KEY`

## Error observado

`Supabase env missing: falta configurar [NEXT_PUBLIC_PILAR_SUPABASE_URL | PILAR_SUPABASE_URL] + [PILAR_SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SERVICE_ROLE_KEY]`

## URLs validadas

- `https://workplace-app-eight.vercel.app/`
- `https://workplace-app-eight.vercel.app/api/pilar/dashboard?year=2026`

## Siguiente paso

Cargar esas variables en Vercel y revalidar que el dashboard deje de usar fallback JSON estatico.
