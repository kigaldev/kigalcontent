import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validCron, validSignature } from './signature';

describe('firma del webhook', () => {
  const body = '{"object":"instagram","entry":[]}';
  const sig = 'sha256=' + createHmac('sha256', 'secreto').update(body).digest('hex');
  it('acepta la firma correcta', () => expect(validSignature(body, sig, 'secreto')).toBe(true));
  it('rechaza otro secreto, otro cuerpo o sin cabecera', () => {
    expect(validSignature(body, sig, 'otro')).toBe(false);
    expect(validSignature(body + ' ', sig, 'secreto')).toBe(false);
    expect(validSignature(body, null, 'secreto')).toBe(false);
    expect(validSignature(body, 'sha1=abc', 'secreto')).toBe(false);
  });
  it('cron con Bearer', () => {
    expect(validCron('Bearer x1', 'x1')).toBe(true);
    expect(validCron('Bearer x2', 'x1')).toBe(false);
    expect(validCron(null, 'x1')).toBe(false);
  });
});
