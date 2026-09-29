'use client';

import { useEffect, useRef, useState } from 'react';

// TV do escritório virtual — fica aberta o dia todo.
// Acesso: /tv/escritorio?chave=<mesmo token da /tv> (ou gestão logada, p/ prévia).
// Duas telas alternando a cada 30 s: 1) movimentos do WhatsApp ao vivo  2) o que precisa de atenção.
// Agentes sempre na faixa de baixo. Busca a cada 15 s; apita só para itens NOVOS
// (cliente esperando / lead parado = alerta; lead qualificado = campainha).

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INTERVALO_DADOS = 15_000;
const INTERVALO_TELA = 30_000;
const INTERVALO_CARROSSEL = 5_000;

type Agente = { id: string; nome: string; funcao: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado'; ultima: { texto: string; em: string } | null; numeros: { rotulo: string; valor: number }[]; observacao?: string };
type Pessoa = { id: string; nome: string; cargo: string; online: boolean; ultima: { texto: string; em: string } | null; enviadas_hoje: number; esperando: number };
type Item = { id: string; contato: string; desde: string; responsavel: string; nao_lidas?: number; trecho?: string; origem?: string; tentativas?: number };
type Qualificado = { id: string; contato: string; por: string; em: string };
type Movimento = { id: string; direcao: 'ENTRADA' | 'SAIDA'; quem: string | null; agente: boolean; contato: string; texto: string; em: string };
type Conversa = { id: string; agente: string; contato: string; temperatura: string | null; nota: number | null; em: string };
type Destaque = { tipo: 'vermelho' | 'laranja' | 'verde'; titulo: string; contato: string; detalhe: string };

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
const COR_AGENTE: Record<string, string> = {};

// ── Sons (Web Audio, sem arquivos) ─────────────────────────────────────────
function tocar(ctx: AudioContext, notas: { f: number; t: number; d: number }[], tipo: OscillatorType, vol: number) {
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
  const [tela, setTela] = useState<1 | 2>(1);
  const [giro, setGiro] = useState(0);
  const [som, setSom] = useState(false);
  const [flash, setFlash] = useState<{ tipo: 'qualificado' | 'alerta'; texto: string } | null>(null);
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

        // O que é novo desde a última busca (na primeira carga só memoriza).
        const alertas: Item[] = [...d.esperando.lista, ...d.sumiram.lista];
        const quals: Qualificado[] = d.qualificados;
        const ids = [
          ...alertas.map(a => `a:${a.id}`), ...quals.map(q => `q:${q.id}`),
          ...(d.movimentos as Movimento[]).map(m => `m:${m.id}`),
        ];
        const vistos = vistosRef.current;
        if (vistos) {
          const qNovo = quals.find(q => !vistos.has(`q:${q.id}`));
          const aNovos = alertas.filter(a => !vistos.has(`a:${a.id}`));
          const ctx = ctxRef.current;
          if (qNovo) {
            if (ctx) somQualificado(ctx);
            setFlash({ tipo: 'qualificado', texto: `🎉 Lead qualificado: ${qNovo.contato} · ${qNovo.por}` });
          } else if (aNovos.length) {
            if (ctx) somAlerta(ctx);
            setFlash({ tipo: 'alerta', texto: aNovos.length === 1 ? `🔔 ${aNovos[0].contato} precisa de atenção` : `🔔 ${aNovos.length} novos alertas` });
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
    const iTela = setInterval(() => setTela(t => (t === 1 ? 2 : 1)), INTERVALO_TELA);
    const iGiro = setInterval(() => setGiro(g => g + 1), INTERVALO_CARROSSEL);
    const iRelogio = setInterval(() => setAgora(new Date()), 10_000);
    return () => { ativo = false; clearInterval(iDados); clearInterval(iTela); clearInterval(iGiro); clearInterval(iRelogio); };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 12_000);
    return () => clearTimeout(t);
  }, [flash]);

  const relogio = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·');

  if (erro === 'invalido' && !dados) {
    return <div className="tv"><style>{CSS}</style><div className="centro"><div className="aviso"><h1>Link do painel inválido</h1><p>Abra pelo botão &quot;Abrir TV do Escritório&quot; em Configurações → Painel da TV.</p></div></div></div>;
  }
  if (!dados) return <div className="tv"><style>{CSS}</style><div className="centro"><p className="s">{erro === 'rede' ? 'Reconectando…' : 'Carregando escritório…'}</p></div></div>;

  const agentes: Agente[] = dados.agentes;
  agentes.forEach(a => { COR_AGENTE[a.nome] = a.cor; });
  const equipe: Pessoa[] = dados.equipe;
  const trabalhando = agentes.filter(a => a.status === 'trabalhando').length + equipe.filter(p => p.online).length;

  // Carrossel de destaques: alertas e qualificados, um de cada vez.
  const destaques: Destaque[] = [
    ...dados.esperando.lista.map((c: Item) => ({ tipo: 'vermelho' as const, titulo: '🔴 Cliente esperando resposta', contato: c.contato, detalhe: `${c.responsavel} · escreveu ${ha(c.desde, agora)}${c.trecho ? ` · "${c.trecho}"` : ''}` })),
    ...dados.qualificados.slice(0, 5).map((q: Qualificado) => ({ tipo: 'verde' as const, titulo: '🟢 Lead qualificado hoje', contato: q.contato, detalhe: `${q.por} · ${hora(q.em)}` })),
    ...dados.sumiram.lista.map((c: Item) => ({ tipo: 'laranja' as const, titulo: '🟠 Lead parado — não responde', contato: c.contato, detalhe: `${c.responsavel}${c.tentativas ? ` · tentativa ${c.tentativas}/3` : ''} · sem retorno ${ha(c.desde, agora)}` })),
  ];
  const destaque = destaques.length ? destaques[giro % destaques.length] : null;

  return (
    <div className="tv" onClick={() => { if (!som) ativarSom(); }}>
      <style>{CSS}</style>
      <div className="wrap">
        {erro && <div className="banner">Reconectando… mostrando os últimos dados recebidos</div>}
        {flash && <div className={`flash ${flash.tipo}`}>{flash.texto}</div>}

        <div className="top">
          <h1>{tela === 1 ? 'Escritório · WhatsApp ao vivo' : 'Escritório · Precisa de atenção'}</h1>
          <div className="topdir">
            <span className="chip ok">● {trabalhando} trabalhando</span>
            <span className={`chip ${dados.esperando.total ? 'bad' : ''}`}>🔴 {dados.esperando.total} esperando</span>
            <span className={`chip ${dados.sumiram.total ? 'warn' : ''}`}>🟠 {dados.sumiram.total} parados</span>
            <span className="chip ok">🟢 {dados.qualificados.length} qualificados</span>
            {!som ? <button className="btnsom" onClick={ativarSom}>🔊 Ativar som</button> : <span className="chip">🔊</span>}
            <span className="clock">{relogio}</span>
            <span className="dots"><span className={tela === 1 ? 'on' : ''} /><span className={tela === 2 ? 'on' : ''} /></span>
          </div>
        </div>
        <div className="progresso"><i key={tela} /></div>

        <div className="palco" key={tela}>
          {tela === 1 ? (
            <div className="tela1">
              <div className="t mov">
                <div className="l">💬 Movimentos do WhatsApp <em className="aovivo">● ao vivo</em></div>
                <div className="lista-mov">
                  {(dados.movimentos as Movimento[]).slice(0, 11).map(m => (
                    <div key={m.id} className={`msg ${m.direcao === 'ENTRADA' ? 'entrada' : 'saida'} ${novos.has(`m:${m.id}`) ? 'novo' : ''}`}>
                      <span className="h">{hora(m.em)}</span>
                      {m.direcao === 'ENTRADA' ? (
                        <span className="quem"><b className="cli">{m.contato}</b> <span className="seta">escreveu</span></span>
                      ) : (
                        <span className="quem">
                          <b style={{ color: (m.quem && COR_AGENTE[m.quem]) || '#93c5fd' }}>{m.quem}</b>
                          <span className="seta">→</span> <b className="cli">{m.contato}</b>
                        </span>
                      )}
                      <span className="txt">{m.texto ? `“${m.texto}”` : ''}</span>
                      <span className="ha">{ha(m.em, agora)}</span>
                    </div>
                  ))}
                  {!dados.movimentos.length && <div className="s">Nenhuma mensagem nas últimas horas.</div>}
                </div>
              </div>

              <div className="coluna">
                {destaque ? (
                  <div className={`t destaque ${destaque.tipo}`} key={`${giro}-${destaque.contato}`}>
                    <div className="l">{destaque.titulo} <em>{(giro % destaques.length) + 1}/{destaques.length}</em></div>
                    <div className="dcontato">{destaque.contato}</div>
                    <div className="ddet">{destaque.detalhe}</div>
                  </div>
                ) : (
                  <div className="t destaque verde"><div className="l">Tudo em dia</div><div className="dcontato">Nenhum alerta agora ✓</div></div>
                )}
                <div className="t conv">
                  <div className="l">🗣️ Conversando agora <em>{dados.conversando.length}</em></div>
                  {(dados.conversando as Conversa[]).slice(0, 7).map(c => (
                    <div key={c.id} className="linha">
                      <span className="quem"><b style={{ color: COR_AGENTE[c.agente] || '#93c5fd' }}>{c.agente}</b> com {c.contato}</span>
                      <span className="det">{c.nota != null ? <span className={`termo ${c.nota >= 70 ? 'quente' : c.nota >= 40 ? 'morno' : ''}`}>{c.nota}°</span> : null} {ha(c.em, agora)}</span>
                    </div>
                  ))}
                  {!dados.conversando.length && <div className="s">Nenhum agente conversando neste momento.</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="tela2">
              <div className="t alerta-vermelho">
                <div className="l">🔴 Cliente esperando resposta <em>{dados.esperando.total}</em></div>
                {dados.esperando.lista.length ? dados.esperando.lista.slice(0, 9).map((c: Item) => (
                  <div key={c.id} className={`linha ${novos.has(`a:${c.id}`) ? 'novo' : ''}`}>
                    <span className="quem">{c.contato}</span><span className="det">{c.responsavel} · {ha(c.desde, agora)}</span>
                  </div>
                )) : <div className="vazio ok">Ninguém esperando ✓</div>}
              </div>
              <div className="t alerta-laranja">
                <div className="l">🟠 Parou de responder (24h+) <em>{dados.sumiram.total}</em></div>
                {dados.sumiram.lista.length ? dados.sumiram.lista.slice(0, 9).map((c: Item) => (
                  <div key={c.id} className={`linha ${novos.has(`a:${c.id}`) ? 'novo' : ''}`}>
                    <span className="quem">{c.contato}</span><span className="det">{c.responsavel}{c.tentativas ? ` · ${c.tentativas}/3` : ''} · {ha(c.desde, agora)}</span>
                  </div>
                )) : <div className="vazio ok">Nenhum lead parado ✓</div>}
              </div>
              <div className="coluna">
                <div className="t alerta-verde">
                  <div className="l">🟢 Qualificados hoje <em>{dados.qualificados.length}</em></div>
                  {dados.qualificados.length ? dados.qualificados.slice(0, 4).map((q: Qualificado) => (
                    <div key={q.id} className={`linha ${novos.has(`q:${q.id}`) ? 'novo' : ''}`}>
                      <span className="quem">{q.contato}</span><span className="det">{q.por} · {hora(q.em)}</span>
                    </div>
                  )) : <div className="vazio">Nenhum ainda hoje</div>}
                </div>
                <div className="t">
                  <div className="l">👥 Equipe</div>
                  {equipe.map(p => (
                    <div key={p.id} className="linha">
                      <span className="quem"><span className={`dot ${p.online ? 'trabalhando' : 'parado'}`} /> {p.nome}</span>
                      <span className="det">{p.enviadas_hoje} msgs hoje · <span className={p.esperando ? 'bad' : ''}>{p.esperando} esperando</span> · {p.ultima ? ha(p.ultima.em, agora) : '—'}</span>
                    </div>
                  ))}
                  {(dados.aprovacoes.mensagens > 0 || dados.aprovacoes.documentos > 0) && (
                    <div className="s warn" style={{ marginTop: '.5em' }}>
                      ✍️ Para aprovar: {dados.aprovacoes.mensagens} mensagem(ns) dos agentes · {dados.aprovacoes.documentos} documento(s) do Rafael
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="agentes">
          {agentes.filter(a => a.status !== 'desligado' || a.ultima).map(a => (
            <div key={a.id} className={`ag ${a.status}`} style={{ borderTopColor: a.cor }}>
              <div className="cab"><span className={`dot ${a.status}`} /><b>{a.nome}</b><small>{a.ultima ? ha(a.ultima.em, agora) : ''}</small></div>
              <div className="acao">{a.ultima ? a.ultima.texto : (a.observacao || a.funcao)}</div>
              {a.numeros[0] && <div className="num"><strong>{a.numeros[0].valor}</strong> {a.numeros[0].rotulo}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CSS = `
html,body{background:#0b1220}
.tv{min-height:100vh;background:#0b1220;color:#e5e7eb;font-family:var(--font-sans),Inter,Segoe UI,Arial,sans-serif;font-size:clamp(10px,min(0.85vw,1.5vh),18px);overflow:hidden}
.wrap{padding:1vw 1.3vw;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;gap:.6vw;position:relative}
.top{display:flex;justify-content:space-between;align-items:center;gap:1em}
.top h1{font-size:1.6em;margin:0;font-weight:700;white-space:nowrap}
.topdir{display:flex;align-items:center;gap:.8em;flex-wrap:wrap;justify-content:flex-end}
.chip{background:#111a2e;border:1px solid #1f2a44;border-radius:999px;padding:.25em .8em;font-size:.95em;font-weight:600}
.clock{font-size:1.3em;color:#93c5fd;text-transform:capitalize}
.dots{display:flex;gap:6px}
.dots span{width:10px;height:10px;border-radius:50%;background:#1f2a44;display:inline-block}
.dots span.on{background:#22d3ee}
.progresso{height:3px;background:#111a2e;border-radius:3px;overflow:hidden;margin-top:-.3vw}
.progresso i{display:block;height:100%;background:#22d3ee;animation:encher 30s linear forwards}
@keyframes encher{from{width:0}to{width:100%}}
.btnsom{background:#2563eb;color:#fff;border:0;border-radius:999px;padding:.4em 1em;font-size:1em;font-weight:700;cursor:pointer;animation:pulsar 1.4s ease-in-out infinite}
@keyframes pulsar{50%{opacity:.45}}
.palco{flex:1;min-height:0;animation:trocar .6s ease-out}
@keyframes trocar{from{opacity:0;transform:translateY(.8em)}}
.tela1{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:.8vw;height:100%}
.tela2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8vw;height:100%}
.coluna{display:flex;flex-direction:column;gap:.8vw;min-height:0}
.coluna>.t:last-child{flex:1}
.t{background:#111a2e;border:1px solid #1f2a44;border-radius:14px;padding:.8em 1em;min-width:0;min-height:0;overflow:hidden}
.l{font-size:.85em;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.5em;display:flex;align-items:center;gap:.5em}
.l em{margin-left:auto;font-style:normal;font-size:1.5em;font-weight:800;color:#e5e7eb}
.l em.aovivo{font-size:1em;color:#f87171;animation:pulsar 1.2s ease-in-out infinite}
.lista-mov{display:flex;flex-direction:column;gap:.35em}
.msg{display:grid;grid-template-columns:3.2em minmax(0,15em) minmax(0,1fr) 5em;align-items:center;gap:.8em;padding:.45em .7em;border-radius:10px;background:#0f1729;border-left:3px solid #2563eb;font-size:1.05em}
.msg.entrada{border-left-color:#34d399;background:#0d1f1c}
.msg .h{color:#64748b;font-size:.85em}
.msg .quem{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msg .seta{color:#64748b;font-size:.85em;margin:0 .2em}
.msg .cli{color:#e5e7eb}
.msg .txt{color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic}
.msg .ha{color:#64748b;font-size:.85em;text-align:right}
.msg.novo{animation:chegar .7s ease-out,brilho 2.5s ease-out}
@keyframes chegar{from{opacity:0;transform:translateX(-2em)}}
@keyframes brilho{0%{box-shadow:0 0 0 2px #22d3ee}100%{box-shadow:0 0 0 0 transparent}}
.destaque{flex:none;animation:trocar .5s ease-out;border-width:2px}
.destaque.vermelho{border-color:#ef4444;background:linear-gradient(135deg,#2a1215,#111a2e)}
.destaque.laranja{border-color:#f59e0b;background:linear-gradient(135deg,#2a1d0c,#111a2e)}
.destaque.verde{border-color:#10b981;background:linear-gradient(135deg,#0c2a20,#111a2e)}
.destaque .l em{font-size:1em;color:#94a3b8}
.dcontato{font-size:2.1em;font-weight:800;line-height:1.15;margin:.2em 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ddet{font-size:1.05em;color:#cbd5e1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.linha{display:flex;justify-content:space-between;align-items:center;gap:1em;padding:.4em 0;border-bottom:1px solid #1f2a44;font-size:1em}
.linha:last-child{border-bottom:0}
.linha .quem{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.linha .det{color:#94a3b8;white-space:nowrap;flex:none}
.linha.novo{animation:piscar 1s ease-in-out 6;border-radius:6px}
@keyframes piscar{50%{background:#334155}}
.termo{background:#1f2a44;border-radius:999px;padding:0 .5em;font-weight:700;color:#94a3b8}
.termo.morno{background:#78350f;color:#fde68a}.termo.quente{background:#7f1d1d;color:#fecaca}
.alerta-vermelho{border-color:#7f1d1d}.alerta-laranja{border-color:#78350f}.alerta-verde{border-color:#065f46}
.alerta-vermelho .l em{color:#f87171}.alerta-laranja .l em{color:#fbbf24}.alerta-verde .l em{color:#34d399}
.vazio{font-size:1.4em;font-weight:700;color:#64748b;padding:1em 0;text-align:center}
.agentes{flex:none;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:.5vw}
.ag{background:#111a2e;border:1px solid #1f2a44;border-top:3px solid #334155;border-radius:10px;padding:.5em .65em;min-width:0}
.ag.trabalhando{background:#0f2420;box-shadow:0 0 0 1px #065f46 inset}
.ag.desligado{opacity:.45}
.ag .cab{display:flex;align-items:center;gap:.4em}
.ag .cab b{font-size:1em}
.ag .cab small{margin-left:auto;color:#64748b;font-size:.75em}
.ag .acao{font-size:.8em;color:#cbd5e1;margin:.25em 0 .15em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag .num{font-size:.75em;color:#94a3b8}
.ag .num strong{color:#e5e7eb;font-size:1.2em}
.dot{width:.7em;height:.7em;border-radius:50%;flex:none;background:#475569;display:inline-block}
.dot.trabalhando{background:#34d399;box-shadow:0 0 .6em #34d399;animation:pulsar 1.6s ease-in-out infinite}
.dot.parado{background:#fbbf24}
.s{font-size:.95em;color:#94a3b8;margin-top:.2em}
.ok{color:#34d399}.warn{color:#fbbf24}.bad{color:#f87171}
.chip.ok{color:#34d399}.chip.warn{color:#fbbf24;border-color:#78350f}.chip.bad{color:#f87171;border-color:#7f1d1d;animation:pulsar 1.2s ease-in-out infinite}
.flash{position:absolute;top:4.5em;left:50%;transform:translateX(-50%);z-index:10;padding:.8em 2em;border-radius:14px;font-size:1.7em;font-weight:800;animation:entrar .4s ease-out;white-space:nowrap}
.flash.qualificado{background:#065f46;color:#d1fae5;box-shadow:0 0 3em #10b98188}
.flash.alerta{background:#7f1d1d;color:#fee2e2;box-shadow:0 0 3em #ef444488}
@keyframes entrar{from{opacity:0;transform:translate(-50%,-1em)}}
.banner{background:#7c2d12;color:#fed7aa;padding:.5em 1em;border-radius:10px;font-weight:600}
.centro{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.aviso{max-width:640px;text-align:center;background:#111a2e;border:1px solid #1f2a44;border-radius:16px;padding:2em}
.aviso h1{font-size:2em;margin:0 0 .5em}
.aviso p{color:#94a3b8;font-size:1.2em}
@media (max-width:1400px){.agentes{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media (max-width:900px){.tv{overflow:auto}.wrap{height:auto}.tela1,.tela2{grid-template-columns:1fr}.agentes{grid-template-columns:repeat(2,minmax(0,1fr))}.top{flex-wrap:wrap}.msg{grid-template-columns:3em minmax(0,1fr) 4em}.msg .txt{display:none}}
`;
