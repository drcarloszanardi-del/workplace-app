import os
from pathlib import Path

from urllib.parse import urlparse

try:
    import psycopg
except ImportError:
    raise SystemExit('psycopg no instalado. Ejecutar: python3 -m pip install psycopg[binary]')

DB_URL = os.environ.get('PILAR_SUPABASE_DB_URL')
if not DB_URL:
    raise SystemExit('Falta PILAR_SUPABASE_DB_URL')

sql = Path('scripts/pilar_bootstrap.sql').read_text()

with psycopg.connect(DB_URL) as conn:
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()

print('Bootstrap SQL aplicado OK')
