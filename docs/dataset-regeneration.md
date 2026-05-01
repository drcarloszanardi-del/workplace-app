# Regeneración de `flujo-fondos.json`

## Uso fuera del microciclo

```bash
cd /Users/jarvis/workplace-app
python3 -m venv .venv
.venv/bin/python -m pip install openpyxl
.venv/bin/python scripts/build_flujo_data.py
```

- No commitear `.venv/`.
- Esta regeneración completa requiere `openpyxl` y no debe correr dentro del cron de 5 minutos.

## Fallback rápido sin Excel

Si no se puede instalar `openpyxl`, el script permite reconstruir solo las métricas de pendientes desde el JSON actual:

```bash
cd /Users/jarvis/workplace-app
python3 scripts/build_flujo_data.py --recalc-pending-from-json
```

## Validación liviana

```bash
python3 -m json.tool src/data/flujo-fondos.json >/dev/null
grep -n '"totalPending"' src/data/flujo-fondos.json
git diff -- src/data/flujo-fondos.json scripts/build_flujo_data.py docs/dataset-regeneration.md
```
