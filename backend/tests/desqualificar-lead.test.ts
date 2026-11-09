import { describe, it, expect } from 'vitest';
import { desqualificarLead } from '../src/services/whatsapp-vinculo.service';

// Banco falso: guarda o que cada tabela recebeu.
function bancoFalso() {
  const g: any = { lead: null, sql: [] as any[][], obs: null, sdr: null, conversa: null };
  const prisma: any = {
    lead: { update: async (q: any) => { g.lead = q; } },
    $executeRawUnsafe: async (...args: any[]) => { g.sql.push(args); return 1; },
    leadObservacao: { create: async (q: any) => { g.obs = q; } },
    sdrLead: { updateMany: async (q: any) => { g.sdr = q; return { count: 1 }; } },
    whatsappConversa: { update: async (q: any) => { g.conversa = q; } },
  };
  return { prisma, g };
}

const lead = { id: 'l1', nome: 'Farmácia Teste', etapa_comercial: 'EM_CONTATO', etapa_funil: 'NOVO', valor_estimado: 400, motivo_perda: null };

describe('desqualificar lead pelo WhatsApp', () => {
  it('marca perdido com o motivo, registra em LeadPerda com quem fez e tira os agentes', async () => {
    const { prisma, g } = bancoFalso();
    const m = await desqualificarLead(prisma, 'c1', lead, 'FORA_DO_PERFIL', 'é distribuidora', { id: 'u1', nome: 'Jessica' });
    expect(m).toBe('FORA_DO_PERFIL: é distribuidora');
    expect(g.lead.data).toMatchObject({ etapa_comercial: 'PERDIDO', status: 'PERDIDO', motivo_perda: 'FORA_DO_PERFIL: é distribuidora' });
    const perda = g.sql.find((a: any[]) => String(a[0]).includes('INSERT INTO LeadPerda'));
    expect(perda.slice(2)).toEqual(['l1', 'Farmácia Teste', 'EM_CONTATO', 'PERDIDO', 'FORA_DO_PERFIL', 'é distribuidora', 'Desqualificado pela tela de WhatsApp.', 400, 'u1', 'Jessica']);
    expect(g.sql.some((a: any[]) => String(a[0]).includes('LeadHistorico'))).toBe(true);
    expect(g.sdr.data).toEqual({ status: 'HUMANO' });
    expect(g.conversa).toMatchObject({ where: { id: 'c1' }, data: { bot_ativo: false, cadencia_proximo_envio: null } });
  });

  it('sem detalhe, guarda só a chave do motivo (mesmo formato da tela de Leads)', async () => {
    const { prisma, g } = bancoFalso();
    expect(await desqualificarLead(prisma, 'c1', lead, 'PRECO', undefined, null)).toBe('PRECO');
    expect(g.lead.data.motivo_perda).toBe('PRECO');
  });
});
