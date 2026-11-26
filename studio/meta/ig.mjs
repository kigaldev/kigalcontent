#!/usr/bin/env node
// Instagram Studio · publicador por la API oficial de Meta (Instagram API with Instagram Login).
//
// Nunca maneja instagram.com ni la app: solo llama a graph.instagram.com con el token de tu propia app.
// Solo publica piezas con "estado": "aprobado" en su pieza.json. Ver meta/README.md.
//
// Uso:
//   node ig.mjs whoami      --proyecto <p>
//   node ig.mjs limite      --proyecto <p>
//   node ig.mjs token       --proyecto <p>            (renueva el token de 60 días)
//   node ig.mjs validar     <carpeta-de-pieza>
//   node ig.mjs publicar    <carpeta-de-pieza> [--ahora]
//   node ig.mjs tick                                   (publica lo aprobado cuya hora ya ha llegado)
//   node ig.mjs metricas    --proyecto <p> [--dias 30]
//   node ig.mjs pendientes  [--proyecto <p>]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..');
const PROYECTOS = path.join(STUDIO, 'proyectos');
const LOG = path.join(HERE, 'ig.log');

// ---------- utilidades ----------

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

function setEnvValue(file, key, value) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((l) => {
    if (l.trim().startsWith(key + '=')) { found = true; return `${key}=${value}`; }
    return l;
  });
  if (!found) next.push(`${key}=${value}`);
  fs.writeFileSync(file, next.join('\n').replace(/\n+$/, '') + '\n');
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(msg);
  try { fs.appendFileSync(LOG, line + '\n'); } catch { /* sin log no paramos */ }
}

function fail(msg) {
  log('ERROR: ' + msg);
  process.exit(1);
}

function args() {
  const a = process.argv.slice(2);
  const out = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
      out[k] = v;
    } else out._.push(a[i]);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- configuración por proyecto ----------

function rootEnv() {
  return { ...parseEnvFile(path.join(STUDIO, '.env')), ...process.env };
}

function proyectoConfig(proyecto) {
  if (!proyecto) fail('Falta --proyecto <nombre> (una carpeta de proyectos/).');
  const dir = path.join(PROYECTOS, proyecto);
  if (!fs.existsSync(dir)) fail(`No existe el proyecto ${dir}`);
  const envFile = path.join(dir, '.env');
  const env = parseEnvFile(envFile);
  const root = rootEnv();
  if (!env.IG_TOKEN) fail(`Falta IG_TOKEN en ${envFile}. Ver meta/README.md, paso 3.`);
  return {
    proyecto,
    dir,
    envFile,
    token: env.IG_TOKEN,
    userId: env.IG_USER_ID,
    refreshedAt: env.IG_TOKEN_REFRESHED_AT,
    version: env.IG_API_VERSION || root.IG_API_VERSION || 'v27.0',
    blobToken: env.BLOB_READ_WRITE_TOKEN || root.BLOB_READ_WRITE_TOKEN,
  };
}

// ---------- API de Instagram ----------

class MetaError extends Error {
  constructor(body, status) {
    const e = body?.error || {};
    super(`${e.message || 'Error de Meta'} (código ${e.code ?? '?'}${e.error_subcode ? '/' + e.error_subcode : ''}, HTTP ${status})`);
    this.code = e.code;
    this.status = status;
  }
  // Límites de Meta: no se reintenta en bucle.
  get esLimite() { return [4, 17, 32, 613].includes(this.code) || (this.code >= 80000 && this.code <= 80099) || this.status === 429; }
  get esAbuso() { return this.code === 368; }
}

async function api(cfg, method, endpoint, params = {}) {
  const url = new URL(`https://graph.instagram.com/${cfg.version}/${endpoint.replace(/^\//, '')}`);
  const opts = { method, headers: { Authorization: `Bearer ${cfg.token}` } };
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  } else {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    opts.body = body;
  }
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new MetaError(json, res.status);
  return json;
}

async function ensureUserId(cfg) {
  if (cfg.userId) return cfg.userId;
  const me = await api(cfg, 'GET', 'me', { fields: 'user_id,username' });
  // Ojo: es user_id, no id.
  cfg.userId = me.user_id;
  setEnvValue(cfg.envFile, 'IG_USER_ID', me.user_id);
  log(`IG_USER_ID guardado para @${me.username}`);
  return cfg.userId;
}

async function refreshToken(cfg) {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(cfg.token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new MetaError(json, res.status);
  cfg.token = json.access_token;
  setEnvValue(cfg.envFile, 'IG_TOKEN', json.access_token);
  setEnvValue(cfg.envFile, 'IG_TOKEN_REFRESHED_AT', new Date().toISOString());
  log(`Token de ${cfg.proyecto} renovado. Caduca en ${Math.round(json.expires_in / 86400)} días.`);
}

function tokenNeedsRefresh(cfg) {
  if (!cfg.refreshedAt) return true;
  return (Date.now() - Date.parse(cfg.refreshedAt)) / 86400000 > 7;
}

// ---------- piezas ----------

const TIPOS = ['reel', 'carrusel', 'imagen', 'historia'];

function leerPieza(carpeta) {
  const dir = path.resolve(carpeta);
  const file = path.join(dir, 'pieza.json');
  if (!fs.existsSync(file)) fail(`No hay pieza.json en ${dir}`);
  const pieza = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { dir, file, pieza };
}

function guardarPieza(p) {
  fs.writeFileSync(p.file, JSON.stringify(p.pieza, null, 2) + '\n');
}

function leerPie(p) {
  const { pieza, dir } = p;
  if (!pieza.pie) return '';
  const f = path.join(dir, pieza.pie);
  const texto = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : pieza.pie;
  return texto.trim();
}

function ffprobe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' });
  return JSON.parse(out);
}

function validarPieza(p) {
  const { pieza, dir } = p;
  const errores = [];
  const avisos = [];
  if (!TIPOS.includes(pieza.tipo)) errores.push(`tipo debe ser uno de ${TIPOS.join(', ')}`);
  const archivos = pieza.archivos || [];
  if (!archivos.length) errores.push('archivos está vacío');
  for (const a of archivos) if (!fs.existsSync(path.join(dir, a))) errores.push(`no existe ${a}`);
  if (pieza.tipo === 'carrusel' && (archivos.length < 2 || archivos.length > 20)) errores.push('un carrusel lleva de 2 a 20 archivos');
  if (['reel', 'imagen', 'historia'].includes(pieza.tipo) && archivos.length !== 1) errores.push(`${pieza.tipo} lleva un solo archivo`);
  const pie = leerPie(p);
  if (pieza.tipo !== 'historia') {
    if (!pie) avisos.push('sin pie de foto');
    if (pie.length > 2200) errores.push(`el pie tiene ${pie.length} caracteres (máximo 2.200)`);
    const tags = (pie.match(/#[\p{L}\p{N}_]+/gu) || []).length;
    if (tags > 5) errores.push(`el pie lleva ${tags} hashtags (Instagram admite 5)`);
  }
  for (const a of archivos) {
    const f = path.join(dir, a);
    if (!fs.existsSync(f) || !/\.(mp4|mov)$/i.test(a)) continue;
    try {
      const info = ffprobe(f);
      const v = info.streams.find((s) => s.codec_type === 'video');
      const dur = Number(info.format.duration);
      const mb = Number(info.format.size) / 1048576;
      if (pieza.tipo === 'reel' && (dur < 3 || dur > 900)) errores.push(`${a}: dura ${dur.toFixed(1)} s (de 3 s a 15 min)`);
      if (mb > 300 || (v && (v.width > 1920 || v.height > 1920)) || Number(info.format.bit_rate) > 25e6) avisos.push(`${a}: se recomprimirá (pesa ${mb.toFixed(0)} MB)`);
      if (v && v.height < v.width && pieza.tipo === 'reel') avisos.push(`${a}: es horizontal; los reels van en 9:16`);
    } catch (e) { errores.push(`${a}: ffprobe no pudo leerlo (${e.message.split('\n')[0]})`); }
  }
  return { errores, avisos };
}

// Prepara cada archivo en el formato que acepta Instagram: JPEG para imágenes, H.264/AAC 1080x1920 para vídeo.
function prepararArchivo(src, tipo) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'igstudio-'));
  if (/\.(png|webp|jpe?g)$/i.test(src)) {
    const out = path.join(tmp, path.basename(src).replace(/\.\w+$/, '.jpg'));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-q:v', '2', out]);
    return out;
  }
  const info = ffprobe(src);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const [num, den] = String(v?.avg_frame_rate || '30/1').split('/').map(Number); // "30000/1001"
  const fps = den ? num / den : num;
  const ok = v?.codec_name === 'h264' && (!a || a.codec_name === 'aac') && Number(info.format.size) < 300 * 1048576
    && Number(info.format.bit_rate) <= 25e6 && fps <= 60 && Math.max(v.width, v.height) <= 1920 && v.pix_fmt === 'yuv420p';
  if (ok) return src;
  const out = path.join(tmp, 'video.mp4');
  const scale = tipo === 'reel' || tipo === 'historia'
    ? 'scale=1080:1920:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30'
    : 'scale=1080:-2,fps=30';
  log(`Recomprimiendo ${path.basename(src)}…`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', scale, '-c:v', 'libx264', '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', out]);
  return out;
}

// Instagram descarga el fichero desde una URL pública. Lo subimos a Vercel Blob con nombre aleatorio y se borra al publicar.
async function subirTemporal(cfg, file) {
  if (!cfg.blobToken) throw new Error('Falta BLOB_READ_WRITE_TOKEN en studio/.env. Ver meta/README.md, paso 4.');
  const { put } = await import('@vercel/blob');
  const ext = path.extname(file).toLowerCase();
  const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'image/jpeg';
  const blob = await put(`igstudio/${Date.now()}${ext}`, fs.createReadStream(file), {
    access: 'public', token: cfg.blobToken, addRandomSuffix: true, contentType, multipart: fs.statSync(file).size > 50 * 1048576,
  });
  return blob.url;
}

async function borrarTemporales(cfg, urls) {
  if (!urls.length) return;
  try {
    const { del } = await import('@vercel/blob');
    await del(urls, { token: cfg.blobToken });
  } catch (e) { log(`Aviso: no se pudieron borrar los temporales (${e.message}). Bórralos en Vercel › Storage.`); }
}

async function esperarContenedor(cfg, id, etiqueta) {
  const inicio = Date.now();
  while (Date.now() - inicio < 15 * 60 * 1000) {
    const c = await api(cfg, 'GET', id, { fields: 'status_code,status' });
    if (c.status_code === 'FINISHED') return;
    if (c.status_code === 'ERROR' || c.status_code === 'EXPIRED') throw new Error(`${etiqueta}: ${c.status_code} · ${c.status || 'sin motivo'}`);
    await sleep(c.status_code === 'IN_PROGRESS' ? 8000 : 4000);
  }
  throw new Error(`${etiqueta}: Instagram tardó más de 15 minutos en procesarlo`);
}

async function publicarPieza(carpeta, { forzarAhora = false } = {}) {
  const p = leerPieza(carpeta);
  const { pieza, dir } = p;
  if (pieza.estado === 'publicado') { log(`Ya publicada: ${dir}`); return; }
  if (pieza.estado !== 'aprobado') fail(`La pieza no está aprobada (estado: ${pieza.estado}). Solo Kike aprueba: cambia "estado" a "aprobado" tras revisarla.`);
  if (!forzarAhora && pieza.programado && Date.parse(pieza.programado) > Date.now()) {
    log(`Programada para ${pieza.programado}. Usa --ahora para publicarla ya, o deja que la publique "tick".`);
    return;
  }
  const { errores, avisos } = validarPieza(p);
  avisos.forEach((a) => log('Aviso: ' + a));
  if (errores.length) fail('La pieza no pasa la validación:\n - ' + errores.join('\n - '));

  if (!pieza.proyecto) fail('Falta "proyecto" en pieza.json (la carpeta de proyectos/ cuya cuenta publica).');
  const cfg = proyectoConfig(pieza.proyecto);
  // Antes de marcarla "publicando": si falta el alojamiento temporal, la pieza no se toca.
  if (!cfg.blobToken) fail('Falta BLOB_READ_WRITE_TOKEN en studio/.env. Ver meta/README.md, paso 4.');
  const igId = await ensureUserId(cfg);
  const pie = leerPie(p);
  const temporales = [];
  pieza.estado = 'publicando';
  guardarPieza(p);

  try {
    const urls = [];
    for (const a of pieza.archivos) {
      const listo = prepararArchivo(path.join(dir, a), pieza.tipo);
      const url = await subirTemporal(cfg, listo);
      temporales.push(url);
      urls.push(url);
    }
    let coverUrl;
    if (pieza.portada && fs.existsSync(path.join(dir, pieza.portada))) {
      coverUrl = await subirTemporal(cfg, prepararArchivo(path.join(dir, pieza.portada), 'imagen'));
      temporales.push(coverUrl);
    }

    let creationId;
    const esVideo = (u) => /\.(mp4|mov)(\?|$)/i.test(u);
    if (pieza.tipo === 'carrusel') {
      const hijos = [];
      for (const [i, u] of urls.entries()) {
        const c = await api(cfg, 'POST', `${igId}/media`, esVideo(u)
          ? { media_type: 'VIDEO', video_url: u, is_carousel_item: true }
          : { image_url: u, is_carousel_item: true, alt_text: pieza.alt_text?.[i] });
        await esperarContenedor(cfg, c.id, `diapositiva ${i + 1}`);
        hijos.push(c.id);
      }
      const c = await api(cfg, 'POST', `${igId}/media`, { media_type: 'CAROUSEL', children: hijos.join(','), caption: pie });
      creationId = c.id;
    } else if (pieza.tipo === 'reel') {
      const params = {
        media_type: 'REELS', video_url: urls[0], caption: pie, cover_url: coverUrl,
        share_to_feed: pieza.prueba ? false : pieza.compartir_en_feed !== false,
        thumb_offset: pieza.thumb_offset_ms, audio_name: pieza.audio_name,
        collaborators: pieza.colaboradores?.length ? pieza.colaboradores : undefined,
      };
      if (pieza.prueba) params.trial_params = { graduation_strategy: pieza.graduacion || 'MANUAL' };
      creationId = (await api(cfg, 'POST', `${igId}/media`, params)).id;
    } else if (pieza.tipo === 'historia') {
      creationId = (await api(cfg, 'POST', `${igId}/media`, esVideo(urls[0])
        ? { media_type: 'STORIES', video_url: urls[0] }
        : { media_type: 'STORIES', image_url: urls[0] })).id;
    } else {
      creationId = (await api(cfg, 'POST', `${igId}/media`, { image_url: urls[0], caption: pie, alt_text: pieza.alt_text?.[0] })).id;
    }

    await esperarContenedor(cfg, creationId, pieza.tipo);
    const pub = await api(cfg, 'POST', `${igId}/media_publish`, { creation_id: creationId });
    const info = await api(cfg, 'GET', pub.id, { fields: 'permalink,timestamp,media_type,media_product_type' }).catch(() => ({}));
    pieza.estado = 'publicado';
    pieza.resultado = { media_id: pub.id, permalink: info.permalink, publicado_en: info.timestamp || new Date().toISOString() };
    guardarPieza(p);
    log(`Publicada ${pieza.tipo}${pieza.prueba ? ' de prueba' : ''}: ${info.permalink || pub.id}`);
  } catch (e) {
    pieza.estado = 'error';
    pieza.resultado = { error: e.message, en: new Date().toISOString(), pausa: e instanceof MetaError && (e.esLimite || e.esAbuso) };
    guardarPieza(p);
    if (e instanceof MetaError && (e.esLimite || e.esAbuso)) {
      const horas = e.esAbuso ? 24 : 1;
      setEnvValue(cfg.envFile, 'IG_PAUSA_HASTA', new Date(Date.now() + horas * 3600000).toISOString());
      log(`Meta ha puesto un límite: se pausa la publicación ${horas} h en ${cfg.proyecto}.`);
    }
    throw e;
  } finally {
    await borrarTemporales(cfg, temporales);
  }
}

function todasLasPiezas(proyecto) {
  const out = [];
  const raices = proyecto ? [path.join(PROYECTOS, proyecto)] : fs.existsSync(PROYECTOS) ? fs.readdirSync(PROYECTOS).filter((d) => !d.startsWith('_')).map((d) => path.join(PROYECTOS, d)) : [];
  const walk = (d, depth) => {
    if (depth > 5 || !fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory() && !['node_modules', '.git'].includes(e.name)) walk(path.join(d, e.name), depth + 1);
      else if (e.name === 'pieza.json') out.push(d);
    }
  };
  raices.forEach((r) => walk(r, 0));
  return out;
}

async function tick() {
  const piezas = todasLasPiezas().map((d) => ({ d, ...leerPieza(d) }));
  const proyectos = new Set(piezas.map((p) => p.pieza.proyecto).filter(Boolean));
  for (const proyecto of proyectos) {
    try {
      const cfg = proyectoConfig(proyecto);
      if (tokenNeedsRefresh(cfg)) await refreshToken(cfg);
    } catch (e) { log(`Token de ${proyecto}: ${e.message}`); }
  }
  for (const p of piezas) {
    const { pieza } = p;
    if (pieza.estado !== 'aprobado' || !pieza.programado || Date.parse(pieza.programado) > Date.now()) continue;
    if (!pieza.proyecto) { log(`Sin "proyecto" en ${p.d}/pieza.json: no se publica.`); continue; }
    const env = parseEnvFile(path.join(PROYECTOS, pieza.proyecto, '.env'));
    if (env.IG_PAUSA_HASTA && Date.parse(env.IG_PAUSA_HASTA) > Date.now()) { log(`${pieza.proyecto} en pausa hasta ${env.IG_PAUSA_HASTA}`); continue; }
    try { await publicarPieza(p.d); } catch (e) { log(`No se publicó ${p.d}: ${e.message}`); }
    await sleep(30000); // nunca dos publicaciones en el mismo minuto
  }
}

// ---------- métricas ----------

const METRICAS = {
  REELS: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'reels_skip_rate'],
  FEED: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'],
  STORY: ['views', 'reach', 'replies', 'shares', 'total_interactions'],
};
const BASE = ['views', 'reach', 'saved', 'shares'];

async function insights(cfg, media) {
  const lista = METRICAS[media.media_product_type] || METRICAS.FEED;
  for (const metric of [lista, BASE]) {
    try {
      const r = await api(cfg, 'GET', `${media.id}/insights`, { metric: metric.join(',') });
      return Object.fromEntries(r.data.map((m) => [m.name, m.values?.[0]?.value ?? m.total_value?.value]));
    } catch (e) { if (metric === BASE) return { error: e.message }; }
  }
}

async function metricas(proyecto, dias) {
  const cfg = proyectoConfig(proyecto);
  const igId = await ensureUserId(cfg);
  const desde = Date.now() - dias * 86400000;
  const filas = [];
  let next = `${igId}/media`;
  let params = { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count', limit: 50 };
  while (next) {
    const r = await api(cfg, 'GET', next, params);
    for (const m of r.data) {
      if (Date.parse(m.timestamp) < desde) { next = null; break; }
      filas.push({ ...m, caption: (m.caption || '').slice(0, 120), insights: await insights(cfg, m) });
    }
    if (next && r.paging?.next) { next = r.paging.next.replace(/^https:\/\/graph\.instagram\.com\/v[\d.]+\//, '').split('?')[0]; params = Object.fromEntries(new URL(r.paging.next).searchParams); delete params.access_token; }
    else next = null;
  }
  const outDir = path.join(cfg.dir, 'metricas');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify({ proyecto, desde: new Date(desde).toISOString(), leido_en: new Date().toISOString(), media: filas }, null, 2));
  log(`${filas.length} publicaciones de los últimos ${dias} días → ${path.relative(STUDIO, file)}`);
}

// ---------- CLI ----------

const a = args();
const cmd = a._[0];
try {
  switch (cmd) {
    case 'whoami': {
      const cfg = proyectoConfig(a.proyecto);
      const me = await api(cfg, 'GET', 'me', { fields: 'user_id,username,account_type,media_count,followers_count' });
      console.log(me);
      if (!cfg.userId) { setEnvValue(cfg.envFile, 'IG_USER_ID', me.user_id); log('IG_USER_ID guardado.'); }
      break;
    }
    case 'limite': {
      const cfg = proyectoConfig(a.proyecto);
      const igId = await ensureUserId(cfg);
      console.log(await api(cfg, 'GET', `${igId}/content_publishing_limit`, { fields: 'config,quota_usage' }));
      break;
    }
    case 'token': await refreshToken(proyectoConfig(a.proyecto)); break;
    case 'validar': {
      const p = leerPieza(a._[1] || fail('Falta la carpeta de la pieza'));
      const { errores, avisos } = validarPieza(p);
      avisos.forEach((x) => console.log('Aviso: ' + x));
      errores.forEach((x) => console.log('Error: ' + x));
      console.log(errores.length ? 'NO VÁLIDA' : `Válida (${p.pieza.tipo}, estado: ${p.pieza.estado})`);
      process.exitCode = errores.length ? 1 : 0;
      break;
    }
    case 'publicar': await publicarPieza(a._[1] || fail('Falta la carpeta de la pieza'), { forzarAhora: !!a.ahora }); break;
    case 'tick': await tick(); break;
    case 'metricas': await metricas(a.proyecto, Number(a.dias || 30)); break;
    case 'pendientes': {
      for (const d of todasLasPiezas(a.proyecto)) {
        const { pieza } = leerPieza(d);
        if (pieza.estado !== 'publicado') console.log(`${(pieza.estado || '?').padEnd(12)} ${(pieza.programado || 'sin hora').padEnd(26)} ${pieza.tipo.padEnd(9)} ${path.relative(STUDIO, d)}`);
      }
      break;
    }
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).join('\n').replace(/^\/\/ ?/gm, ''));
  }
} catch (e) {
  fail(e.message);
}
