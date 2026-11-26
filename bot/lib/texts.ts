// Cada texto en varias versiones, una al azar: el mismo mensaje cientos de veces es lo que Instagram marca como spam.

export function pick<T>(items: T[], rnd: () => number = Math.random): T {
  if (!items.length) throw new Error('Lista de textos vacía');
  return items[Math.floor(rnd() * items.length)];
}

// Rellena {username}. Si no hay usuario, quita el hueco sin dejar "Hola !" ni una @ suelta.
export function fill(template: string, username?: string | null): string {
  if (username) return template.replaceAll('{username}', username);
  return template
    .replace(/@\{username\}\s*/g, '')
    .replace(/\s*\{username\}/g, '')
    .replace(/^\s+/, '');
}

export function render(items: string[], username?: string | null, rnd?: () => number): string {
  return fill(pick(items, rnd), username);
}
