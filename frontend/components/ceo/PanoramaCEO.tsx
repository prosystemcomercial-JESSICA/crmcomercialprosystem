'use client';

// Panorama do Painel do CEO: a primeira tela. Seis blocos, cada um responde uma pergunta
// em linguagem simples e leva ao detalhe (aba do painel ou tela dedicada).
// Usa o que o Dashboard já carregou (kpis, relatório comercial, painel CEO) e busca
// cross-sell (ano), leads em números e Painel da IA (30 dias).

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { BlocoPanorama, CSS_CEO, Numero, Variacao, brl0, nf } from './blocosCeo';

type Props = { data: any; relatorioComercial: any; nrr: number | null; irPara: (aba: string) => void };

export function PanoramaCEO({ data, relatorioComercial, nrr, irPara }: Props) {
  const [cross, setCross] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [ia, setIa] = useState<any>(null);
  useEffect(() => {
    apiClient.getDashboardCrossSell().then(r => setCross(r.data.data)).catch(() => {});
    apiClient.getLeadsResumoCEO().then(r => setLeads(r.data.data)).catch(() => {});
    apiClient.getPainelIa('30d').then(r => setIa(r.data.data)).catch(() => {});
  }, []);
  const k = data?.kpis || {};
  const es = relatorioComercial?.metricas?.entrada_x_saida;
  const fech = relatorioComercial?.metricas?.fechamentos?.total || 0;
  const perd = relatorioComercial?.metricas?.perdidos?.total || 0;
  const winRate = fech + perd ? Math.round((fech / (fech + perd)) * 100) : null;
  const ano = new Date().getFullYear();
  const origemTop = leads?.por_origem?.[0];

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <style>{CSS_CEO}</style>
      <div className="ceo-grid ceo-g3">
        <BlocoPanorama titulo="Receita recorrente" pergunta="Quanto entra todo mês e se está crescendo" acao="Ver retenção e financeiro" onAcao={() => irPara('retencao')}>
          <Numero l="MRR (mensalidades)" v={brl0(k.mrr)} s={k.mrr_delta != null ? <span><b style={{ color: k.mrr_delta >= 0 ? '#16a34a' : '#dc2626' }}>{k.mrr_delta >= 0 ? '↑' : '↓'} {Math.abs(k.mrr_delta)}%</b> vs. mês anterior</span> : undefined} />
          <Numero l="Saldo de MRR no mês" v={es ? brl0(es.saldo_mrr) : '—'} cor={es ? (es.saldo_mrr >= 0 ? '#16a34a' : '#dc2626') : undefined} s="entrou − saiu" />
          <Numero l="Contratos ativos" v={nf(k.contratos_ativos)} s={`+${nf(k.contratos_mes)} neste mês`} />
          <Numero l="Retenção líquida (NRR)" v={nrr != null ? `${nrr}%` : '—'} cor={nrr != null ? (nrr >= 100 ? '#16a34a' : '#d97706') : undefined} s="acima de 100% = a base cresce sozinha" />
        </BlocoPanorama>

        <BlocoPanorama titulo="Vendas novas" pergunta="Quanto o time está vendendo neste mês" acao="Ver vendas e pipeline" onAcao={() => irPara('comercial')}>
          <Numero l="Leads que viraram venda" v={nf(k.leads_ganhos_mes)} s={`de ${nf(k.leads_mes)} captados no mês`} />
          <Numero l="Taxa de conversão" v={k.taxa_conversao != null ? `${k.taxa_conversao}%` : '—'} cor={k.taxa_conversao != null ? (k.taxa_conversao >= 20 ? '#16a34a' : '#d97706') : undefined} s="ganhos ÷ captados" />
          <Numero l="Propostas fechadas" v={winRate != null ? `${winRate}%` : '—'} s={`${nf(fech)} ganhas · ${nf(perd)} perdidas`} />
          <Numero l="Em negociação (pipeline)" v={brl0(k.pipeline_valor)} s={`${nf(k.propostas_abertas)} propostas abertas`} />
        </BlocoPanorama>

        <BlocoPanorama titulo="Leads" pergunta="Quantas oportunidades temos e de onde vêm" acao="Ver leads em números" onAcao={() => irPara('leads')}>
          <Numero l="Leads em aberto" v={leads ? nf(leads.totais.ativos) : '—'} />
          <Numero l="Novos neste mês" v={leads ? nf(leads.totais.novos_mes) : '—'} s={leads ? <Variacao atual={leads.totais.novos_mes} anterior={leads.totais.novos_mes_anterior} /> : undefined} />
          <Numero l="Conversão (90 dias)" v={leads ? `${leads.totais.conversao_90d_pct}%` : '—'} />
          <Numero l="Maior origem (12 meses)" v={origemTop ? origemTop.origem : '—'} s={origemTop ? `${nf(origemTop.captados)} leads · ${origemTop.conversao_pct}% viram venda` : undefined} />
        </BlocoPanorama>

        <BlocoPanorama titulo="Base de clientes" pergunta="Clientes entrando, saindo e satisfeitos" acao="Ver retenção e churn" onAcao={() => irPara('retencao')}>
          <Numero l="Clientes que entraram" v={es ? nf(es.clientes_entrada) : '—'} cor={es?.clientes_entrada ? '#16a34a' : undefined} s="neste mês" />
          <Numero l="Clientes que saíram" v={es ? nf(es.clientes_saida) : '—'} cor={es?.clientes_saida ? '#dc2626' : undefined} s="neste mês" />
          <Numero l="NPS" v={k.nps_score != null ? String(k.nps_score) : '—'} cor={k.nps_score != null ? (k.nps_score >= 50 ? '#16a34a' : '#d97706') : undefined} s="acima de 50 = clientes satisfeitos" />
          <Numero l="Ticket médio" v={k.contratos_ativos ? `${brl0(k.mrr / k.contratos_ativos)}/mês` : '—'} />
        </BlocoPanorama>

        <BlocoPanorama titulo={`Cross-sell e up-sell (${ano})`} pergunta="Quanto vendemos a mais para quem já é cliente" acao="Abrir Cross-sell & Up-sell" href="/cross-sell-ceo">
          <Numero l="MRR de expansão" v={cross ? brl0(cross.totais.mrr_expansao) : '—'} cor="#2E6EAB" s={cross ? `+${brl0(cross.totais.arr_expansao)} por ano` : undefined} />
          <Numero l="Receita única" v={cross ? brl0(cross.totais.receita_unica) : '—'} s="setup e serviços" />
          <Numero l="Vendas para a base" v={cross ? nf(cross.totais.vendas) : '—'} s={cross ? `${nf(cross.totais.clientes)} clientes` : undefined} />
          <Numero l="Mais vendido" v={cross?.por_tipo?.[0]?.rotulo || '—'} s={cross?.por_tipo?.[0] ? `${nf(cross.por_tipo[0].vendas)} vendas` : undefined} />
        </BlocoPanorama>

        <BlocoPanorama titulo="Agentes de IA (30 dias)" pergunta="Quanto do atendimento a IA já faz" acao="Abrir Painel da IA" href="/painel-ia">
          <Numero l="Feito pelos agentes" v={ia ? `${ia.resumo.automacao_pct}%` : '—'} cor="#2E6EAB" s={ia ? `${nf(ia.resumo.enviadas_agentes)} mensagens` : undefined} />
          <Numero l="Contatos novos" v={ia ? nf(ia.resumo.contatos_novos) : '—'} />
          <Numero l="Demonstrações marcadas" v={ia ? nf(ia.resumo.demos) : '—'} />
          <Numero l="Vendas fechadas" v={ia ? nf(ia.resumo.vendas_fechadas) : '—'} cor={ia?.resumo?.vendas_fechadas ? '#16a34a' : undefined} />
        </BlocoPanorama>
      </div>
    </div>
  );
}
