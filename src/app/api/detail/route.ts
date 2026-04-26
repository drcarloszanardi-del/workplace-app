export const dynamic = 'force-dynamic';

import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { readRemoteStatus } from '@/lib/workplace';

const workspaceRoot = process.env.WORKPLACE_SOURCE_ROOT || '/Users/jarvis/.openclaw/workspace';

const detailFallbacks: Record<string, { name: string; description: string; notes: string[]; documents: { name: string; uploadedAt?: string }[]; messages: { role?: string; text?: string; time?: string }[]; activity?: string[]; needs?: string[] }> = {
  obracash: {
    name: 'Jarvis obracash',
    description: 'Operación técnica, mejoras y seguimiento de ObraCash.',
    notes: ['Revisar modelo de datos, bugs, build y deploy.', 'Mantener seguimiento de mejoras activas del producto.'],
    documents: [{ name: 'reports/obracash/obracash-mejoras-proactivas-2026-04-26-manana-2.md', uploadedAt: '2026-04-26 19:06' }],
    messages: [{ role: 'assistant', text: 'Proyecto activo para desarrollo, revisión y seguimiento de ObraCash.', time: '19:06' }],
    activity: ['Seguimiento técnico del producto.', 'Revisión de mejoras proactivas y estado operativo.'],
    needs: [],
  },
  'papers-cientificos': {
    name: 'Jarvis papers científicos',
    description: 'Papers, research y estructura científica del señor Zanardi.',
    notes: ['Usar este topic para pipeline de papers y materiales científicos.', 'Mantener separado de tesis y otros frentes clínicos.'],
    documents: [{ name: 'papers', uploadedAt: '2026-04-26 19:06' }],
    messages: [{ role: 'assistant', text: 'Proyecto activo para papers, ideas científicas y desarrollo de research.', time: '19:06' }],
    activity: ['Estructuración del frente de research.', 'Preparación de espacio para pipeline científico.'],
    needs: [],
  },
  'project-1776699923524': {
    name: 'Jarvis tesis',
    description: 'Todo lo relacionado a mi tesis de Doctorado.',
    notes: ['Definir objetivo, documentos y próximos pasos.', 'Separar este frente del resto del research.'],
    documents: [],
    messages: [{ role: 'assistant', text: 'Proyecto activo para tesis y desarrollo doctoral.', time: '19:06' }],
    activity: ['Orden del frente doctoral dentro del workplace.', 'Preparación de próximos pasos de tesis y materiales asociados.'],
    needs: ['Si hace falta validación suya, debe quedar visible aquí y avisarse en el topic correspondiente.'],
  },
  'reel-cirugia-columna-001': {
    name: 'Jarvis reel',
    description: 'Primer reel profesional con imágenes de quirófano y microcirugía.',
    notes: ['Mantener estética médica sobria.', 'Mostrar assets, guión y plan de publicación.'],
    documents: [{ name: 'assets reel cirugía de columna', uploadedAt: '2026-04-20 13:16' }],
    messages: [{ role: 'assistant', text: 'Proyecto activo para reel profesional sobre cirugía de columna.', time: '19:06' }],
    activity: ['Organización de assets y contexto del reel.', 'Preparación de detalle visible en el dashboard.'],
    needs: [],
  },
  clinica: {
    name: 'Jarvis clínica',
    description: 'Frente clínico y operativo vinculado a práctica médica, consultorio y pacientes.',
    notes: ['Reservar este topic para práctica clínica y temas asistenciales.', 'No mezclar con tesis, reels ni inversiones.'],
    documents: [],
    messages: [{ role: 'assistant', text: 'Proyecto activo para temas clínicos y operativos de la práctica médica.', time: '19:06' }],
    activity: ['Frente preparado para seguimiento clínico y operativo.'],
    needs: [],
  },
  inversiones: {
    name: 'Jarvis inversiones',
    description: 'Seguimiento de inversiones, radar de oportunidades y análisis patrimonial operativo.',
    notes: ['Usar este topic para oportunidades de inversión y seguimiento.', 'Mantener separado de inmobiliaria y finanzas operativas.'],
    documents: [{ name: 'RADAR_INVERSIONES_ZANARDI.md', uploadedAt: '2026-04-26 19:06' }],
    messages: [{ role: 'assistant', text: 'Proyecto activo para inversiones y evaluación de oportunidades.', time: '19:06' }],
    activity: ['Espacio creado para radar y seguimiento de inversiones.'],
    needs: [],
  },
  inmobiliaria: {
    name: 'Jarvis inmobiliario',
    description: 'Consultas, seguimiento y evaluación de propiedades.',
    notes: ['Pedir precio de venta, comisión y estado legal.', 'Mantener tono sobrio y no discutir precio sin datos.'],
    documents: [{ name: 'foto-frente-casa.jpg', uploadedAt: '2026-04-20 12:05' }, { name: 'respuesta-inmobiliaria.pdf', uploadedAt: '2026-04-20 12:06' }],
    messages: [{ role: 'assistant', text: 'Tengo separado este proyecto. Aquí podemos concentrar contactos, documentos y próximos pasos sobre propiedades.', time: '12:02' }],
    activity: ['Seguimiento de propiedades, correos y material asociado.'],
    needs: [],
  },
};

async function getProjectDetail(frente: string) {
  const projectPath = path.join(workspaceRoot, 'workplace', 'projects', frente, 'project.json');
  const fallback = detailFallbacks[frente] || null;

  try {
    const raw = await fs.readFile(projectPath, 'utf8');
    const project = JSON.parse(raw);
    if (fallback) {
      return {
        file: projectPath,
        name: project?.name || fallback.name || frente,
        description: project?.description || fallback.description || '',
        notes: [
          ...(Array.isArray(project?.notes) ? project.notes : []),
          ...(fallback.activity?.length ? ['Fase actual:'] : []),
          ...(fallback.activity || []).map((item) => `• ${item}`),
          `Avance autónomo: ${fallback.activity?.length ? 'Sí' : 'No definido'}`,
          `Necesito aprobación del señor Zanardi: ${fallback.needs?.length ? 'Sí' : 'No'}`,
          ...(fallback.needs || []).map((item) => `• ${item}`),
        ],
        documents: Array.isArray(project?.documents) ? project.documents : fallback.documents,
        messages: Array.isArray(project?.messages) ? project.messages.slice(-5) : fallback.messages,
        reels: Array.isArray(project?.reels) ? project.reels : [],
      };
    }

    return {
      file: projectPath,
      name: project?.name || frente,
      description: project?.description || '',
      notes: Array.isArray(project?.notes) ? project.notes : [],
      documents: Array.isArray(project?.documents) ? project.documents : [],
      messages: Array.isArray(project?.messages) ? project.messages.slice(-5) : [],
      reels: Array.isArray(project?.reels) ? project.reels : [],
    };
  } catch {
    const remote = await readRemoteStatus().catch(() => null);
    const remoteName = remote?.frentes?.[frente]?.nombre || '';
    if (fallback) {
      return {
        file: '',
        name: remoteName || fallback.name,
        description: fallback.description,
        notes: [
          ...fallback.notes,
          ...(fallback.activity?.length ? ['Fase actual:'] : []),
          ...(fallback.activity || []).map((item) => `• ${item}`),
          `Avance autónomo: ${fallback.activity?.length ? 'Sí' : 'No definido'}`,
          `Necesito aprobación del señor Zanardi: ${fallback.needs?.length ? 'Sí' : 'No'}`,
          ...(fallback.needs || []).map((item) => `• ${item}`),
        ],
        documents: fallback.documents,
        messages: fallback.messages,
        reels: [],
      };
    }
    return { file: '', name: remoteName || frente, description: '', notes: [], documents: [], messages: [], reels: [] };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const frente = searchParams.get('frente') || '';
  return NextResponse.json(await getProjectDetail(frente));
}
