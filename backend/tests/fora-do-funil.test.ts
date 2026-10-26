import { describe, it, expect } from 'vitest';
import { dadosSairDoFunil } from '../src/services/whatsapp-vinculo.service';
import { contatoSemAgentes } from '../src/lib/laya';

// Banco falso: só o que as duas funções usam.
function bancoFalso(conversas: any[] = [], origemLead = 'WHATSAPP') {
  const chamadas: any = { leadApagado: false, sdrParados: null };
  const prisma: any = {
    lead: {
      findUnique: async () => ({ origem: origemLead }),
      update: async () => { chamadas.leadApagado = true; },
    },
    sdrLead: { updateMany: async (q: any) => { chamadas.sdrParados = q; return { count: 1 }; } },
    whatsappConversa: {
      findMany: async ({ where }: any) => conversas.filter(c => c.contato_numero.endsWith(where.contato_numero.endsWith)),
    },
  };
  return { prisma, chamadas };
}

describe('conversa tirada do funil', () => {
  it('desvincular pela equipe: marca fora do funil, para a cadência e tira o agente da conversa', async () => {
    const { prisma, chamadas } = bancoFalso();
    const d: any = await dadosSairDoFunil(prisma, { id: 'c1', lead_id: 'l1' }, { semAgentes: true });
    expect(d).toMatchObject({ lead_id: null, bot_ativo: false, bot_estado: null, cadencia_proxima_etapa: null, cadencia_proximo_envio: null });
    expect(d.fora_do_funil_em).toBeInstanceOf(Date);
    expect(chamadas.leadApagado).toBe(true);
    expect(chamadas.sdrParados).toEqual({ where: { conversaId: 'c1', status: { in: ['FILA', 'AGUARDANDO', 'CONVERSANDO'] } }, data: { status: 'HUMANO' } });
  });

  it('identificado como cliente: sai do funil sem marcar (o pós-venda continua)', async () => {
    const { prisma, chamadas } = bancoFalso();
    const d: any = await dadosSairDoFunil(prisma, { id: 'c1', lead_id: 'l1' });
    expect(d).toEqual({ lead_id: null, bot_ativo: false, bot_estado: null });
    expect(chamadas.sdrParados).toBeNull();
  });

  it('lead cadastrado à mão não é apagado', async () => {
    const { prisma, chamadas } = bancoFalso([], 'MANUAL');
    await dadosSairDoFunil(prisma, { id: 'c1', lead_id: 'l1' }, { semAgentes: true });
    expect(chamadas.leadApagado).toBe(false);
  });

  it('nenhum agente fala com número cuja conversa foi tirada do funil (com ou sem o 9)', async () => {
    const { prisma } = bancoFalso([{ contato_numero: '5527999998888', tipo_contato: null, etiqueta: null, fora_do_funil_em: new Date() }]);
    expect(await contatoSemAgentes(prisma, '552799998888')).toBe(true);
  });

  it('conversa comum continua com os agentes', async () => {
    const { prisma } = bancoFalso([{ contato_numero: '5527999998888', tipo_contato: 'LEAD', etiqueta: 'Farmácia', fora_do_funil_em: null }]);
    expect(await contatoSemAgentes(prisma, '5527999998888')).toBe(false);
  });
});
