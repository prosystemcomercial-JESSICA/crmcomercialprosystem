'use client';

import { useEffect, useRef, useState } from 'react';

// Painel da TV do comercial — tela cheia, sem menu e sem login.
// Acesso: /tv?chave=<token gerado em Configurações> (ou gestão logada, p/ prévia).
// Busca os dados a cada 60 s e alterna tela 1 (dia) / tela 2 (ano) a cada 30 s.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INTERVALO_DADOS = 60_000;
const INTERVALO_TELA = 30_000;

type Progresso = { valor: number | null; meta: number | null; pct: number | null };

const brl = (n: number | null | undefined, compacto = false) => {
  if (n == null) return null;
  if (compacto && Math.abs(n) >= 100_000) return `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil`;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
};
const num = (n: number | null | undefined) => (n == null ? null : n.toLocaleString('pt-BR'));

const ICONE_FEED: Record<string, string> = { lead: '🆕', triagem: '💬', proposta: '📄', contrato: '✅', atividade: '✔' };
const ORIGEM: Record<string, string> = { WHATSAPP: 'WhatsApp', MANUAL: 'manuais', PROPOSTA: 'por proposta', RETROATIVO: 'retroativos', SITE: 'site', INDICACAO: 'indicação' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function SemDados() {
  return <span className="semdados">sem dados</span>;
}

function Valor({ v, classe }: { v: string | null; classe?: string }) {
  return <div className={`n ${classe || ''}`}>{v == null ? <SemDados /> : v}</div>;
}

function Barra({ p, cor }: { p: Progresso; cor?: string }) {
  if (p.meta == null) return <div className="s dica">defina a meta em Configurações</div>;
  const pct = p.pct ?? 0;
  return (
    <div className={`bar ${cor || ''}`}>
      <i style={{ width: `${Math.min(100, pct)}%` }} />
      <em>{pct.toLocaleString('pt-BR')}%</em>
    </div>
  );
}

export default function PainelTvPage() {
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<'invalido' | 'rede' | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [tela, setTela] = useState<1 | 2>(1);
  const [agora, setAgora] = useState<Date | null>(null);
  const chaveRef = useRef<string | null>(null);

  useEffect(() => {
    chaveRef.current = new URLSearchParams(window.location.search).get('chave');
    let ativo = true;

    const buscar = async () => {
      setAtualizando(true);
      try {
        const chave = chaveRef.current;
        const headers: Record<string, string> = {};
        // Sem chave: prévia da gestão logada (usa o token de sessão do CRM).
        if (!chave) {
          try { const t = localStorage.getItem('accessToken'); if (t) headers.Authorization = `Bearer ${t}`; } catch { /* sem storage */ }
        }
        const url = `${API_URL}/painel-tv/dados${chave ? `?chave=${encodeURIComponent(chave)}` : ''}`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!ativo) return;
        if (res.status === 401 || res.status === 403) { setErro('invalido'); return; }
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        setDados(json.data);
        setErro(null);
      } catch {
        if (ativo) setErro(e => (e === 'invalido' ? e : 'rede'));
      } finally {
        if (ativo) setAtualizando(false);
      }
    };

    buscar();
    const iDados = setInterval(buscar, INTERVALO_DADOS);
    const iTela = setInterval(() => setTela(t => (t === 1 ? 2 : 1)), INTERVALO_TELA);
    setAgora(new Date());
    const iRelogio = setInterval(() => setAgora(new Date()), 15_000);
    return () => { ativo = false; clearInterval(iDados); clearInterval(iTela); clearInterval(iRelogio); };
  }, []);

  const relogio = agora
    ? agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')
    : '';

  return (
    <div className="tv">
      <style>{CSS}</style>
      {erro === 'invalido' && !dados ? (
        <div className="centro">
          <div className="aviso">
            <h1>Link do painel inválido</h1>
            <p>Gere um novo em Configurações → Painel da TV e abra o link nesta TV.</p>
          </div>
        </div>
      ) : !dados ? (
        <div className="centro"><p className="s">{erro === 'rede' ? 'Reconectando…' : 'Carregando painel…'}</p></div>
      ) : (
        <div className="wrap">
          {erro && (
            <div className="banner">{erro === 'invalido' ? 'Link do painel inválido — gere um novo em Configurações' : 'Reconectando… mostrando os últimos dados recebidos'}</div>
          )}
          <div className="top">
            <h1>{tela === 1 ? 'ProSystem · Comercial ao vivo' : `ProSystem · Resultados de ${dados.tela2.ano}`}</h1>
            <div className="topdir">
              <span className={`live ${atualizando ? 'pulsando' : ''}`}>● {atualizando ? 'atualizando…' : 'atualiza a cada 60 s'}</span>
              <span className="clock">{relogio}</span>
              <span className="dots">
                <span className={tela === 1 ? 'on' : ''} /><span className={tela === 2 ? 'on' : ''} />
              </span>
            </div>
          </div>
          {tela === 1 ? <Tela1 d={dados.tela1} /> : <Tela2 d={dados.tela2} />}
        </div>
      )}
    </div>
  );
}

function Tela1({ d }: { d: any }) {
  const origens = Object.entries(d.leads_novos_hoje.por_origem || {}) as [string, number][];
  const maxFunil = Math.max(1, ...d.funil.map((e: any) => e.total));
  const feed = d.feed as Array<{ hora: string; tipo: string; texto: string }>;
  return (
    <div className="grid">
      <div className="t span2">
        <div className="l">Negociações em andamento</div>
        <Valor v={num(d.negociacoes.total)} />
        <div className="s">
          {d.negociacoes.valor_potencial != null ? `${brl(d.negociacoes.valor_potencial)} em potencial · ` : ''}
          {d.negociacoes.com_proposta_enviada} com proposta enviada
        </div>
      </div>
      <div className="t span2">
        <div className="l">Faturamento do mês (instalação)</div>
        <Valor v={brl(d.faturamento_mes.valor)} />
        {d.faturamento_mes.meta != null && <div className="s">meta {brl(d.faturamento_mes.meta)}</div>}
        <Barra p={d.faturamento_mes} />
      </div>
      <div className="t span2">
        <div className="l">Contratos fechados</div>
        <div className="n">{d.contratos.hoje} <span className="unid">hoje</span></div>
        <div className="s">{d.contratos.mes} no mês · ticket médio {brl(d.contratos.ticket_medio_mes) ?? 'sem dados'}</div>
      </div>

      <div className="t"><div className="l">Leads acumulados</div><Valor v={num(d.leads_acumulados)} /><div className="s">abertos no funil</div></div>
      <div className="t">
        <div className="l">Leads novos hoje</div>
        <Valor v={`+${d.leads_novos_hoje.total}`} classe="up" />
        <div className="s">{origens.length ? origens.map(([o, n]) => `${n} ${ORIGEM[o] || o.toLowerCase()}`).join(' · ') : 'nenhum ainda'}</div>
      </div>
      <div className="t">
        <div className="l">Qualificados hoje</div>
        <Valor v={num(d.qualificados_hoje.pela_triagem)} />
        <div className="s">pela triagem automática</div>
      </div>
      <div className="t">
        <div className="l">Conversas iniciadas</div>
        <Valor v={num(d.conversas_iniciadas.total)} />
        <div className="s">{d.conversas_iniciadas.pelo_cliente} pelo cliente · {d.conversas_iniciadas.pela_equipe} pela equipe</div>
      </div>
      <div className="t">
        <div className="l">Conversas respondidas</div>
        <Valor v={num(d.conversas_respondidas.total)} classe="up" />
        <div className="s">
          {d.conversas_respondidas.tempo_medio_primeira_resposta_min != null
            ? `1ª resposta em ${d.conversas_respondidas.tempo_medio_primeira_resposta_min} min (média)`
            : 'tempo de resposta: sem dados'}
        </div>
      </div>
      <div className="t">
        <div className="l">Sem resposta</div>
        <Valor v={num(d.sem_resposta.total)} classe={d.sem_resposta.total ? 'warn' : ''} />
        <div className="s">{d.sem_resposta.fora_do_prazo != null ? `${d.sem_resposta.fora_do_prazo} fora do prazo` : ''}</div>
      </div>

      <div className="t span2 funil">
        <div className="l">Funil agora</div>
        {d.funil.map((e: any) => (
          <div key={e.etapa}>
            <b style={{ width: `${Math.max(2, (e.total / maxFunil) * 60)}%` }} />
            <span>{e.nome}</span><strong>{num(e.total)}</strong>
          </div>
        ))}
      </div>
      <div className="t span2">
        <div className="l">Equipe hoje</div>
        {d.equipe.length ? (
          <table>
            <tbody>
              {d.equipe.map((u: any, i: number) => (
                <tr key={i}>
                  <td>{u.nome}{u.cargo === 'SDR' ? ' (SDR)' : ''}</td>
                  <td>{u.conversas_respondidas} conversas</td>
                  <td>{u.propostas_criadas} propostas</td>
                  <td className={u.contratos ? 'up' : ''}>{u.contratos} {u.contratos === 1 ? 'venda' : 'vendas'}</td>
                  <td>{u.atividades.concluidas} ✔{u.atividades.atrasadas ? <span className="bad"> · {u.atividades.atrasadas} atras.</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="s"><SemDados /></div>}
        <div className="s" style={{ marginTop: 8 }}>
          Atividades do dia: {d.atividades_hoje.concluidas} feitas · {d.atividades_hoje.pendentes} pendentes ·{' '}
          <span className={d.atividades_hoje.atrasadas ? 'bad' : ''}>{d.atividades_hoje.atrasadas} atrasadas</span>
        </div>
      </div>
      <div className="t span2 alertas">
        <div className="l">Alertas</div>
        {d.alertas.conversas_fora_do_prazo != null && (
          <div className={`s ${d.alertas.conversas_fora_do_prazo ? 'bad' : ''}`}>● {d.alertas.conversas_fora_do_prazo} conversa(s) fora do prazo de resposta</div>
        )}
        <div className={`s ${d.alertas.propostas_paradas ? 'warn' : ''}`}>● {d.alertas.propostas_paradas} proposta(s) parada(s) há 7+ dias</div>
        <div className={`s ${d.alertas.leads_para_distribuir ? 'warn' : ''}`}>● {d.alertas.leads_para_distribuir} lead(s) para distribuir</div>
        <div className={`s ${d.alertas.cnpj_irregular_hoje ? 'bad' : ''}`}>● {d.alertas.cnpj_irregular_hoje} contato(s) de hoje com CNPJ não ativo</div>
      </div>

      <div className="t span6">
        <div className="l">Agora mesmo</div>
        {feed.length ? (
          <div className="feed">
            <div className="trilho" style={{ animationDuration: `${Math.max(20, feed.length * 6)}s` }}>
              {[...feed, ...feed].map((e, i) => (
                <span key={i}>{e.hora} {ICONE_FEED[e.tipo] || '•'} {e.texto}</span>
              ))}
            </div>
          </div>
        ) : <div className="s">Nada registrado hoje ainda.</div>}
      </div>
    </div>
  );
}

function Tela2({ d }: { d: any }) {
  const maxMes = Math.max(1, ...d.contratos_por_mes);
  const ca = d.contratos_ano;
  return (
    <div className="grid">
      <div className="t span3">
        <div className="l">Contratos no ano (sistemas)</div>
        <div className="n">{num(ca.valor)}{ca.meta != null && <span className="unid"> de {num(ca.meta)}</span>}</div>
        <Barra p={ca} cor="azul" />
        <div className="marco">
          <span>ritmo: {ca.por_mes.toLocaleString('pt-BR')}/mês{ca.necessario_por_mes != null ? ` · precisa ${ca.necessario_por_mes.toLocaleString('pt-BR')}/mês até dez` : ''}</span>
        </div>
      </div>
      <div className="t span3">
        <div className="l">Vendas de serviços no ano</div>
        <Valor v={brl(d.servicos_ano.valor)} />
        {d.servicos_ano.valor == null
          ? <div className="s">o CRM ainda não registra vendas de serviços com valor</div>
          : <Barra p={d.servicos_ano} />}
      </div>

      <div className="t span3">
        <div className="l">Cross-sell (vendas adicionais) no ano</div>
        <div className="n">{brl(d.crosssell_ano.valor)}{d.crosssell_ano.meta != null && <span className="unid"> de {brl(d.crosssell_ano.meta)}</span>}</div>
        <Barra p={d.crosssell_ano} cor="roxo" />
        <div className="marco"><span>{d.crosssell_ano.vendas} vendas confirmadas · {d.crosssell_ano.clientes} clientes da base</span></div>
      </div>
      <div className="t span3">
        <div className="l">Cross-sell por produto (ano)</div>
        {d.crosssell_ano.por_produto.length ? (
          <table><tbody>
            {d.crosssell_ano.por_produto.slice(0, 5).map((p: any) => (
              <tr key={p.produto}><td>{p.produto}</td><td className="r">{p.qtd}</td><td className="r">{brl(p.valor)}</td></tr>
            ))}
          </tbody></table>
        ) : <div className="s">Nenhuma venda adicional confirmada no ano.</div>}
      </div>

      <div className="t"><div className="l">Ticket médio instalação</div><Valor v={brl(d.ticket_medio_instalacao)} /><div className="s">contratos do ano</div></div>
      <div className="t"><div className="l">Ticket médio mensalidade</div><Valor v={brl(d.ticket_medio_mensalidade)} /><div className="s">por cliente novo</div></div>
      <div className="t"><div className="l">MRR novo no ano</div><Valor v={brl(d.mrr_novo_ano)} /><div className="s">mensalidades dos contratos novos</div></div>
      <div className="t"><div className="l">Conversão</div><Valor v={d.conversao_proposta_contrato_pct == null ? null : `${d.conversao_proposta_contrato_pct.toLocaleString('pt-BR')}%`} /><div className="s">proposta → contrato (ano)</div></div>
      <div className="t"><div className="l">Ciclo de venda</div><Valor v={d.ciclo_medio_dias == null ? null : `${d.ciclo_medio_dias} dias`} /><div className="s">do lead ao fechamento (média)</div></div>
      <div className="t"><div className="l">Faturamento no ano</div><Valor v={brl(d.faturamento_ano.total, true)} /><div className="s">instalação + cross-sell</div></div>

      <div className="t span3">
        <div className="l">Contratos por segmento (ano)</div>
        <table><tbody>
          {d.contratos_por_segmento.map((s: any) => (
            <tr key={s.segmento}><td>{s.segmento}</td><td className="r">{s.total}</td><td className="r">{s.pct}%</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="t span3">
        <div className="l">Contratos por mês</div>
        <div className="meses">
          {d.contratos_por_mes.map((n: number, i: number) => {
            const futuro = i + 1 > d.mes_atual;
            const atual = i + 1 === d.mes_atual;
            return (
              <div key={i} className="mes">
                <small>{futuro ? '' : n}</small>
                <div className={`col ${futuro ? 'futuro' : atual ? 'atual' : ''}`} style={{ height: futuro ? '100%' : `${Math.max(3, (n / maxMes) * 100)}%` }} />
                <small>{MESES[i]}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CSS = `
html,body{background:#0b1220}
.tv{min-height:100vh;background:#0b1220;color:#e5e7eb;font-family:var(--font-sans),Inter,Segoe UI,Arial,sans-serif;font-size:clamp(12px,0.9vw,18px);overflow:hidden}
.wrap{padding:1.2vw 1.5vw;height:100vh;box-sizing:border-box;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8vw}
.top h1{font-size:1.6em;margin:0;letter-spacing:.3px;font-weight:700}
.topdir{display:flex;align-items:center;gap:1.2em}
.clock{font-size:1.4em;color:#93c5fd;text-transform:capitalize}
.live{font-size:.85em;color:#34d399}
.pulsando{animation:pulsar 1s ease-in-out infinite}
@keyframes pulsar{50%{opacity:.35}}
.dots{display:flex;gap:6px}
.dots span{width:10px;height:10px;border-radius:50%;background:#1f2a44;display:inline-block}
.dots span.on{background:#22d3ee}
.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0.8vw;flex:1;align-content:start}
.t{background:#111a2e;border:1px solid #1f2a44;border-radius:14px;padding:0.9vw 1vw;min-width:0}
.l{font-size:.85em;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8}
.n{font-size:3em;font-weight:800;line-height:1.1;margin-top:.15em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.unid{font-size:.45em;color:#94a3b8;font-weight:600}
.s{font-size:.95em;color:#94a3b8;margin-top:.3em}
.dica{color:#fbbf24}
.semdados{font-size:.4em;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.up{color:#34d399}.warn{color:#fbbf24}.bad{color:#f87171}
.span2{grid-column:span 2}.span3{grid-column:span 3}.span6{grid-column:span 6}
.bar{position:relative;height:1.1em;background:#1f2a44;border-radius:999px;overflow:hidden;margin-top:.7em}
.bar>i{display:block;height:100%;background:linear-gradient(90deg,#2563eb,#22d3ee)}
.bar.roxo>i{background:linear-gradient(90deg,#7c3aed,#c084fc)}
.bar>em{position:absolute;right:.6em;top:0;font-size:.8em;line-height:1.4em;font-style:normal;font-weight:700;color:#e5e7eb}
.marco{display:flex;justify-content:space-between;font-size:.85em;color:#94a3b8;margin-top:.5em}
.funil>div{display:flex;align-items:center;gap:.6em;margin:.3em 0;font-size:.95em}
.funil b{display:inline-block;height:1.1em;border-radius:4px;background:#2563eb;flex:none}
.funil strong{margin-left:auto}
table{width:100%;border-collapse:collapse;font-size:.95em}
td{padding:.35em .3em .35em 0;border-bottom:1px solid #1f2a44;white-space:nowrap}
td.r{text-align:right}
.feed{overflow:hidden;white-space:nowrap;font-size:1.05em;margin-top:.4em}
.trilho{display:inline-block;animation:rolar linear infinite}
.trilho span{margin-right:3em}
@keyframes rolar{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.meses{display:flex;align-items:flex-end;gap:.4em;height:8em;margin-top:.6em}
.mes{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:.2em}
.mes small{font-size:.75em;color:#94a3b8}
.col{width:100%;background:#2563eb;border-radius:3px 3px 0 0}
.col.atual{background:#22d3ee}
.col.futuro{background:#1f2a44;opacity:.4}
.banner{background:#7c2d12;color:#fed7aa;padding:.5em 1em;border-radius:10px;margin-bottom:.6em;font-weight:600}
.centro{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.aviso{max-width:640px;text-align:center;background:#111a2e;border:1px solid #1f2a44;border-radius:16px;padding:2em}
.aviso h1{font-size:2em;margin:0 0 .5em}
.aviso p{color:#94a3b8;font-size:1.2em}
@media (max-width:1400px){.tv{font-size:12px}.n{font-size:2.5em}}
@media (max-width:900px){.tv{overflow:auto}.wrap{height:auto}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.span2,.span3,.span6{grid-column:span 2}}
`;
