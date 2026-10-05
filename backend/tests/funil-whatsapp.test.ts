import { describe, it, expect } from 'vitest';
import { deveIrParaInteressados, sinaisDeInteresse } from '../src/lib/funil-whatsapp';

const agora = new Date('2026-10-05T15:00:00Z');
const base = { estagio_funil: 'NOVO_CONTATO', ultima_entrada: new Date('2026-10-04T12:00:00Z'), ia_sugestao: { intencao: 'comprar' } };

describe('fase Interessados do WhatsApp', () => {
  it('interesse + mensagem do contato nos últimos 7 dias entra', () => {
    expect(deveIrParaInteressados(base, agora)).toBe(true);
    expect(deveIrParaInteressados({ ...base, ia_sugestao: { intencao: 'outro', qualificacao: 'morno' } }, agora)).toBe(true);
    expect(deveIrParaInteressados({ ...base, ia_sugestao: null, lead_temperatura: 'QUENTE' }, agora)).toBe(true);
  });
  it('sem interesse, ou sem falar há mais de 7 dias, não entra', () => {
    expect(deveIrParaInteressados({ ...base, ia_sugestao: { intencao: 'suporte', qualificacao: 'frio' }, lead_temperatura: 'FRIO' }, agora)).toBe(false);
    expect(deveIrParaInteressados({ ...base, ultima_entrada: new Date('2026-09-27T12:00:00Z') }, agora)).toBe(false);
    expect(deveIrParaInteressados({ ...base, ultima_entrada: null }, agora)).toBe(false);
  });
  it('nunca puxa quem a equipe já moveu, nem cliente, equipe, finalizado ou quem saiu das campanhas', () => {
    expect(deveIrParaInteressados({ ...base, estagio_funil: 'EM_NEGOCIACAO' }, agora)).toBe(false);
    expect(deveIrParaInteressados({ ...base, tipo_contato: 'CLIENTE' }, agora)).toBe(false);
    expect(deveIrParaInteressados({ ...base, etiqueta: 'Suporte' }, agora)).toBe(false);
    expect(deveIrParaInteressados({ ...base, finalizada_em: agora }, agora)).toBe(false);
    expect(deveIrParaInteressados({ ...base, optout_campanhas: true }, agora)).toBe(false);
    expect(deveIrParaInteressados({ ...base, tipo_contato: 'LEAD' }, agora)).toBe(true);
  });
  it('lista os sinais encontrados', () => {
    expect(sinaisDeInteresse({ ...base, ia_sugestao: { intencao: 'comprar', qualificacao: 'quente' }, lead_temperatura: 'MORNO' })).toEqual(['quer comprar', 'qualificação quente', 'lead morno']);
  });
});
