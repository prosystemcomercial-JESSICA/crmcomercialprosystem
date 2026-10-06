'use client';

// Leads em números (aba "Leads" do Painel do CEO): no lugar da Central de Leads,
// só os dados — base, mês, funil, origem, últimos 6 meses, temperatura, vendedores e perdas.

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Barra, CSS_CEO, Numero, Variacao, nf, painel, secao } from './blocosCeo';

// Paleta categórica validada (2 séries): captados, ganhos.
const COR = { captados: '#2a78d6', ganhos: '#eb6834' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function LeadsCEO() {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { apiClient.getLeadsResumoCEO().then(r => setD(r.data.data)).catch((e: any) => setErro(e?.response?.data?.message || 'Não foi possível carregar os leads.')); }, []);
  if (erro) return <div style={{ ...painel, padding: 16, color: '#dc2626', fontSize: 13 }}>{erro}</div>;
  if (!d) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={20} /></div>;
  const t = d.totais;
  const maxEtapa = Math.max(1, ...d.por_etapa.map((e: any) => e.ativos));
  const maxMotivo = Math.max(1, ...d.motivos_perda.map((m: any) => m.qtd));
  const meses = d.por_mes.map((m: any) => ({ ...m, rot: `${MESES[Number(m.mes.slice(5, 7)) - 1]}/${m.mes.slice(2, 4)}` }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <style>{CSS_CEO}</style>
      <div style={{ ...painel, padding: 16 }} className="ceo-grid ceo-g4">
        <Numero l="Leads em aberto" v={nf(t.ativos)} s={`de ${nf(t.base)} na base`} />
        <Numero l="Novos neste mês" v={nf(t.novos_mes)} s={<Variacao atual={t.novos_mes} anterior={t.novos_mes_anterior} />} />
        <Numero l="Ganhos / perdidos no mês" v={`${nf(t.ganhos_mes)} / ${nf(t.perdidos_mes)}`} cor={t.ganhos_mes ? '#16a34a' : undefined} />
        <Numero l="Conversão (últimos 90 dias)" v={`${t.conversao_90d_pct}%`} s="leads criados que viraram venda" />
      </div>

      <div className="ceo-grid ceo-g2">
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={secao}>Onde estão os leads em aberto (etapa)</div>
          {d.por_etapa.map((e: any) => <Barra key={e.etapa} l={e.etapa} v={e.ativos} max={maxEtapa} />)}
        </section>
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, minWidth: 0 }}>
          <div style={secao}>Captados × ganhos (últimos 6 meses)</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--t-card-border)" />
                <XAxis dataKey="rot" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} />
                <YAxis width={40} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} />
                <Tooltip cursor={{ fill: '#2E6EAB0f' }} contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="captados" name="Captados" fill={COR.captados} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="ganhos" name="Ganhos" fill={COR.ganhos} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section style={{ ...painel, padding: 16, display: 'grid', gap: 10 }}>
        <div style={secao}>De onde vêm os leads (últimos 12 meses)</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ceo-tab">
            <thead><tr><th>Origem</th><th className="n">Captados</th><th className="n">Em aberto</th><th className="n">Ganhos</th><th className="n">Conversão</th></tr></thead>
            <tbody>{d.por_origem.map((o: any) => (
              <tr key={o.origem}><td>{o.origem}</td><td className="n">{nf(o.captados)}</td><td className="n">{nf(o.ativos)}</td><td className="n">{nf(o.ganhos)}</td><td className="n">{o.conversao_pct}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <div className="ceo-grid ceo-g3">
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
          <div style={secao}>Vendedores</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ceo-tab">
              <thead><tr><th>Vendedor</th><th className="n">Em aberto</th><th className="n">Novos no mês</th><th className="n">Ganhos no mês</th></tr></thead>
              <tbody>{d.por_vendedor.map((v: any) => <tr key={v.vendedor}><td>{v.vendedor}</td><td className="n">{nf(v.ativos)}</td><td className="n">{nf(v.novos_mes)}</td><td className="n">{nf(v.ganhos_mes)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={secao}>Temperatura dos leads em aberto</div>
          {d.por_temperatura.map((x: any) => <Barra key={x.temperatura} l={x.temperatura} v={x.ativos} max={Math.max(1, ...d.por_temperatura.map((y: any) => y.ativos))} />)}
        </section>
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={secao}>Por que perdemos (últimos 90 dias)</div>
          {d.motivos_perda.length ? d.motivos_perda.map((m: any) => <Barra key={m.motivo} l={m.motivo} v={m.qtd} max={maxMotivo} />) : <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma perda registrada no período.</span>}
        </section>
      </div>
    </div>
  );
}
