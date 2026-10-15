import { describe, it, expect } from 'vitest';
import { lerDataUrl, extensaoAudio } from '../src/lib/assistente/ia-texto';

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

describe('extensão do áudio para a transcrição', () => {
  it('áudio gravado pelo navegador (WebM) vai como .webm, não .ogg (dava HTTP 400)', () => {
    expect(extensaoAudio('audio/webm')).toBe('webm');
    expect(extensaoAudio('audio/webm;codecs=opus')).toBe('webm');
  });
  it('mantém os outros formatos', () => {
    expect(extensaoAudio('audio/ogg')).toBe('ogg');
    expect(extensaoAudio('audio/mpeg')).toBe('mp3');
    expect(extensaoAudio('audio/mp4')).toBe('m4a');
    expect(extensaoAudio('audio/wav')).toBe('wav');
    expect(extensaoAudio(null)).toBe('ogg');
  });
});
