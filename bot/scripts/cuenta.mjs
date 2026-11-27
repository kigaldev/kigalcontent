#!/usr/bin/env node
// Conecta (o actualiza) una cuenta de Instagram del estudio con el bot.
//   node bot\scripts\cuenta.mjs conectar --proyecto kikegallego
//   node bot\scripts\cuenta.mjs listar
//   node bot\scripts\cuenta.mjs pausar --proyecto kikegallego [--horas 24]
//   node bot\scripts\cuenta.mjs reanudar --proyecto kikegallego
//   node bot\scripts\cuenta.mjs borrar-usuario --proyecto kikegallego --usuario <username>   (derecho de supresión)
import { accountIdDe, args, proyectoEnv, supabase } from './comun.mjs';

const a = args();
const sb = supabase();

async function igMe(token) {
  const v = process.env.IG_API_VERSION || 'v27.0';
  const headers = { Authorization: `Bearer ${token}` };
  if (token.trim().startsWith('EAA')) {
    const r = await fetch(`https://graph.facebook.com/${v}/me/assigned_instagram_accounts?fields=id,username`, { headers });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
    let acc = j.data?.[0];
    if (!acc) {
      const r2 = await fetch(`https://graph.facebook.com/${v}/me/accounts?fields=instagram_business_account{id,username}`, { headers });
      const j2 = await r2.json();
      acc = (j2.data ?? []).map((p) => p.instagram_business_account).find(Boolean);
    }
    if (!acc?.id) throw new Error('No se encontró ninguna cuenta de Instagram asignada a este token Unified Login.');
    return { user_id: acc.id, username: acc.username || acc.id };
  }
  const r = await fetch(`https://graph.instagram.com/${v}/me?fields=user_id,username`, { headers });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return j;
}

switch (a._[0]) {
  case 'conectar': {
    const env = proyectoEnv(a.proyecto);
    const me = await igMe(env.IG_TOKEN);
    const { error } = await sb.from('bot_accounts').upsert({
      account_id: me.user_id, username: me.username, proyecto: a.proyecto,
      access_token: env.IG_TOKEN, token_refreshed_at: env.IG_TOKEN_REFRESHED_AT || new Date().toISOString(), enabled: true,
    });
    if (error) throw error;
    console.log(`Conectada @${me.username} (${me.user_id}) al bot como proyecto ${a.proyecto}.`);
    break;
  }
  case 'listar': {
    const { data, error } = await sb.from('bot_accounts').select('account_id, username, proyecto, enabled, paused_until, token_refreshed_at');
    if (error) throw error;
    console.table(data);
    break;
  }
  case 'pausar':
  case 'reanudar': {
    const id = await accountIdDe(a.proyecto);
    const until = a._[0] === 'pausar' ? new Date(Date.now() + Number(a.horas || 24) * 3600_000).toISOString() : null;
    const { error } = await sb.from('bot_accounts').update({ paused_until: until }).eq('account_id', id);
    if (error) throw error;
    console.log(until ? `Bot en pausa hasta ${until}` : 'Bot reanudado.');
    break;
  }
  case 'borrar-usuario': {
    const id = await accountIdDe(a.proyecto);
    if (!a.usuario) { console.error('Falta --usuario'); process.exit(1); }
    const tablas = ['bot_sent', 'bot_processed_comments', 'bot_pending_follow', 'bot_retry_comments'];
    // Las filas que llegan por mensaje directo pueden no tener username: se borran también por su igsid.
    const igsids = new Set();
    for (const t of tablas) {
      const { data, error } = await sb.from(t).select('igsid').eq('account_id', id).eq('username', a.usuario);
      if (error) throw error;
      (data ?? []).forEach((r) => r.igsid && igsids.add(r.igsid));
    }
    let total = 0;
    for (const t of tablas) {
      const porNombre = await sb.from(t).delete({ count: 'exact' }).eq('account_id', id).eq('username', a.usuario);
      if (porNombre.error) throw porNombre.error;
      total += porNombre.count ?? 0;
      if (igsids.size) {
        const porId = await sb.from(t).delete({ count: 'exact' }).eq('account_id', id).in('igsid', [...igsids]);
        if (porId.error) throw porId.error;
        total += porId.count ?? 0;
      }
    }
    if (!igsids.size) console.log('Aviso: no hay filas con ese username. Si escribió solo por privado, pide su id (igsid) en Meta y bórralo a mano.');
    console.log(`Borradas ${total} filas de @${a.usuario}.`);
    break;
  }
  default:
    console.log('Uso: conectar | listar | pausar | reanudar | borrar-usuario  (ver cabecera del script)');
}
