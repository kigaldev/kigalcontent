// Llamadas a la API oficial de Instagram: soporta Meta Unified Login (graph.facebook.com, tokens EAA...)
// y el flujo clásico Instagram Login (graph.instagram.com, tokens IGAA...).
import type { Account } from './db';
import { env } from './env';

export class IgError extends Error {
  constructor(message: string, public code?: number, public status?: number, public subcode?: number) {
    super(message);
  }
}

export const FOLLOW_PAYLOAD = 'FOLLOW_CHECK';
const BUTTON_TITLE = 'Ya te sigo';

export const isUnifiedToken = (token: string) => token.trim().startsWith('EAA');
export const graphHost = (token: string) =>
  isUnifiedToken(token) ? 'https://graph.facebook.com' : 'https://graph.instagram.com';

async function ig<T>(token: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${graphHost(token)}/${env.apiVersion}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number } } & T;
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new IgError(e.message || `HTTP ${res.status}`, e.code, res.status, e.error_subcode);
  }
  return json;
}

const clip = (text: string) => (text.length > 1000 ? text.slice(0, 997) + '…' : text);

function message(text: string, withButton: boolean) {
  return withButton
    ? { text: clip(text), quick_replies: [{ content_type: 'text', title: BUTTON_TITLE, payload: FOLLOW_PAYLOAD }] }
    : { text: clip(text) };
}

// Respuesta privada a un comentario: Meta deja UNA por comentario, y como mucho 7 días después.
// Si falla con el botón, se reintenta sin él (escribir cualquier cosa vale igual que pulsar).
export async function privateReply(acc: Account, commentId: string, text: string, withButton: boolean) {
  try {
    return await ig(acc.access_token, 'POST', `${acc.account_id}/messages`, { recipient: { comment_id: commentId }, message: message(text, withButton) });
  } catch (e) {
    if (!withButton || isLimit(e)) throw e;
    return ig(acc.access_token, 'POST', `${acc.account_id}/messages`, { recipient: { comment_id: commentId }, message: message(text, false) });
  }
}

// Mensaje a quien ya nos ha escrito (dentro de su ventana de 24 h).
export async function sendMessage(acc: Account, igsid: string, text: string, withButton: boolean) {
  try {
    return await ig(acc.access_token, 'POST', `${acc.account_id}/messages`, { recipient: { id: igsid }, message: message(text, withButton) });
  } catch (e) {
    if (!withButton || isLimit(e)) throw e;
    return ig(acc.access_token, 'POST', `${acc.account_id}/messages`, { recipient: { id: igsid }, message: message(text, false) });
  }
}

export function publicReply(acc: Account, commentId: string, text: string) {
  return ig(acc.access_token, 'POST', `${commentId}/replies`, { message: text });
}

// Solo responde si esa persona ya nos ha escrito: por eso existe el botón. null = Meta no lo sabe.
export async function isFollower(acc: Account, igsid: string): Promise<boolean | null> {
  try {
    const r = await ig<{ is_user_follow_business?: boolean }>(acc.access_token, 'GET', `${igsid}?fields=is_user_follow_business`);
    return typeof r.is_user_follow_business === 'boolean' ? r.is_user_follow_business : null;
  } catch (e) {
    console.error('is_user_follow_business', (e as Error).message);
    return null;
  }
}

export async function refreshToken(token: string): Promise<{ access_token: string; expires_in: number }> {
  // Los tokens EAA de Meta Unified Login (System User) no usan ig_refresh_token en graph.instagram.com.
  if (isUnifiedToken(token)) {
    return { access_token: token, expires_in: 0 };
  }
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || json.error) throw new IgError(json.error?.message || `HTTP ${res.status}`, json.error?.code, res.status);
  return json;
}

function isLimit(e: unknown): boolean {
  if (!(e instanceof IgError)) return false;
  const c = e.code ?? 0;
  return e.status === 429 || [4, 17, 32, 368, 613].includes(c) || (c >= 80000 && c <= 80099);
}
