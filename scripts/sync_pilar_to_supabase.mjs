import fs from 'fs';

function loadEnv(path) {
  const env = {};
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!raw || raw.trim().startsWith('#') || !raw.includes('=')) continue;
    const idx = raw.indexOf('=');
    env[raw.slice(0, idx)] = raw.slice(idx + 1);
  }
  return env;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const env = loadEnv('.env.local');
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey) {
  throw new Error('Missing Supabase env vars');
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=representation',
};

async function rest(path, options = {}) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function sqlQuote(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function createTableIfMissing(table, ddl) {
  const probe = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=1`, { headers });
  if (probe.status !== 404) return;
  const statements = ddl
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    const payload = { query: statement.endsWith(';') ? statement : `${statement};` };
    const res = await fetch(`${baseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`No se pudo ejecutar DDL para ${table}: ${res.status} ${text}`);
    }
  }
}

const data = JSON.parse(fs.readFileSync('src/data/flujo-fondos.json', 'utf8'));

const rubros = [
  ['Ventas Maxi Pisos', 'ingreso', 'Maxi Pisos', true, 1],
  ['Ventas Mozzetto', 'ingreso', 'Mozzetto', true, 2],
  ['Ventas Flex-Color', 'ingreso', 'Flex-Color', true, 3],
  ['Ventas Lamparas', 'ingreso', 'Lamparas', true, 4],
  ['Ventas Mobile', 'ingreso', 'Mobile', true, 5],
  ['Ventas Muresco', 'ingreso', 'Muresco', true, 6],
  ['Ventas Otros', 'ingreso', 'Otros', true, 7],
  ['Liquidación USD', 'ingreso', null, true, 8],
  ['Maxi Pisos - Pagos', 'egreso', 'Maxi Pisos', true, 10],
  ['Mozzetto - Pagos', 'egreso', 'Mozzetto', true, 11],
  ['Flex-Color - Pagos', 'egreso', 'Flex-Color', true, 12],
  ['Lamparas - Pagos', 'egreso', 'Lamparas', true, 13],
  ['Mobile - Pagos', 'egreso', 'Mobile', true, 14],
  ['Muresco - Pagos', 'egreso', 'Muresco', true, 15],
  ['Otros Proveedores - Pagos', 'egreso', 'Otros', true, 16],
  ['Impuestos', 'egreso', null, true, 20],
  ['Viaticos/Combustible', 'egreso', null, true, 21],
  ['Ferreteria', 'egreso', null, true, 22],
  ['Publicidad', 'egreso', null, true, 23],
  ['Alquiler', 'egreso', null, true, 24],
  ['Colocación', 'egreso', null, true, 25],
  ['Servicios', 'egreso', null, true, 26],
  ['Fletes', 'egreso', null, true, 27],
  ['Gastos Generales', 'egreso', null, true, 28],
  ['Contador', 'egreso', null, true, 29],
  ['AFIP', 'egreso', null, true, 30],
  ['Showroom', 'egreso', null, true, 31],
  ['Compra Dolares', 'utilidad', null, true, 40],
  ['Utilidades Pilar', 'utilidad', null, true, 41],
  ['Utilidades Male', 'utilidad', null, false, 99],
].map(([nombre, tipo, grupo_proveedor, activo, orden]) => ({ nombre, tipo, grupo_proveedor, activo, orden }));

const cajaBase = [
  { concepto: 'Efectivo Pili', monto: 541800, orden: 1 },
  { concepto: 'Banco Nacion', monto: 602512.13, orden: 2 },
  { concepto: 'Banco pcia. Credito', monto: 0, orden: 3 },
  { concepto: 'Cheques', monto: 0, orden: 4 },
  { concepto: 'Dolares', monto: 5870, orden: 5 },
];

const deudas = (data.debts || []).map((item) => ({
  concepto: item.concept,
  monto: Number(item.amount || 0),
  vencimiento: item.dueDate || null,
  activo: true,
}));

async function main() {
  const rubroRows = await rest('rubros?select=id,nombre&limit=500');
  const useExistingTables = Array.isArray(rubroRows) && rubroRows.length && 'obra_id' in rubroRows[0];
  if (useExistingTables) {
    throw new Error('La tabla rubros existente pertenece a otra app. Hay que aislar PIL-001 en otro schema/proyecto Supabase antes de publicar.');
  }

  await rest('rubros', { method: 'POST', body: JSON.stringify(rubros) });
  const rubrosActuales = await rest('rubros?select=id,nombre&limit=500');
  const rubroMap = new Map(rubrosActuales.map((row) => [row.nombre, row.id]));

  await rest('caja?on_conflict=concepto', { method: 'POST', body: JSON.stringify(cajaBase) });
  await rest('deudas?on_conflict=concepto', { method: 'POST', body: JSON.stringify(deudas) });

  await rest('transacciones?id=not.is.null', { method: 'DELETE' });
  const records = (data.recordsPreview || []).map((record) => ({
    fecha: record.date,
    mes: Number(record.month),
    anio: Number(record.year),
    numero: Number(record.id),
    cliente: record.client || null,
    producto: record.product || null,
    presupuesto: Number(record.budget || 0),
    presupuesto_proveedor: Number(record.supplierBudget || 0),
    cobro_1: Number(record.collection1 || 0),
    pendiente: Number(record.pending || 0),
    fecha_2: record.date2 || null,
    mes_2: record.month2 ? Number(record.month2) : null,
    anio_2: record.year2 ? Number(record.year2) : null,
    cobro_2: Number(record.collection2 || 0),
    cobro_total: Number(record.totalCollection || 0),
    saldo: Number(record.balance || 0),
    rubro_id: rubroMap.get(record.category) || null,
    gastos: Number(record.expense || 0),
    moneda: 'ARS',
    monto_usd: null,
    cotizacion_usd: null,
    es_canje_usd: false,
    migrado: true,
  })).filter((row) => row.rubro_id && row.fecha);

  for (const batch of chunk(records, 200)) {
    await rest('transacciones', { method: 'POST', body: JSON.stringify(batch) });
  }

  const cuentaUsd = [
    {
      fecha: data.months?.[0] ? `${data.months[0].year}-${String(data.months[0].month).padStart(2, '0')}-01` : '2024-05-01',
      tipo: 'compra',
      monto_usd: 5870,
      cotizacion_blue: 0,
      monto_ars_equivalente: 0,
      descripcion: 'Saldo inicial migrado desde caja histórica',
    },
  ];
  await rest('cuenta_usd', { method: 'POST', body: JSON.stringify(cuentaUsd) });

  console.log(JSON.stringify({ ok: true, rubros: rubros.length, deudas: deudas.length, transacciones: records.length, cuentaUsd: cuentaUsd.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
