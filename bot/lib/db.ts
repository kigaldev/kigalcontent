import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export type Account = {
  account_id: string;
  username: string;
  proyecto: string | null;
  access_token: string;
  token_refreshed_at: string;
  paused_until: string | null;
  enabled: boolean;
};

export type Rule = {
  id: number;
  account_id: string;
  name: string;
  enabled: boolean;
  keywords: string[];
  post_id: string | null;
  require_follow: boolean;
  follow_prompts: string[];
  not_following_replies: string[];
  reward_messages: string[];
  public_replies: string[];
};

export type SentKind = 'prompt' | 'not_following' | 'reward' | 'public';

let client: SupabaseClient | null = null;

// Solo desde el servidor, con la service role (las tablas tienen RLS sin políticas).
export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function getAccount(accountId: string): Promise<Account | null> {
  const { data, error } = await db().from('bot_accounts').select('*').eq('account_id', accountId).maybeSingle();
  if (error) throw error;
  return data as Account | null;
}

export async function getRules(accountId: string): Promise<Rule[]> {
  const { data, error } = await db().from('bot_rules').select('*').eq('account_id', accountId).eq('enabled', true);
  if (error) throw error;
  return (data ?? []) as Rule[];
}

export async function getRule(id: number): Promise<Rule | null> {
  const { data, error } = await db().from('bot_rules').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Rule | null;
}

const since = (ms: number) => new Date(Date.now() - ms).toISOString();

export async function countSent(accountId: string, kinds: SentKind[], withinMs: number, igsid?: string, ruleId?: number): Promise<number> {
  let q = db().from('bot_sent').select('id', { count: 'exact', head: true })
    .eq('account_id', accountId).in('kind', kinds).gte('created_at', since(withinMs));
  if (igsid) q = q.eq('igsid', igsid);
  if (ruleId !== undefined) q = q.eq('rule_id', ruleId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function logSent(accountId: string, igsid: string, username: string | null, ruleId: number, kind: SentKind) {
  const { error } = await db().from('bot_sent').insert({ account_id: accountId, igsid, username, rule_id: ruleId, kind });
  if (error) console.error('sent insert', error.message);
}

export async function setPause(accountId: string, until: Date) {
  await db().from('bot_accounts').update({ paused_until: until.toISOString() }).eq('account_id', accountId);
  console.warn(`FRENO: cuenta ${accountId} en pausa hasta ${until.toISOString()}`);
}
