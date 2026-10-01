'use client';

// Aba "Gráficos" de Churn & Retenção: recuperados x perdidos mês a mês, valores (mensalidade) perdidos
// e salvos, melhor mês de recuperação, pior mês de perda e motivos. Dados de /casos-churn/graficos.

import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { apiClient } from '@/lib/api-client';

type Mes = { mes: number; abertos: number; recuperados: number; perdidos: number; valor_perdido: number; valor_recuperado: number; divida_perdida: number };
type Dados = {
  ano: number; anos: number[]; meses: Mes[];
  totais: { recuperados: number; perdidos: number; valor_perdido: number; valor_recuperado: number; abertos: number; taxa_recuperacao: number | null };
  melhor_mes_recuperacao: number | null; pior_mes_perda: number | null;
  motivos: { motivo: string; perdidos: number; recuperados: number }[];
};

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const NOMES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const VERDE = '#16a34a', VERMELHO = '#dc2626', AZUL = '#2563eb';

function Kpi({ rot, valor, sub, cor }: { rot: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="ps-card rounded-2xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-muted)' }}>{rot}</p>
      <p className="text-2xl font-extrabold mt-1" style={{ color: cor || 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{sub}</p>}
    </div>
  );
}

function Painel({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="ps-card rounded-2xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
      <p className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>{titulo}</p>
      {nota && <p className="text-xs mb-3" style={{ color: 'var(--t-text-muted)' }}>{nota}</p>}
      {children}
    </div>
  );
}

export default function GraficosChurn() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    setErro(false);
    apiClient.client.get('/casos-churn/graficos', { params: { ano } }).then(r => setD(r.data.data)).catch(() => setErro(true));
  }, [ano]);

  if (erro) return <p className="text-sm py-10 text-center">Não consegui carregar os gráficos. Recarregue a página.</p>;
  if (!d) return <p className="text-sm py-10 text-center">Carregando gráficos…</p>;

  const serie = d.meses.map(m => ({ ...m, nome: NOMES[m.mes - 1], saldo: m.recuperados - m.perdidos }));
  const t = d.totais;
  const eixo = { fontSize: 11, fill: 'var(--t-text-muted)' } as any;
  const anos = d.anos.length ? d.anos : [ano];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold">Resultado da retenção em {d.ano}</p>
          <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Casos contados no mês em que foram resolvidos. Valores pela mensalidade do cliente.</p>
        </div>
        <select value={ano} onChange={e => setAno(Number(e.target.value))} aria-label="Ano" className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          {[...new Set([...anos, new Date().getFullYear()])].sort((a, b) => b - a).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi rot="Recuperados" valor={String(t.recuperados)} sub={`${brl(t.valor_recuperado)}/mês salvos`} cor={VERDE} />
        <Kpi rot="Perdidos" valor={String(t.perdidos)} sub={`${brl(t.valor_perdido)}/mês perdidos`} cor={VERMELHO} />
        <Kpi rot="Taxa de recuperação" valor={t.taxa_recuperacao == null ? '—' : `${t.taxa_recuperacao}%`} sub="recuperados ÷ casos resolvidos" cor={AZUL} />
        <Kpi rot="Melhor mês" valor={d.melhor_mes_recuperacao ? NOMES_LONGOS[d.melhor_mes_recuperacao - 1] : '—'}
          sub={d.pior_mes_perda ? `mais perdas em ${NOMES_LONGOS[d.pior_mes_perda - 1]}` : 'sem perdas no ano'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Painel titulo="Recuperados x perdidos, mês a mês" nota="Quantidade de casos resolvidos em cada mês.">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serie} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
              <XAxis dataKey="nome" tick={eixo} />
              <YAxis allowDecimals={false} tick={eixo} />
              <Tooltip formatter={(v: any, n: any) => [`${v} casos`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="recuperados" name="Recuperados" fill={VERDE} radius={[4, 4, 0, 0]} />
              <Bar dataKey="perdidos" name="Perdidos" fill={VERMELHO} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Painel>

        <Painel titulo="Valores perdidos e salvos por mês" nota="Mensalidade dos clientes que saíram x dos que ficaram.">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serie} margin={{ top: 5, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
              <XAxis dataKey="nome" tick={eixo} />
              <YAxis tick={eixo} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))} />
              <Tooltip formatter={(v: any, n: any) => [brl(Number(v)), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="valor_recuperado" name="Salvo (mensalidade)" fill={VERDE} radius={[4, 4, 0, 0]} />
              <Bar dataKey="valor_perdido" name="Perdido (mensalidade)" fill={VERMELHO} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Painel>

        <Painel titulo="Casos abertos x resolvidos" nota="Entrada de novos casos de risco e o saldo do mês (recuperados menos perdidos).">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={serie} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
              <XAxis dataKey="nome" tick={eixo} />
              <YAxis allowDecimals={false} tick={eixo} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="abertos" name="Abertos no mês" stroke={AZUL} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="saldo" name="Saldo (rec. − perd.)" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Painel>

        <Painel titulo="Motivos mais comuns" nota="Casos resolvidos no ano, por motivo principal.">
          {d.motivos.length === 0 ? <p className="text-sm py-8 text-center">Sem casos resolvidos neste ano.</p> : (
            <div className="space-y-2">
              {d.motivos.map(m => {
                const totalM = m.perdidos + m.recuperados;
                const max = Math.max(...d.motivos.map(x => x.perdidos + x.recuperados));
                return (
                  <div key={m.motivo}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="truncate pr-2" style={{ color: 'var(--t-text-secondary)' }}>{m.motivo}</span>
                      <span style={{ color: 'var(--t-text-muted)', whiteSpace: 'nowrap' }}><b style={{ color: VERDE }}>{m.recuperados}</b> rec · <b style={{ color: VERMELHO }}>{m.perdidos}</b> perd</span>
                    </div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--t-card-border)', width: `${Math.max(8, (totalM / max) * 100)}%` }}>
                      <span style={{ width: `${(m.recuperados / totalM) * 100}%`, background: VERDE }} />
                      <span style={{ width: `${(m.perdidos / totalM) * 100}%`, background: VERMELHO }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Painel>
      </div>

      <Painel titulo="Mês a mês" nota="Os mesmos números em tabela.">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm" style={{ minWidth: 640, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr className="text-xs uppercase" style={{ color: 'var(--t-text-muted)' }}>
              <th className="text-left py-2">Mês</th><th className="text-right">Abertos</th><th className="text-right">Recuperados</th><th className="text-right">Perdidos</th><th className="text-right">Salvo/mês</th><th className="text-right">Perdido/mês</th><th className="text-right">Dívida perdida</th>
            </tr></thead>
            <tbody>
              {serie.map(m => (
                <tr key={m.mes} style={{ borderTop: '1px solid var(--t-card-border)' }}>
                  <td className="py-1.5 capitalize">{NOMES_LONGOS[m.mes - 1]}</td>
                  <td className="text-right">{m.abertos}</td>
                  <td className="text-right" style={{ color: m.recuperados ? VERDE : undefined }}>{m.recuperados}</td>
                  <td className="text-right" style={{ color: m.perdidos ? VERMELHO : undefined }}>{m.perdidos}</td>
                  <td className="text-right">{brl(m.valor_recuperado)}</td>
                  <td className="text-right">{brl(m.valor_perdido)}</td>
                  <td className="text-right">{brl(m.divida_perdida)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
    </div>
  );
}
