import { describe, it, expect } from 'vitest';
import { montarResumoLeads, rotuloOrigem } from '../src/lib/leads-resumo';

const d = (s: string) => new Date(`${s}T12:00:00-03:00`);
const lead = (o: any) => ({ origem: 'WHATSAPP', status: 'NOVO', etapa_comercial: 'NOVO_LEAD', temperatura: 'FRIO', responsavel_id: 'v1', created_at: d('2026-10-02'), updated_at: d('2026-10-02'), ...o });

describe('origem do lead em português', () => {
  it('junta variações da mesma origem', () => {
    expect(rotuloOrigem('PROSPECCAO')).toBe('Prospecção');
    expect(rotuloOrigem('Prospecção ativa')).toBe('Prospecção');
    expect(rotuloOrigem('CAMPANHA_PADARIA_2025_2026')).toBe('Campanhas');
    expect(rotuloOrigem('IMPORTACAO_CSV_MKT')).toBe('Lista importada (marketing)');
    expect(rotuloOrigem('Indicação')).toBe('Indicação');
    expect(rotuloOrigem('INDICACAO')).toBe('Indicação');
    expect(rotuloOrigem(null)).toBe('Outros');
    expect(rotuloOrigem('FORMULARIO_BLOG')).toBe('Formulário do site/blog');
  });
});

describe('resumo de leads para o CEO', () => {
  const agora = d('2026-10-06');
  const leads = [
    lead({ origem: 'PROSPECCAO', etapa_comercial: 'QUALIFICADO', temperatura: 'QUENTE' }),
    lead({ origem: 'Prospecção ativa', created_at: d('2026-09-10') }),
    lead({ origem: 'WHATSAPP', status: 'GANHO', etapa_comercial: 'FECHADO', created_at: d('2026-09-01'), updated_at: d('2026-10-03') }),
    lead({ origem: 'WHATSAPP', status: 'PERDIDO', etapa_comercial: 'PERDIDO', created_at: d('2026-09-05'), updated_at: d('2026-09-20') }),
    lead({ origem: 'IMPORTACAO_CSV_MKT', created_at: d('2025-12-01'), etapa_comercial: 'FUP_TENT_1', responsavel_id: 'v2' }),
  ];
  const perdas = [{ motivo: 'PRECO', created_at: d('2026-09-20') }, { motivo: 'PRECO', created_at: d('2026-08-20') }, { motivo: 'SEM_RETORNO', created_at: d('2026-09-21') }];
  const nomes = { v1: 'Jessica Cardoso', v2: 'Ana Clara' };
  const r = montarResumoLeads(leads, perdas, nomes, agora);

  it('totais do mês e da base', () => {
    expect(r.totais).toEqual({ base: 5, ativos: 3, novos_mes: 1, novos_mes_anterior: 3, ganhos_mes: 1, perdidos_mes: 0, conversao_90d_pct: 25 });
  });

  it('ativos por etapa, na ordem do funil, com follow-ups juntos', () => {
    expect(r.por_etapa).toEqual([
      { etapa: 'Novo lead', ativos: 1 }, { etapa: 'Qualificado', ativos: 1 }, { etapa: 'Follow-up', ativos: 1 },
    ]);
  });

  it('por origem: captados nos últimos 12 meses, ativos, ganhos e conversão', () => {
    // empate em captados: quem converteu mais vem antes
    expect(r.por_origem.map(o => o.origem).slice(0, 2)).toEqual(['WhatsApp', 'Prospecção']);
    expect(r.por_origem.find(o => o.origem === 'Prospecção')).toEqual({ origem: 'Prospecção', captados: 2, ativos: 2, ganhos: 0, conversao_pct: 0 });
    expect(r.por_origem.find(o => o.origem === 'WhatsApp')).toEqual({ origem: 'WhatsApp', captados: 2, ativos: 0, ganhos: 1, conversao_pct: 50 });
  });

  it('últimos 6 meses: captados, ganhos e perdidos', () => {
    expect(r.por_mes.at(-1)).toEqual({ mes: '2026-10', captados: 1, ganhos: 1, perdidos: 0 });
    expect(r.por_mes.at(-2)).toEqual({ mes: '2026-09', captados: 3, ganhos: 0, perdidos: 1 });
    expect(r.por_mes).toHaveLength(6);
  });

  it('temperatura dos ativos, vendedores e motivos de perda dos últimos 90 dias', () => {
    expect(r.por_temperatura).toEqual([{ temperatura: 'Frio', ativos: 2 }, { temperatura: 'Quente', ativos: 1 }]);
    expect(r.por_vendedor).toEqual([
      { vendedor: 'Jessica Cardoso', ativos: 2, novos_mes: 1, ganhos_mes: 1 },
      { vendedor: 'Ana Clara', ativos: 1, novos_mes: 0, ganhos_mes: 0 },
    ]);
    expect(r.motivos_perda).toEqual([{ motivo: 'Preço', qtd: 2 }, { motivo: 'Sem retorno', qtd: 1 }]);
  });
});
