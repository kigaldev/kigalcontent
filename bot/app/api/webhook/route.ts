import { after, NextResponse, type NextRequest } from 'next/server';
import { handleCommentEvent, handleMessagingEvent, type CommentEvent, type MessagingEvent } from '@/lib/bot';
import { env } from '@/lib/env';
import { validSignature } from '@/lib/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Verificación del webhook desde el panel de Meta.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === env.verifyToken) {
    return new NextResponse(p.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

type Payload = {
  object?: string;
  entry?: { id: string; time?: number; changes?: { field: string; value: CommentEvent }[]; messaging?: MessagingEvent[] }[];
};

// Meta desactiva el webhook si falla a menudo: se responde 200 al momento y se procesa después.
// Un evento que da error se registra en los logs, nunca se devuelve 500.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'), env.appSecret)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }
  let payload: Payload;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  after(async () => {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'comments') continue;
        try { await handleCommentEvent(entry.id, change.value); } catch (e) { console.error('comment event', e); }
      }
      for (const m of entry.messaging ?? []) {
        try { await handleMessagingEvent(entry.id, m); } catch (e) { console.error('messaging event', e); }
      }
    }
  });
  return NextResponse.json({ ok: true });
}
