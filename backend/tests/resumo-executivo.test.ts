import { describe, it, expect } from 'vitest';
import {
  montarHtmlResumoExecutivo, assuntoResumoExecutivo, calcularEficiencia, tipoResumoDoDia, montarHtmlResumoSemanal, assuntoResumoSemanal,
} from '../src/lib/resumo-executivo';

describe('calcularEficiencia', () => {
  const agora = new Date('2026-09-25T20:00:00Z');
  const at = (status: string, prazo: string | null, feita: string | null = null) =>
    ({ responsavel_id: 'u', status, titulo: 't', tipo: 'TAREFA', data_prevista: prazo ? new Date(prazo) : null, data_realizada: feita ? new Date(feita) : null });
  it('no prazo ÷ (no prazo + concluídas com atraso + vencidas em aberto)', () => {
    const e = calcularEficiencia([
      at('REALIZADA', '2026-09-24T12:00:00Z', '2026-09-24T10:00:00Z'), // no prazo
      at('REALIZADA', '2026-09-23T12:00:00Z', '2026-09-24T10:00:00Z'), // com atraso
      at('PENDENTE', '2026-09-25T10:00:00Z'),                          // vencida em aberto
      at('PENDENTE', '2026-09-26T10:00:00Z'),                          // ainda no prazo: não conta
      at('CANCELADA', '2026-09-22T10:00:00Z'),                         // ignorada
      at('REALIZADA', null, '2026-09-24T10:00:00Z'),                   // sem prazo: conta como no prazo
    ], agora);
    expect(e).toEqual({ no_prazo: 2, concluidas_atrasadas: 1, vencidas_abertas: 1, a_vencer: 1, eficiencia_pct: 50 });
  });
  it('sem atividades cobráveis → sem nota', () => {
    expect(calcularEficiencia([], agora).eficiencia_pct).toBeNull();
  });
});

describe('tipoResumoDoDia (fuso de São Paulo)', () => {
  it('seg–qui diário, sexta semanal, fim de semana nada', () => {
    expect(tipoResumoDoDia(new Date('2026-09-24T21:00:00Z'))).toBe('diario');  // quinta 18h
    expect(tipoResumoDoDia(new Date('2026-09-25T21:00:00Z'))).toBe('semanal'); // sexta 18h
    expect(tipoResumoDoDia(new Date('2026-09-26T21:00:00Z'))).toBeNull();      // sábado
    expect(tipoResumoDoDia(new Date('2026-09-27T21:00:00Z'))).toBeNull();      // domingo
    expect(tipoResumoDoDia(new Date('2026-09-26T02:00:00Z'))).toBe('semanal'); // ainda sexta 23h em SP
  });
});

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
  it('semanal traz eficiência por pessoa e as atividades concluídas', () => {
    const ef = { no_prazo: 3, concluidas_atrasadas: 1, vencidas_abertas: 0, a_vencer: 2, eficiencia_pct: 75 };
    const s = {
      periodo: '21/09 a 25/09', leads_novos: 9, por_origem: { WHATSAPP: 9 }, qualificados: 4, propostas_enviadas: 3,
      contratos: 2, faturamento_instalacao: 3000, conversas_iniciadas: 12, conversas_respondidas: 10,
      equipe: [{ nome: 'Ana', cargo: 'SDR', conversas_respondidas: 8, propostas: 0, contratos: 0, eficiencia: ef, concluidas: ['Ligar padaria X', 'Qualificar <lead>'] }],
      eficiencia_geral: ef,
    };
    expect(assuntoResumoSemanal(s)).toBe('📊 Resumo da semana (21/09 a 25/09): 2 contrato(s), 9 lead(s), eficiência 75%');
    const h = montarHtmlResumoSemanal(s, dados, 'https://crm/tv');
    expect(h).toContain('Ana (SDR)');
    expect(h).toContain('75%');
    expect(h).toContain('Qualificar &lt;lead&gt;');
    expect(h).toContain('Acumulado de 2026');
  });
});
