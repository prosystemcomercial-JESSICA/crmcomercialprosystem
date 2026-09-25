import { describe, it, expect } from 'vitest';
import { avancarTriagem, type DepsTriagem } from '../src/lib/triagem/fluxo';
import { lerEscolhaTriagem } from '../src/lib/laya';

const base: DepsTriagem = { consultarCnpj: async () => ({ status: 'indisponivel' } as any), temMaterial: () => false };

describe('triagem com Laya (opcional)', () => {
  it('sem Laya: texto livre que não casa repete a pergunta, como sempre', async () => {
    const r = await avancarTriagem('SEGMENTO', { fluxo: 'conhecer' }, { texto: 'vendo pão francês e bolo' }, base);
    expect(r.estado).toBe('SEGMENTO');
  });
  it('com Laya: aceita a opção que ela entendeu', async () => {
    const deps = { ...base, classificar: async () => 'padaria' };
    const r = await avancarTriagem('SEGMENTO', { fluxo: 'conhecer' }, { texto: 'vendo pão francês e bolo' }, deps);
    expect(r.estado).toBe('NOME');
    expect(r.dados.segmento).toBe('Padaria');
  });
  it('com Laya: resposta inválida ou falha cai no comportamento de hoje', async () => {
    const lixo = await avancarTriagem('MENU', {}, { texto: 'tudo bem?' }, { ...base, classificar: async () => 'qualquer' });
    expect(lixo.estado).toBe('MENU');
    const falha = await avancarTriagem('MENU', {}, { texto: 'tudo bem?' }, { ...base, classificar: async () => { throw new Error('x'); } });
    expect(falha.estado).toBe('MENU');
  });
  it('botão/apelido continuam vencendo a IA', async () => {
    let chamou = false;
    const r = await avancarTriagem('MENU', {}, { texto: 'suporte' }, { ...base, classificar: async () => { chamou = true; return 'conhecer'; } });
    expect(r.desfecho).toBe('suporte');
    expect(chamou).toBe(false);
  });
});

describe('lerEscolhaTriagem', () => {
  const res = (choice: string, confidence: number) => ({ answers: { q: { choice, confidence } } });
  it('exige confiança mínima e ignora nao_sei', () => {
    expect(lerEscolhaTriagem(res('padaria', 0.95), 0.8)).toBe('padaria');
    expect(lerEscolhaTriagem(res('padaria', 0.6), 0.8)).toBeNull();
    expect(lerEscolhaTriagem(res('nao_sei', 0.99), 0.8)).toBeNull();
    expect(lerEscolhaTriagem({}, 0.8)).toBeNull();
  });
});
