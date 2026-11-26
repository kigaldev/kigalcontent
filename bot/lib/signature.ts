import { createHmac, timingSafeEqual } from 'node:crypto';

// X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(cuerpo en bruto, Instagram app secret) en hex.
export function validSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function validCron(authorization: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization ?? '');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
