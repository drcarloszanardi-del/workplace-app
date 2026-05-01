# Regeneración de `flujo-fondos.json`

## Uso normal, fuera del cron de 5 minutos

```bash
cd /Users/jarvis/workplace-app
python3 -m venv .venv
.venv/bin/python -m pip install openpyxl
.venv/bin/python scripts/build_flujo_data.py
```

Notas:
- No commitear `.venv/`.
- Este paso requiere `openpyxl` para leer el Excel fuente.
- No correr build de Next dentro del microciclo productivo.

## Fallback rápido si no se puede regenerar desde Excel

```bash
cd /Users/jarvis/workplace-app
python3 scripts/build_flujo_data.py --recalc-pending-from-json
python3 -m json.tool src/data/flujo-fondos.json >/dev/null
```

Este fallback solo recalcula `metrics.openPendingCount` y `metrics.totalPending` desde `recordsPreview` ya presente en `src/data/flujo-fondos.json`.
