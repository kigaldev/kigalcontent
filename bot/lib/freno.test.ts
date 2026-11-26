import { describe, expect, it } from 'vitest';
import { comentarioReintentable, esperaHumanaMs, pausaPorError, puedeEnviarPrivado, puedeResponderEnPublico } from './freno';
import { fill } from './texts';

const now = new Date('2026-12-01T10:00:00Z');

describe('pausaPorError', () => {
  it('límite de Meta → 1 hora', () => {
    for (const err of [{ code: 4 }, { code: 17 }, { code: 32 }, { code: 613 }, { code: 80002 }, { status: 429 }]) {
      expect(pausaPorError(err, now)?.toISOString()).toBe('2026-12-01T11:00:00.000Z');
    }
  });
  it('abusivo (368) → 24 horas', () => {
    expect(pausaPorError({ code: 368 }, now)?.toISOString()).toBe('2026-12-02T10:00:00.000Z');
  });
  it('otros errores no pausan', () => {
    expect(pausaPorError({ code: 100 }, now)).toBeNull();
    expect(pausaPorError({ code: 80100 }, now)).toBeNull();
    expect(pausaPorError({ status: 500 }, now)).toBeNull();
  });
});

describe('puedeEnviarPrivado', () => {
  const base = { pausedUntil: null, privadosUltimaHora: 0, mensajesUsuario24h: 0, now };
  it('sin topes → sí', () => expect(puedeEnviarPrivado(base)).toEqual({ ok: true }));
  it('en pausa → a la cola', () => {
    expect(puedeEnviarPrivado({ ...base, pausedUntil: '2026-12-01T10:30:00Z' })).toEqual({ ok: false, motivo: 'pausa', reintentar: true });
    expect(puedeEnviarPrivado({ ...base, pausedUntil: '2026-12-01T09:59:00Z' })).toEqual({ ok: true });
  });
  it('600 privados en la hora → a la cola', () => {
    expect(puedeEnviarPrivado({ ...base, privadosUltimaHora: 599 }).ok).toBe(true);
    expect(puedeEnviarPrivado({ ...base, privadosUltimaHora: 600 })).toEqual({ ok: false, motivo: 'tope_privados', reintentar: true });
  });
  it('12 mensajes a la misma persona → ese día no, y sin cola', () => {
    expect(puedeEnviarPrivado({ ...base, mensajesUsuario24h: 12 })).toEqual({ ok: false, motivo: 'tope_usuario', reintentar: false });
  });
  it('respuestas públicas: tope de 200 por hora', () => {
    expect(puedeResponderEnPublico(199)).toBe(true);
    expect(puedeResponderEnPublico(200)).toBe(false);
  });
});

describe('ventana y espera', () => {
  it('solo se reintenta durante 7 días', () => {
    expect(comentarioReintentable('2026-11-25T10:00:01Z', now)).toBe(true);
    expect(comentarioReintentable('2026-11-24T10:00:00Z', now)).toBe(false);
  });
  it('espera de 2 a 6 segundos', () => {
    expect(esperaHumanaMs(() => 0)).toBe(2000);
    expect(esperaHumanaMs(() => 0.9999)).toBeLessThan(6000);
  });
});

describe('fill', () => {
  it('con usuario', () => expect(fill('Hola {username}! 👋', 'ana')).toBe('Hola ana! 👋'));
  it('sin usuario no deja huecos', () => {
    expect(fill('Hola {username}! 👋', null)).toBe('Hola! 👋');
    expect(fill('@{username} te lo he mandado por privado!🤝', undefined)).toBe('te lo he mandado por privado!🤝');
  });
});
