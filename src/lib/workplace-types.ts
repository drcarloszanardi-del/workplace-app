export type Frente = {
  nombre: string;
  estado: 'verde' | 'amarillo' | 'rojo';
  ultimoAvance: string;
  fechaAvance: string;
  proximaTarea: string;
  necesitaDelUsuario: string;
  extra?: string;
};

export type WorkplaceStatus = {
  lastHeartbeat: string;
  frentes: Record<string, Frente>;
};
