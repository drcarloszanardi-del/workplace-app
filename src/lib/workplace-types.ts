export type Frente = {
  nombre: string;
  estado: 'verde' | 'amarillo' | 'rojo';
  ultimoAvance: string;
  fechaAvance: string;
  proximaTarea: string;
  necesitaDelUsuario: string;
  extra?: string;
  faseActual?: string;
  avanceAutonomo?: 'si' | 'no';
  esperaRespuesta?: 'si' | 'no';
  actividadPct?: number;
  totalItems?: number;
  completedItems?: number;
};

export type WorkplaceStatus = {
  lastHeartbeat: string;
  frentes: Record<string, Frente>;
};
