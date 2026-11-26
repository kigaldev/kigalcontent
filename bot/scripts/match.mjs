// Copia en JS de lib/match.ts para los scripts locales (mismas reglas de normalización).
export function normalize(text) {
  return text.normalize('NFD').replace(/[̀-̂̈]/g, '').toLowerCase();
}

export function matchesKeyword(text, keyword) {
  const k = normalize(keyword.trim());
  if (!k) return false;
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${esc}($|[^\\p{L}\\p{M}\\p{N}])`, 'u').test(normalize(text));
}
