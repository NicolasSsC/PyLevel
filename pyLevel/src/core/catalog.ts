import { classic } from './classic-exercises';
import contextual from './exercises.json';

export type ContextualFileRole = {
  path: string;
  role: string;
  isMain?: boolean;
};

export type ContextualBriefing = {
  situacion: string;
  pregunta: string;
  queSeTiene: ContextualFileRole[];
  queSeEspera: string[];
  salidaResumen: string;
};

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
  briefing?: ContextualBriefing;
};

const projectMetadata: Record<string, Pick<Exercise, 'difficulty' | 'topics' | 'description' | 'briefing'>> = {
  '01_inventario_juan': {
    difficulty: 'Fácil',
    topics: ['Validación', 'Reglas de negocio'],
    description: 'Corrige las ventas por unidad sin impedir cantidades fraccionarias en productos por peso.',
    briefing: {
      situacion: 'La tienda de Juan vende manzanas por unidades completas (no fraccionables) y arroz por kilogramos (sí fraccionario). Actualmente el sistema tiene un defecto: permite registrar ventas imposibles como 1.5 manzanas y descuenta existencias erróneas del inventario.',
      pregunta: '¿Qué defecto permite registrar cantidades fraccionarias de manzanas y cómo corregirías el proyecto para rechazar esas ventas sin impedir la venta de productos por peso?',
      queSeTiene: [
        { path: 'inventario/ventas.py', role: 'Lógica principal de registrar_venta donde está el defecto a corregir.', isMain: true },
        { path: 'inventario/modelos.py', role: 'Estructura de Producto (modalidad "unidad" o "peso") y stock inicial.' },
        { path: 'main.py', role: 'Caso de uso demostrativo con 3 llamadas de prueba.' },
        { path: 'tests/test_publico.py', role: 'Pruebas automatizadas (unitarias) que validan el comportamiento.' },
      ],
      queSeEspera: [
        'Productos tipo "unidad": exigir cantidades estrictamente enteras (ej. 3 o 3.0, rechazando 1.5 con error).',
        'Productos tipo "peso": deben seguir admitiendo decimales positivos.',
        'Una venta rechazada no debe descontar ni alterar las existencias de stock.',
        'Mantener la firma de la función registrar_venta y el formato de los mensajes de salida.',
      ],
      salidaResumen: 'Aceptar ventas enteras (3 manzanas -> stock 7), rechazar 1.5 manzanas con "ERROR: la cantidad de manzanas debe ser entera" y mantener el inventario intacto.',
    },
  },
  '02_agenda_salas': {
    difficulty: 'Medio',
    topics: ['Fechas', 'Intervalos'],
    description: 'Permite reservas consecutivas y detecta los solapamientos reales entre horarios.',
    briefing: {
      situacion: 'Una universidad gestiona salas de estudio donde una reserva puede iniciar en el mismo minuto exacto que termina la anterior (ej. 09:00 a 10:00 y de 10:00 a 11:00). Actualmente el sistema rechaza reservas consecutivas válidas interpretándolas incorrectamente como solapamientos.',
      pregunta: '¿Por qué el sistema considera incompatibles dos reservas consecutivas contiguas y cómo corregir la detección de conflictos sin permitir solapamientos reales?',
      queSeTiene: [
        { path: 'agenda/servicio.py', role: 'Función crear_reserva con la comparación defectuosa de horarios.', isMain: true },
        { path: 'agenda/modelos.py', role: 'Modelo inmutable Reserva (sala, usuario, inicio, fin).' },
        { path: 'main.py', role: 'Simulación con reservas consecutivas y simultáneas para probar.' },
        { path: 'tests/test_publico.py', role: 'Pruebas públicas que verifican reservas contiguas y solapadas.' },
      ],
      queSeEspera: [
        'Los intervalos ocupan [inicio, fin): incluyen el inicio pero excluyen el fin exacto.',
        'Dos reservas contiguas en la misma sala (ej. 09:00-10:00 y 10:00-11:00) deben aceptarse sin error.',
        'Rechazar con "sala ya ocupada" únicamente si comparten instantes reales en la misma sala.',
        'Salas distintas (ej. A1 y B2) pueden reservarse en el mismo horario sin conflicto.',
      ],
      salidaResumen: 'Permitir reservas consecutivas en la misma sala y rechazar únicamente solapamientos reales en el mismo espacio.',
    },
  },
  '03_pagos_factura': {
    difficulty: 'Difícil',
    topics: ['Estado', 'Idempotencia'],
    description: 'Evita cobros duplicados al recibir de nuevo una misma referencia de pago.',
    briefing: {
      situacion: 'Una pasarela de pagos registra abonos a facturas. Cuando ocurren reintentos automáticos por inestabilidad de red, el cliente puede enviar dos veces la misma operación con idéntica referencia. Actualmente el sistema cobra dos veces y descuenta doble saldo.',
      pregunta: '¿Cómo corregir el registro de pagos para que reenviar una operación confirmada devuelva "Pago duplicado" sin descontar dos veces el saldo?',
      queSeTiene: [
        { path: 'facturacion/pagos.py', role: 'Función registrar_pago: omite la detección de operaciones repetidas.', isMain: true },
        { path: 'facturacion/modelos.py', role: 'Modelo Factura con total, pagado y diccionario de pagos por referencia.' },
        { path: 'main.py', role: 'Simulación de pagos normales, reintento de la misma referencia y exceso de saldo.' },
        { path: 'tests/test_publico.py', role: 'Pruebas unitarias de reintentos, validación de importes y saldo.' },
      ],
      queSeEspera: [
        'Idempotencia: Si llega la misma referencia con el mismo monto, responder "Pago duplicado" sin descontar de nuevo.',
        'Si llega la misma referencia con distinto monto, rechazar por referencia reutilizada incompatible.',
        'Cálculos monetarios con Decimal exacto y validación de hasta dos decimales.',
        'Ninguna operación rechazada debe modificar el saldo de la factura.',
      ],
      salidaResumen: 'Evitar cobros dobles en reintentos legítimos y proteger la consistencia del saldo.',
    },
  },
};

export const catalogs: Record<'classic' | 'contextual', Exercise[]> = {
  classic,
  contextual: contextual.map(exercise => ({ ...exercise, ...projectMetadata[exercise.id] })),
};

export const modePaths = { classic: 'clasicos', contextual: 'contextualizados' } as const;
