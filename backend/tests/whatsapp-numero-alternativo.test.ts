import { describe, it, expect } from 'vitest';
import { numeroAlternativoBR, ehNumeroSemWhatsapp } from '../src/services/evolution.service';

describe('número alternativo (9 extra do celular brasileiro)', () => {
  it('celular com 9 extra → sem o 9', () => {
    expect(numeroAlternativoBR('5593992395940')).toBe('559392395940');
    expect(numeroAlternativoBR('5527999121135')).toBe('552799121135');
  });
  it('celular sem o 9 → com o 9', () => {
    expect(numeroAlternativoBR('559392395940')).toBe('5593992395940');
  });
  it('fixo, internacional ou número estranho não tem alternativo', () => {
    expect(numeroAlternativoBR('552733334444')).toBeNull(); // fixo (começa com 3)
    expect(numeroAlternativoBR('14155550100')).toBeNull();
    expect(numeroAlternativoBR('55279')).toBeNull();
  });
});

describe('erro de número sem WhatsApp', () => {
  it('reconhece a resposta da UazAPI', () => {
    expect(ehNumeroSemWhatsapp('{"error":"the number 5593992395940@s.whatsapp.net is not on WhatsApp"}')).toBe(true);
    expect(ehNumeroSemWhatsapp('{"error":"timeout"}')).toBe(false);
  });
});
