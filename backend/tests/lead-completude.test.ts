import { describe, it, expect } from 'vitest';
import { calcularCompletude } from '@/lib/lead-completude';

describe('calcularCompletude', () => {
  it('lead vazio retorna 0%', () => {
    expect(calcularCompletude({})).toBe(0);
  });

  it('lead com todos os 9 campos retorna 100%', () => {
    expect(calcularCompletude({
      telefone: '11999999999', email: 'a@a.com', segmento: 'Farmácia',
      cidade: 'Curitiba', qtd_lojas: 2, sistema_atual: 'Concorrente X',
      responsavel_nome: 'João', temperatura: 'QUENTE', observacoes_comerciais: 'Dor: suporte lento',
    })).toBe(100);
  });

  it('lead com metade dos campos fica perto de 50%', () => {
    const pct = calcularCompletude({
      telefone: '11999999999', email: 'a@a.com', segmento: 'Farmácia', cidade: 'Curitiba',
    });
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(60);
  });

  it('aceita valores alternativos (responsavel_telefone/responsavel_email) para os mesmos critérios', () => {
    expect(calcularCompletude({
      responsavel_telefone: '11988887777', responsavel_email: 'b@b.com', segmento: 'Farmácia',
      cidade: 'Curitiba', qtd_lojas: 3, sistema_atual: 'Concorrente Y',
      responsavel_nome: 'Maria', probabilidade: 50, observacoes_comerciais: 'Interessado',
    })).toBe(100);
  });

  it('temperatura FRIO sozinha não conta como critério preenchido (precisa não-FRIO ou probabilidade)', () => {
    const semTemperaturaUtil = calcularCompletude({ temperatura: 'FRIO' });
    const comProbabilidade = calcularCompletude({ probabilidade: 10 });
    expect(semTemperaturaUtil).toBe(0);
    expect(comProbabilidade).toBeGreaterThan(0);
  });

  it('arredonda para inteiro', () => {
    const pct = calcularCompletude({ telefone: '11999999999' });
    expect(Number.isInteger(pct)).toBe(true);
  });
});
