'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api.dashboard().then(r => setD(r.data)).catch(e => setErro(e.message)); }, []);

  if (erro) return <Shell><div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div></Shell>;
  if (!d) return <Shell><p className="text-slate-400">Carregando indicadores…</p></Shell>;

  const mv = d.migracao_vs_zerado;
  const totalF2 = (mv.banco_zerado + mv.migracao_dados + mv.nao_definido) || 1;

  return (
    <Shell>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Dashboard Gerencial — Implantação</h2>

      {/* Linha de KPIs topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi titulo="Time-to-Value (TTV)" valor={d.ttv_medio_dias != null ? `${d.ttv_medio_dias} dias` : '—'} sub={`${d.ttv_amostra} go-lives`} cor="#2E6EAB" />
        <Kpi titulo="Taxa de Sucesso (mês)" valor={d.sucesso_mes} sub="clientes na Fase 3.4" cor="#16a34a" />
        <Kpi titulo="Em Implantação" valor={d.por_funil.IMPLANTACAO} sub="projetos ativos" cor="#d97706" />
        <Kpi titulo="Em Onboarding" valor={d.por_funil.ONBOARDING} sub="projetos ativos" cor="#7c3aed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gargalos técnicos atuais */}
        <Card titulo={`⚠️ Gargalos Técnicos Atuais (${d.gargalos.length})`}>
          {d.gargalos.length === 0 ? <p className="text-sm text-slate-400">Nenhum SLA estourado 🎉</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400"><th className="py-1">Cliente</th><th>Fase</th><th className="text-right">Dias / SLA</th></tr></thead>
              <tbody>
                {d.gargalos.map((g: any) => (
                  <tr key={g.id} className="border-t border-slate-100">
                    <td className="py-1.5 font-medium text-slate-800">{g.cliente_nome}</td>
                    <td className="text-slate-600">{g.fase}</td>
                    <td className="text-right font-semibold text-red-600">{g.dias_na_fase}d / {g.sla_dias}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Migração vs Zerado (barras) */}
        <Card titulo="🍩 Projetos em Migração vs Zerados (Funil 2)">
          <Barra label="Banco Zerado" valor={mv.banco_zerado} total={totalF2} cor="#2E6EAB" />
          <Barra label="Migração de Dados" valor={mv.migracao_dados} total={totalF2} cor="#d97706" />
          {mv.nao_definido > 0 && <Barra label="Não definido" valor={mv.nao_definido} total={totalF2} cor="#94a3b8" />}
        </Card>

        {/* Previsão de Go-Live */}
        <Card titulo={`🚀 Previsão de Go-Live (${d.previsao_golive.length})`}>
          {d.previsao_golive.length === 0 ? <p className="text-sm text-slate-400">Ninguém na fase de instalação/homologação.</p> : (
            <ul className="space-y-1.5 text-sm">
              {d.previsao_golive.map((p: any) => (
                <li key={p.id} className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-800">{p.cliente_nome}</span>
                  <span className="text-slate-400 text-xs">{p.tipo_implantacao === 'BANCO_ZERADO' ? 'Zerado' : p.tipo_implantacao === 'MIGRACAO_DADOS' ? 'Migração' : '—'} · {p.dias_na_fase}d</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Visão geral por funil */}
        <Card titulo="📊 Projetos ativos por funil">
          <Barra label="Comercial" valor={d.por_funil.COMERCIAL} total={Math.max(1, d.por_funil.COMERCIAL + d.por_funil.IMPLANTACAO + d.por_funil.ONBOARDING)} cor="#4B8EC8" />
          <Barra label="Implantação" valor={d.por_funil.IMPLANTACAO} total={Math.max(1, d.por_funil.COMERCIAL + d.por_funil.IMPLANTACAO + d.por_funil.ONBOARDING)} cor="#d97706" />
          <Barra label="Onboarding" valor={d.por_funil.ONBOARDING} total={Math.max(1, d.por_funil.COMERCIAL + d.por_funil.IMPLANTACAO + d.por_funil.ONBOARDING)} cor="#7c3aed" />
        </Card>
      </div>
    </Shell>
  );
}

function Kpi({ titulo, valor, sub, cor }: { titulo: string; valor: any; sub: string; cor: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="text-2xl font-extrabold mt-1" style={{ color: cor }}>{valor}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}
function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm font-bold text-slate-800 mb-3">{titulo}</p>{children}</div>;
}
function Barra({ label, valor, total, cor }: { label: string; valor: number; total: number; cor: string }) {
  const pct = Math.round((valor / total) * 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">{label}</span><span className="font-semibold" style={{ color: cor }}>{valor} ({pct}%)</span></div>
      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: cor }} /></div>
    </div>
  );
}
