'use client';

import { useEffect, useMemo, useState } from 'react';

type SheetSummary = {
  title: string;
  rows: number;
  cols: number;
  first_rows: (string | number | null)[][];
};

type ExcelAnalysis = {
  workbook: string;
  generatedAt: string;
  sheets: SheetSummary[];
  headers: string[];
  rubros: [string, number][];
  clientes: [string, number][];
  metrics: {
    totalRegistrosDatos: number;
    totalRubros: number;
    totalClientes: number;
    totalDeudas: number;
  };
  firstBuildPlan: string[];
};

const analysis: ExcelAnalysis = {
  workbook: 'Flujo de Fondos 2026.xlsx',
  generatedAt: '2026-04-29T00:20:00-03:00',
  sheets: [
    {
      title: 'Flujo de Fondos 2026',
      rows: 39,
      cols: 35,
      first_rows: [
        ['Rubro', 'May-24', 'Jun-24', 'Jul-24', 'Ago-24', 'Sep-24'],
        ['Ventas Maxi Pisos'],
        ['Ventas Mozzetto'],
        ['Ventas Flex-Color'],
        ['PENDIENTE DE COBRAR'],
        ['Gastos Operativos'],
        ['Resultado'],
      ],
    },
    {
      title: 'Datos',
      rows: 1406,
      cols: 26,
      first_rows: [
        ['Fecha1', 'Mes', 'Año', 'Nº', 'Cliente', 'Producto', 'Presupuesto', 'Presupuesto Proveedor', 'Cobro 1', 'Pendiente', 'Fecha 2', 'Mes2', 'Año2', 'Cobro 2', 'Cobro Total', 'Saldo', 'RUBRO', 'Gastos'],
        ['2024-05-15', 5, 2024, 2024, 'Riboli', 'Cocina', 5544900, 4135129.95, 4400000, 1144900, '2024-09-25', 9, 2024, 1144900, 5544900, 0, 'Ventas Mobile', null],
        ['2024-05-15', 5, 2024, 2024, null, 'Pago Mobile Riboli - Cocina', 0, 4135129.95, 0, 0, null, null, null, 0, 0, 0, 'Mobile - Pagos', 4135129.95],
      ],
    },
    {
      title: 'Deudas',
      rows: 12,
      cols: 3,
      first_rows: [
        ['Concepto', 'Monto', 'Vencimiento'],
        ['La Cueva', 0, null],
        ['Marmolin', 0, null],
        ['Flex-Color', 0, null],
      ],
    },
    {
      title: 'Hoja1',
      rows: 0,
      cols: 0,
      first_rows: [],
    },
  ],
  headers: ['Fecha1', 'Mes', 'Año', 'Nº', 'Cliente', 'Producto', 'Presupuesto', 'Presupuesto Proveedor', 'Cobro 1', 'Pendiente', 'Fecha 2', 'Mes2', 'Año2', 'Cobro 2', 'Cobro Total', 'Saldo', 'RUBRO', 'Gastos'],
  rubros: [
    ['AFIP', 244],
    ['Gastos Generales', 242],
    ['Ventas Otros', 100],
    ['Otros Proveedores - Pagos', 82],
    ['Fletes', 77],
    ['Viaticos/Combustible', 76],
    ['Showroom', 64],
    ['Colocación', 59],
    ['Mobile - Pagos', 52],
    ['Ventas Mobile', 51],
    ['Flex-Color - Pagos', 50],
    ['Ferreteria', 44],
    ['Ventas Flex-Color', 30],
    ['Ventas Muresco', 28],
    ['Muresco - Pagos', 21],
    ['Mozzetto - Pagos', 21],
    ['Alquiler', 19],
    ['Ventas Mozzetto', 18],
    ['Ventas Maxi Pisos', 16],
    ['Contador', 14],
  ],
  clientes: [
    ['Asociacion de Anestesiologos', 11],
    ['Gardenal', 11],
    ['Celia Romano', 9],
    ['Zanardi Carlos', 8],
    ['Caro Ortega', 6],
    ['Zanardi', 6],
    ['Matias Huarte', 6],
    ['Pili Campeni', 5],
    ['Clara Giecco', 5],
    ['Marzol', 5],
  ],
  metrics: {
    totalRegistrosDatos: 1406,
    totalRubros: 28,
    totalClientes: 110,
    totalDeudas: 11,
  },
  firstBuildPlan: [
    'Crear el modelo de datos nuevo en Supabase, separado de ObraCash.',
    'Importar hojas Datos y Deudas, normalizando clientes, rubros y movimientos.',
    'Construir el motor mensual para ingresos, egresos, pendientes y saldo acumulado.',
    'Validar totales mensuales contra la hoja principal antes de ampliar pantallas.',
  ],
};

function money(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}

export default function Home() {
  const [selectedSheet, setSelectedSheet] = useState('Datos');
  const sheet = useMemo(
    () => analysis.sheets.find((item) => item.title === selectedSheet) || analysis.sheets[0],
    [selectedSheet],
  );

  useEffect(() => {
    document.title = 'App Flujo de Fondos';
  }, []);

  return (
    <main className="min-h-screen bg-[#0b1220] text-[#eef2ff]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-[#7dd3fc]">APP FLUJO DE FONDOS</div>
            <h1 className="mt-2 text-4xl font-semibold">Diagnóstico inicial del Excel y base del MVP</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#cbd5e1]">
              App nueva, separada de ObraCash, basada en la lógica operativa del archivo {analysis.workbook}.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#cbd5e1]">
            Lectura generada: {analysis.generatedAt}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Registros en Datos" value={money(analysis.metrics.totalRegistrosDatos)} />
          <StatCard label="Rubros detectados" value={money(analysis.metrics.totalRubros)} />
          <StatCard label="Clientes detectados" value={money(analysis.metrics.totalClientes)} />
          <StatCard label="Deudas cargadas" value={money(analysis.metrics.totalDeudas)} />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-medium">Hojas detectadas</h2>
            <div className="mt-4 grid gap-3">
              {analysis.sheets.map((sheetItem) => (
                <button
                  key={sheetItem.title}
                  onClick={() => setSelectedSheet(sheetItem.title)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedSheet === sheetItem.title ? 'border-[#38bdf8] bg-[#0f172a]' : 'border-white/10 bg-black/10 hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-medium">{sheetItem.title}</div>
                    <div className="text-xs text-[#94a3b8]">{sheetItem.rows} filas · {sheetItem.cols} columnas</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#020617]/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Vista rápida: {sheet.title}</h3>
                <div className="text-xs text-[#94a3b8]">Muestra inicial</div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <tbody>
                    {sheet.first_rows.map((row, index) => (
                      <tr key={index} className="border-t border-white/5 first:border-t-0">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 align-top text-[#dbe4ff]">
                            {cell === null || cell === '' ? '—' : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Panel title="Qué voy a construir primero">
              <ol className="space-y-3 text-sm text-[#dbe4ff]">
                {analysis.firstBuildPlan.map((item, index) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0ea5e9]/20 text-xs text-[#7dd3fc]">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel title="Columnas principales">
              <div className="flex flex-wrap gap-2">
                {analysis.headers.map((header) => (
                  <span key={header} className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs text-[#cbd5e1]">
                    {header}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel title="Cálculos clave detectados">
              <ul className="space-y-2 text-sm text-[#dbe4ff]">
                <li>Pendiente = Presupuesto - Cobro 1</li>
                <li>Cobro Total = Cobro 1 + Cobro 2</li>
                <li>Saldo = Pendiente - Cobro 2</li>
                <li>Hoja principal con SUMIFS por mes, año y rubro sobre la hoja Datos</li>
                <li>Totales de ventas, gastos, resultado y rentabilidad acumulados por período</li>
              </ul>
            </Panel>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Panel title="Rubros detectados">
            <div className="grid gap-2 text-sm">
              {analysis.rubros.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  <span>{name}</span>
                  <span className="text-[#94a3b8]">{count}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Clientes más repetidos">
            <div className="grid gap-2 text-sm">
              {analysis.clientes.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  <span>{name}</span>
                  <span className="text-[#94a3b8]">{count}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm text-[#94a3b8]">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-medium">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}
