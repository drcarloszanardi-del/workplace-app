import type { WorkplaceStatus } from '@/lib/workplace-types';

export const defaultStatus: WorkplaceStatus = {
  lastHeartbeat: '',
  frentes: {
    obracash: {
      nombre: 'ObraCash',
      estado: 'amarillo',
      ultimoAvance: 'Reestructuración de rubros completada',
      fechaAvance: '2026-04-25 10:30',
      proximaTarea: 'Validar totales con arquitecta',
      necesitaDelUsuario: 'Lista de correcciones de Pilar',
    },
    tesis: {
      nombre: 'Tesis',
      estado: 'amarillo',
      ultimoAvance: 'Tema registrado en USER.md',
      fechaAvance: '2026-04-25',
      proximaTarea: 'Recibir proyecto de tesis',
      necesitaDelUsuario: 'Archivo del proyecto',
    },
    reels: {
      nombre: 'Reels',
      estado: 'verde',
      ultimoAvance: 'Reel preparado: celular y columna',
      fechaAvance: '2026-04-25 08:02',
      proximaTarea: 'Reel de mañana (auto 8am)',
      necesitaDelUsuario: '',
    },
    clinica: {
      nombre: 'Clínica',
      estado: 'amarillo',
      ultimoAvance: 'Skill de partes pendiente',
      fechaAvance: '2026-04-25',
      proximaTarea: 'Crear skill partes quirúrgicos',
      necesitaDelUsuario: 'Primer caso dictado',
    },
    papers: {
      nombre: 'Papers',
      estado: 'amarillo',
      ultimoAvance: 'Prioridad definida',
      fechaAvance: '2026-04-25',
      proximaTarea: 'Armar estructura research',
      necesitaDelUsuario: 'Ideas o datos de casos',
    },
    inmobiliario: {
      nombre: 'Inmobiliario',
      estado: 'verde',
      ultimoAvance: '3 propiedades en shortlist',
      fechaAvance: '2026-04-25 07:18',
      proximaTarea: 'Rastreo mañana 7:15',
      necesitaDelUsuario: '',
      extra: 'Irigoyen 400 USD 55K | Lartigau USD 55K | Laprida 316 USD 58K',
    },
    inversiones: {
      nombre: 'Inversiones',
      estado: 'verde',
      ultimoAvance: 'Informe importación entregado',
      fechaAvance: '2026-04-24',
      proximaTarea: 'Profundizar steel frame y mobiliario médico',
      necesitaDelUsuario: '',
    },
  },
};
