import { NextResponse, type NextRequest } from 'next/server';
import { processRetries } from '@/lib/bot';
import { env } from '@/lib/env';
import { validCron } from '@/lib/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cada 5 minutos (Supabase Cron + pg_net): reintenta los comentarios que quedaron en cola por pausa o tope.
export async function GET(req: NextRequest) {
  if (!validCron(req.headers.get('authorization'), env.cronSecret)) return new NextResponse('Unauthorized', { status: 401 });
  try {
    // Cada comentario tarda ~4-8 s (espera humana + llamadas): lote pequeño y tope de tiempo para no pasar de maxDuration.
    return NextResponse.json({ ok: true, ...(await processRetries(8, 40_000)) });
  } catch (e) {
    console.error('reintentos', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
