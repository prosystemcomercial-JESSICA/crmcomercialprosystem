import { describe, it, expect } from 'vitest';
import { lerDataUrl } from '../src/lib/assistente/ia-texto';

// Áudios com "codecs=opus" não eram transcritos (15/10/2026).
describe('data URL de mídia', () => {
  it('aceita áudio com codecs', () => {
    expect(lerDataUrl('data:audio/ogg; codecs=opus;base64,T2dnUw==')).toEqual({ mime: 'audio/ogg', base64: 'T2dnUw==' });
  });
  it('continua aceitando o formato simples e imagem', () => {
    expect(lerDataUrl('data:audio/mpeg;base64,AAAA')?.mime).toBe('audio/mpeg');
    expect(lerDataUrl('data:image/jpeg;base64,/9j/')?.mime).toBe('image/jpeg');
  });
  it('recusa o que não é data URL', () => {
    expect(lerDataUrl('https://exemplo.com/a.ogg')).toBeNull();
    expect(lerDataUrl(null)).toBeNull();
  });
});
