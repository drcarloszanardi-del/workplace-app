export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { refreshStructuredStatus } from '@/lib/workplace-sync';

export async function GET() {
  try {
    const status = await refreshStructuredStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({
      lastHeartbeat: new Date().toISOString(),
      frentes: {
        workplace: {
          nombre: 'Workplace',
          estado: 'amarillo',
          ultimoAvance: 'Producción activa con fallback de emergencia.',
          fechaAvance: new Date().toISOString(),
          proximaTarea: 'Terminar conexión de fuente de datos persistente.',
          necesitaDelUsuario: '',
          extra: 'El dashboard respondió sin romper el render.',
        },
      },
    });
  }
}
