import { describe, it, expect } from 'vitest';
import { montarHtmlResumoExecutivo, assuntoResumoExecutivo } from '../src/lib/resumo-executivo';

const dados = {
  tela1: {
    negociacoes: { total: 5, valor_potencial: 12000, com_proposta_enviada: 2 },
    faturamento_mes: { valor: 3000, meta: null, pct: null },
    contratos: { hoje: 1, mes: 3, ticket_medio_mes: 1000 },
    leads_acumulados: 40,
    leads_novos_hoje: { total: 4, por_origem: { WHATSAPP: 3, MANUAL: 1 } },
    qualificados_hoje: { total: null, pela_triagem: 2 },
    conversas_iniciadas: { total: 6, pelo_cliente: 5, pela_equipe: 1 },
    conversas_respondidas: { total: 5, tempo_medio_primeira_resposta_min: 7 },
    sem_resposta: { total: 1, fora_do_prazo: 0 },
    funil: [{ etapa: 'NOVO', nome: 'Novo contato', total: 10 }],
    equipe: [{ nome: 'Ana', cargo: 'SDR', conversas_respondidas: 3, propostas_criadas: 0, contratos: 0, atividades: { concluidas: 2, pendentes: 0, atrasadas: 1 } }],
    alertas: { conversas_fora_do_prazo: 0, propostas_paradas: 2, leads_para_distribuir: 0, cnpj_irregular_hoje: 0 },
  },
  tela2: {
    ano: 2026, mes_atual: 3,
    contratos_ano: { valor: 10, meta: 60, pct: 16.7, por_mes: 3.3, necessario_por_mes: 5.6 },
    crosssell_ano: { valor: 0, meta: null, pct: null, vendas: 0, clientes: 0 },
    ticket_medio_instalacao: 1500, ticket_medio_mensalidade: 350, mrr_novo_ano: 3500,
    conversao_proposta_contrato_pct: 50, ciclo_medio_dias: 5,
    faturamento_ano: { total: 15000 },
    contratos_por_segmento: [{ segmento: 'Padaria', total: 4, pct: 40 }, { segmento: 'Varejo', total: 0, pct: 0 }],
    contratos_por_mes: [4, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

describe('resumo executivo', () => {
  it('assunto traz leads e contratos do dia', () => {
    expect(assuntoResumoExecutivo(dados, '24/09/2026')).toBe('📊 Resumo executivo 24/09/2026: 4 lead(s) novo(s), 1 contrato(s) hoje');
  });
  it('html tem o dia, os alertas e os acumulados do ano', () => {
    const h = montarHtmlResumoExecutivo(dados, 'quinta, 24/09/2026', 'https://crm/tv');
    expect(h).toContain('3 WhatsApp · 1 manual');
    expect(h).toContain('2 proposta(s) parada(s)');
    expect(h).toContain('Acumulado de 2026');
    expect(h).toContain('de 60 (16,7%)');
    expect(h).toContain('jan 4 · fev 2 · mar 4');
    expect(h).toContain('Ana (SDR)');
    expect(h).not.toContain('Varejo'); // segmento sem contrato não aparece
  });
});
