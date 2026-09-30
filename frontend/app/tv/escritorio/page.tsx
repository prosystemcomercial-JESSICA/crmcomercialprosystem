'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Maximize, Minimize, Moon, Sun, Volume2, VolumeX } from 'lucide-react';

// TV do escritório virtual — fica aberta o dia todo.
// Acesso: /tv/escritorio?chave=<mesmo token da /tv> (ou gestão logada, p/ prévia).
// Duas telas alternando a cada 30 s: 1) mensagens do WhatsApp ao vivo  2) o que precisa de atenção.
// Agentes sempre na faixa de baixo. Busca a cada 15 s; apita só para itens NOVOS
// (cliente esperando / lead parado = alerta; lead qualificado = campainha).
// Visual: linguagem do Geist (Vercel) — neutros, bordas de 1px, cor só com significado.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INTERVALO_DADOS = 15_000;
const INTERVALO_TELA = 30_000;
const INTERVALO_CARROSSEL = 6_000;

type Agente = { id: string; nome: string; funcao: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado'; ultima: { texto: string; em: string } | null; numeros: { rotulo: string; valor: number }[]; observacao?: string };
type Pessoa = { id: string; nome: string; cargo: string; online: boolean; ultima: { texto: string; em: string } | null; enviadas_hoje: number; esperando: number };
type Item = { id: string; contato: string; desde: string; responsavel: string; nao_lidas?: number; trecho?: string; origem?: string; tentativas?: number };
type Qualificado = { id: string; contato: string; por: string; em: string };
type Movimento = { id: string; direcao: 'ENTRADA' | 'SAIDA'; quem: string | null; agente: boolean; contato: string; texto: string; em: string };
type Conversa = { id: string; agente: string; contato: string; temperatura: string | null; nota: number | null; em: string };
type Tom = 'bad' | 'warn' | 'ok';
type Destaque = { tom: Tom; titulo: string; contato: string; detalhe: string };

function ha(iso: string | null | undefined, agora: Date) {
  if (!iso) return '';
  const min = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
  return `${Math.floor(h / 24)}d`;
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const iniciais = (nome: string) => nome.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
const STATUS_TXT: Record<Agente['status'], string> = { trabalhando: 'Ativo', parado: 'Ocioso', desligado: 'Desligado' };

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
  const [tela, setTela] = useState<1 | 2 | 3>(1);
  const [telaCheia, setTelaCheia] = useState(false);
  const [giro, setGiro] = useState(0);
  const [som, setSom] = useState(false);
  const [aviso, setAviso] = useState<{ tom: Tom; titulo: string; texto: string } | null>(null);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  // Tema: escuro (padrão) ou claro. ?tema=claro|escuro ou o botão no topo (fica salvo nesta TV).
  const [tema, setTema] = useState<'escuro' | 'claro'>('escuro');
  const ctxRef = useRef<AudioContext | null>(null);
  const vistosRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tema');
    let salvo: string | null = null;
    try { salvo = localStorage.getItem('tv-escritorio-tema'); } catch { /* sem storage */ }
    const t = q === 'claro' || q === 'escuro' ? q : salvo;
    if (t === 'claro' || t === 'escuro') setTema(t);
  }, []);

  const trocarTema = () => {
    const t = tema === 'escuro' ? 'claro' : 'escuro';
    setTema(t);
    try { localStorage.setItem('tv-escritorio-tema', t); } catch { /* sem storage */ }
  };
  const classeTv = `tv${tema === 'claro' ? ' claro' : ''}`;

  // Tela cheia: botão no topo ou tecla F. A TV lembra a escolha e volta a entrar no primeiro clique
  // (o navegador só permite tela cheia depois de um toque na página).
  const alternarTelaCheia = () => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
        localStorage.setItem('tv-escritorio-tela-cheia', '0');
      } else {
        document.documentElement.requestFullscreen?.().catch(() => {});
        localStorage.setItem('tv-escritorio-tela-cheia', '1');
      }
    } catch { /* sem suporte */ }
  };
  useEffect(() => {
    const aoMudar = () => setTelaCheia(!!document.fullscreenElement);
    const tecla = (e: KeyboardEvent) => { if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) alternarTelaCheia(); };
    document.addEventListener('fullscreenchange', aoMudar);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('fullscreenchange', aoMudar); window.removeEventListener('keydown', tecla); };
  }, []);
  const primeiroToque = () => {
    if (!som) ativarSom();
    try {
      if (!document.fullscreenElement && (localStorage.getItem('tv-escritorio-tela-cheia') === '1' || new URLSearchParams(window.location.search).get('telacheia') === '1')) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } catch { /* sem suporte */ }
  };

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
            setAviso({ tom: 'ok', titulo: 'Lead qualificado', texto: `${qNovo.contato} · ${qNovo.por}` });
          } else if (aNovos.length) {
            if (ctx) somAlerta(ctx);
            setAviso({ tom: 'bad', titulo: aNovos.length === 1 ? 'Precisa de atenção' : `${aNovos.length} novos alertas`, texto: aNovos.length === 1 ? aNovos[0].contato : aNovos.slice(0, 3).map(a => a.contato).join(', ') });
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
    const iTela = setInterval(() => setTela(t => (t === 3 ? 1 : ((t + 1) as 1 | 2 | 3))), INTERVALO_TELA);
    const iGiro = setInterval(() => setGiro(g => g + 1), INTERVALO_CARROSSEL);
    const iRelogio = setInterval(() => setAgora(new Date()), 10_000);
    return () => { ativo = false; clearInterval(iDados); clearInterval(iTela); clearInterval(iGiro); clearInterval(iRelogio); };
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 12_000);
    return () => clearTimeout(t);
  }, [aviso]);

  const horaAgora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const dataAgora = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' });

  if (erro === 'invalido' && !dados) {
    return <div className={classeTv}><style>{CSS}</style><div className="centro"><div className="vazio-box"><h1>Link do painel inválido</h1><p>Abra pelo botão &quot;Abrir TV do Escritório&quot; em Configurações → Painel da TV.</p></div></div></div>;
  }
  if (!dados) return <div className={classeTv}><style>{CSS}</style><div className="centro"><p className="mudo">{erro === 'rede' ? 'Reconectando…' : 'Carregando…'}</p></div></div>;

  const agentes: Agente[] = dados.agentes;
  const corAgente: Record<string, string> = {};
  agentes.forEach(a => { corAgente[a.nome] = a.cor; });
  const equipe: Pessoa[] = dados.equipe;
  const trabalhando = agentes.filter(a => a.status === 'trabalhando').length + equipe.filter(p => p.online).length;

  // Carrossel de destaques: alertas e qualificados, um de cada vez.
  const destaques: Destaque[] = [
    ...dados.esperando.lista.map((c: Item) => ({ tom: 'bad' as const, titulo: 'Cliente aguardando resposta', contato: c.contato, detalhe: `${c.responsavel} · há ${ha(c.desde, agora)}${c.trecho ? ` — “${c.trecho}”` : ''}` })),
    ...dados.qualificados.slice(0, 5).map((q: Qualificado) => ({ tom: 'ok' as const, titulo: 'Qualificado hoje', contato: q.contato, detalhe: `${q.por} · ${hora(q.em)}` })),
    ...dados.sumiram.lista.map((c: Item) => ({ tom: 'warn' as const, titulo: 'Sem retorno do lead', contato: c.contato, detalhe: `${c.responsavel}${c.tentativas ? ` · tentativa ${c.tentativas} de 3` : ''} · há ${ha(c.desde, agora)}` })),
  ];
  const destaque = destaques.length ? destaques[giro % destaques.length] : null;

  const kpis: { rotulo: string; valor: number; tom?: Tom }[] = [
    { rotulo: 'Ativos agora', valor: trabalhando },
    { rotulo: 'Aguardando resposta', valor: dados.esperando.total, tom: dados.esperando.total ? 'bad' : undefined },
    { rotulo: 'Sem retorno 24h+', valor: dados.sumiram.total, tom: dados.sumiram.total ? 'warn' : undefined },
    { rotulo: 'Qualificados hoje', valor: dados.qualificados.length, tom: dados.qualificados.length ? 'ok' : undefined },
    { rotulo: 'Mensagens para aprovar', valor: dados.aprovacoes.mensagens + dados.aprovacoes.documentos, tom: dados.aprovacoes.mensagens + dados.aprovacoes.documentos ? 'warn' : undefined },
  ];

  return (
    <div className={classeTv} onClick={primeiroToque}>
      <style>{CSS}</style>
      <div className="wrap">
        {aviso && (
          <div className={`toast tom-${aviso.tom}`}>
            <span className={`ponto ${aviso.tom}`} />
            <div><b>{aviso.titulo}</b><span>{aviso.texto}</span></div>
          </div>
        )}

        <header className="top">
          <div className="marca">
            <span className="logo">ProSystem</span>
            <span className="barra">/</span>
            <span>Escritório</span>
            <nav className="abas">
              <span className={tela === 1 ? 'on' : ''}>Ao vivo</span>
              <span className={tela === 2 ? 'on' : ''}>Atenção</span>
              <span className={tela === 3 ? 'on' : ''}>Captação</span>
            </nav>
          </div>
          <div className="acoes">
            {erro === 'rede' ? <span className="estado warn"><span className="ponto warn" />Reconectando</span>
              : <span className="estado"><span className="ponto ok vivo" />Ao vivo</span>}
            <button className="icone" onClick={e => { e.stopPropagation(); if (!som) ativarSom(); }} title={som ? 'Som ligado' : 'Ativar som'}>
              {som ? <Volume2 size={16} /> : <><VolumeX size={16} /><span>Ativar som</span></>}
            </button>
            <button className="icone" onClick={e => { e.stopPropagation(); alternarTelaCheia(); }} title="Tela cheia (tecla F)">
              {telaCheia ? <><Minimize size={16} /><span>Sair</span></> : <><Maximize size={16} /><span>Tela cheia</span></>}
            </button>
            <button className="icone" onClick={e => { e.stopPropagation(); trocarTema(); }} title="Alternar tema">
              {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="relogio"><b>{horaAgora}</b><span>{dataAgora}</span></div>
          </div>
        </header>
        <div className="progresso"><i key={tela} /></div>

        <section className="kpis">
          {kpis.map(k => (
            <div key={k.rotulo} className="kpi">
              <span className="rot">{k.tom && <span className={`ponto ${k.tom}`} />}{k.rotulo}</span>
              <b className={k.tom || ''}>{k.valor}</b>
            </div>
          ))}
        </section>

        <main className="palco" key={tela}>
          {tela === 1 ? (
            <div className="tela1">
              <section className="painel">
                <div className="cab"><h2>Mensagens</h2><span className="mudo">WhatsApp · últimas 12 horas</span></div>
                <div className="tabela">
                  {(dados.movimentos as Movimento[]).slice(0, 12).map(m => (
                    <div key={m.id} className={`msg ${novos.has(`m:${m.id}`) ? 'novo' : ''}`}>
                      <span className="mono mudo">{hora(m.em)}</span>
                      <span className={`dir ${m.direcao === 'ENTRADA' ? 'in' : 'out'}`}>
                        {m.direcao === 'ENTRADA' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </span>
                      <span className="quem">
                        {m.direcao === 'ENTRADA'
                          ? <><b>{m.contato}</b></>
                          : <><b style={m.quem && corAgente[m.quem] ? { color: corAgente[m.quem] } : undefined}>{m.quem}</b><span className="mudo"> para </span><b>{m.contato}</b></>}
                      </span>
                      <span className="txt">{m.texto}</span>
                      <span className="mono mudo dir-r">{ha(m.em, agora)}</span>
                    </div>
                  ))}
                  {!dados.movimentos.length && <div className="vazio">Nenhuma mensagem nas últimas horas</div>}
                </div>
              </section>

              <div className="coluna">
                <section className={`painel destaque tom-${destaque ? destaque.tom : 'ok'}`} key={`${giro}`}>
                  {destaque ? (
                    <>
                      <div className="cab"><span className="rot"><span className={`ponto ${destaque.tom}`} />{destaque.titulo}</span><span className="mono mudo">{(giro % destaques.length) + 1} de {destaques.length}</span></div>
                      <div className="nome">{destaque.contato}</div>
                      <div className="det">{destaque.detalhe}</div>
                    </>
                  ) : (
                    <>
                      <div className="cab"><span className="rot"><span className="ponto ok" />Tudo em dia</span></div>
                      <div className="nome">Nenhum alerta agora</div>
                    </>
                  )}
                </section>
                {dados.laya && (
                  <section className="painel laya">
                    <div className="cab"><h2><span className="ponto roxo vivo-roxo" />Laya · o cérebro</h2><span className="mono mudo">{dados.laya.cerebro?.pct_laya == null ? '' : `${dados.laya.cerebro.pct_laya}% das decisões`}</span></div>
                    <div className="laya-niveis">
                      {dados.laya.tarefas.map((t: any) => (
                        <div key={t.tarefa} className="laya-t">
                          <span className="mudo">{({ segmento: 'Ramo', intencao: 'Intenção', cancelar: 'Cancelar' } as any)[t.tarefa] || t.tarefa}</span>
                          <b className={`nivel-${t.nivel}`}>{t.nome_nivel}</b>
                          <span className="barra-n"><i style={{ width: `${Math.min(100, (t.exemplos / 30) * 100)}%` }} /></span>
                          <small className="mono mudo">{t.exemplos}/30 · {t.acerto == null ? '—' : `${t.acerto}%`}</small>
                        </div>
                      ))}
                    </div>
                    {dados.laya.cerebro && (
                      <div className="laya-hoje mono">
                        <span><b>{dados.laya.cerebro.decisoes}</b> decisões</span>
                        <span><b>{dados.laya.cerebro.aprendidas}</b> aprendidas</span>
                        <span><b className="ok">{dados.laya.cerebro.evitadas}</b> IA poupada</span>
                      </div>
                    )}
                  </section>
                )}
                <section className="painel crescer">
                  <div className="cab"><h2>Conversas em andamento</h2><span className="mono mudo">{dados.conversando.length}</span></div>
                  {(dados.conversando as Conversa[]).slice(0, 7).map(c => (
                    <div key={c.id} className="linha">
                      <span className="quem"><b style={{ color: corAgente[c.agente] }}>{c.agente}</b><span className="mudo"> com </span>{c.contato}</span>
                      <span className="meta">{c.nota != null && <span className={`selo ${c.nota >= 70 ? 'bad' : c.nota >= 40 ? 'warn' : ''}`}>{c.nota}</span>}<span className="mono mudo">{ha(c.em, agora)}</span></span>
                    </div>
                  ))}
                  {!dados.conversando.length && <div className="vazio">Nenhum agente conversando agora</div>}
                </section>
              </div>
            </div>
          ) : tela === 3 && dados.captacao ? (
            <Captacao c={dados.captacao} agora={agora} />
          ) : (
            <div className="tela2">
              <Lista titulo="Aguardando resposta" tom="bad" total={dados.esperando.total} vazio="Ninguém aguardando">
                {dados.esperando.lista.slice(0, 10).map((c: Item) => (
                  <div key={c.id} className={`linha ${novos.has(`a:${c.id}`) ? 'novo' : ''}`}>
                    <span className="quem">{c.contato}</span>
                    <span className="meta"><span className="mudo">{c.responsavel}</span><span className="mono bad">{ha(c.desde, agora)}</span></span>
                  </div>
                ))}
              </Lista>
              <Lista titulo="Sem retorno há 24h+" tom="warn" total={dados.sumiram.total} vazio="Nenhum lead parado">
                {dados.sumiram.lista.slice(0, 10).map((c: Item) => (
                  <div key={c.id} className={`linha ${novos.has(`a:${c.id}`) ? 'novo' : ''}`}>
                    <span className="quem">{c.contato}</span>
                    <span className="meta"><span className="mudo">{c.responsavel}{c.tentativas ? ` · ${c.tentativas}/3` : ''}</span><span className="mono warn">{ha(c.desde, agora)}</span></span>
                  </div>
                ))}
              </Lista>
              <div className="coluna">
                <Lista titulo="Qualificados hoje" tom="ok" total={dados.qualificados.length} vazio="Nenhum ainda hoje">
                  {dados.qualificados.slice(0, 4).map((q: Qualificado) => (
                    <div key={q.id} className={`linha ${novos.has(`q:${q.id}`) ? 'novo' : ''}`}>
                      <span className="quem">{q.contato}</span>
                      <span className="meta"><span className="mudo">{q.por}</span><span className="mono mudo">{hora(q.em)}</span></span>
                    </div>
                  ))}
                </Lista>
                <section className="painel crescer">
                  <div className="cab"><h2>Equipe</h2></div>
                  {equipe.map(p => (
                    <div key={p.id} className="linha">
                      <span className="quem"><span className={`ponto ${p.online ? 'ok' : 'cinza'}`} />{p.nome}</span>
                      <span className="meta">
                        <span className="mudo">{p.enviadas_hoje} enviadas</span>
                        <span className={p.esperando ? 'bad' : 'mudo'}>{p.esperando} aguardando</span>
                        <span className="mono mudo">{p.ultima ? ha(p.ultima.em, agora) : '—'}</span>
                      </span>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          )}
        </main>

        <footer className="agentes">
          {agentes.filter(a => a.status !== 'desligado' || a.ultima).map(a => (
            <div key={a.id} className={`ag ${a.status}`}>
              <span className="av" style={{ color: a.cor, background: `color-mix(in srgb, ${a.cor} 16%, transparent)` }}>{iniciais(a.nome)}</span>
              <div className="info">
                <div className="l1"><b>{a.nome}</b><span className={`ponto ${a.status === 'trabalhando' ? 'ok' : a.status === 'parado' ? 'warn' : 'cinza'}`} /></div>
                <div className="l2">{a.ultima ? `${a.ultima.texto}` : (a.observacao || a.funcao)}</div>
                <div className="l3 mono">{STATUS_TXT[a.status]}{a.ultima ? ` · ${ha(a.ultima.em, agora)}` : ''}</div>
              </div>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}

const NOME_FONTE: Record<string, string> = { heitor: 'Heitor', campanha: 'Campanha', whatsapp: 'WhatsApp', outros: 'Outros' };
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`);

function Captacao({ c, agora }: { c: any; agora: Date }) {
  const fontes = ['heitor', 'campanha', 'whatsapp', 'outros'] as const;
  const maxDia = Math.max(1, ...c.mes.por_dia.map((d: any) => d.heitor + d.campanha + d.whatsapp + d.outros));
  const maxReg = Math.max(1, ...c.regioes_mes.map((r: any) => r.total));
  const h = c.heitor;
  const ritmo = c.mes.mes_passado_ate_hoje ? Math.round(((c.mes.total - c.mes.mes_passado_ate_hoje) / c.mes.mes_passado_ate_hoje) * 100) : null;
  return (
    <div className="tela3">
      {c.atencao.length > 0 && (
        <div className="faixa-atencao">
          {c.atencao.map((a: any) => <span key={a.chave} className={`aviso-item ${a.tom}`}><span className={`ponto ${a.tom} pisca`} />{a.texto}</span>)}
        </div>
      )}
      <div className="cap-grid">
        <div className="coluna">
          <section className="painel">
            <div className="cab"><h2>Captados hoje</h2><span className="mono mudo">{agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span></div>
            <div className="grande">{c.hoje.total}</div>
            <div className="barra-fontes">
              {fontes.map(f => c.hoje[f] ? <i key={f} className={`f-${f}`} style={{ flex: c.hoje[f] }} /> : null)}
              {!c.hoje.total && <i className="f-vazio" style={{ flex: 1 }} />}
            </div>
            <div className="legenda">
              {fontes.map(f => (
                <span key={f}><span className={`qd f-${f}`} />{NOME_FONTE[f]} <b className="mono">{c.hoje[f]}</b></span>
              ))}
            </div>
          </section>
          <section className="painel crescer">
            <div className="cab"><h2>Últimos captados</h2><span className="mono mudo">{c.ultimos.length}</span></div>
            {c.ultimos.length ? c.ultimos.slice(0, 8).map((u: any, i: number) => (
              <div key={i} className={`linha ${i === 0 ? 'novo' : ''}`}>
                <span className="quem"><span className={`qd f-${u.fonte}`} />{u.nome || 'Sem nome'}</span>
                <span className="meta"><span className="mudo">{u.regiao}</span><span className="mono mudo">{new Date(u.em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span></span>
              </div>
            )) : <div className="vazio">Nenhum lead captado hoje ainda</div>}
          </section>
        </div>

        <div className="coluna">
          <section className="painel">
            <div className="cab">
              <h2><span className={`ponto ${h.erro ? 'bad pisca' : h.ativo ? 'ok vivo' : 'cinza'}`} />Heitor · prospecção hoje</h2>
              <span className="mono mudo">{h.erro ? 'com erro' : h.ativo ? 'ativo' : 'desligado'}</span>
            </div>
            <div className="funil-h">
              {[
                ['Encontrados no Maps', h.encontrados, ''],
                ['Cadastrados como lead', h.cadastrados, 'ok'],
                ['Sem WhatsApp', h.sem_whatsapp, ''],
                ['Rede / fora do perfil', h.descartados, ''],
              ].map(([rot, v, tom]) => (
                <div key={rot as string} className="linha"><span className="quem">{rot}</span><b className={`mono ${tom}`}>{v as number}</b></div>
              ))}
              <div className="linha"><span className="quem">Na fila da Caroline</span><b className={`mono ${h.fila_caroline >= 30 ? 'warn' : ''}`}>{h.fila_caroline >= 30 && <span className="ponto warn pisca" />} {h.fila_caroline}</b></div>
              <div className="linha"><span className="quem">Aguardando análise</span><b className="mono">{h.aguardando}</b></div>
            </div>
            <div className="rodape-p mudo">No mês: <b className="mono">{h.cadastrados_mes}</b> cadastrados{h.ultima_rodada ? ` · última rodada ${new Date(h.ultima_rodada).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}` : ''}</div>
          </section>
          <section className="painel crescer">
            <div className="cab"><h2>Retorno efetivo · primeiros contatos do mês</h2></div>
            <div className="tabela-ret">
              <span /><b><span className="qd f-heitor" />Heitor</b><b><span className="qd f-campanha" />Campanha</b>
              {[
                ['Contatados', 'contatados', null],
                ['Responderam', 'responderam', 'taxa_resposta'],
                ['Qualificados', 'qualificados', 'taxa_qualificacao'],
                ['Demos marcadas', 'demos', null],
                ['Sem interesse', 'sem_interesse', null],
              ].map(([rot, k, t]) => (
                <Fragment key={k as string}>
                  <span className="mudo">{rot}</span>
                  {(['heitor', 'campanha'] as const).map(f => {
                    const r = c.retorno[f];
                    const baixo = t === 'taxa_resposta' && r.contatados >= 10 && (r.taxa_resposta ?? 100) < 10;
                    return <span key={f} className={`mono ${baixo ? 'bad' : ''}`}>{baixo && <span className="ponto bad pisca" />} {r[k as string]}{t ? <small> · {pct(r[t as string])}</small> : null}</span>;
                  })}
                </Fragment>
              ))}
            </div>
          </section>
        </div>

        <div className="coluna">
          <section className="painel">
            <div className="cab"><h2>Acumulado de {c.mes.nome}</h2><span className="mono mudo">dia {c.mes.dia_atual} de {c.mes.dias_no_mes}</span></div>
            <div className="acum">
              <div><div className="grande">{c.mes.total}</div><span className="mudo">leads no mês</span></div>
              <div className="acum-lado">
                <span><b className="mono">{c.mes.media_dia}</b> <span className="mudo">por dia</span></span>
                <span><b className="mono">{c.mes.projecao ?? '—'}</b> <span className="mudo">projeção do mês</span></span>
                {ritmo != null && <span><b className={`mono ${ritmo >= 0 ? 'ok' : 'bad'}`}>{ritmo >= 0 ? '+' : ''}{ritmo}%</b> <span className="mudo">vs mês passado</span></span>}
              </div>
            </div>
            <div className="dias">
              {c.mes.por_dia.map((d: any, i: number) => {
                const tot = d.heitor + d.campanha + d.whatsapp + d.outros;
                const futuro = i + 1 > c.mes.dia_atual;
                return (
                  <div key={i} className={`dia ${i + 1 === c.mes.dia_atual ? 'hoje' : ''} ${futuro ? 'futuro' : ''}`} title={`Dia ${i + 1}: ${tot}`}>
                    <div className="pilha" style={{ height: futuro ? '4%' : `${Math.max(3, (tot / maxDia) * 100)}%` }}>
                      {!futuro && fontes.map(f => d[f] ? <i key={f} className={`f-${f}`} style={{ flex: d[f] }} /> : null)}
                    </div>
                    <small className="mono">{(i + 1) % 5 === 0 || i === 0 || i + 1 === c.mes.dia_atual ? i + 1 : ''}</small>
                  </div>
                );
              })}
            </div>
            <div className="legenda">
              {fontes.map(f => <span key={f}><span className={`qd f-${f}`} />{NOME_FONTE[f]} <b className="mono">{c.mes[f]}</b></span>)}
            </div>
          </section>
          <section className="painel crescer">
            <div className="cab"><h2>Regiões do mês</h2><span className="mono mudo">hoje: {c.regioes_hoje.slice(0, 2).map((r: any) => `${r.nome} ${r.total}`).join(' · ') || '—'}</span></div>
            {c.regioes_mes.length ? c.regioes_mes.slice(0, 6).map((r: any) => (
              <div key={r.nome} className="reg">
                <span className="quem">{r.nome}</span>
                <span className="reg-barra"><i className="f-heitor" style={{ width: `${(r.heitor / maxReg) * 100}%` }} /><i className="f-campanha" style={{ width: `${(r.campanha / maxReg) * 100}%` }} /><i className="f-outros" style={{ width: `${((r.total - r.heitor - r.campanha) / maxReg) * 100}%` }} /></span>
                <b className="mono">{r.total}</b>
              </div>
            )) : <div className="vazio">Sem leads no mês</div>}
            {c.campanhas_mes.length > 0 && <div className="rodape-p mudo">Campanhas: {c.campanhas_mes.map((x: any) => `${x.nome} (${x.total})`).join(' · ')}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function Lista({ titulo, tom, total, vazio, children }: { titulo: string; tom: Tom; total: number; vazio: string; children: React.ReactNode }) {
  const temItens = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="painel crescer">
      <div className="cab"><h2><span className={`ponto ${tom}`} />{titulo}</h2><span className={`mono ${total ? tom : 'mudo'}`}>{total}</span></div>
      {temItens ? children : <div className="vazio">{vazio}</div>}
    </section>
  );
}

const CSS = `
.tv{
  --bg:#0a0a0a;--s1:#111111;--s2:#171717;--borda:#262626;--borda2:#1f1f1f;
  --t1:#ededed;--t2:#a1a1a1;--t3:#6e6e6e;
  --ok:#45a557;--warn:#f1a10d;--bad:#e5484d;--azul:#3291ff;--cinza:#525252;
  min-height:100vh;background:var(--bg);color:var(--t1);
  font-family:var(--font-sans),Inter,system-ui,sans-serif;font-size:clamp(10px,min(0.82vw,1.45vh),17px);
  font-feature-settings:"cv11","ss01";letter-spacing:-.005em;overflow:hidden;-webkit-font-smoothing:antialiased}
.tv.claro{
  --bg:#fafafa;--s1:#ffffff;--s2:#f5f5f5;--borda:#eaeaea;--borda2:#f0f0f0;
  --t1:#171717;--t2:#666666;--t3:#8f8f8f;
  --ok:#297a3a;--warn:#a35200;--bad:#d8222e;--azul:#0068d6;--cinza:#c7c7c7}
.wrap{height:100vh;box-sizing:border-box;padding:1.2vw 1.5vw;display:flex;flex-direction:column;gap:.9vw;position:relative}
.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;letter-spacing:0}
.mudo{color:var(--t2)}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}

.top{display:flex;align-items:center;justify-content:space-between;gap:1em}
.marca{display:flex;align-items:center;gap:.6em;font-size:1.25em;font-weight:500}
.logo{font-weight:700;letter-spacing:-.02em}
.barra{color:var(--t3);font-weight:300}
.abas{display:flex;gap:.2em;margin-left:1.2em;padding:.2em;border:1px solid var(--borda);border-radius:8px;background:var(--s1);font-size:.72em}
.abas span{padding:.35em .9em;border-radius:6px;color:var(--t2);transition:all .3s}
.abas span.on{background:var(--s2);color:var(--t1);box-shadow:0 0 0 1px var(--borda)}
.acoes{display:flex;align-items:center;gap:.7em}
.estado{display:flex;align-items:center;gap:.45em;font-size:.9em;color:var(--t2)}
.icone{display:flex;align-items:center;gap:.4em;height:2.3em;padding:0 .7em;border:1px solid var(--borda);background:var(--s1);color:var(--t1);border-radius:8px;cursor:pointer;font:inherit;font-size:.9em}
.icone:hover{background:var(--s2)}
.relogio{display:flex;flex-direction:column;align-items:flex-end;line-height:1.15;margin-left:.6em}
.relogio b{font-size:1.5em;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.relogio span{font-size:.8em;color:var(--t2);text-transform:capitalize}
.progresso{height:1px;background:var(--borda);margin-top:-.4vw}
.progresso i{display:block;height:100%;background:var(--t2);animation:encher 30s linear forwards}
@keyframes encher{from{width:0}to{width:100%}}

.ponto{display:inline-block;width:.55em;height:.55em;border-radius:50%;flex:none;background:var(--cinza)}
.ponto.ok{background:var(--ok)}.ponto.warn{background:var(--warn)}.ponto.bad{background:var(--bad)}.ponto.cinza{background:var(--cinza)}
.ponto.vivo{box-shadow:0 0 0 0 var(--ok);animation:onda 2s infinite}
@keyframes onda{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ok) 60%,transparent)}100%{box-shadow:0 0 0 .5em transparent}}

.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid var(--borda);border-radius:10px;background:var(--s1);overflow:hidden}
.kpi{padding:.8em 1.1em;border-left:1px solid var(--borda);display:flex;flex-direction:column;gap:.25em}
.kpi:first-child{border-left:0}
.kpi .rot{display:flex;align-items:center;gap:.5em;font-size:.88em;color:var(--t2)}
.kpi b{font-size:2.3em;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1}

.palco{flex:1;min-height:0;animation:entrar .45s ease-out}
@keyframes entrar{from{opacity:0;transform:translateY(6px)}}
.tela1{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(0,1fr);gap:.9vw;height:100%}
.tela2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9vw;height:100%}
.coluna{display:flex;flex-direction:column;gap:.9vw;min-height:0}
.crescer{flex:1}
.painel{background:var(--s1);border:1px solid var(--borda);border-radius:10px;padding:.9em 1.1em;min-width:0;min-height:0;overflow:hidden}
.cab{display:flex;align-items:center;justify-content:space-between;gap:1em;padding-bottom:.7em;margin-bottom:.3em;border-bottom:1px solid var(--borda2)}
.cab h2{display:flex;align-items:center;gap:.55em;margin:0;font-size:1em;font-weight:600}
.cab .mono{font-size:1em}
.rot{display:flex;align-items:center;gap:.5em;font-size:.9em;color:var(--t2)}

.tabela{display:flex;flex-direction:column}
.msg{display:grid;grid-template-columns:3.4em 1.6em minmax(0,17em) minmax(0,1fr) 4.2em;align-items:center;gap:.7em;padding:.55em .2em;border-bottom:1px solid var(--borda2);font-size:1em}
.msg:last-child{border-bottom:0}
.msg .quem{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msg .quem b{font-weight:600}
.msg .txt{color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dir{display:flex;align-items:center;justify-content:center;width:1.6em;height:1.6em;border-radius:6px;border:1px solid var(--borda)}
.dir.in{color:var(--ok)}.dir.out{color:var(--t2)}
.dir-r{text-align:right}
.msg.novo{animation:chegar .5s ease-out,marca 3s ease-out}
@keyframes chegar{from{opacity:0;transform:translateY(-4px)}}
@keyframes marca{0%,40%{background:var(--s2)}100%{background:transparent}}

.destaque{flex:none;border-left:3px solid var(--cinza);animation:entrar .4s ease-out}
.destaque.tom-bad{border-left-color:var(--bad)}.destaque.tom-warn{border-left-color:var(--warn)}.destaque.tom-ok{border-left-color:var(--ok)}
.destaque .cab{border-bottom:0;padding-bottom:.3em}
.destaque .nome{font-size:1.9em;font-weight:600;letter-spacing:-.025em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.destaque .det{color:var(--t2);margin-top:.35em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

.linha{display:flex;align-items:center;justify-content:space-between;gap:1em;padding:.55em .2em;border-bottom:1px solid var(--borda2)}
.linha:last-child{border-bottom:0}
.linha .quem{display:flex;align-items:center;gap:.5em;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.linha .meta{display:flex;align-items:center;gap:.9em;flex:none;font-size:.92em}
.linha.novo{animation:marca 3s ease-out}
.selo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;padding:.1em .5em;border-radius:999px;border:1px solid var(--borda);color:var(--t2)}
.selo.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 35%,transparent)}
.selo.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 35%,transparent)}
.vazio{color:var(--t3);padding:1.5em 0;text-align:center}

.agentes{flex:none;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:.6vw}
.ag{display:flex;gap:.65em;align-items:flex-start;background:var(--s1);border:1px solid var(--borda);border-radius:10px;padding:.65em .75em;min-width:0}
.ag.desligado{opacity:.5}
.av{width:2.1em;height:2.1em;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.85em;font-weight:700;flex:none}
.info{min-width:0;flex:1}
.l1{display:flex;align-items:center;justify-content:space-between;gap:.4em}
.l1 b{font-weight:600;font-size:.98em}
.l2{font-size:.82em;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1em}
.l3{font-size:.72em;color:var(--t3);margin-top:.2em}

.toast{position:absolute;top:1.2vw;right:1.5vw;z-index:10;display:flex;gap:.8em;align-items:flex-start;min-width:22em;max-width:36em;padding:1em 1.2em;background:var(--s1);border:1px solid var(--borda);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);animation:deslizar .35s cubic-bezier(.2,.8,.2,1)}
.toast .ponto{margin-top:.45em;width:.7em;height:.7em}
.toast b{display:block;font-size:1.15em;font-weight:600}
.toast span:not(.ponto){display:block;color:var(--t2);margin-top:.2em;font-size:1.05em}
.toast.tom-ok{border-color:color-mix(in srgb,var(--ok) 45%,var(--borda))}
.toast.tom-bad{border-color:color-mix(in srgb,var(--bad) 45%,var(--borda))}
@keyframes deslizar{from{opacity:0;transform:translateY(-8px)}}

.centro{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.vazio-box{max-width:560px;text-align:center;background:var(--s1);border:1px solid var(--borda);border-radius:12px;padding:2em}
.vazio-box h1{font-size:1.6em;margin:0 0 .5em;font-weight:600}
.vazio-box p{color:var(--t2)}
.tv{--c-heitor:#84cc16;--c-campanha:#3291ff;--c-whatsapp:#2dd4bf;--c-outros:#737373}
.tv.claro{--c-heitor:#4d7c0f;--c-campanha:#0068d6;--c-whatsapp:#0f766e;--c-outros:#a3a3a3}
.f-heitor{background:var(--c-heitor)}.f-campanha{background:var(--c-campanha)}.f-whatsapp{background:var(--c-whatsapp)}.f-outros{background:var(--c-outros)}.f-vazio{background:var(--borda)}
.qd{display:inline-block;width:.6em;height:.6em;border-radius:2px;margin-right:.45em;flex:none;vertical-align:middle}
.pisca{animation:pisca 1s steps(2,start) infinite}
@keyframes pisca{to{visibility:hidden}}
.tela3{display:flex;flex-direction:column;gap:.7vw;height:100%}
.faixa-atencao{display:flex;flex-wrap:wrap;gap:.5em}
.aviso-item{display:flex;align-items:center;gap:.5em;padding:.35em .8em;border:1px solid var(--borda);border-radius:8px;background:var(--s1);font-size:.92em}
.aviso-item.bad{border-color:color-mix(in srgb,var(--bad) 45%,var(--borda))}.aviso-item.warn{border-color:color-mix(in srgb,var(--warn) 45%,var(--borda))}
.cap-grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9vw}
.grande{font-size:3.4em;font-weight:600;letter-spacing:-.04em;line-height:1.05;font-variant-numeric:tabular-nums}
.barra-fontes{display:flex;height:.7em;border-radius:4px;overflow:hidden;margin:.7em 0 .6em;gap:2px}
.barra-fontes i{display:block;height:100%}
.legenda{display:flex;flex-wrap:wrap;gap:.3em 1.1em;font-size:.9em;color:var(--t2)}
.legenda b{color:var(--t1);margin-left:.2em}
.funil-h .linha b{font-size:1.1em}
.rodape-p{font-size:.85em;margin-top:.6em}
.tabela-ret{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr 1fr;gap:.35em .8em;align-items:center;font-size:1em}
.tabela-ret b{font-weight:600;font-size:.9em;display:flex;align-items:center}
.tabela-ret small{color:var(--t2);font-size:.8em}
.acum{display:flex;justify-content:space-between;align-items:flex-end;gap:1em}
.acum-lado{display:flex;flex-direction:column;align-items:flex-end;gap:.25em;font-size:.95em}
.dias{display:flex;align-items:flex-end;gap:2px;height:6.5em;margin:.9em 0 .5em}
.dia{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:.2em;min-width:0}
.pilha{width:100%;display:flex;flex-direction:column-reverse;border-radius:2px 2px 0 0;overflow:hidden;background:var(--borda)}
.pilha i{display:block;width:100%}
.dia.futuro .pilha{opacity:.4}
.dia.hoje .pilha{box-shadow:0 0 0 1px var(--t1)}
.dia small{font-size:.65em;color:var(--t3);height:1em}
.reg{display:grid;grid-template-columns:minmax(0,10em) 1fr 2.5em;align-items:center;gap:.7em;padding:.3em 0;border-bottom:1px solid var(--borda2)}
.reg:last-of-type{border-bottom:0}
.reg .quem{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.reg b{text-align:right}
.reg-barra{display:flex;height:.55em;background:var(--s2);border-radius:3px;overflow:hidden}
.reg-barra i{display:block;height:100%}
.tv{--roxo:#a78bfa}.tv.claro{--roxo:#6d28d9}
.ponto.roxo{background:var(--roxo)}
.vivo-roxo{animation:onda-roxo 2s infinite}
@keyframes onda-roxo{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--roxo) 60%,transparent)}100%{box-shadow:0 0 0 .5em transparent}}
.painel.laya{flex:none;border-color:color-mix(in srgb,var(--roxo) 40%,var(--borda))}
.laya-niveis{display:grid;gap:.35em}
.laya-t{display:grid;grid-template-columns:5.5em 6.5em 1fr 6.5em;align-items:center;gap:.6em;font-size:.92em}
.laya-t b{font-weight:600}.nivel-aprendiz{color:var(--t2)}.nivel-assistente{color:var(--azul)}.nivel-titular{color:var(--ok)}
.barra-n{height:.4em;background:var(--s2);border-radius:3px;overflow:hidden}
.barra-n i{display:block;height:100%;background:var(--roxo)}
.laya-t small{text-align:right}
.laya-hoje{display:flex;gap:1.2em;margin-top:.6em;font-size:.9em;color:var(--t2)}
.laya-hoje b{color:var(--t1)}
@media (max-width:1400px){.agentes{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media (max-width:900px){.cap-grid{grid-template-columns:1fr}}
@media (max-width:900px){.tv{overflow:auto}.wrap{height:auto}.tela1,.tela2{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.agentes{grid-template-columns:repeat(2,minmax(0,1fr))}.top{flex-wrap:wrap}.abas{display:none}.msg{grid-template-columns:3em 1.6em minmax(0,1fr) 3.5em}.msg .txt{display:none}}
`;
