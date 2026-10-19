export const exam = {
  id: 'fundamentos-python-v1',
  title: 'Fundamentos de Python',
  durationMinutes: 30,
  questions: [
    {
      id: 'acceso', title: 'Control de acceso', topic: 'Lógica y booleanos', points: 30,
      statement: 'Implementa puede_acceder(tiene_entrada, es_invitado, esta_bloqueado). Una persona puede acceder si tiene entrada o es invitada, siempre que no esté bloqueada. Los argumentos son booleanos. Devuelve True o False.',
      example: 'puede_acceder(True, False, False) → True\npuede_acceder(False, True, True) → False',
      starter: 'def puede_acceder(tiene_entrada, es_invitado, esta_bloqueado):\n    # Escribe tu solución aquí\n    pass\n',
    },
    {
      id: 'pares', title: 'Suma de números pares', topic: 'Bucles y listas', points: 35,
      statement: 'Implementa sumar_pares(numeros) con un bucle for. Devuelve la suma de los números pares, incluidos los negativos. Si no hay pares o la lista está vacía, devuelve 0. Conserva la lista original.',
      example: 'sumar_pares([1, 2, 3, 4, 6]) → 12\nsumar_pares([-4, -1, 2]) → -2\nsumar_pares([]) → 0',
      starter: 'def sumar_pares(numeros):\n    # Escribe tu solución aquí\n    pass\n',
    },
    {
      id: 'clasificar', title: 'Clasificar un número', topic: 'Condicionales', points: 35,
      statement: 'Implementa clasificar_numero(numero) usando if, elif y else. Recibe un entero y devuelve exactamente "positivo", "negativo" o "cero", según corresponda. Devuelve el resultado desde la función, sin imprimirlo.',
      example: 'clasificar_numero(8) → "positivo"\nclasificar_numero(-3) → "negativo"\nclasificar_numero(0) → "cero"',
      starter: 'def clasificar_numero(numero):\n    # Escribe tu solución aquí\n    pass\n',
    },
  ],
};

export type Answers = Record<string, string>;
export type ExamEvent = { id: string; kind: 'away' | 'return'; source: 'visibility' | 'focus' | 'pagehide' | 'resume' };
export type Attempt = {
  id: string; status: 'in_progress' | 'submitted' | 'expired'; answers: Answers; revision: number;
  startedAt: string; expiresAt: string; submittedAt: string | null; lastSeenAt: string;
  incidents: number; events: { kind: string; source: string; occurredAt: string }[];
};

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateAnswers(value: unknown): Answers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuestas inválidas.');
  const entries = Object.entries(value);
  if (entries.length > exam.questions.length || entries.some(([key, code]) =>
    !exam.questions.some(q => q.id === key) || typeof code !== 'string' || code.length > 12000)) {
    throw new Error('Cada respuesta debe contener como máximo 12.000 caracteres.');
  }
  return Object.fromEntries(entries);
}

export function validateEvents(value: unknown): ExamEvent[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 40 || value.some(e =>
    !e || !uuidPattern.test(e.id) || !['away', 'return'].includes(e.kind) ||
    !['visibility', 'focus', 'pagehide', 'resume'].includes(e.source))) {
    throw new Error('Registro de incidencias inválido.');
  }
  return value.map(({ id, kind, source }) => ({ id, kind, source }));
}
