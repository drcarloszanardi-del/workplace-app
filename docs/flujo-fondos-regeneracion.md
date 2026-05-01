# Regeneración de `flujo-fondos.json` fuera del cron

## Cuándo usarla

Usar este flujo cuando el tablero muestre dataset vencido o cuando `metrics.totalPending` necesite validación completa contra el Excel.

## Comando recomendado

```bash
cd /Users/jarvis/workplace-app
python3 -m venv .venv
.venv/bin/python -m pip install openpyxl
.venv/bin/python scripts/build_flujo_data.py
```

No commitear `.venv/`.

## Fallback corto

Si solo hace falta recomponer el saldo pendiente visible sin releer el Excel:

```bash
cd /Users/jarvis/workplace-app
npm run flujo:data:recalc-pending
```

Este fallback recalcula `metrics.totalPending` desde `summary.totals.pending` cuando esa sección está presente. Si el JSON no tuviera `summary`, usa `recordsPreview` y recién ahí recompone también `openPendingCount`. No reemplaza una regeneración completa desde Excel.

## Límites operativos

- No correr la regeneración completa dentro del cron de 5 minutos.
- No instalar dependencias globales si alcanza con `.venv/` local.
- Después del fallback, dejar claro que `generatedAt` sigue marcando la última regeneración real desde Excel.

## Validación liviana

```bash
cd /Users/jarvis/workplace-app
python3 -m json.tool src/data/flujo-fondos.json >/dev/null
git diff -- src/data/flujo-fondos.json scripts/build_flujo_data.py docs/flujo-fondos-regeneracion.md
```
