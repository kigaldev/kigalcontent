// Cuándo encaja una palabra clave en un comentario o mensaje. Funciones puras (test en match.test.ts).

export type MatchableRule = {
  id: number;
  enabled: boolean;
  keywords: string[];
  post_id: string | null;
};

// Quita tildes, circunflejo y diéresis (U+0300-U+0302, U+0308) pero NO la virgulilla de la ñ (U+0303):
// "año" no puede encajar con "ano".
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-̂̈]/g, '').toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Palabra suelta, nunca dentro de otra: GUIA encaja con "guía!!" y "quiero la guia", no con "guias" ni "seguía".
export function matchesKeyword(text: string, keyword: string): boolean {
  const k = normalize(keyword.trim());
  if (!k) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${escapeRegExp(k)}($|[^\\p{L}\\p{M}\\p{N}])`, 'u');
  return re.test(normalize(text));
}

// Primero las reglas de esa publicación, después las generales. Solo las activas.
export function findRule<R extends MatchableRule>(rules: R[], text: string, mediaId?: string | null): R | null {
  const active = rules.filter((r) => r.enabled);
  const ordered = [
    ...active.filter((r) => r.post_id && r.post_id === mediaId),
    ...active.filter((r) => !r.post_id),
  ];
  return ordered.find((r) => r.keywords.some((k) => matchesKeyword(text, k))) ?? null;
}

// Por privado solo cuenta un mensaje corto: en uno largo la palabra va de paso.
export function isShortMessage(text: string, maxWords = 8): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length <= maxWords;
}
