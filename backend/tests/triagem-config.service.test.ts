import { describe, it, expect } from 'vitest';
import { obterConfigTriagem, salvarConfigTriagem, materialVazio } from '../src/services/triagem-config.service';

function prismaFalso(inicial: Record<string, string> = {}) {
  const linhas = new Map(Object.entries(inicial).map(([chave, valor]) => [chave, { chave, valor }]));
  return {
    linhas,
    configuracaoIntegracao: {
      findMany: async ({ where }: any) => [...linhas.values()].filter(l => where.chave.in.includes(l.chave)),
      upsert: async ({ where, create, update }: any) => { const n = linhas.has(where.chave) ? { ...linhas.get(where.chave), ...update } : create; linhas.set(where.chave, n); return n; },
    },
  };
}

describe('triagem-config', () => {
  it('padrão: desligada e sem material', async () => {
    const c = await obterConfigTriagem(prismaFalso() as any);
    expect(c.ativa).toBe(false);
    expect(c.material.farmacia).toEqual({ texto: '', imagem: null, pdf: null, pdf_nome: null });
    expect(materialVazio(c.material.padaria)).toBe(true);
  });
  it('salva e lê de volta', async () => {
    const p = prismaFalso();
    const cfg = { ativa: true, material: { farmacia: { texto: 'Veja: https://x', imagem: null, pdf: 'data:application/pdf;base64,AA', pdf_nome: 'catalogo.pdf' }, padaria: { texto: '', imagem: null, pdf: null, pdf_nome: null } } };
    await salvarConfigTriagem(p as any, cfg, 'u1');
    expect(p.linhas.get('whatsapp.triagem.ativa')?.valor).toBe('true');
    const lida = await obterConfigTriagem(p as any);
    expect(lida).toEqual(cfg);
    expect(materialVazio(lida.material.farmacia)).toBe(false);
  });
  it('JSON corrompido vira material vazio', async () => {
    const c = await obterConfigTriagem(prismaFalso({ 'whatsapp.triagem.material.farmacia': '{quebrado' }) as any);
    expect(c.material.farmacia.texto).toBe('');
  });
});
