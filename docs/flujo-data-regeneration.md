# Regeneración segura de `flujo-fondos.json`

## Contexto
El generador `scripts/build_flujo_data.py` necesita `openpyxl` para volver a leer el Excel original. El microciclo de 5 minutos no debe instalar dependencias ni correr builds largos.

## Regeneración completa, fuera del cron
```bash
cd /Users/jarvis/workplace-app
python3 -m venv .venv
.venv/bin/python -m pip install openpyxl
.venv/bin/python scripts/build_flujo_data.py
```

Notas:
- No commitear `.venv/`.
- Esto refresca `src/data/flujo-fondos.json` desde `Flujo_de_Fondos_2026---5877ca3e-5fba-478c-bd25-d3518ab72ad8.xlsx`.

## Fallback corto dentro del repo
Si solo hace falta recomponer `metrics.totalPending` usando el JSON actual:
```bash
cd /Users/jarvis/workplace-app
python3 scripts/build_flujo_data.py --recalc-pending-from-json
python3 -m json.tool src/data/flujo-fondos.json >/dev/null
```

Notas:
- Este fallback no relee el Excel y deja `generatedAt` intacto.
- El tablero debe seguir en `DUDOSO` hasta regenerar completo el dataset fuera del cron.

## Validación liviana
```bash
git diff --check
python3 -m json.tool src/data/flujo-fondos.json >/dev/null
git diff -- src/data/flujo-fondos.json scripts/build_flujo_data.py docs/flujo-data-regeneration.md
```
