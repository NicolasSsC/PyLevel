import { classic } from './classic-exercises';
import contextual from './exercises.json';

export type Exercise = {
  id: string;
  title: string;
  level: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  topics: string[];
  description: string;
  statement: string;
  expected: string;
  files: Record<string, string>;
};

const projectMetadata: Record<string, Pick<Exercise, 'difficulty' | 'topics' | 'description'>> = {
  '01_inventario_juan': { difficulty: 'Fácil', topics: ['Validación', 'Reglas de negocio'], description: 'Corrige las ventas por unidad sin impedir cantidades fraccionarias en productos por peso.' },
  '02_agenda_salas': { difficulty: 'Medio', topics: ['Fechas', 'Intervalos'], description: 'Permite reservas consecutivas y detecta los solapamientos reales entre horarios.' },
  '03_pagos_factura': { difficulty: 'Difícil', topics: ['Estado', 'Idempotencia'], description: 'Evita cobros duplicados al recibir de nuevo una misma referencia de pago.' },
};
export const catalogs: Record<'classic' | 'contextual', Exercise[]> = {
  classic,
  contextual: contextual.map(exercise => ({ ...exercise, ...projectMetadata[exercise.id] })),
};

export const modePaths = { classic: 'clasicos', contextual: 'contextualizados' } as const;
