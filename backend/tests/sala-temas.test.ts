import { describe, it, expect } from 'vitest';
import { pascoa, temaDoDia, sortearDialogo, TEMAS, PAPO_CASUAL } from '../../frontend/components/escritorio/sala-temas';

describe('temas do Escritório vivo', () => {
  it('calcula o domingo de Páscoa', () => {
    expect(pascoa(2025)).toEqual([4, 20]);
    expect(pascoa(2026)).toEqual([4, 5]);
    expect(pascoa(2027)).toEqual([3, 28]);
  });
  it('escolhe o tema pela data', () => {
    expect(temaDoDia(2026, 11, 11)).toBe('nenhum');
    expect(temaDoDia(2026, 12, 1)).toBe('natal');
    expect(temaDoDia(2026, 12, 25)).toBe('natal');
    expect(temaDoDia(2026, 12, 31)).toBe('ano_novo');
    expect(temaDoDia(2027, 1, 1)).toBe('ano_novo');
    expect(temaDoDia(2027, 1, 3)).toBe('nenhum');
    expect(temaDoDia(2027, 2, 9)).toBe('carnaval');   // terça de Carnaval
    expect(temaDoDia(2027, 2, 11)).toBe('nenhum');
    expect(temaDoDia(2027, 3, 21)).toBe('pascoa');    // Domingo de Ramos
    expect(temaDoDia(2027, 3, 28)).toBe('pascoa');
    expect(temaDoDia(2027, 3, 29)).toBe('nenhum');
    expect(temaDoDia(2027, 6, 24)).toBe('junina');
  });
  it('sorteia conversas sem repetir a anterior e com falas curtas', () => {
    let ant = sortearDialogo('natal');
    for (let i = 0; i < 200; i++) { const d = sortearDialogo('natal', ant); expect(d).not.toBe(ant); expect(d.length).toBeGreaterThanOrEqual(2); ant = d; }
    [...PAPO_CASUAL, ...Object.values(TEMAS).flatMap(t => t.papo)].forEach(d => d.forEach(f => expect(f.length).toBeLessThanOrEqual(70)));
  });
});
