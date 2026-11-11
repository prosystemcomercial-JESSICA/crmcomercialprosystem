'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Escritório vivo (10/11/2026, substitui a sala isométrica): planta baixa com uma sala por setor, café,
// sala de reunião e a sala da Jessica, ligadas por corredores. Os bonecos andam suavemente (a posição é
// escrita direto no elemento a cada quadro, sem redesenhar a sala). Quem passa trabalho para outro agente
// (passagens de hoje e conversas registradas) caminha até a mesa dele e os dois trocam balões; quem está
// parado vai ao café e conversa por lá. Somente visual: nada é enviado nem gravado.

export type AgenteSala = {
  id: string; nome: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado' | 'erro';
  ultima: { texto: string; em?: string } | null; erro?: string | null; precisa?: string | null; funcao?: string;
};
export type Chamado = 'sala' | 'reuniao';
export type ConversaSala = { id: string; de: string; para: string; tema: string; falas: { quem: string; texto: string }[] };
export type PassagemSala = { de: string; para: string; tipo: 'passa' | 'orienta'; rotulo: string; hoje: number | null };

type P = { x: number; y: number };
const LARG = 1200, ALT = 720, VEL = 110, TOPO = 56; // palco em px; velocidade em px/s; folga para os balões da 1ª fileira
const CORR_Y = 360, CORR_X = 797;         // corredor horizontal e vertical

// Mesmos setores do servidor (lib/assistente/escritorio-setores.ts); agente novo cai em "clientes".
const SETORES: Record<string, string[]> = {
  entrada: ['heitor', 'bia', 'zequinha', 'clarice'],
  vendas: ['caroline', 'julio', 'lurdinha', 'luiz_felipe'],
  inteligencia: ['rafael', 'laya', 'olivia', 'sofia', 'joana'],
  clientes: ['helena', 'mila', 'otavio', 'marta'],
};

type Sala = { id: string; nome: string; x: number; y: number; w: number; h: number; lado: 'baixo' | 'cima' | 'esq'; piso: string; tom: string; porta: P; corredor: P };
const SALAS: Sala[] = ([
  { id: 'entrada', nome: 'Entrada de leads', x: 20, y: 20, w: 370, h: 320, lado: 'baixo', piso: '#eaf3ff', tom: '#2563eb' },
  { id: 'vendas', nome: 'Vendas', x: 410, y: 20, w: 370, h: 320, lado: 'baixo', piso: '#eafaf1', tom: '#16a34a' },
  { id: 'inteligencia', nome: 'Inteligência e treino', x: 20, y: 380, w: 370, h: 320, lado: 'cima', piso: '#f3efff', tom: '#7c3aed' },
  { id: 'clientes', nome: 'Clientes e gestão', x: 410, y: 380, w: 370, h: 320, lado: 'cima', piso: '#fff4e8', tom: '#ea580c' },
  { id: 'reuniao', nome: 'Sala de reunião', x: 815, y: 20, w: 365, h: 220, lado: 'esq', piso: '#eef2f7', tom: '#475569' },
  { id: 'cafe', nome: 'Café e lounge', x: 815, y: 260, w: 365, h: 200, lado: 'esq', piso: '#fdf2e9', tom: '#b45309' },
  { id: 'jessica', nome: 'Sala da Jessica', x: 815, y: 480, w: 365, h: 220, lado: 'esq', piso: '#fefce8', tom: '#ca8a04' },
] as Omit<Sala, 'porta' | 'corredor'>[]).map(s => {
  const porta = s.lado === 'baixo' ? { x: s.x + s.w / 2, y: s.y + s.h } : s.lado === 'cima' ? { x: s.x + s.w / 2, y: s.y } : { x: s.x, y: s.y + s.h / 2 };
  return { ...s, porta, corredor: s.lado === 'esq' ? { x: CORR_X, y: porta.y } : { x: porta.x, y: CORR_Y } };
});
const SALA = Object.fromEntries(SALAS.map(s => [s.id, s])) as Record<string, Sala>;

// Lugares de pausa e de reunião.
type Lugar = { id: string; zona: 'cafe' | 'reuniao' | 'jessica'; p: P };
const CAFE: Lugar[] = [
  { x: 1010, y: 318 }, { x: 1050, y: 322 }, { x: 1090, y: 318 }, // balcão do café
  { x: 905, y: 430 }, { x: 950, y: 434 },                         // sofá
  { x: 1085, y: 420 }, { x: 1140, y: 420 },                        // mesinha redonda
].map((p, i) => ({ id: `cafe${i}`, zona: 'cafe' as const, p }));
const MESA_REUNIAO = { x: 1000, y: 130 };
const reuniaoLugar = (i: number, n: number): P => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return { x: MESA_REUNIAO.x + Math.cos(a) * 150, y: MESA_REUNIAO.y + 8 + Math.sin(a) * 74 }; };
const SALA_JESSICA: P[] = [{ x: 945, y: 668 }, { x: 990, y: 680 }, { x: 1100, y: 680 }, { x: 1145, y: 668 }];
const JESSICA = { mesa: { x: 1045, y: 600 }, assento: { x: 1052, y: 588 } };

const PAPO_CAFE = ['☕ Café novo saindo!', '😄 Que dia bom de vendas', '🥐 Alguém quer pão de queijo?', '📈 Hoje rendeu', '🙌 Bora que a meta vem', '😂 Essa foi boa'];
const PAPO_REUNIAO = ['📊 Vamos ver os números', '🎯 Qual a meta da semana?', '💡 Tive uma ideia', '✅ Combinado!'];

// Aparência: cor do cabelo, cabelo comprido e tom de pele.
const VISUAL: Record<string, [string, boolean, string?]> = {
  bia: ['#5b3a1a', true], lurdinha: ['#9ca3af', true], clarice: ['#1f1a17', true], luiz_felipe: ['#2b2b2b', false],
  zequinha: ['#ef4444', false], helena: ['#1c1410', true, '#7a4a2a'], laya: ['#6b21a8', true], marta: ['#7c2d12', true],
  sofia: ['#e0b100', true], caroline: ['#b45309', true], julio: ['#1c1917', false], rafael: ['#3f2a1d', false],
  olivia: ['#111827', true], heitor: ['#78350f', false, '#c68642'], mila: ['#7c2d12', true], otavio: ['#292524', false, '#e0ac69'],
  joana: ['#1f1a17', true, '#8d5524'], jessica: ['#5a3825', true],
};

function salaDoPonto(p: P) { return SALAS.find(s => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h); }
/** De um ponto dentro da sala até a porta, sem atravessar mesas (desce para o corredor entre as fileiras). */
function interior(s: Sala, p: P): P[] {
  if (s.lado === 'esq') return [{ x: 852, y: p.y }, { x: 852, y: s.porta.y }, s.porta];
  const faixa = p.y + 32;
  return [{ x: p.x, y: faixa }, { x: s.porta.x, y: faixa }, s.porta];
}
function rota(de: P, para: P): P[] {
  const a = salaDoPonto(de), b = salaDoPonto(para);
  if (a && b && a.id === b.id) {
    const ia = interior(a, de).slice(0, -1), ib = interior(b, para).slice(0, -1).reverse();
    return [...ia, ...ib, para];
  }
  const ida = a ? interior(a, de) : [];
  const c1 = a ? a.corredor : Math.abs(de.y - CORR_Y) < Math.abs(de.x - CORR_X) ? { x: de.x, y: CORR_Y } : { x: CORR_X, y: de.y };
  const c2 = b ? b.corredor : { x: para.x, y: CORR_Y };
  const cruza = (c1.y === CORR_Y && c2.y === CORR_Y) || (c1.x === CORR_X && c2.x === CORR_X) ? [] : [{ x: CORR_X, y: CORR_Y }];
  return [...ida, c1, ...cruza, c2, ...(b ? interior(b, para).reverse() : []), para];
}

type Lugares = Record<string, { sala: string; mesa: P; assento: P }>;
/** Mesas: duas colunas por sala (corredor no meio), até três fileiras. */
function montarMesas(ids: string[]): Lugares {
  const porSala: Record<string, string[]> = { entrada: [], vendas: [], inteligencia: [], clientes: [] };
  ids.forEach(id => { const s = Object.keys(SETORES).find(k => SETORES[k].includes(id)) || 'clientes'; porSala[s].push(id); });
  const out: Lugares = {};
  Object.entries(porSala).forEach(([sid, lista]) => {
    const s = SALA[sid];
    lista.forEach((id, i) => {
      const col = i % 2, lin = Math.floor(i / 2);
      const mesa = { x: s.x + (col ? 275 : 95), y: s.y + 116 + lin * 80 };
      out[id] = { sala: sid, mesa, assento: { x: mesa.x + 12, y: mesa.y - 4 } };
    });
  });
  return out;
}

type Estado = { pos: P; caminho: P[]; alvo: 'mesa' | 'lugar' | 'visita' | 'chamado'; lugar: string | null; ate: number; chamado: Chamado | null; visita: boolean; preso: boolean; esq: boolean };
type Visita = { de: string; para: string; falas: { quem: string; texto: string }[]; fase: 'indo' | 'falando'; i: number; prox: number };
type Fala = { t: string; tipo: 'fala' | 'acao' | 'papo'; ate: number };

type Props = {
  agentes: AgenteSala[]; conversas?: ConversaSala[]; passagens?: PassagemSala[];
  selecionado: string | null; onSelecionar: (id: string) => void;
  chamados?: Record<string, Chamado>;
  /** Setor escolhido: as outras salas e agentes ficam esmaecidos. */
  destacar?: string | null; onSetor?: (id: string) => void;
};

export default function SalaViva({ agentes, conversas = [], passagens = [], selecionado, onSelecionar, chamados = {}, destacar = null, onSetor }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.7);
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const ro = new ResizeObserver(() => setEscala(Math.max(0.5, el.clientWidth / LARG)));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const ids = agentes.map(a => a.id).join(',');
  const mesas = useMemo(() => montarMesas(ids.split(',').filter(Boolean)), [ids]);
  const ref = useRef({ agentes, conversas, passagens, chamados, mesas });
  useEffect(() => { ref.current = { agentes, conversas, passagens, chamados, mesas }; });
  const estados = useRef<Record<string, Estado>>({});
  const elementos = useRef<Record<string, HTMLDivElement | null>>({});
  const visitas = useRef<Visita[]>([]);
  const [falas, setFalas] = useState<Record<string, Fala>>({});
  const falasRef = useRef(falas);
  useEffect(() => { falasRef.current = falas; }, [falas]);
  const falar = (id: string, t: string, tipo: Fala['tipo'], ms: number) => setFalas(f => ({ ...f, [id]: { t, tipo, ate: Date.now() + ms } }));

  // Ação nova de um agente (ou da simulação): aparece no balão por alguns segundos.
  const vistas = useRef<Record<string, string>>({});
  useEffect(() => {
    agentes.forEach(a => {
      const em = a.ultima?.em; if (!em) return;
      if (vistas.current[a.id] && vistas.current[a.id] !== em && a.ultima) falar(a.id, a.ultima.texto, 'acao', 6000);
      vistas.current[a.id] = em;
    });
  }, [agentes]);

  useEffect(() => {
    let vivo = true, ultimo = performance.now(), raf = 0;
    let proxVisita = performance.now() + 2500, proxPapo = performance.now() + 3000, proxAcao = performance.now() + 1500, proxLimpa = 0, filaIdx = 0;

    const fila = (): Omit<Visita, 'fase' | 'i' | 'prox'>[] => {
      const { conversas: cv, passagens: ps } = ref.current;
      return [
        ...cv.filter(c => c.falas.length).map(c => ({ de: c.de, para: c.para, falas: c.falas.slice(0, 4) })),
        ...ps.filter(p => p.hoje).map(p => ({
          de: p.de, para: p.para,
          falas: [{ quem: p.de, texto: `${p.rotulo[0].toUpperCase()}${p.rotulo.slice(1)}: ${p.hoje} hoje` }, { quem: p.para, texto: p.tipo === 'passa' ? 'Recebido! Já cuido disso.' : 'Anotado, obrigado!' }],
        })),
      ];
    };

    const quadro = (t: number) => {
      if (!vivo) return;
      const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
      const { agentes: lista, chamados: cham, mesas: ms } = ref.current;
      const agora = Date.now();
      const ocupados = new Set(Object.values(estados.current).map(e => e.lugar).filter(Boolean) as string[]);
      const ir = (e: Estado, destino: P, alvo: Estado['alvo'], lugar: string | null = null) => {
        e.caminho = rota(e.pos, destino); e.alvo = alvo; e.lugar = lugar; e.ate = t + 9000 + Math.random() * 10000;
      };
      const nReuniao = Math.max(10, Object.values(cham).filter(c => c === 'reuniao').length);
      let iReuniao = 0, iSala = 0;

      // Visitas: começa uma nova a cada ~6 s (até duas ao mesmo tempo).
      if (t > proxVisita) {
        proxVisita = t + 6000;
        const f = fila();
        if (f.length && visitas.current.length < 2) {
          for (let k = 0; k < f.length; k++) {
            const v = f[(filaIdx + k) % f.length];
            const a = lista.find(x => x.id === v.de), b = lista.find(x => x.id === v.para);
            const ea = estados.current[v.de], eb = estados.current[v.para];
            const ocupado = (id: string) => visitas.current.some(x => x.de === id || x.para === id) || !!cham[id];
            if (!a || !b || !ea || !eb || a.status === 'desligado' || b.status === 'desligado' || ocupado(v.de) || ocupado(v.para)) continue;
            filaIdx = (filaIdx + k + 1) % f.length;
            const base = eb.caminho.length ? eb.caminho[eb.caminho.length - 1] : eb.pos;
            const naMesa = eb.alvo === 'mesa' && ms[v.para];
            const destino = naMesa ? { x: ms[v.para].mesa.x + 66, y: ms[v.para].mesa.y + 10 } : { x: base.x + 34, y: base.y + 4 };
            eb.preso = true; ea.visita = true; ir(ea, destino, 'visita');
            visitas.current.push({ ...v, fase: 'indo', i: 0, prox: 0 });
            break;
          }
        }
      }
      visitas.current = visitas.current.filter(v => {
        const ea = estados.current[v.de], eb = estados.current[v.para];
        const acaba = () => { if (ea) { ea.visita = false; ea.ate = 0; } if (eb) eb.preso = false; return false; };
        if (!ea || !eb || cham[v.de] || cham[v.para]) return acaba();
        if (v.fase === 'indo' && !ea.caminho.length) { v.fase = 'falando'; v.prox = t; ea.esq = estados.current[v.para].pos.x < ea.pos.x; }
        if (v.fase === 'falando' && t >= v.prox) {
          if (v.i >= v.falas.length) return acaba();
          const f = v.falas[v.i++];
          falar(f.quem === v.para ? v.para : v.de, f.texto, 'fala', 3300);
          v.prox = t + 3400;
        }
        return true;
      });

      lista.forEach(a => {
        const m = ms[a.id]; if (!m) return;
        let e = estados.current[a.id];
        if (!e) e = estados.current[a.id] = { pos: { ...m.assento }, caminho: [], alvo: 'mesa', lugar: null, ate: t + 2000 + Math.random() * 8000, chamado: null, visita: false, preso: false, esq: false };
        const c = cham[a.id] || null;
        if (c) {
          const destino = c === 'reuniao' ? reuniaoLugar(iReuniao++, nReuniao) : SALA_JESSICA[iSala++ % SALA_JESSICA.length];
          if (e.chamado !== c) { e.chamado = c; e.visita = false; e.preso = false; ir(e, destino, 'chamado'); }
        } else {
          if (e.chamado) { e.chamado = null; e.ate = 0; e.alvo = 'chamado'; }
          if (!e.visita && !e.preso) {
            if (a.status !== 'parado' && e.alvo !== 'mesa') ir(e, m.assento, 'mesa');
            else if (a.status === 'parado' && !e.caminho.length && t > e.ate) {
              const livres = CAFE.filter(l => !ocupados.has(l.id));
              if (e.alvo !== 'mesa' && Math.random() < 0.4) ir(e, m.assento, 'mesa');
              else if (livres.length && Math.random() < 0.75) { const l = livres[Math.floor(Math.random() * livres.length)]; ocupados.add(l.id); ir(e, l.p, 'lugar', l.id); }
              else e.ate = t + 5000 + Math.random() * 5000;
            }
          }
        }
        // Anda pelo caminho.
        let resta = VEL * dt;
        while (resta > 0 && e.caminho.length) {
          const alvo = e.caminho[0], dx = alvo.x - e.pos.x, dy = alvo.y - e.pos.y, d = Math.hypot(dx, dy);
          if (Math.abs(dx) > 0.5) e.esq = dx < 0;
          if (d <= resta) { e.pos = { ...alvo }; e.caminho.shift(); resta -= d; } else { e.pos = { x: e.pos.x + dx / d * resta, y: e.pos.y + dy / d * resta }; resta = 0; }
        }
        const el = elementos.current[a.id];
        if (el) {
          el.style.transform = `translate3d(${e.pos.x.toFixed(1)}px,${e.pos.y.toFixed(1)}px,0)`;
          el.style.zIndex = String(Math.round(e.pos.y) + (falasRef.current[a.id] ? 2000 : 0));
          const andando = e.caminho.length > 0;
          el.classList.toggle('andando', andando);
          el.classList.toggle('esq', e.esq);
          el.classList.toggle('na-mesa', !andando && e.alvo === 'mesa');
        }
      });

      // Papo no café e na reunião: quem está parado junto troca uma frase.
      if (t > proxPapo) {
        proxPapo = t + 4200;
        (['cafe', 'reuniao'] as const).forEach(zona => {
          const ali = lista.filter(a => { const e = estados.current[a.id]; return e && !e.caminho.length && (zona === 'cafe' ? e.alvo === 'lugar' : e.chamado === 'reuniao'); });
          const livres = ali.filter(a => !falasRef.current[a.id]);
          if (ali.length >= 2 && livres.length) {
            const quem = livres[Math.floor(Math.random() * livres.length)];
            const frases = zona === 'cafe' ? PAPO_CAFE : PAPO_REUNIAO;
            falar(quem.id, frases[Math.floor(Math.random() * frases.length)], 'papo', 3000);
          }
        });
      }
      // Quem trabalha mostra de vez em quando o que fez por último.
      if (t > proxAcao) {
        proxAcao = t + 5500;
        const cands = lista.filter(a => a.status === 'trabalhando' && a.ultima && !falasRef.current[a.id] && estados.current[a.id]?.alvo === 'mesa');
        if (cands.length) { const a = cands[Math.floor(Math.random() * cands.length)]; falar(a.id, a.ultima!.texto, 'acao', 5000); }
      }
      if (t > proxLimpa) {
        proxLimpa = t + 400;
        const f = falasRef.current;
        if (Object.values(f).some(x => x.ate < agora)) setFalas(Object.fromEntries(Object.entries(f).filter(([, x]) => x.ate >= agora)));
      }
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => { vivo = false; cancelAnimationFrame(raf); };
  }, []);

  // Relógio da parede e luz do dia (horário de São Paulo).
  const [hora, setHora] = useState<string>('');
  const [noite, setNoite] = useState(false);
  useEffect(() => {
    const tic = () => {
      const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      setHora(f); const h = Number(f.slice(0, 2)); setNoite(h >= 19 || h < 6);
    };
    tic(); const i = setInterval(tic, 20_000); return () => clearInterval(i);
  }, []);

  const apagada = (salaId: string) => !!destacar && SETORES[destacar] && salaId !== destacar && salaId in SETORES;
  const agenteApagado = (id: string) => !!destacar && !!SETORES[destacar] && mesas[id]?.sala !== destacar;
  const porSala = (sid: string) => agentes.filter(a => mesas[a.id]?.sala === sid);

  return (
    <div ref={caixa} className="sv-caixa" style={{ height: (ALT + TOPO) * escala }}>
      <div className={`sv-palco${noite ? ' noite' : ''}`} style={{ width: LARG, height: ALT, top: TOPO * escala, transform: `scale(${escala})` }}>
        {/* corredores */}
        <div className="sv-corredor" style={{ left: 20, top: 340, width: 795, height: 40 }} />
        <div className="sv-corredor" style={{ left: 780, top: 20, width: 35, height: 680 }} />

        {SALAS.map(s => {
          const lista = porSala(s.id);
          const trab = lista.filter(a => a.status === 'trabalhando').length;
          const erro = lista.some(a => a.status === 'erro');
          const ePorta = s.lado === 'esq' ? { left: -4, top: s.h / 2 - 26, width: 8, height: 52 } : { left: s.w / 2 - 30, top: s.lado === 'baixo' ? s.h - 4 : -4, width: 60, height: 8 };
          return (
            <div key={s.id} className={`sv-sala${apagada(s.id) ? ' apagada' : ''}`} style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: s.piso, ['--tom' as string]: s.tom }}>
              <span className="sv-porta" style={ePorta} />
              {s.id in SETORES
                ? <button className="sv-placa" onClick={() => onSetor?.(s.id)} aria-label={`Setor ${s.nome}: ${trab} de ${lista.length} trabalhando`}>
                    {erro && <i className="sv-placa-erro" aria-hidden />}{s.nome}<small>{trab}/{lista.length} trabalhando</small>
                  </button>
                : <span className="sv-placa estatica">{s.nome}{s.id === 'jessica' && hora ? <small>{hora}</small> : null}</span>}
            </div>
          );
        })}

        {/* móveis */}
        <div className="sv-movel sv-mesa-reuniao" style={{ left: MESA_REUNIAO.x - 120, top: MESA_REUNIAO.y - 38, zIndex: MESA_REUNIAO.y }} />
        <div className="sv-movel sv-tela" style={{ left: 1150, top: 70, zIndex: 1 }} aria-hidden>📊</div>
        <div className="sv-movel sv-balcao" style={{ left: 980, top: 290, zIndex: 300 }}><span>☕</span><span>🥐</span><span>🍩</span></div>
        <div className="sv-movel sv-sofa" style={{ left: 872, top: 420, zIndex: 440 }} />
        <div className="sv-movel sv-mesinha" style={{ left: 1095, top: 410, zIndex: 425 }} />
        <div className="sv-movel sv-tapete" style={{ left: 845, top: 380, zIndex: 0 }} />
        <div className="sv-movel sv-tv" style={{ left: 860, top: 272, zIndex: 1 }}><span>⚽</span></div>
        <div className="sv-movel sv-mesa sv-mesa-chefe" style={{ left: JESSICA.mesa.x - 55, top: JESSICA.mesa.y - 16, zIndex: JESSICA.mesa.y + 16 }}><span className="sv-monitor" /><span className="sv-trofeu">🏆</span></div>
        {[[30, 300], [740, 300], [30, 660], [740, 660], [1150, 220], [1150, 440]].map(([x, y], k) => <span key={k} className="sv-planta" style={{ left: x, top: y, zIndex: y + 20 }}>🪴</span>)}
        {SALAS.filter(s => s.id in SETORES).map(s => <span key={`q-${s.id}`} className="sv-quadro" style={{ left: s.x + s.w / 2 - 40, top: s.y + 10 }} />)}

        {/* mesas dos agentes */}
        {agentes.map(a => {
          const m = mesas[a.id]; if (!m) return null;
          return (
            <div key={`mesa-${a.id}`} className={`sv-movel sv-mesa st-${a.status}${agenteApagado(a.id) ? ' apagada' : ''}`} style={{ left: m.mesa.x - 42, top: m.mesa.y - 15, zIndex: Math.round(m.mesa.y + 15), ['--c' as string]: a.cor }}>
              <span className="sv-monitor" /><span className="sv-teclado" /><span className="sv-caneca" />
            </div>
          );
        })}

        {/* Jessica */}
        <div className="sv-av na-mesa" style={{ transform: `translate3d(${JESSICA.assento.x}px,${JESSICA.assento.y}px,0)`, zIndex: JESSICA.assento.y }} aria-label="Jessica (você)">
          <Boneco id="jessica" cor="#1e3a8a" />
          <span className="sv-nome voce">⭐ Você</span>
        </div>

        {/* agentes */}
        {agentes.map(a => {
          const f = falas[a.id];
          const sel = selecionado === a.id;
          const fixo = a.status === 'erro' && a.erro ? `⚠ ${a.erro}` : null;
          const balao = f ? f : sel && (fixo || a.precisa) ? { t: fixo || `✋ Precisa de você: ${a.precisa}`, tipo: 'fala' as const } : null;
          return (
            <div key={a.id} ref={el => { elementos.current[a.id] = el; }} role="button" tabIndex={0}
              className={`sv-av st-${a.status}${sel ? ' sel' : ''}${agenteApagado(a.id) ? ' apagada' : ''}`}
              style={{ ['--c' as string]: a.cor }}
              aria-label={`${a.nome}: ${a.status === 'erro' ? 'com erro' : a.status}${a.precisa ? `, precisa de você: ${a.precisa}` : ''}`}
              title={`${a.nome}${a.funcao ? ` · ${a.funcao}` : ''}\n${a.erro ? `Erro: ${a.erro}` : a.precisa ? `Precisa de você: ${a.precisa}` : a.ultima?.texto || ''}`}
              onClick={() => onSelecionar(a.id)}
              onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelecionar(a.id); } }}>
              <span className="sv-chao" />
              <Boneco id={a.id} cor={a.cor} />
              <span className="sv-nome"><i className="sv-luz" />{a.nome}</span>
              {a.status === 'erro' && <span className="sv-selo erro" aria-hidden>!</span>}
              {a.status !== 'erro' && a.precisa && <span className="sv-selo precisa" aria-hidden>✋</span>}
              {a.status === 'desligado' && <span className="sv-zz" aria-hidden>z z</span>}
              {balao
                ? <span key={balao.t} className={`sv-balao ${balao.tipo}${a.status === 'erro' && !f ? ' erro' : ''}`}>{balao.t}</span>
                : a.status === 'trabalhando' && <span className="sv-digitando" aria-hidden><i /><i /><i /></span>}
            </div>
          );
        })}
      </div>
      <EstilosSala />
    </div>
  );
}

function Boneco({ id, cor }: { id: string; cor: string }) {
  const [cabelo, longo, pele] = VISUAL[id] || ['#3f2a1d', false];
  return (
    <span className="sv-fig" style={{ ['--c' as string]: cor, ['--h' as string]: cabelo, ['--p' as string]: pele || '#f1c27d' }}>
      {longo && <span className="sv-mecha" />}
      <span className="sv-perna e" /><span className="sv-perna d" />
      <span className="sv-tronco" />
      <span className="sv-braco e" /><span className="sv-braco d" />
      <span className="sv-cabeca"><span className="sv-cabelo" /><span className="sv-olhos" /></span>
    </span>
  );
}

function EstilosSala() {
  return <style>{`
    .sv-caixa{position:relative;width:100%;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
    .sv-palco{position:absolute;left:0;transform-origin:0 0;background:#dfe5ee;font-family:inherit;border-radius:14px}
    .sv-palco::after{content:"";position:absolute;inset:0;border-radius:14px;pointer-events:none;background:linear-gradient(160deg,rgba(255,236,190,.18),transparent 45%);z-index:9000;transition:background 2s}
    .sv-palco.noite::after{background:rgba(30,27,75,.1)}
    .sv-corredor{position:absolute;background:repeating-linear-gradient(90deg,#cfd8e3 0 38px,#c8d2de 38px 40px)}
    .sv-sala{position:absolute;border-radius:14px;box-shadow:inset 0 0 0 5px #fff,inset 0 0 0 6px #cbd5e1,0 2px 10px rgba(15,23,42,.08);transition:opacity .4s,filter .4s;background-image:radial-gradient(rgba(15,23,42,.035) 1px,transparent 1px)!important;background-size:22px 22px!important}
    .sv-sala.apagada,.sv-av.apagada,.sv-mesa.apagada{opacity:.35;filter:saturate(.4)}
    .sv-porta{position:absolute;background:#cfd8e3;border-radius:3px}
    .sv-placa{position:absolute;left:12px;top:10px;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:none;background:#fff;color:#0f172a;font:700 13px/1.2 inherit;box-shadow:0 1px 4px rgba(15,23,42,.12);cursor:pointer;z-index:5}
    .sv-placa::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--tom)}
    .sv-placa small{font-weight:600;font-size:12px;color:#64748b}
    .sv-placa.estatica{cursor:default}
    .sv-placa:hover:not(.estatica){box-shadow:0 0 0 2px var(--tom)}
    .sv-placa:focus-visible,.sv-av:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
    .sv-placa-erro{width:9px;height:9px;border-radius:50%;background:#dc2626;animation:sv-pisca 1s steps(2) infinite}
    .sv-movel{position:absolute;pointer-events:none}
    .sv-quadro{position:absolute;width:80px;height:8px;border-radius:3px;background:#fff;box-shadow:0 0 0 2px #cbd5e1}
    .sv-mesa{width:84px;height:30px;border-radius:7px;background:linear-gradient(#fff,#f1f5f9);box-shadow:0 0 0 1.5px #cbd5e1,0 4px 0 #cbd5e1,0 6px 10px rgba(15,23,42,.12)}
    .sv-monitor{position:absolute;left:8px;top:-14px;width:30px;height:20px;border-radius:4px;background:#1e293b;box-shadow:inset 0 0 0 2.5px #1e293b;background-clip:padding-box}
    .sv-monitor::after{content:"";position:absolute;inset:3px;border-radius:2px;background:#334155}
    .st-trabalhando .sv-monitor::after{background:linear-gradient(var(--c),#38bdf8);animation:sv-tela 1.6s ease-in-out infinite alternate}
    .st-erro .sv-monitor::after{background:#ef4444;animation:sv-pisca .9s steps(2) infinite}
    .st-parado .sv-monitor::after{background:#64748b}
    .sv-teclado{position:absolute;left:44px;top:14px;width:26px;height:7px;border-radius:2px;background:#cbd5e1}
    .sv-caneca{position:absolute;right:6px;top:5px;width:7px;height:7px;border-radius:50%;background:var(--c)}
    .sv-mesa-chefe{width:110px;height:32px;background:linear-gradient(#b7793d,#8a5523);box-shadow:0 4px 0 #6b3f19,0 6px 12px rgba(15,23,42,.2)}
    .sv-trofeu{position:absolute;right:8px;top:-10px;font-size:16px}
    .sv-mesa-reuniao{width:240px;height:84px;border-radius:50%;background:radial-gradient(#c58b52,#9a6331);box-shadow:0 5px 0 #7a4b22,0 8px 16px rgba(15,23,42,.18)}
    .sv-tela{font-size:22px;background:#1e293b;border-radius:6px;padding:6px 4px}
    .sv-balcao{width:150px;height:26px;border-radius:6px;background:linear-gradient(#e7e5e4,#d6d3d1);box-shadow:0 4px 0 #a8a29e;display:flex;gap:14px;padding:0 16px;align-items:center;font-size:15px}
    .sv-sofa{width:110px;height:26px;border-radius:12px;background:#f472b6;box-shadow:inset 0 -8px 0 #db2777,0 4px 8px rgba(15,23,42,.15)}
    .sv-mesinha{width:44px;height:30px;border-radius:50%;background:#e2e8f0;box-shadow:0 3px 0 #94a3b8}
    .sv-tapete{width:150px;height:70px;border-radius:40px;background:#fed7aa;opacity:.7}
    .sv-tv{width:90px;height:12px;border-radius:3px;background:#0f172a;display:grid;place-items:center;font-size:9px}
    .sv-planta{position:absolute;font-size:24px;pointer-events:none}
    .sv-av{position:absolute;left:0;top:0;width:0;height:0;cursor:pointer;will-change:transform;transition:opacity .4s,filter .4s}
    .sv-chao{position:absolute;left:-15px;top:-5px;width:30px;height:10px;border-radius:50%;background:rgba(15,23,42,.18)}
    .sv-av.sel .sv-chao{background:none;box-shadow:0 0 0 3px var(--c);animation:sv-pulso 1.4s ease-in-out infinite}
    .sv-av.st-erro .sv-chao{background:none;box-shadow:0 0 0 3px #ef4444;animation:sv-pulso 1s ease-in-out infinite}
    .sv-fig{position:absolute;left:-15px;bottom:0;width:30px;height:52px}
    .sv-av.esq .sv-fig{transform:scaleX(-1)}
    .sv-perna{position:absolute;bottom:0;width:7px;height:13px;border-radius:3px;background:#334155}
    .sv-perna.e{left:8px}.sv-perna.d{left:15px}
    .sv-tronco{position:absolute;left:4px;bottom:11px;width:22px;height:20px;border-radius:10px 10px 6px 6px;background:var(--c)}
    .sv-braco{position:absolute;bottom:14px;width:6px;height:15px;border-radius:3px;background:var(--c);filter:brightness(.88);transform-origin:50% 2px}
    .sv-braco.e{left:0}.sv-braco.d{right:0}
    .sv-cabeca{position:absolute;left:4px;bottom:28px;width:22px;height:22px;border-radius:50%;background:var(--p)}
    .sv-cabelo{position:absolute;left:-2px;top:-3px;width:26px;height:12px;border-radius:13px 13px 5px 5px;background:var(--h)}
    .sv-mecha{position:absolute;left:2px;bottom:18px;width:26px;height:26px;border-radius:12px 12px 6px 6px;background:var(--h)}
    .sv-olhos{position:absolute;left:6px;top:11px;width:3px;height:3px;border-radius:50%;background:#1e293b;box-shadow:7px 0 0 #1e293b;animation:sv-piscar 4.5s infinite}
    .sv-av.andando .sv-fig{animation:sv-quica .32s ease-in-out infinite alternate}
    .sv-av.andando .sv-perna.e{animation:sv-passo .32s ease-in-out infinite alternate}
    .sv-av.andando .sv-perna.d{animation:sv-passo .32s ease-in-out infinite alternate-reverse}
    .sv-av.andando .sv-braco.e{animation:sv-balanco .32s ease-in-out infinite alternate}
    .sv-av.andando .sv-braco.d{animation:sv-balanco .32s ease-in-out infinite alternate-reverse}
    .sv-av.na-mesa.st-trabalhando .sv-braco{animation:sv-digita .25s ease-in-out infinite alternate}
    .sv-av.na-mesa.st-trabalhando .sv-braco.d{animation-delay:.12s}
    .sv-av.st-desligado .sv-fig{opacity:.55}
    .sv-av.st-desligado .sv-cabeca{transform:rotate(14deg) translateY(3px)}
    .sv-nome{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;background:rgba(15,23,42,.82);color:#fff;font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none}
    .sv-nome.voce{background:#f59e0b;color:#0f172a}
    .sv-luz{width:7px;height:7px;border-radius:50%;background:#94a3b8}
    .st-trabalhando .sv-luz{background:#22c55e;box-shadow:0 0 6px #22c55e}
    .st-parado .sv-luz{background:#eab308}
    .st-erro .sv-luz{background:#ef4444;animation:sv-pisca .9s steps(2) infinite}
    .sv-selo{position:absolute;left:12px;bottom:44px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:900;color:#fff;box-shadow:0 0 0 2px #fff}
    .sv-selo.erro{background:#ef4444;animation:sv-pulso 1s ease-in-out infinite}
    .sv-selo.precisa{background:#f59e0b;font-size:10px}
    .sv-zz{position:absolute;left:12px;bottom:46px;font-size:11px;font-weight:800;color:#64748b;animation:sv-sobe 2.4s ease-in infinite}
    .sv-balao{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);width:max-content;max-width:200px;padding:7px 11px;border-radius:14px;background:#fff;color:#0f172a;font-size:12px;line-height:1.35;font-weight:500;box-shadow:0 4px 14px rgba(15,23,42,.18),0 0 0 2px var(--c);animation:sv-pop .35s cubic-bezier(.3,1.5,.5,1) both;pointer-events:none;text-wrap:balance}
    .sv-balao::after{content:"";position:absolute;left:50%;bottom:-6px;width:12px;height:12px;background:inherit;transform:translateX(-50%) rotate(45deg);box-shadow:2px 2px 0 0 var(--c)}
    .sv-balao.acao{background:#f8fafc;font-size:11.5px;color:#334155}
    .sv-balao.papo{font-size:12px;box-shadow:0 4px 14px rgba(15,23,42,.15),0 0 0 1.5px #cbd5e1}
    .sv-balao.papo::after{box-shadow:2px 2px 0 0 #cbd5e1}
    .sv-balao.erro{background:#fef2f2;box-shadow:0 4px 14px rgba(15,23,42,.18),0 0 0 2px #ef4444}
    .sv-balao.erro::after{box-shadow:2px 2px 0 0 #ef4444}
    .sv-digitando{position:absolute;left:50%;bottom:82px;transform:translateX(-50%);display:flex;gap:3px;padding:5px 8px;border-radius:10px;background:#fff;box-shadow:0 2px 6px rgba(15,23,42,.15)}
    .sv-digitando i{width:5px;height:5px;border-radius:50%;background:var(--c);animation:sv-ponto 1.2s ease-in-out infinite}
    .sv-digitando i:nth-child(2){animation-delay:.2s}.sv-digitando i:nth-child(3){animation-delay:.4s}
    @keyframes sv-quica{to{transform:translateY(-3px)}}
    .sv-av.esq.andando .sv-fig{animation-name:sv-quica-esq}
    @keyframes sv-quica-esq{from{transform:scaleX(-1)}to{transform:scaleX(-1) translateY(-3px)}}
    @keyframes sv-passo{from{transform:translateY(0)}to{transform:translateY(-4px)}}
    @keyframes sv-balanco{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
    @keyframes sv-digita{from{transform:rotate(-8deg) translateY(0)}to{transform:rotate(6deg) translateY(-2px)}}
    @keyframes sv-piscar{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
    @keyframes sv-pisca{50%{opacity:.25}}
    @keyframes sv-pulso{50%{opacity:.45}}
    @keyframes sv-tela{to{filter:brightness(1.25)}}
    @keyframes sv-sobe{0%{opacity:0;transform:translateY(4px)}30%{opacity:1}100%{opacity:0;transform:translate(6px,-12px)}}
    @keyframes sv-pop{from{opacity:0;transform:translateX(-50%) translateY(6px) scale(.85)}to{opacity:1;transform:translateX(-50%) scale(1)}}
    @keyframes sv-ponto{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-3px);opacity:1}}
    @media (prefers-reduced-motion:reduce){.sv-palco *{animation:none!important}}
  `}</style>;
}
