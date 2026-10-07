import { describe, it, expect } from 'vitest';
import { ehAdiamento, intervaloRetomadaAssumida } from '../src/lib/assistente/sdr';

describe('cliente avisou que ainda não pode (adiamento)', () => {
  it('reconhece CNPJ que ainda não saiu, "te chamo" e loja abrindo', () => {
    expect(ehAdiamento('Assim que sair o cnpj te chamo tá, eu tô pesquisando sistema')).toBe(true);
    expect(ehAdiamento('o CNPJ ainda não saiu')).toBe(true);
    expect(ehAdiamento('estou aguardando o cnpj')).toBe(true);
    expect(ehAdiamento('quando sair o CNPJ eu falo com vocês')).toBe(true);
    expect(ehAdiamento('vou abrir a farmácia mês que vem')).toBe(true);
    expect(ehAdiamento('a loja está em reforma, depois da inauguração conversamos')).toBe(true);
    expect(ehAdiamento('te aviso quando estiver tudo certo')).toBe(true);
  });
  it('continua reconhecendo viagem e "eu te chamo"', () => {
    expect(ehAdiamento('estou viajando')).toBe(true);
    expect(ehAdiamento('eu te chamo depois')).toBe(true);
  });
  it('não confunde conversa normal com adiamento', () => {
    expect(ehAdiamento('quero conhecer o sistema')).toBe(false);
    expect(ehAdiamento('qual o valor do plano?')).toBe(false);
    expect(ehAdiamento('meu cnpj é 12345678000199')).toBe(false);
  });
});

describe('quando retomar uma conversa assumida (dias úteis desde a nossa última mensagem)', () => {
  it('cliente que adiou: 3 dias úteis antes de cada retomada (nunca no mesmo dia)', () => {
    expect(intervaloRetomadaAssumida(0, true)).toBe(3);
    expect(intervaloRetomadaAssumida(1, true)).toBe(3);
    expect(intervaloRetomadaAssumida(2, true)).toBeNull();
  });
  it('cliente que só parou de responder: 1 e depois 3 dias úteis', () => {
    expect(intervaloRetomadaAssumida(0, false)).toBe(1);
    expect(intervaloRetomadaAssumida(1, false)).toBe(3);
    expect(intervaloRetomadaAssumida(2, false)).toBeNull();
  });
});
