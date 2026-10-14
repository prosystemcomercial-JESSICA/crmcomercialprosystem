import { describe, it, expect } from 'vitest';
import { normalPergunta, perguntarAJessica, perguntasParaJessica } from '../src/services/equipe.service';

// Painel do Rafael › Perguntas para você (14/10/2026).
function prismaFalso(notas: any[] = []) {
  return {
    agenteNota: {
      findMany: async ({ where }: any) => notas.filter(n => (!where?.tipo || (typeof where.tipo === 'string' ? n.tipo === where.tipo : where.tipo.in.includes(n.tipo))) && (where?.resolvida_em !== null || !n.resolvida_em) && (!where?.de || n.de === where.de)),
      create: async ({ data }: any) => { const n = { id: `n${notas.length + 1}`, created_at: new Date(), resolvida_em: null, ...data }; notas.push(n); return n; },
    },
  } as any;
}

describe('perguntas para a Jessica', () => {
  it('compara pergunta sem acento, pontuação nem caixa', () => {
    expect(normalPergunta('O sistema emite NFC-e?')).toBe(normalPergunta('o sistema emite nfc e'));
  });

  it('não repete pergunta já feita', async () => {
    const notas: any[] = [];
    const p = prismaFalso(notas);
    expect(await perguntarAJessica(p, { pergunta: 'O Farma Pro tem integração com iFood?', assunto: 'teste' })).toBeTruthy();
    expect(await perguntarAJessica(p, { pergunta: 'o farma pro tem integracao com ifood', assunto: 'teste' })).toBeNull();
    expect(notas.filter(n => n.tipo === 'PERGUNTA')).toHaveLength(1);
    expect(notas[0]).toMatchObject({ de: 'rafael', para: 'jessica' });
  });

  it('lista perguntas do Rafael antes das dúvidas e junta as repetidas', async () => {
    const agora = new Date();
    const p = prismaFalso([
      { id: 'd1', tipo: 'DUVIDA', de: 'caroline', assunto: 'a', texto: 'Tem app no celular?', ref: 'c1', created_at: agora, resolvida_em: null },
      { id: 'd2', tipo: 'DUVIDA', de: 'julio', assunto: 'b', texto: 'tem app no celular', ref: 'c2', created_at: agora, resolvida_em: null },
      { id: 'p1', tipo: 'PERGUNTA', de: 'rafael', assunto: 'c', texto: 'Qual o prazo de implantação?', ref: null, created_at: agora, resolvida_em: null },
    ]);
    const r = await perguntasParaJessica(p);
    expect(r.abertas.map((x: any) => x.id)).toEqual(['p1', 'd1']);
    expect(r.abertas[1].vezes).toBe(2);
  });
});
