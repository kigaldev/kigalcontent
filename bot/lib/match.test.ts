import { describe, expect, it } from 'vitest';
import { findRule, isShortMessage, matchesKeyword, normalize } from './match';

describe('matchesKeyword', () => {
  it('encaja con tildes, mayúsculas, signos y emojis', () => {
    expect(matchesKeyword('guía!!', 'GUIA')).toBe(true);
    expect(matchesKeyword('Guia 🙌', 'GUIA')).toBe(true);
    expect(matchesKeyword('quiero la guia', 'GUIA')).toBe(true);
    expect(matchesKeyword('GUÍA', 'guia')).toBe(true);
    expect(matchesKeyword('Bot!!', 'BOT')).toBe(true);
  });

  it('no encaja dentro de otra palabra', () => {
    expect(matchesKeyword('guias', 'GUIA')).toBe(false);
    expect(matchesKeyword('seguía', 'GUIA')).toBe(false);
    expect(matchesKeyword('robot', 'BOT')).toBe(false);
  });

  it('respeta la ñ', () => {
    expect(matchesKeyword('feliz año', 'ANO')).toBe(false);
    expect(matchesKeyword('feliz año', 'AÑO')).toBe(true);
    expect(matchesKeyword('FELIZ AÑO!', 'año')).toBe(true);
  });

  it('quita la diéresis', () => {
    expect(normalize('Pingüino')).toBe('pinguino');
  });

  it('palabra vacía nunca encaja', () => {
    expect(matchesKeyword('lo que sea', '  ')).toBe(false);
  });
});

describe('findRule', () => {
  const rules = [
    { id: 1, enabled: true, keywords: ['GUIA'], post_id: null },
    { id: 2, enabled: true, keywords: ['GUIA'], post_id: 'media-9' },
    { id: 3, enabled: false, keywords: ['CHECKLIST'], post_id: null },
    { id: 4, enabled: true, keywords: ['ARSENAL', 'HERRAMIENTAS'], post_id: null },
  ];

  it('prioriza la regla de la publicación', () => {
    expect(findRule(rules, 'guia', 'media-9')?.id).toBe(2);
    expect(findRule(rules, 'guia', 'otra')?.id).toBe(1);
  });

  it('ignora las desactivadas y busca en todas las palabras', () => {
    expect(findRule(rules, 'checklist', null)).toBeNull();
    expect(findRule(rules, 'pásame las herramientas', null)?.id).toBe(4);
  });
});

describe('isShortMessage', () => {
  it('8 palabras o menos', () => {
    expect(isShortMessage('GUIA')).toBe(true);
    expect(isShortMessage('hola me pasas la guia por favor gracias')).toBe(true);
    expect(isShortMessage('hola qué tal, quería preguntarte una cosa sobre la guia que mandaste')).toBe(false);
  });
});
