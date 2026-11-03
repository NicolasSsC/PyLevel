import type { Exercise } from '../core/catalog.ts';
export type AdminExercise = Exercise & {
  mode: 'classic' | 'contextual'; is_active: boolean; hints: string[]; solution: string;
  version: number; archivedAt?: string | null;
};
export interface AdminAccount { id: string; displayName: string; email: string; createdAt: string }
export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
