import { describe, it, expect } from 'vitest';
import { palavrasDoCliente, vocabulario, casoParecido, nivelTarefa, historicoAcertos, gerarCaderno } from '../src/lib/laya-caderno';

const am = (cliente: string, rot: any, sug: any, i = 0) => ({ texto: `Cliente: ${cliente}\nEmpresa: ok`, rotulos: rot, sugestao: sug, created_at: new Date(2026, 8, 1, 0, i) });
const R = (segmento: string, intencao: string, cancelar = false) => ({ segmento, intencao, cancelar });
const S = (segmento: string, intencao: string, cancelar = 0) => ({ segmento, intencao, cancelar, urgencia: 0 });

describe('Caderno da Laya', () => {
  it('pega só as palavras do cliente, sem acento e sem palavras vazias', () => {
    expect(palavrasDoCliente('Cliente: Preciso da segunda via do BOLETO, obrigado\nEmpresa: claro')).toEqual(['segunda', 'boleto']);
  });

  it('vocabulário: palavras típicas de cada etiqueta', () => {
    const xs = [am('segunda via do boleto', R('farmacia', 'financeiro'), null), am('boleto venceu', R('padaria', 'financeiro'), null), am('quero orçamento balança', R('padaria', 'comprar'), null), am('orçamento sistema balança fermento', R('padaria', 'comprar'), null)];
    const v = vocabulario(xs, 'intencao');
    expect(v.financeiro).toContain('boleto');
    expect(v.comprar).toEqual(expect.arrayContaining(['balanca', 'orcamento']));
  });

  it('caso parecido acha o exemplo confirmado mais próximo', () => {
    const xs = [am('segunda via do boleto de setembro', R('farmacia', 'financeiro'), null), am('sistema travou no caixa agora', R('farmacia', 'suporte'), null)];
    const c = casoParecido('Cliente: manda a segunda via do boleto de outubro', xs, 'intencao');
    expect(c?.rotulo).toBe('financeiro');
    expect(c!.similaridade).toBeGreaterThanOrEqual(0.4);
  });

  it('níveis: aprendiz, assistente e titular', () => {
    expect(nivelTarefa(Array(20).fill(true)).nivel).toBe('aprendiz');
    expect(nivelTarefa([...Array(25).fill(true), ...Array(5).fill(false)]).nivel).toBe('assistente');
    expect(nivelTarefa([...Array(4).fill(false), ...Array(56).fill(true)]).nivel).toBe('titular');
    expect(nivelTarefa([...Array(40).fill(true), ...Array(20).fill(false)]).nivel).toBe('aprendiz');
  });

  it('histórico compara sugestão com a confirmação', () => {
    const xs = [am('a b c', R('farmacia', 'comprar'), S('farmacia', 'suporte'), 1), am('a b c', R('padaria', 'comprar'), S('padaria', 'comprar'), 2), am('x', { ignorar: true }, S('padaria', 'comprar'), 3)];
    expect(historicoAcertos(xs, 'segmento')).toEqual([true, true]);
    expect(historicoAcertos(xs, 'intencao')).toEqual([false, true]);
  });

  it('caderno traz níveis, definições e casos difíceis', () => {
    const md = gerarCaderno([am('sistema travou no caixa', R('farmacia', 'suporte'), S('farmacia', 'comprar'))], { intencao: { suporte: 'problema ou erro' } });
    expect(md).toContain('# Caderno da Laya');
    expect(md).toContain('**suporte**: problema ou erro');
    expect(md).toContain('era **suporte** (ela disse comprar)');
  });
});
