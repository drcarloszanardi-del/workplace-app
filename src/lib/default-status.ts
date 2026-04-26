import type { WorkplaceStatus } from '@/lib/workplace-types';

export const defaultStatus: WorkplaceStatus = {
  lastHeartbeat: '',
  frentes: {
    importacion: {
      nombre: 'Importación steel frame',
      estado: 'verde',
      ultimoAvance: 'Base consolidada lista',
      fechaAvance: '2026-04-26 15:04',
      proximaTarea: 'Pasar a sourcing con 8 a 12 fabricantes por línea priorizada',
      necesitaDelUsuario: '',
      extra: 'Objetivo: entregar informe final base para iniciar búsqueda de proveedores.',
    },
    proveedores_china: {
      nombre: 'Proveedores China',
      estado: 'verde',
      ultimoAvance: 'Búsqueda posterior iniciada',
      fechaAvance: '2026-04-26 15:04',
      proximaTarea: 'Capturar fabricantes concretos para house wrap y butyl flashing tape',
      necesitaDelUsuario: '',
      extra: 'En curso. Si sigue trabado, pasar a accesorios steel framing y paneles WPC/PVC.',
    },
    brief_diario: {
      nombre: 'Brief diario 7:00',
      estado: 'amarillo',
      ultimoAvance: 'Diseño previo existente',
      fechaAvance: '2026-04-26 15:04',
      proximaTarea: 'Convertir la plantilla en flujo operativo estable',
      necesitaDelUsuario: '',
      extra: 'Implementación pendiente.',
    },
    proactividad: {
      nombre: 'Proactividad Jarvis',
      estado: 'verde',
      ultimoAvance: 'Regla operativa activa',
      fechaAvance: '2026-04-26 15:04',
      proximaTarea: 'Mantener lista maestra viva y revisar cada 2 horas',
      necesitaDelUsuario: '',
      extra: 'Frente permanente.',
    },
    apps: {
      nombre: 'Apps y flujos',
      estado: 'amarillo',
      ultimoAvance: 'Backlog activo con ideas iniciales',
      fechaAvance: '2026-04-26 15:04',
      proximaTarea: 'Consolidar roadmap priorizado por impacto y dificultad',
      necesitaDelUsuario: '',
      extra: 'Siguiente frente estructural después de importación y brief.',
    },
  },
};
