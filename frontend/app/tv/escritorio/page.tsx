'use client';

import { useEffect, useRef, useState } from 'react';

// TV do escritório virtual — quem está trabalhando e o que precisa de ação agora.
// Acesso: /tv/escritorio?chave=<mesmo token da /tv> (ou gestão logada, p/ prévia).
// Busca a cada 30 s. Apita só para itens NOVOS: cliente esperando / lead que sumiu (alerta)
// e lead qualificado (campainha). O navegador só libera som depois de um clique na tela.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INTERVALO_DADOS = 30_000;

type Agente = { id: string; nome: string; funcao: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado'; ultima: { texto: string; em: string } | null; numeros: { rotulo: string; valor: number }[]; observacao?: string };
type Pessoa = { id: string; nome: string; cargo: string; online: boolean; ultima: { texto: string; em: string } | null; enviadas_hoje: number; esperando: number };
type Item = { id: string; contato: string; desde: string; responsavel: string; nao_lidas?: number; trecho?: string; origem?: string; tentativas?: number };
type Qualificado = { id: string; contato: string; por: string; em: string };

function ha(iso: string | null | undefined, agora: Date) {
  if (!iso) return '';
  const min = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
  return `há ${Math.floor(h / 24)}d`;
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

// ── Sons (Web Audio, sem arquivos) ─────────────────────────────────────────
function tocar(ctx: AudioContext, notas: { f: number; t: number; d: number }[], tipo: OscillatorType, vol = 0.25) {
  const t0 = ctx.currentTime;
  notas.forEach(n => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo; o.frequency.value = n.f;
    g.gain.setValueAtTime(0, t0 + n.t);
    g.gain.linearRampToValueAtTime(vol, t0 + n.t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + n.t + n.d);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + n.t); o.stop(t0 + n.t + n.d + 0.05);
  });
}
const somAlerta = (ctx: AudioContext) => tocar(ctx, [{ f: 880, t: 0, d: 0.18 }, { f: 880, t: 0.28, d: 0.18 }, { f: 660, t: 0.56, d: 0.3 }], 'square', 0.12);
const somQualificado = (ctx: AudioContext) => tocar(ctx, [{ f: 523, t: 0, d: 0.35 }, { f: 659, t: 0.15, d: 0.35 }, { f: 784, t: 0.3, d: 0.35 }, { f: 1047, t: 0.45, d: 0.7 }], 'sine', 0.3);

export default function TvEscritorioPage() {
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<'invalido' | 'rede' | null>(null);
  const [agora, setAgora] = useState(new Date());
  const [som, setSom] = useState(false);
  const [destaque, setDestaque] = useState<{ tipo: 'qualificado' | 'alerta'; texto: string } | null>(null);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const ctxRef = useRef<AudioContext | null>(null);
  const vistosRef = useRef<Set<string> | null>(null);

  const ativarSom = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = ctxRef.current || new Ctx();
      ctxRef.current.resume();
      somQualificado(ctxRef.current);
      setSom(true);
    } catch { /* sem áudio */ }
  };

  useEffect(() => {
    const chave = new URLSearchParams(window.location.search).get('chave');
    let ativo = true;

    const buscar = async () => {
      try {
        const headers: Record<string, string> = {};
        if (!chave) {
          try { const t = localStorage.getItem('accessToken'); if (t) headers.Authorization = `Bearer ${t}`; } catch { /* sem storage */ }
        }
        const res = await fetch(`${API_URL}/painel-tv/escritorio${chave ? `?chave=${encodeURIComponent(chave)}` : ''}`, { headers, cache: 'no-store' });
        if (!ativo) return;
        if (res.status === 401 || res.status === 403) { setErro('invalido'); return; }
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()).data;

        // Detecta o que é novo desde a última busca (na primeira carga só memoriza).
        const alertas: Item[] = [...d.esperando.lista, ...d.sumiram.lista];
        const quals: Qualificado[] = d.qualificados;
        const ids = [...alertas.map(a => `a:${a.id}`), ...quals.map(q => `q:${q.id}`)];
        const vistos = vistosRef.current;
        if (vistos) {
          const qNovo = quals.find(q => !vistos.has(`q:${q.id}`));
          const aNovos = alertas.filter(a => !vistos.has(`a:${a.id}`));
          const ctx = ctxRef.current;
          if (qNovo) {
            if (ctx) somQualificado(ctx);
            setDestaque({ tipo: 'qualificado', texto: `🎉 Lead qualificado: ${qNovo.contato} · ${qNovo.por}` });
          } else if (aNovos.length) {
            if (ctx) somAlerta(ctx);
            setDestaque({ tipo: 'alerta', texto: `🔔 ${aNovos.length === 1 ? `${aNovos[0].contato} precisa de atenção` : `${aNovos.length} novos alertas`}` });
          }
          setNovos(new Set(ids.filter(i => !vistos.has(i))));
        }
        vistosRef.current = new Set(ids);
        setDados(d);
        setErro(null);
      } catch {
        if (ativo) setErro(e => (e === 'invalido' ? e : 'rede'));
      }
    };

    buscar();
    const iDados = setInterval(buscar, INTERVALO_DADOS);
    const iRelogio = setInterval(() => setAgora(new Date()), 15_000);
    return () => { ativo = false; clearInterval(iDados); clearInterval(iRelogio); };
  }, []);

  useEffect(() => {
    if (!destaque) return;
    const t = setTimeout(() => setDestaque(null), 12_000);
    return () => clearTimeout(t);
  }, [destaque]);

  const relogio = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·');

  if (erro === 'invalido' && !dados) {
    return <div className="tv"><style>{CSS}</style><div className="centro"><div className="aviso"><h1>Link do painel inválido</h1><p>Use o mesmo link da TV (Configurações → Painel da TV) trocando /tv por /tv/escritorio.</p></div></div></div>;
  }
  if (!dados) return <div className="tv"><style>{CSS}</style><div className="centro"><p className="s">{erro === 'rede' ? 'Reconectando…' : 'Carregando escritório…'}</p></div></div>;

  const agentes: Agente[] = dados.agentes;
  const equipe: Pessoa[] = dados.equipe;
  const trabalhando = agentes.filter(a => a.status === 'trabalhando').length + equipe.filter(p => p.online).length;
  const aprov = dados.aprovacoes;
  const feed: { texto: string; em: string; agente: string }[] = dados.feed;

  return (
    <div className="tv" onClick={() => { if (!som) ativarSom(); }}>
      <style>{CSS}</style>
      <div className="wrap">
        {erro && <div className="banner">Reconectando… mostrando os últimos dados recebidos</div>}
        {destaque && <div className={`flash ${destaque.tipo}`}>{destaque.texto}</div>}
        <div className="top">
          <h1>ProSystem · Escritório ao vivo</h1>
          <div className="topdir">
            <span className="live">● {trabalhando} trabalhando agora</span>
            {!som && <button className="btnsom" onClick={ativarSom}>🔊 Ativar som</button>}
            {som && <span className="live">🔊 som ligado</span>}
            <span className="clock">{relogio}</span>
          </div>
        </div>

        <div className="corpo">
          <div className="sala">
            <div className="l">Equipe</div>
            <div className="cards">
              {equipe.map(p => (
                <div key={p.id} className={`card ${p.online ? 'trabalhando' : 'parado'}`}>
                  <div className="cab"><span className={`dot ${p.online ? 'trabalhando' : 'parado'}`} /><b>{p.nome}</b><small>{p.cargo === 'SDR' ? 'SDR' : p.cargo === 'VENDEDOR' ? 'Vendas' : p.cargo.toLowerCase()}</small></div>
                  <div className="acao">{p.ultima ? `${p.ultima.texto} · ${ha(p.ultima.em, agora)}` : 'sem mensagens enviadas'}</div>
                  <div className="nums">
                    <span><strong>{p.enviadas_hoje}</strong> msgs hoje</span>
                    <span className={p.esperando ? 'bad' : ''}><strong>{p.esperando}</strong> esperando</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="l" style={{ marginTop: '0.8em' }}>Agentes</div>
            <div className="cards">
              {agentes.map(a => (
                <div key={a.id} className={`card ${a.status}`} style={{ borderLeftColor: a.cor }}>
                  <div className="cab"><span className={`dot ${a.status}`} /><b>{a.nome}</b><small>{a.status}</small></div>
                  <div className="acao">{a.ultima ? `${a.ultima.texto} · ${ha(a.ultima.em, agora)}` : (a.observacao || a.funcao)}</div>
                  {a.numeros.length > 0 && (
                    <div className="nums">
                      {a.numeros.slice(0, 3).map(n => (
                        <span key={n.rotulo} className={n.rotulo === 'para aprovar' && n.valor ? 'warn' : ''}><strong>{n.valor}</strong> {n.rotulo}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lado">
            <div className="t alerta-vermelho">
              <div className="l">🔴 Cliente esperando resposta <em>{dados.esperando.total}</em></div>
              {dados.esperando.lista.length ? dados.esperando.lista.map((c: Item) => (
                <div key={c.id} className={`linha ${novos.has(`a:${c.id}`) ? 'novo' : ''}`}>
                  <span className="quem">{c.contato}</span>
                  <span className="det">{c.responsavel} · {ha(c.desde, agora)}</span>
                </div>
              )) : <div className="s ok">Ninguém esperando ✓</div>}
            </div>

            <div className="t alerta-laranja">
              <div className="l">🟠 Parou de responder (24h+) <em>{dados.sumiram.total}</em></div>
              {dados.sumiram.lista.length ? dados.sumiram.lista.map((c: Item) => (
                <div key={c.id} className={`linha ${novos.has(`a:${c.id}`) ? 'novo' : ''}`}>
                  <span className="quem">{c.contato}</span>
                  <span className="det">{c.responsavel}{c.tentativas ? ` · tentativa ${c.tentativas}/3` : ''} · {ha(c.desde, agora)}</span>
                </div>
              )) : <div className="s ok">Nenhum lead parado ✓</div>}
            </div>

            <div className="t alerta-verde">
              <div className="l">🟢 Qualificados hoje <em>{dados.qualificados.length}</em></div>
              {dados.qualificados.length ? dados.qualificados.slice(0, 5).map((q: Qualificado) => (
                <div key={q.id} className={`linha ${novos.has(`q:${q.id}`) ? 'novo' : ''}`}>
                  <span className="quem">{q.contato}</span>
                  <span className="det">{q.por} · {hora(q.em)}</span>
                </div>
              )) : <div className="s">Nenhum ainda hoje</div>}
            </div>

            {(aprov.mensagens > 0 || aprov.documentos > 0) && (
              <div className="t aprov">
                <div className="l">✍️ Esperando sua aprovação</div>
                {aprov.mensagens > 0 && <div className="s warn">{aprov.mensagens} mensagem(ns) dos agentes SDR</div>}
                {aprov.documentos > 0 && <div className="s warn">{aprov.documentos} documento(s) do Rafael</div>}
              </div>
            )}
          </div>
        </div>

        <div className="t rodape">
          <div className="l">Agora mesmo no escritório</div>
          {feed.length ? (
            <div className="feed">
              <div className="trilho" style={{ animationDuration: `${Math.max(30, feed.length * 7)}s` }}>
                {[...feed, ...feed].map((e, i) => <span key={i}>{hora(e.em)} <b>{e.agente}</b> {e.texto}</span>)}
              </div>
            </div>
          ) : <div className="s">Nada registrado hoje ainda.</div>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
html,body{background:#0b1220}
.tv{min-height:100vh;background:#0b1220;color:#e5e7eb;font-family:var(--font-sans),Inter,Segoe UI,Arial,sans-serif;font-size:clamp(10px,min(0.85vw,1.5vh),18px);overflow:hidden}
.wrap{padding:1.1vw 1.4vw;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;gap:.7vw;position:relative}
.top{display:flex;justify-content:space-between;align-items:center}
.top h1{font-size:1.6em;margin:0;font-weight:700}
.topdir{display:flex;align-items:center;gap:1.2em}
.clock{font-size:1.4em;color:#93c5fd;text-transform:capitalize}
.live{font-size:.95em;color:#34d399}
.btnsom{background:#2563eb;color:#fff;border:0;border-radius:999px;padding:.45em 1.1em;font-size:1em;font-weight:700;cursor:pointer;animation:pulsar 1.4s ease-in-out infinite}
@keyframes pulsar{50%{opacity:.5}}
.corpo{flex:1;display:grid;grid-template-columns:minmax(0,2.1fr) minmax(0,1fr);gap:.8vw;min-height:0}
.sala{min-height:0;overflow:hidden}
.lado{display:flex;flex-direction:column;gap:.7vw;min-height:0;overflow:hidden}
.l{font-size:.85em;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.5em;display:flex;align-items:center;gap:.5em}
.l em{margin-left:auto;font-style:normal;font-size:1.5em;font-weight:800;color:#e5e7eb}
.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6vw}
.card{background:#111a2e;border:1px solid #1f2a44;border-left:4px solid #334155;border-radius:12px;padding:.65em .8em;min-width:0}
.card.desligado{opacity:.45}
.card.trabalhando{box-shadow:0 0 0 1px #065f46 inset}
.cab{display:flex;align-items:center;gap:.5em}
.cab b{font-size:1.15em}
.cab small{margin-left:auto;color:#64748b;font-size:.8em;text-transform:uppercase;letter-spacing:.06em}
.dot{width:.75em;height:.75em;border-radius:50%;flex:none;background:#475569}
.dot.trabalhando{background:#34d399;box-shadow:0 0 .6em #34d399;animation:pulsar 1.6s ease-in-out infinite}
.dot.parado{background:#fbbf24}
.dot.desligado{background:#475569}
.acao{font-size:.9em;color:#cbd5e1;margin:.35em 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nums{display:flex;flex-wrap:wrap;gap:.2em .9em;font-size:.82em;color:#94a3b8}
.nums strong{color:#e5e7eb;font-size:1.15em}
.t{background:#111a2e;border:1px solid #1f2a44;border-radius:14px;padding:.8em 1em;min-width:0}
.alerta-vermelho{border-color:#7f1d1d}.alerta-laranja{border-color:#78350f}.alerta-verde{border-color:#065f46}.aprov{border-color:#713f12}
.alerta-vermelho .l em{color:#f87171}.alerta-laranja .l em{color:#fbbf24}.alerta-verde .l em{color:#34d399}
.linha{display:flex;justify-content:space-between;gap:1em;padding:.3em 0;border-bottom:1px solid #1f2a44;font-size:.95em}
.linha:last-child{border-bottom:0}
.linha .quem{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.linha .det{color:#94a3b8;white-space:nowrap;flex:none}
.linha.novo{animation:piscar 1s ease-in-out 6;border-radius:6px}
@keyframes piscar{50%{background:#334155}}
.s{font-size:.95em;color:#94a3b8;margin-top:.2em}
.ok{color:#34d399}.warn{color:#fbbf24}.bad{color:#f87171}
.rodape{flex:none}
.feed{overflow:hidden;white-space:nowrap;font-size:1.05em}
.trilho{display:inline-block;animation:rolar linear infinite}
.trilho span{margin-right:3em}
.trilho b{color:#93c5fd}
@keyframes rolar{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.flash{position:absolute;top:4.2em;left:50%;transform:translateX(-50%);z-index:10;padding:.8em 2em;border-radius:14px;font-size:1.6em;font-weight:800;animation:entrar .4s ease-out}
.flash.qualificado{background:#065f46;color:#d1fae5;box-shadow:0 0 3em #10b98166}
.flash.alerta{background:#7f1d1d;color:#fee2e2;box-shadow:0 0 3em #ef444466}
@keyframes entrar{from{opacity:0;transform:translate(-50%,-1em)}}
.banner{background:#7c2d12;color:#fed7aa;padding:.5em 1em;border-radius:10px;font-weight:600}
.centro{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.aviso{max-width:640px;text-align:center;background:#111a2e;border:1px solid #1f2a44;border-radius:16px;padding:2em}
.aviso h1{font-size:2em;margin:0 0 .5em}
.aviso p{color:#94a3b8;font-size:1.2em}
@media (max-width:1400px){.cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:900px){.tv{overflow:auto}.wrap{height:auto}.corpo{grid-template-columns:1fr}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.top{flex-wrap:wrap;gap:.5em}}
`;
