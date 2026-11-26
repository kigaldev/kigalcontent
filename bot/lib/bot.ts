// Lógica del bot: comentario con palabra → privado con botón → comprobar follow → enlace.
import { countSent, db, getAccount, getRule, getRules, logSent, setPause, type Account, type Rule } from './db';
import { comentarioReintentable, esperaHumanaMs, LIMITES, pausaPorError, puedeEnviarPrivado, puedeResponderEnPublico } from './freno';
import { FOLLOW_PAYLOAD, IgError, isFollower, privateReply, publicReply, sendMessage } from './instagram';
import { findRule, isShortMessage } from './match';
import { render } from './texts';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const DM_KINDS = ['prompt', 'not_following', 'reward'] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type CommentEvent = {
  id: string;
  text?: string;
  from?: { id: string; username?: string };
  media?: { id: string };
  parent_id?: string;
};

export type MessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp?: number;
  message?: { mid: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string } };
};

type Comment = { commentId: string; igsid: string; username: string | null; createdAt: string };

async function queue(acc: Account, c: Comment, rule: Rule) {
  await db().from('bot_retry_comments').upsert({
    comment_id: c.commentId, account_id: acc.account_id, igsid: c.igsid, username: c.username,
    rule_id: rule.id, comment_created_at: c.createdAt,
  }, { onConflict: 'comment_id', ignoreDuplicates: true });
}

async function handleIgError(acc: Account, e: unknown): Promise<boolean> {
  if (!(e instanceof IgError)) { console.error(e); return false; }
  const until = pausaPorError({ code: e.code, status: e.status });
  if (until) { await setPause(acc.account_id, until); return true; }
  console.error(`Meta ${e.code}/${e.subcode} (HTTP ${e.status}): ${e.message}`);
  return false;
}

async function frenosPrivado(acc: Account, igsid: string) {
  const fresh = (await getAccount(acc.account_id)) ?? acc; // la pausa puede haberla puesto otra ejecución
  return puedeEnviarPrivado({
    pausedUntil: fresh.paused_until,
    privadosUltimaHora: await countSent(acc.account_id, ['prompt'], HOUR),
    mensajesUsuario24h: await countSent(acc.account_id, [...DM_KINDS], DAY, igsid),
  });
}

// ---------- comentarios ----------

export async function handleCommentEvent(accountId: string, value: CommentEvent) {
  if (!value?.id || !value.from?.id || !value.text) return;
  if (value.from.id === accountId) return; // nuestras propias respuestas también llegan como comentarios
  const acc = await getAccount(accountId);
  if (!acc?.enabled) return;
  const rule = findRule(await getRules(accountId), value.text, value.media?.id);
  if (!rule) return;
  await processComment(acc, { commentId: value.id, igsid: value.from.id, username: value.from.username ?? null, createdAt: new Date().toISOString() }, rule, false);
}

// Devuelve true si el comentario queda resuelto (contestado o descartado) y false si sigue en cola.
async function processComment(acc: Account, c: Comment, rule: Rule, fromRetry: boolean): Promise<boolean> {
  const freno = await frenosPrivado(acc, c.igsid);
  if (!freno.ok) {
    if (freno.reintentar && !fromRetry) await queue(acc, c, rule);
    return !freno.reintentar;
  }

  // Meta a veces entrega el mismo evento dos veces.
  const { data: inserted, error } = await db().from('bot_processed_comments')
    .upsert({ comment_id: c.commentId, account_id: acc.account_id, igsid: c.igsid, username: c.username, rule_id: rule.id }, { onConflict: 'comment_id', ignoreDuplicates: true })
    .select('comment_id');
  if (error) { console.error('bot_processed_comments', error.message); return false; }
  if (!inserted?.length) return true;

  // Comentar dos veces da una sola respuesta: una por persona y regla cada 7 días.
  if (await countSent(acc.account_id, [...DM_KINDS], LIMITES.ventanaRespuestaPrivadaDias * DAY, c.igsid, rule.id) > 0) return true;

  const directo = !rule.require_follow;
  try {
    await privateReply(acc, c.commentId, render(directo ? rule.reward_messages : rule.follow_prompts, c.username), !directo);
  } catch (e) {
    const limite = await handleIgError(acc, e);
    // Se libera el comentario para poder reintentarlo cuando pase la pausa.
    await db().from('bot_processed_comments').delete().eq('comment_id', c.commentId);
    if (limite) { if (!fromRetry) await queue(acc, c, rule); return false; }
    return true; // error no recuperable (comentario borrado, ventana pasada…): no se reintenta
  }

  if (directo) {
    await logSent(acc.account_id, c.igsid, c.username, rule.id, 'reward');
  } else {
    await db().from('bot_pending_follow').upsert({ account_id: acc.account_id, igsid: c.igsid, rule_id: rule.id, username: c.username });
    await logSent(acc.account_id, c.igsid, c.username, rule.id, 'prompt');
  }

  // Solo si el privado salió, y con una espera humana: nadie contesta en el mismo segundo.
  await sleep(esperaHumanaMs());
  if (puedeResponderEnPublico(await countSent(acc.account_id, ['public'], HOUR))) {
    try {
      await publicReply(acc, c.commentId, render(rule.public_replies, c.username));
      await logSent(acc.account_id, c.igsid, c.username, rule.id, 'public');
    } catch (e) { await handleIgError(acc, e); }
  }
  return true;
}

// ---------- mensajes privados ----------

export async function handleMessagingEvent(accountId: string, m: MessagingEvent) {
  if (!m?.message || m.message.is_echo) return; // lecturas, reacciones y nuestros propios mensajes
  const igsid = m.sender?.id;
  if (!igsid || igsid === accountId) return;
  const acc = await getAccount(accountId);
  if (!acc?.enabled) return;

  const { data: pending } = await db().from('bot_pending_follow').select('rule_id, username')
    .eq('account_id', accountId).eq('igsid', igsid).maybeSingle();

  let rule: Rule | null = null;
  let username: string | null = pending?.username ?? null;
  if (pending) {
    rule = await getRule(pending.rule_id);
  } else {
    const text = m.message.text ?? '';
    if (m.message.quick_reply?.payload === FOLLOW_PAYLOAD || !text || !isShortMessage(text)) return;
    rule = findRule(await getRules(accountId), text, null);
    if (!rule) return;
    if (await countSent(accountId, ['reward'], 7 * DAY, igsid, rule.id) > 0) return; // ya se lo mandamos
    if (rule.require_follow) await db().from('bot_pending_follow').upsert({ account_id: accountId, igsid, rule_id: rule.id, username });
  }
  if (!rule?.enabled) return;

  const freno = await frenosPrivado(acc, igsid);
  if (!freno.ok) { console.warn(`FRENO ${freno.motivo}: no se contesta a ${igsid}`); return; }

  if (!rule.require_follow) {
    await reward(acc, igsid, username, rule);
    return;
  }
  await checkFollow(acc, igsid, username, rule);
}

// El follow recién dado tarda en contar: si dice false, se mira otra vez a los 3, 5 y 7 s.
// Si Meta devuelve null o falla, se trata como sí: la persona hizo lo que se le pidió.
async function checkFollow(acc: Account, igsid: string, username: string | null, rule: Rule) {
  let follows = await isFollower(acc, igsid);
  for (const wait of [3000, 5000, 7000]) {
    if (follows !== false) break;
    await sleep(wait);
    follows = await isFollower(acc, igsid);
  }
  if (follows === false) {
    try {
      await sendMessage(acc, igsid, render(rule.not_following_replies, username), true);
      await logSent(acc.account_id, igsid, username, rule.id, 'not_following');
    } catch (e) { await handleIgError(acc, e); }
    return;
  }
  await reward(acc, igsid, username, rule);
}

async function reward(acc: Account, igsid: string, username: string | null, rule: Rule) {
  try {
    await sendMessage(acc, igsid, render(rule.reward_messages, username), false);
    await db().from('bot_pending_follow').delete().eq('account_id', acc.account_id).eq('igsid', igsid);
    await logSent(acc.account_id, igsid, username, rule.id, 'reward');
  } catch (e) { await handleIgError(acc, e); }
}

// ---------- relojes ----------

export async function processRetries(limit = 8, budgetMs = 40_000) {
  const start = Date.now();
  // Pasados 7 días Meta ya no deja la respuesta privada: se borran.
  const corte = new Date(Date.now() - LIMITES.ventanaRespuestaPrivadaDias * DAY).toISOString();
  await db().from('bot_retry_comments').delete().lt('comment_created_at', corte);

  const { data, error } = await db().from('bot_retry_comments').select('*').order('created_at').limit(limit);
  if (error) throw error;
  let done = 0;
  let left = 0;
  const pausadas = new Set<string>();
  for (const row of data ?? []) {
    // Sin tiempo para uno completo: queda para la siguiente vuelta (nunca a medias).
    if (Date.now() - start > budgetMs) { left++; continue; }
    if (pausadas.has(row.account_id) || !comentarioReintentable(row.comment_created_at)) { left++; continue; }
    const acc = await getAccount(row.account_id);
    const rule = row.rule_id ? await getRule(row.rule_id) : null;
    if (!acc?.enabled || !rule?.enabled) { await db().from('bot_retry_comments').delete().eq('comment_id', row.comment_id); continue; }
    const resolved = await processComment(acc, { commentId: row.comment_id, igsid: row.igsid, username: row.username, createdAt: row.comment_created_at }, rule, true);
    if (resolved) { await db().from('bot_retry_comments').delete().eq('comment_id', row.comment_id); done++; }
    else { left++; pausadas.add(row.account_id); } // en pausa o en el tope: esa cuenta espera a la siguiente vuelta
  }
  return { done, left };
}
