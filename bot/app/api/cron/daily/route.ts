import { NextResponse, type NextRequest } from 'next/server';
import { db, type Account } from '@/lib/db';
import { env } from '@/lib/env';
import { refreshToken } from '@/lib/instagram';
import { validCron } from '@/lib/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Una vez al día (Vercel Cron, plan Hobby): renueva tokens de más de 7 días (duran 60) y limpia.
// La propia consulta mantiene despierto Supabase (el plan gratis se pausa tras 7 días sin actividad).
export async function GET(req: NextRequest) {
  if (!validCron(req.headers.get('authorization'), env.cronSecret)) return new NextResponse('Unauthorized', { status: 401 });

  const corte = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: accounts, error } = await db().from('bot_accounts').select('*').eq('enabled', true).lt('token_refreshed_at', corte);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });

  const renovadas: string[] = [];
  for (const acc of (accounts ?? []) as Account[]) {
    try {
      const r = await refreshToken(acc.access_token);
      await db().from('bot_accounts').update({ access_token: r.access_token, token_refreshed_at: new Date().toISOString() }).eq('account_id', acc.account_id);
      renovadas.push(acc.username);
    } catch (e) {
      console.error(`No se pudo renovar el token de @${acc.username}: ${(e as Error).message}`);
    }
  }

  // Pendientes de follow de hace más de 7 días: la ventana de mensajes ya pasó.
  await db().from('bot_pending_follow').delete().lt('created_at', corte);
  // Comentarios ya procesados de hace más de 30 días: no hacen falta para deduplicar.
  await db().from('bot_processed_comments').delete().lt('created_at', new Date(Date.now() - 30 * 86400_000).toISOString());

  return NextResponse.json({ ok: true, renovadas });
}
