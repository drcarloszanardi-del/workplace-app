import fs from 'fs';

type SyncResult = {
  rubros: number;
  deudas: number;
  transacciones: number;
  cuentaUsd: number;
};

function loadEnv(path: string) {
  const env: Record<string, string> = {};
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!raw || raw.trim().startsWith('#') || !raw.includes('=')) continue;
    const idx = raw.indexOf('=');
    env[raw.slice(0, idx)] = raw.slice(idx + 1);
  }
  return env;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function getProjectRoot() {
  return process.cwd();
}

function getEnv() {
  const root = getProjectRoot();
  const envPath = `${root}/.env.local`;
  const fileEnv = fs.existsSync(envPath) ? loadEnv(envPath) : {};
  const baseUrl = (process.env.NEXT_PUBLIC_PILAR_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_PILAR_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.PILAR_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.PILAR_SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('Faltan variables de Supabase para la sincronización');
  return { root, baseUrl, serviceKey };
}

function getHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  };
}

async function rest(baseUrl: string, headers: Record<string, string>, path: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

export async function syncPilarToSupabase(): Promise<SyncResult> {
  const { root, baseUrl, serviceKey } = getEnv();
  const headers = getHeaders(serviceKey);
  const data = JSON.parse(fs.readFileSync(`${root}/src/data/flujo-fondos.json`, 'utf8'));

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

  const deudas = (data.debts || []).map((item: { concept: string; amount: number; dueDate?: string | null }) => ({
    concepto: item.concept,
    monto: Number(item.amount || 0),
    vencimiento: item.dueDate || null,
    activo: true,
  }));

  const required = ['pilar_rubros', 'pilar_transacciones', 'pilar_cuenta_usd', 'pilar_deudas', 'pilar_caja', 'pilar_cotizacion_usd_cache', 'pilar_user_roles'];
  for (const table of required) {
    const probe = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=1`, { headers });
    if (probe.status === 404) throw new Error(`Falta la tabla ${table}. Hay que ejecutar el schema de Pilar en Supabase.`);
  }

  await rest(baseUrl, headers, 'pilar_rubros?on_conflict=nombre', { method: 'POST', body: JSON.stringify(rubros) });
  const rubrosActuales = await rest(baseUrl, headers, 'pilar_rubros?select=id,nombre&limit=500') as Array<{ id: string; nombre: string }>;
  const rubroMap = new Map(rubrosActuales.map((row) => [row.nombre, row.id]));

  await rest(baseUrl, headers, 'pilar_caja?on_conflict=concepto', { method: 'POST', body: JSON.stringify(cajaBase) });
  await rest(baseUrl, headers, 'pilar_deudas?on_conflict=concepto', { method: 'POST', body: JSON.stringify(deudas) });
  await rest(baseUrl, headers, 'pilar_transacciones?id=not.is.null', { method: 'DELETE' });

  const records = (data.recordsPreview || []).map((record: Record<string, unknown>) => ({
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
    rubro_id: rubroMap.get(String(record.category || '')) || null,
    gastos: Number(record.expense || 0),
    moneda: 'ARS',
    monto_usd: null,
    cotizacion_usd: null,
    es_canje_usd: false,
    migrado: true,
  })).filter((row: { rubro_id: string | null; fecha: unknown }) => row.rubro_id && row.fecha);

  for (const batch of chunk(records, 200)) {
    await rest(baseUrl, headers, 'pilar_transacciones', { method: 'POST', body: JSON.stringify(batch) });
  }

  await rest(baseUrl, headers, 'pilar_cuenta_usd?id=not.is.null', { method: 'DELETE' });
  const cuentaUsd = [{
    fecha: data.months?.[0] ? `${data.months[0].year}-${String(data.months[0].month).padStart(2, '0')}-01` : '2024-05-01',
    tipo: 'compra',
    monto_usd: 5870,
    cotizacion_blue: 0,
    monto_ars_equivalente: 0,
    descripcion: 'Saldo inicial migrado desde caja histórica',
  }];
  await rest(baseUrl, headers, 'pilar_cuenta_usd', { method: 'POST', body: JSON.stringify(cuentaUsd) });

  return { rubros: rubros.length, deudas: deudas.length, transacciones: records.length, cuentaUsd: cuentaUsd.length };
}
