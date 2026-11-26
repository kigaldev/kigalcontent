// FRENOS: lo que evita que Instagram cierre la cuenta. Funciones puras (test en freno.test.ts).
// Topes propios por debajo de los de Meta (750 respuestas privadas por hora y cuenta).

export const LIMITES = {
  privadosPorHora: 600,
  publicasPorHora: 200,
  mensajesPorUsuario24h: 12,
  ventanaRespuestaPrivadaDias: 7,
} as const;

export type ErrorMeta = { code?: number; status?: number };

// Error de límite → pausa 1 h. "Abusivo" (368) → pausa 24 h. Cualquier otro → sin pausa. Nunca reintentar en bucle.
export function pausaPorError(err: ErrorMeta, now: Date = new Date()): Date | null {
  const { code, status } = err;
  if (code === 368) return new Date(now.getTime() + 24 * 3600_000);
  const limite = status === 429 || code === 4 || code === 17 || code === 32 || code === 613
    || (typeof code === 'number' && code >= 80000 && code <= 80099);
  return limite ? new Date(now.getTime() + 3600_000) : null;
}

export type EstadoFrenos = {
  pausedUntil: string | Date | null;
  privadosUltimaHora: number;
  mensajesUsuario24h: number;
  now?: Date;
};

export type Veredicto = { ok: true } | { ok: false; motivo: 'pausa' | 'tope_privados' | 'tope_usuario'; reintentar: boolean };

// ¿Se puede mandar un privado automático ahora? Si no, si merece cola de reintento.
export function puedeEnviarPrivado(e: EstadoFrenos): Veredicto {
  const now = e.now ?? new Date();
  if (e.pausedUntil && new Date(e.pausedUntil).getTime() > now.getTime()) return { ok: false, motivo: 'pausa', reintentar: true };
  if (e.privadosUltimaHora >= LIMITES.privadosPorHora) return { ok: false, motivo: 'tope_privados', reintentar: true };
  // Una persona que ya ha recibido 12 en un día es un bucle o alguien jugando con el botón: ese día no se le contesta más.
  if (e.mensajesUsuario24h >= LIMITES.mensajesPorUsuario24h) return { ok: false, motivo: 'tope_usuario', reintentar: false };
  return { ok: true };
}

export function puedeResponderEnPublico(publicasUltimaHora: number): boolean {
  return publicasUltimaHora < LIMITES.publicasPorHora;
}

// Meta solo deja la respuesta privada a un comentario durante 7 días.
export function comentarioReintentable(commentCreatedAt: string | Date, now: Date = new Date()): boolean {
  return now.getTime() - new Date(commentCreatedAt).getTime() < LIMITES.ventanaRespuestaPrivadaDias * 86400_000;
}

// Espera humana entre el privado y la respuesta pública: de 2 a 6 s.
export function esperaHumanaMs(rnd: () => number = Math.random): number {
  return 2000 + Math.floor(rnd() * 4000);
}
