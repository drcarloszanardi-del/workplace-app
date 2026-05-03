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

## Headers utiles para verificar el bloqueo actual

En la respuesta de `GET /api/pilar/dashboard?year=2026` ya quedan expuestos estos headers para confirmar el estado sin abrir logs:

- `X-Pilar-Data-Source`
- `X-Pilar-Source-Error`
- `X-Pilar-Env-Ready`
- `X-Pilar-Env-Missing`

Mientras falten envs, el caso esperado es:

- `X-Pilar-Env-Ready: no`
- `X-Pilar-Env-Missing: NEXT_PUBLIC_PILAR_SUPABASE_URL|PILAR_SUPABASE_URL,PILAR_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY`
- `X-Pilar-Data-Source: json-static-fallback`

## Validacion tecnica breve

Se reviso nuevamente la hipotesis de bundle/serverless sugerida por Codex. El estado actual ya descarta ese problema:

- `src/lib/pilar-server.ts` solo arma el cliente de Supabase y valida envs.
- `src/lib/pilar-data.ts` ya usa import estatico de `@/data/flujo-fondos.json`.
- No hay `fs`, `path`, `process.cwd()`, `require()` dinamico ni parseo JSON runtime en `src/lib/pilar-server.ts`.
- El bloqueo publico actual sigue siendo la falta de variables de entorno en Vercel, no una carga dinamica con `fs` o paths runtime.

## Resultado de la revision sugerida por Codex

No hizo falta aplicar patch en `src/lib/pilar-server.ts` porque la separacion ya esta hecha:

- `src/lib/pilar-server.ts` solo lee envs y crea el cliente admin de Supabase.
- `src/lib/pilar-data.ts` concentra el fallback con import estatico de `@/data/flujo-fondos.json`.
- El endpoint actual cae a fallback por env faltante, no por bundle roto en serverless.

## Siguiente paso

Cargar esas variables en Vercel y revalidar que el dashboard deje de usar fallback JSON estatico.

Checklist minima en Vercel:

1. Project Settings -> Environment Variables.
2. Agregar `NEXT_PUBLIC_PILAR_SUPABASE_URL` (o `PILAR_SUPABASE_URL`).
3. Agregar `PILAR_SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`).
4. Redeploy del proyecto.
5. Reprobar `https://workplace-app-eight.vercel.app/api/pilar/dashboard?year=2026` y confirmar que la fuente ya no quede en fallback estatico.
