// Utilidades compartidas por los scripts del bot (se ejecutan en local, desde la raíz de kigalcontent; leen studio/.env y studio/proyectos/).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STUDIO = path.resolve(HERE, '..', '..', 'studio');

export function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

export function args() {
  const a = process.argv.slice(2);
  const out = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) out[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
    else out._.push(a[i]);
  }
  return out;
}

export function supabase() {
  const env = { ...parseEnv(path.join(STUDIO, '.env')), ...process.env };
  const url = env.BOT_SUPABASE_URL;
  const key = env.BOT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Faltan BOT_SUPABASE_URL y BOT_SUPABASE_SERVICE_ROLE_KEY en studio/.env (ver bot/README.md).');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function proyectoEnv(proyecto) {
  if (!proyecto) { console.error('Falta --proyecto <nombre>'); process.exit(1); }
  const file = path.join(STUDIO, 'proyectos', proyecto, '.env');
  const env = parseEnv(file);
  if (!env.IG_TOKEN) { console.error(`Falta IG_TOKEN en ${file}`); process.exit(1); }
  return env;
}

export async function accountIdDe(proyecto) {
  const env = proyectoEnv(proyecto);
  if (env.IG_USER_ID) return env.IG_USER_ID;
  console.error(`Falta IG_USER_ID en proyectos/${proyecto}/.env: ejecuta antes node meta\\ig.mjs whoami --proyecto ${proyecto}`);
  process.exit(1);
}
