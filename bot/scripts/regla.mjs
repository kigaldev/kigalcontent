#!/usr/bin/env node
// Reglas «comenta PALABRA y te lo mando». Enseña la fila antes de guardarla: solo guarda con --si.
//
//   node bot\scripts\regla.mjs crear --proyecto kikegallego --palabra GUIA --tema "usar Claude en tu negocio" \
//        --enlace https://kigaldev.com/recursos/guia-claude-para-negocios \
//        --puntos "48 fichas por área|Prompts listos para copiar|Qué no delegar en la IA|Un kit para empezar hoy" \
//        [--post <media_id>] [--sin-follow] [--nombre "Guía Claude"] [--si]
//   node bot\scripts\regla.mjs listar --proyecto kikegallego
//   node bot\scripts\regla.mjs desactivar --id 3
//   node bot\scripts\regla.mjs embudo            (últimos 7 días: botones enviados y enlaces entregados)
import { accountIdDe, args, supabase } from './comun.mjs';
import { matchesKeyword, normalize } from './match.mjs';

const a = args();
const sb = supabase();

const FOLLOW_PROMPTS = [
  'Hola {username}! 👋 Pulsa el botón y te lo mando. Eso sí, tienes que seguirme 🤝',
  'Buenas {username}! Te lo paso ahora mismo, solo tienes que seguirme y darle al botón 👇',
  'Hey {username}! 🙌 Sígueme y pulsa el botón de abajo, que te lo mando al momento',
];
const NOT_FOLLOWING = [
  'Casi lo tienes {username}! 🙌 Sígueme y vuelve a pulsar el botón',
  'Todavía no me sigues! Dale a seguir y pulsa otra vez, que te lo mando 🤝',
  'Uy, aún no me sale tu follow. Sígueme y vuelve a darle 👇',
];
const PUBLIC_REPLIES = [
  '@{username} te lo he mandado por privado!🤝',
  '@{username} mira tus mensajes, ya te lo he pasado 🙌',
  '@{username} te escribo por privado!🤝',
  '@{username} enviado! Revisa el privado 👀',
  '@{username} ahí lo tienes, en tus mensajes 🤝',
  '@{username} hecho, te lo acabo de mandar 👌',
  '@{username} te ha llegado por privado, échale un ojo',
  '@{username} listo! Lo tienes en mensajes 📩',
  '@{username} te lo dejo en el privado 🙌',
  '@{username} mandado, ya me dices qué tal',
];

function conUtm(url, palabra) {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'instagram');
  u.searchParams.set('utm_medium', 'dm');
  u.searchParams.set('utm_campaign', palabra.toLowerCase());
  return u.toString();
}

function rewards(tema, puntos, enlace) {
  const lista = puntos.map((p) => `• ${p}`).join('\n');
  return [
    `Hola {username}! 👋\nAquí tienes lo de ${tema} 🤝\nDentro tienes:\n${lista}\n👉 ${enlace}\nCualquier duda me dices!`,
    `Buenas {username}! 🙌\nTe paso lo de ${tema}\nLo que vas a encontrar:\n${lista}\n👉 ${enlace}\nSi te atascas me escribes!`,
    `Hey {username}! Aquí va 🤝\nTe dejo lo de ${tema}\nTe he puesto:\n${lista}\n👉 ${enlace}\nYa me contarás qué tal te va!`,
  ];
}

switch (a._[0]) {
  case 'crear': {
    const accountId = await accountIdDe(a.proyecto);
    for (const k of ['palabra', 'tema', 'enlace', 'puntos']) if (!a[k] || a[k] === true) { console.error(`Falta --${k}`); process.exit(1); }
    const palabra = String(a.palabra).toUpperCase();
    const puntos = String(a.puntos).split('|').map((s) => s.trim()).filter(Boolean);
    if (puntos.length < 2) { console.error('--puntos: al menos 2, separados por |'); process.exit(1); }

    // Los reels viejos siguen recibiendo comentarios: ni la misma palabra ni una que encaje con ella.
    const { data: existentes } = await sb.from('bot_rules').select('id, name, keywords, enabled').eq('account_id', accountId);
    const choque = (existentes ?? []).filter((r) => r.keywords.some((k) => matchesKeyword(k, palabra) || matchesKeyword(palabra, k)
      || normalize(k).startsWith(normalize(palabra)) || normalize(palabra).startsWith(normalize(k))));
    if (choque.length) { console.error('Ya hay reglas con una palabra igual o parecida:'); console.table(choque); process.exit(1); }

    const fila = {
      account_id: accountId,
      name: a.nombre && a.nombre !== true ? a.nombre : palabra,
      keywords: [palabra],
      post_id: a.post && a.post !== true ? a.post : null,
      require_follow: !a['sin-follow'],
      follow_prompts: FOLLOW_PROMPTS,
      not_following_replies: NOT_FOLLOWING,
      reward_messages: rewards(a.tema, puntos, conUtm(a.enlace, palabra)),
      public_replies: PUBLIC_REPLIES,
    };
    console.log(JSON.stringify(fila, null, 2));
    if (!a.si) { console.log('\nRevisa la fila. Para guardarla, repite el comando con --si'); break; }
    const { data, error } = await sb.from('bot_rules').insert(fila).select('id').single();
    if (error) throw error;
    console.log(`Regla ${data.id} guardada: comenta ${palabra} → ${a.enlace}`);
    break;
  }
  case 'listar': {
    const accountId = await accountIdDe(a.proyecto);
    const { data, error } = await sb.from('bot_rules').select('id, name, keywords, post_id, require_follow, enabled, created_at').eq('account_id', accountId).order('id');
    if (error) throw error;
    console.table(data);
    break;
  }
  case 'desactivar': {
    const { error } = await sb.from('bot_rules').update({ enabled: false }).eq('id', Number(a.id));
    if (error) throw error;
    console.log(`Regla ${a.id} desactivada.`);
    break;
  }
  case 'embudo': {
    const { data, error } = await sb.from('bot_embudo_7d').select('*');
    if (error) throw error;
    console.table(data);
    break;
  }
  default:
    console.log('Uso: crear | listar | desactivar | embudo  (ver cabecera del script)');
}
