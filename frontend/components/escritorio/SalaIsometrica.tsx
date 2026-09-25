'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

// Escritório virtual em SVG isométrico com bonecos no estilo minifigura de LEGO.
// Eles andam pelo escritório: trabalhando → vão para a mesa e digitam; desligado →
// cochilam na mesa; parado → alternam entre café, biblioteca, pebolim, videogame
// e a própria mesa. Rotas pelos corredores (não atravessam mesas). Relógio com a
// hora real e janela que muda de dia para noite no horário de São Paulo.

export type AgenteSala = {
  id: string; nome: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado';
  ultima: { texto: string } | null;
};

const LARG = 62, ALT = 36;
const COLS = 4, ESPACO = 2.3;
const W = 16, D = 7.4;
const ESPINHA_X = 10.2;                     // corredor vertical entre as mesas e os cantos
const CORREDOR_LINHA = [0.38, 2.45];        // corredor atrás de cada fileira de mesas
const VELOCIDADE = 1.5;                     // células por segundo
const AMARELO = '#f6c90e', AMARELO_SOMBRA = '#d9ac00';
const COR_STATUS = { trabalhando: '#22c55e', parado: '#eab308', desligado: '#94a3b8' } as const;

type P = { x: number; y: number };
const iso = (x: number, y: number) => ({ x: (x - y) * LARG, y: (x + y) * ALT });
const pts = (...p: P[]) => p.map(q => `${q.x},${q.y}`).join(' ');
const up = (p: P, k: number) => ({ x: p.x, y: p.y - k });
const r1 = (n: number) => Math.round(n * 10) / 10;

// ── Lugares ────────────────────────────────────────────────────────────────
type Atividade = 'mesa' | 'cafe' | 'biblioteca' | 'pebolim' | 'videogame';
type Vaga = { id: string; atividade: Atividade; p: P };
const VAGAS: Vaga[] = [
  { id: 'cafe1', atividade: 'cafe', p: { x: 14.0, y: 3.35 } },
  { id: 'cafe2', atividade: 'cafe', p: { x: 15.0, y: 3.9 } },
  { id: 'livro1', atividade: 'biblioteca', p: { x: 11.4, y: 1.15 } },
  { id: 'livro2', atividade: 'biblioteca', p: { x: 13.1, y: 1.15 } },
  { id: 'pebolim1', atividade: 'pebolim', p: { x: 11.2, y: 4.75 } },
  { id: 'pebolim2', atividade: 'pebolim', p: { x: 11.2, y: 6.45 } },
  { id: 'game1', atividade: 'videogame', p: { x: 13.75, y: 6.55 } },
  { id: 'game2', atividade: 'videogame', p: { x: 14.55, y: 6.55 } },
];

const mesaDe = (i: number) => {
  const col = i % COLS, lin = Math.floor(i / COLS);
  const bx = 0.9 + col * ESPACO, by = 1.1 + lin * ESPACO;
  return { bx, by, lin, assento: { x: bx + 0.62, y: by - 0.38 } };
};

/** Caminho pelos corredores: sai para o corredor da fileira, vai até a espinha e segue. */
function rota(de: P, para: P, linDe: number | null, linPara: number | null): P[] {
  const out: P[] = [];
  if (linDe !== null) { out.push({ x: de.x, y: CORREDOR_LINHA[linDe] }); out.push({ x: ESPINHA_X, y: CORREDOR_LINHA[linDe] }); }
  else out.push({ x: ESPINHA_X, y: de.y });
  if (linPara !== null) { out.push({ x: ESPINHA_X, y: CORREDOR_LINHA[linPara] }); out.push({ x: para.x, y: CORREDOR_LINHA[linPara] }); }
  else out.push({ x: ESPINHA_X, y: para.y });
  out.push(para);
  return out;
}

type Estado = { pos: P; caminho: P[]; atividade: Atividade; vaga: string | null; ate: number; andando: boolean };

// ── Peças ──────────────────────────────────────────────────────────────────
function Caixa({ x, y, w, d, h, topo, esq, dir, z = 0 }: { x: number; y: number; w: number; d: number; h: number; topo: string; esq: string; dir: string; z?: number }) {
  const a = iso(x, y), b = iso(x + w, y), c = iso(x + w, y + d), e = iso(x, y + d);
  return (
    <g>
      <polygon points={pts(up(e, z), up(c, z), up(c, z + h), up(e, z + h))} fill={esq} />
      <polygon points={pts(up(b, z), up(c, z), up(c, z + h), up(b, z + h))} fill={dir} />
      <polygon points={pts(up(a, z + h), up(b, z + h), up(c, z + h), up(e, z + h))} fill={topo} />
    </g>
  );
}

type Visual = { cabelo?: string; corCabelo: string; feminina: boolean; estampa: string; extra?: string; calca: string };
const VISUAL: Record<string, Visual> = {
  bia:         { cabelo: 'rabo',     corCabelo: '#5b3a1a', feminina: true,  estampa: 'headset', extra: 'headset', calca: '#1e3a8a' },
  lurdinha:    { cabelo: 'coque',    corCabelo: '#9ca3af', feminina: true,  estampa: 'agenda',  extra: 'oculos', calca: '#7c2d12' },
  clarice:     { cabelo: 'longo',    corCabelo: '#1f1a17', feminina: true,  estampa: 'brilho', calca: '#111827' },
  luiz_felipe: { cabelo: 'bone',     corCabelo: '#2b2b2b', feminina: false, estampa: 'gravata', calca: '#374151' },
  zequinha:    { cabelo: 'moicano',  corCabelo: '#ef4444', feminina: false, estampa: 'megafone', calca: '#1d4ed8' },
  helena:      { cabelo: 'cacheado', corCabelo: '#3b2314', feminina: true,  estampa: 'coracao', calca: '#f5f5f4' },
  laya:        { cabelo: 'ondulado', corCabelo: '#6b21a8', feminina: true,  estampa: 'circuito', calca: '#0f172a' },
  marta:       { cabelo: 'chanel',   corCabelo: '#7c2d12', feminina: true,  estampa: 'blazer', extra: 'oculos', calca: '#1f2937' },
};

function Cabelo({ tipo, cor, corAgente }: { tipo?: string; cor: string; corAgente: string }) {
  switch (tipo) {
    case 'rabo': return (<g>
      <path d="M -12 -64 Q -12 -80 0 -80 Q 12 -80 12 -64 L 12 -60 Q 0 -70 -12 -60 Z" fill={cor} />
      <path d="M 10 -72 Q 26 -70 22 -50 Q 20 -44 16 -46 Q 18 -60 9 -64 Z" fill={cor} className="rabo" />
      <circle cx={11} cy={-70} r={2.5} fill={corAgente} /></g>);
    case 'coque': return (<g>
      <path d="M -12 -63 Q -12 -79 0 -79 Q 12 -79 12 -63 L 12 -59 Q 0 -68 -12 -59 Z" fill={cor} />
      <circle cx={0} cy={-83} r={7} fill={cor} /></g>);
    case 'longo': return <path d="M -13 -62 Q -13 -80 0 -80 Q 13 -80 13 -62 L 14 -36 L 9 -36 L 9 -58 Q 0 -66 -9 -58 L -9 -36 L -14 -36 Z" fill={cor} />;
    case 'bone': return (<g>
      <path d="M -12 -66 Q -12 -80 0 -80 Q 12 -80 12 -66 Z" fill="#1d4ed8" />
      <path d="M -12 -66 L 18 -66 Q 20 -63 16 -62 L -12 -62 Z" fill="#1e3a8a" />
      <text x={0} y={-70} fontSize={6} fontWeight={800} fill="#fff" textAnchor="middle">PS</text></g>);
    case 'moicano': return <path d="M -4 -70 L -6 -86 L -2 -80 L 0 -92 L 2 -80 L 6 -88 L 5 -70 Z" fill={cor} />;
    case 'cacheado': return (<g>{[-14, -8, -1, 6, 13, -12, 12, -15, 15].map((dx, i) => (
      <circle key={i} cx={dx} cy={i < 5 ? -78 + Math.abs(dx) * 0.2 : i < 7 ? -64 : -52} r={i < 5 ? 7 : 6} fill={cor} />))}</g>);
    case 'ondulado': return (<g>
      <path d="M -13 -62 Q -14 -80 0 -80 Q 14 -80 13 -62 Q 16 -54 12 -46 Q 16 -40 11 -36 L 9 -58 Q 0 -66 -9 -58 L -11 -36 Q -16 -40 -12 -46 Q -16 -54 -13 -62 Z" fill={cor} />
      <path d="M 6 -79 Q 13 -70 12 -48" stroke="#f472b6" strokeWidth={2.4} fill="none" /></g>);
    case 'chanel': return <path d="M -13 -62 Q -13 -80 0 -80 Q 13 -80 13 -62 L 14 -50 L 8 -50 L 8 -60 Q 0 -67 -8 -60 L -8 -50 L -14 -50 Z" fill={cor} />;
    default: return <rect x={-6} y={-75} width={12} height={5} rx={1.5} fill={AMARELO} />;
  }
}

function Estampa({ tipo }: { tipo: string }) {
  switch (tipo) {
    case 'gravata': return <path d="M -2 -44 L 2 -44 L 3 -40 L 0 -26 L -3 -40 Z" fill="#dc2626" />;
    case 'megafone': return <g><path d="M -6 -36 L 2 -40 L 2 -30 L -6 -34 Z" fill="#fff" /><rect x={-9} y={-36} width={3} height={2} fill="#fff" /></g>;
    case 'coracao': return <path d="M 0 -30 C -8 -36 -5 -42 0 -38 C 5 -42 8 -36 0 -30 Z" fill="#fff" />;
    case 'brilho': return <path d="M 0 -42 L 2 -36 L 8 -34 L 2 -32 L 0 -26 L -2 -32 L -8 -34 L -2 -36 Z" fill="#fde68a" />;
    case 'circuito': return <g stroke="#fbcfe8" strokeWidth={1.2} fill="none"><path d="M -8 -40 H -2 V -32 H 6" /><circle cx={6} cy={-32} r={1.5} fill="#fbcfe8" /></g>;
    case 'agenda': return <g><rect x={-6} y={-40} width={12} height={11} rx={1} fill="#fff" /><rect x={-6} y={-40} width={12} height={3} fill="#ef4444" /></g>;
    case 'blazer': return <g><path d="M -12 -46 L -2 -46 L -6 -28 Z" fill="rgba(0,0,0,.25)" /><path d="M 12 -46 L 2 -46 L 6 -28 Z" fill="rgba(0,0,0,.25)" /></g>;
    case 'headset': return <g><rect x={-4} y={-40} width={8} height={6} rx={1} fill="#fff" /><text x={0} y={-35} fontSize={5} textAnchor="middle" fill="#e11d74" fontWeight={800}>OI</text></g>;
    default: return null;
  }
}

type Pose = 'digitando' | 'sentado' | 'dormindo' | 'andando' | 'cafe' | 'lendo' | 'pebolim' | 'jogando';

/** Minifigura. Origem: sentado = altura do tampo; em pé = pés no chão. */
function Minifig({ id, cor, pose, atraso }: { id: string; cor: string; pose: Pose; atraso: number }) {
  const v = VISUAL[id] || { corCabelo: '#333', feminina: true, estampa: '', calca: '#333' };
  const emPe = pose === 'andando' || pose === 'cafe' || pose === 'lendo' || pose === 'pebolim';
  const d = { animationDelay: `${atraso}s` };
  const bracos = pose === 'digitando' || pose === 'pebolim' || pose === 'jogando' ? 'bracos-rapidos' : pose === 'andando' ? 'bracos-andando' : '';
  const cabecaLonga = v.cabelo === 'longo' || v.cabelo === 'ondulado';
  return (
    <g className={`fig pose-${pose}`} style={d}>
      {emPe && (
        <g>
          <ellipse cx={0} cy={0} rx={15} ry={5} fill="rgba(15,23,42,.18)" />
          <g className="perna perna-e" style={d}><rect x={-12} y={-24} width={11} height={24} rx={2} fill={v.calca} /><rect x={-12} y={-4} width={11} height={4} rx={1} fill="rgba(0,0,0,.3)" /></g>
          <g className="perna perna-d" style={d}><rect x={1} y={-24} width={11} height={24} rx={2} fill={v.calca} /><rect x={1} y={-4} width={11} height={4} rx={1} fill="rgba(0,0,0,.3)" /></g>
          <rect x={-14} y={-28} width={28} height={5} rx={1.5} fill={v.calca} />
        </g>
      )}
      <g transform={emPe ? 'translate(0 -14)' : undefined}>
        <g transform="translate(-13 -42)"><g className={`braco braco-e ${bracos}`} style={d}>
          <path d="M 0 0 Q -7 6 -6 18 L 0 20 Q -1 10 4 4 Z" fill={cor} />
          <circle cx={-3} cy={22} r={4.2} fill={AMARELO} /><circle cx={-3} cy={24} r={1.8} fill={AMARELO_SOMBRA} />
        </g></g>
        <g transform="translate(13 -42)"><g className={`braco braco-d ${bracos} ${pose === 'cafe' || pose === 'sentado' ? 'gole' : ''}`} style={d}>
          <path d="M 0 0 Q 7 6 6 18 L 0 20 Q 1 10 -4 4 Z" fill={cor} />
          <circle cx={3} cy={22} r={4.2} fill={AMARELO} /><circle cx={3} cy={24} r={1.8} fill={AMARELO_SOMBRA} />
          {(pose === 'cafe' || pose === 'sentado') && <g><rect x={-1} y={14} width={8} height={8} rx={1.5} fill="#fff" stroke="#cbd5e1" /><path d="M 7 16 q 3 2 0 4" stroke="#cbd5e1" fill="none" /></g>}
        </g></g>
        <path d="M -12 -46 L 12 -46 L 16 -14 L -16 -14 Z" fill={cor} />
        <path d="M -12 -46 L 12 -46 L 12.6 -42 L -12.6 -42 Z" fill="rgba(255,255,255,.18)" />
        <Estampa tipo={v.estampa} />
        {pose === 'lendo' && <g><path d="M -14 -26 L 0 -22 L 14 -26 L 14 -12 L 0 -8 L -14 -12 Z" fill="#fff" stroke="#94a3b8" /><path d="M 0 -22 V -8" stroke="#94a3b8" /><path d="M -14 -26 L 0 -22 L 14 -26" stroke={cor} strokeWidth={2} fill="none" /></g>}
        {pose === 'jogando' && <g><rect x={-10} y={-24} width={20} height={9} rx={4} fill="#111827" /><circle cx={-5} cy={-19.5} r={1.5} fill="#22c55e" /><circle cx={5} cy={-19.5} r={1.5} fill="#ef4444" /></g>}
        <rect x={-5} y={-49} width={10} height={4} fill={AMARELO_SOMBRA} />
        <g className="cabeca" style={d}>
          {cabecaLonga && <Cabelo tipo={v.cabelo} cor={v.corCabelo} corAgente={cor} />}
          <rect x={-11} y={-72} width={22} height={24} rx={6} fill={AMARELO} />
          <rect x={-11} y={-72} width={5} height={24} rx={3} fill="rgba(255,255,255,.25)" />
          <g className="olhos" style={d}>
            <ellipse cx={-4.5} cy={-61} rx={1.7} ry={2.1} fill="#111" /><ellipse cx={4.5} cy={-61} rx={1.7} ry={2.1} fill="#111" />
            {v.feminina && <path d="M -7 -63.5 l -1.6 -1.4 M 7 -63.5 l 1.6 -1.4" stroke="#111" strokeWidth={0.9} />}
          </g>
          {pose === 'dormindo'
            ? <path d="M -3 -54 q 3 1.5 6 0" stroke="#111" strokeWidth={1.2} fill="none" />
            : <path d={pose === 'pebolim' || pose === 'jogando' ? 'M -5 -56 q 5 7 10 0 Z' : 'M -5 -55 q 5 5 10 0'} stroke={v.feminina ? '#dc2626' : '#111'} strokeWidth={v.feminina ? 1.8 : 1.3} fill={pose === 'pebolim' || pose === 'jogando' ? '#fff' : 'none'} strokeLinecap="round" />}
          {v.feminina && <><circle cx={-8} cy={-56} r={2} fill="#fb923c" opacity={0.45} /><circle cx={8} cy={-56} r={2} fill="#fb923c" opacity={0.45} /></>}
          {v.extra === 'oculos' && <g stroke="#111" strokeWidth={1} fill="rgba(255,255,255,.35)"><circle cx={-4.5} cy={-61} r={3.6} /><circle cx={4.5} cy={-61} r={3.6} /><path d="M -1 -61 h 2" /></g>}
          {!cabecaLonga && <Cabelo tipo={v.cabelo} cor={v.corCabelo} corAgente={cor} />}
          {cabecaLonga && <path d="M -11 -64 Q -11 -80 0 -80 Q 11 -80 11 -64 Q 4 -72 -11 -64 Z" fill={v.corCabelo} />}
          {v.extra === 'headset' && <g><path d="M -13 -62 Q -13 -84 0 -84 Q 13 -84 13 -62" stroke="#111827" strokeWidth={2} fill="none" /><rect x={-15} y={-65} width={4} height={8} rx={2} fill="#111827" /><path d="M -13 -58 Q -10 -52 -4 -52" stroke="#111827" strokeWidth={1.3} fill="none" /></g>}
        </g>
        {pose === 'dormindo' && <g className="zzz" style={d}><text x={14} y={-80} fontSize={10} fontWeight={800} fill="#64748b">z</text><text x={20} y={-90} fontSize={13} fontWeight={800} fill="#64748b">z</text></g>}
      </g>
    </g>
  );
}

function quebrar(texto: string, max = 26, linhas = 2): string[] {
  const out: string[] = [''];
  for (const w of texto.split(/\s+/)) {
    if ((out[out.length - 1] + ' ' + w).trim().length > max) {
      if (out.length === linhas) { out[out.length - 1] = out[out.length - 1].replace(/.{0,2}$/, '…'); break; }
      out.push(w);
    } else out[out.length - 1] = (out[out.length - 1] + ' ' + w).trim();
  }
  return out;
}

function useRelogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => { setAgora(new Date()); const i = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(i); }, []);
  return agora;
}

// ── Sala ───────────────────────────────────────────────────────────────────
export default function SalaIsometrica({ agentes, selecionado, onSelecionar }: { agentes: AgenteSala[]; selecionado: string | null; onSelecionar: (id: string) => void }) {
  const agora = useRelogio();
  const estados = useRef<Record<string, Estado>>({});
  const agentesRef = useRef(agentes);
  agentesRef.current = agentes;
  const [, setQuadro] = useState(0);

  // Movimento: ~24 quadros por segundo, com decisões de rotina por agente.
  useEffect(() => {
    let ultimo = performance.now(), vivo = true;
    const passo = () => {
      if (!vivo) return;
      const agoraMs = performance.now();
      const dt = Math.min(0.1, (agoraMs - ultimo) / 1000);
      ultimo = agoraMs;
      const lista = agentesRef.current;
      const ocupadas = new Set(Object.values(estados.current).map(e => e.vaga).filter(Boolean) as string[]);
      lista.forEach((a, i) => {
        const m = mesaDe(i);
        let e = estados.current[a.id];
        if (!e) { e = estados.current[a.id] = { pos: { ...m.assento }, caminho: [], atividade: 'mesa', vaga: null, ate: agoraMs + 3000 + Math.random() * 6000, andando: false }; }
        const naMesa = e.atividade === 'mesa';
        const irPara = (atividade: Atividade, vaga: Vaga | null) => {
          const destino = vaga ? vaga.p : m.assento;
          const linDe = naMesa ? m.lin : null, linPara = atividade === 'mesa' ? m.lin : null;
          e!.caminho = rota(e!.pos, destino, linDe, linPara);
          e!.atividade = atividade; e!.vaga = vaga?.id || null;
          e!.ate = agoraMs + 9000 + Math.random() * 9000;
        };
        // Trabalhando ou desligado: sempre para a mesa.
        if (a.status !== 'parado' && e.atividade !== 'mesa') irPara('mesa', null);
        // Parado: de vez em quando muda de atividade.
        else if (a.status === 'parado' && !e.caminho.length && agoraMs > e.ate) {
          const livres = VAGAS.filter(v => !ocupadas.has(v.id));
          const sorteio = Math.random();
          if (!naMesa && sorteio < 0.35) irPara('mesa', null);
          else if (livres.length) { const v = livres[Math.floor(Math.random() * livres.length)]; ocupadas.add(v.id); irPara(v.atividade, v); }
          else e.ate = agoraMs + 4000;
        }
        // Anda pelo caminho.
        e.andando = e.caminho.length > 0;
        let resta = VELOCIDADE * dt;
        while (resta > 0 && e.caminho.length) {
          const alvo = e.caminho[0], dx = alvo.x - e.pos.x, dy = alvo.y - e.pos.y, dist = Math.hypot(dx, dy);
          if (dist <= resta) { e.pos = { ...alvo }; e.caminho.shift(); resta -= dist; }
          else { e.pos = { x: e.pos.x + (dx / dist) * resta, y: e.pos.y + (dy / dist) * resta }; resta = 0; }
        }
      });
      setQuadro(q => (q + 1) % 1_000_000);
      setTimeout(() => requestAnimationFrame(passo), 40);
    };
    requestAnimationFrame(passo);
    return () => { vivo = false; };
  }, []);

  const cantos = [iso(0, 0), iso(W, 0), iso(W, D), iso(0, D)];
  const minX = cantos[3].x - 20, maxX = cantos[1].x + 20, minY = cantos[0].y - 200, maxY = cantos[2].y + 20;
  const PAREDE = 140;

  const hSP = agora ? Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora)) : 12;
  const mSP = agora ? agora.getUTCMinutes() : 0, sSP = agora ? agora.getUTCSeconds() : 0;
  const dia = hSP >= 6 && hSP < 18, entardecer = hSP >= 17 && hSP < 19;
  const ceu = dia ? (entardecer ? '#fdba74' : '#7dd3fc') : '#1e1b4b';
  const jA = iso(0, 1.2), jB = iso(0, 3.2), jM = { x: (jA.x + jB.x) / 2, y: (jA.y + jB.y) / 2 };
  const relogio = up(iso(8.8, 0), 92);

  // Itens desenhados por profundidade (x + y): móveis, mesas e pessoas andando.
  type Item = { k: number; el: ReactElement };
  const itens: Item[] = [];
  const rotulos: ReactElement[] = [];

  // Biblioteca: estantes na parede do fundo
  [10.6, 12.3, 14.0].forEach((x, i) => itens.push({ k: x + 0.3, el: (
    <g key={`est${i}`}>
      <Caixa x={x} y={0.1} w={1.5} d={0.35} h={96} topo="#78350f" esq="#92400e" dir="#7c2d12" />
      {[18, 42, 66].map((z, j) => Array.from({ length: 7 }, (_, k) => {
        const b = iso(x + 0.12 + k * 0.19, 0.45);
        const cores = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4'];
        return <rect key={`${j}-${k}`} x={r1(b.x - 4)} y={r1(b.y - z - 20 + (k % 3))} width={7} height={18 - (k % 3)} rx={1} fill={cores[(k + j + i) % 7]} />;
      }))}
    </g>) }));
  // Canto do café: balcão, cafeteira e mesinha
  itens.push({ k: 14.6 + 2.6, el: (
    <g key="cafe">
      <Caixa x={14.3} y={2.3} w={1.5} d={0.6} h={34} topo="#e5e7eb" esq="#9ca3af" dir="#6b7280" />
      <Caixa x={14.5} y={2.4} w={0.45} d={0.35} h={26} z={34} topo="#1f2937" esq="#111827" dir="#0b1220" />
      {[0, 0.8, 1.6].map(t => <circle key={t} className="vapor" style={{ animationDelay: `${t}s` }} cx={r1(iso(14.72, 2.57).x)} cy={r1(iso(14.72, 2.57).y - 66)} r={4} fill="#fff" opacity={0} />)}
      <text x={r1(iso(15.3, 2.6).x)} y={r1(iso(15.3, 2.6).y - 38)} fontSize={14}>🥐</text>
    </g>) });
  itens.push({ k: 14.4 + 4.1, el: (
    <g key="bistro"><Caixa x={14.2} y={3.9} w={0.5} d={0.5} h={30} topo="#fca5a5" esq="#f87171" dir="#ef4444" /></g>) });
  // Canto da diversão: pebolim, TV com videogame e sofá
  itens.push({ k: 11.9 + 5.6, el: (
    <g key="pebolim">
      <Caixa x={10.9} y={5.25} w={1.6} d={0.8} h={30} topo="#16a34a" esq="#166534" dir="#14532d" />
      <polygon points={pts(up(iso(11.0, 5.33), 30.5), up(iso(12.4, 5.33), 30.5), up(iso(12.4, 5.97), 30.5), up(iso(11.0, 5.97), 30.5))} fill="#22c55e" stroke="#fff" strokeWidth={1.2} />
      {[11.25, 11.55, 11.85, 12.15].map((x, i) => (
        <g key={i} className="vareta" style={{ animationDelay: `${i * 0.2}s` }}>
          <polyline points={pts(up(iso(x, 5.1), 36), up(iso(x, 6.2), 36))} stroke="#9ca3af" strokeWidth={2} />
          <circle cx={r1(iso(x, 5.65).x)} cy={r1(iso(x, 5.65).y - 36)} r={3} fill={i % 2 ? '#ef4444' : '#2563eb'} />
        </g>))}
      <circle className="bolinha" cx={r1(iso(11.7, 5.65).x)} cy={r1(iso(11.7, 5.65).y - 32)} r={2.2} fill="#fff" />
    </g>) });
  itens.push({ k: 13.9 + 4.9, el: (
    <g key="tv">
      <Caixa x={13.4} y={4.75} w={1.5} d={0.35} h={20} topo="#475569" esq="#334155" dir="#1e293b" />
      <polygon points={pts(up(iso(13.5, 5.0), 26), up(iso(14.8, 5.0), 26), up(iso(14.8, 5.0), 64), up(iso(13.5, 5.0), 64))} fill="#0f172a" />
      <polygon className="tela-game" points={pts(up(iso(13.58, 5.02), 29), up(iso(14.72, 5.02), 29), up(iso(14.72, 5.02), 61), up(iso(13.58, 5.02), 61))} fill="#7c3aed" />
      <text x={r1(iso(14.15, 5.02).x)} y={r1(iso(14.15, 5.02).y - 40)} fontSize={12} textAnchor="middle">🏎️</text>
    </g>) });
  itens.push({ k: 14.1 + 6.95, el: (
    <g key="sofa">
      <Caixa x={13.3} y={6.75} w={1.8} d={0.5} h={16} topo="#f472b6" esq="#db2777" dir="#be185d" />
      <Caixa x={13.3} y={7.05} w={1.8} d={0.2} h={34} topo="#ec4899" esq="#be185d" dir="#9d174d" />
    </g>) });
  // Planta
  itens.push({ k: 0.5 + D - 0.5, el: (
    <g key="planta">
      <Caixa x={0.25} y={D - 0.8} w={0.45} d={0.45} h={22} topo="#b45309" esq="#92400e" dir="#78350f" />
      <g className="planta">{[-14, 0, 14, -7, 7].map((dx, i) => { const b = iso(0.47, D - 0.57); return <ellipse key={i} cx={r1(b.x + dx)} cy={r1(b.y - 36 - (i > 2 ? 12 : 0))} rx={9} ry={16} fill={i % 2 ? '#15803d' : '#22c55e'} transform={`rotate(${dx * 2} ${r1(b.x + dx)} ${r1(b.y - 36)})`} />; })}</g>
    </g>) });

  agentes.forEach((a, i) => {
    const { bx, by, assento } = mesaDe(i);
    const e = estados.current[a.id];
    const pos = e?.pos || assento;
    const sentado = !e || (e.atividade === 'mesa' && !e.andando && Math.hypot(pos.x - assento.x, pos.y - assento.y) < 0.05);
    const sel = selecionado === a.id;
    const nb = iso(bx + 0.12, by + 0.2);
    const trabalhando = a.status === 'trabalhando';
    const poseMesa: Pose = a.status === 'desligado' ? 'dormindo' : trabalhando ? 'digitando' : 'sentado';
    const topoMesa = iso(bx + 0.62, by + 0.12);

    // Mesa (com o boneco sentado, se ele estiver nela).
    itens.push({ k: bx + by + 0.6, el: (
      <g key={`mesa-${a.id}`} className="mesa" tabIndex={0} role="button" aria-label={`Mesa de ${a.nome}`} onClick={() => onSelecionar(a.id)}
        onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelecionar(a.id); } }}>
        {sel && <polygon points={pts(iso(bx - 0.3, by - 0.8), iso(bx + 1.5, by - 0.8), iso(bx + 1.5, by + 1.1), iso(bx - 0.3, by + 1.1))} fill={a.cor} opacity={0.14} stroke={a.cor} strokeWidth={2.5} strokeDasharray="7 5" />}
        <Caixa x={bx + 0.32} y={by - 0.2} w={0.6} d={0.1} h={44} topo="#4338ca" esq="#3730a3" dir="#312e81" />
        {sentado && <g transform={`translate(${r1(topoMesa.x)} ${r1(topoMesa.y - 30)})`}><Minifig id={a.id} cor={a.cor} pose={poseMesa} atraso={-(i * 0.37)} /></g>}
        <Caixa x={bx} y={by} w={1.2} d={0.7} h={30} topo="#fef3c7" esq="#e5c07b" dir="#d4a857" />
        <Caixa x={bx + 0.1} y={by + 0.15} w={0.35} d={0.4} h={2} z={30} topo="#94a3b8" esq="#64748b" dir="#475569" />
        <polygon points={pts(up(nb, 32), up(iso(bx + 0.12, by + 0.55), 32), up(iso(bx + 0.12, by + 0.55), 58), up(nb, 58))} fill="#1e293b" />
        <polygon points={pts(up(nb, 35), up(iso(bx + 0.12, by + 0.52), 35), up(iso(bx + 0.12, by + 0.52), 55), up(nb, 55))} fill={a.status === 'desligado' ? '#0f172a' : '#38bdf8'} />
        {a.status !== 'desligado' && <g className={trabalhando && sentado ? 'tela-linhas' : undefined}>
          {[0, 1, 2].map(k => <line key={k} x1={r1(nb.x - 3 - k)} y1={r1(nb.y - 50 + k * 5)} x2={r1(nb.x - 13 - k)} y2={r1(nb.y - 44 + k * 5)} stroke="#e0f2fe" strokeWidth={1.4} />)}
        </g>}
        <Caixa x={bx + 0.95} y={by + 0.45} w={0.12} d={0.12} h={9} z={30} topo="#fff" esq={a.cor} dir={a.cor} />
        {trabalhando && sentado && ['✉️', '💬', '✅'].map((ic, k) => (
          <text key={k} className="icone" style={{ animationDelay: `${k * 1.05 - i * 0.3}s` }} x={r1(topoMesa.x + 26 + k * 4)} y={r1(topoMesa.y - 40)} fontSize={13}>{ic}</text>
        ))}
      </g>) });

    // Boneco fora da mesa (andando ou numa atividade).
    const p = iso(pos.x, pos.y);
    let pose: Pose = 'andando';
    if (e && !e.andando) pose = e.atividade === 'cafe' ? 'cafe' : e.atividade === 'biblioteca' ? 'lendo' : e.atividade === 'pebolim' ? 'pebolim' : e.atividade === 'videogame' ? 'jogando' : 'andando';
    const sentadoSofa = pose === 'jogando';
    if (!sentado) {
      itens.push({ k: pos.x + pos.y + (sentadoSofa ? 0.2 : 0), el: (
        <g key={`fig-${a.id}`} transform={`translate(${r1(p.x)} ${r1(p.y - (sentadoSofa ? 16 : 0))})`} style={{ cursor: 'pointer' }} onClick={() => onSelecionar(a.id)}>
          <Minifig id={a.id} cor={a.cor} pose={pose} atraso={-(i * 0.37)} />
        </g>) });
    }

    // Crachá e balão acompanham a pessoa.
    const cabeca = sentado ? { x: topoMesa.x, y: topoMesa.y - 30 - 92 } : { x: p.x, y: p.y - (sentadoSofa ? 16 : 0) - 106 - (pose === 'andando' ? 0 : 0) };
    const balao = trabalhando && a.ultima ? quebrar(a.ultima.texto) : null;
    rotulos.push(
      <g key={`tag-${a.id}`} style={{ pointerEvents: 'none' }}>
        <rect x={r1(cabeca.x - 50)} y={r1(cabeca.y - 12)} width={100} height={22} rx={11} fill="#0f172a" opacity={0.92} />
        <circle cx={r1(cabeca.x - 38)} cy={r1(cabeca.y - 1)} r={6.5} fill={a.cor} />
        <text x={r1(cabeca.x - 38)} y={r1(cabeca.y + 2)} fontSize={7.5} fontWeight={800} fill="#fff" textAnchor="middle">{a.nome[0]}</text>
        <text x={r1(cabeca.x + 3)} y={r1(cabeca.y + 3)} fill="#f8fafc" fontSize={11} fontWeight={700} textAnchor="middle">{a.nome}</text>
        <circle className={`luz-status-${a.status}`} cx={r1(cabeca.x + 40)} cy={r1(cabeca.y - 1)} r={4.2} fill={COR_STATUS[a.status]} />
        {balao && (
          <g className="balao">
            <rect x={r1(cabeca.x - 90)} y={r1(cabeca.y - 22 - balao.length * 14)} width={180} height={balao.length * 14 + 10} rx={10} fill="#fff" stroke={a.cor} strokeWidth={1.5} />
            {balao.map((l, k) => <text key={k} x={r1(cabeca.x)} y={r1(cabeca.y - 22 - balao.length * 14 + 16 + k * 14)} fontSize={11} fill="#0f172a" textAnchor="middle">{l}</text>)}
          </g>
        )}
      </g>,
    );
  });
  itens.sort((a, b) => a.k - b.k);

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" aria-label="Escritório virtual com os agentes em estilo LEGO" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', maxHeight: 'calc(100vh - 150px)', display: 'block' }}>
      <style>{`
        .bracos-rapidos.braco-e{animation:digita .38s ease-in-out infinite alternate}
        .bracos-rapidos.braco-d{animation:digita .38s ease-in-out infinite alternate-reverse}
        @keyframes digita{from{transform:rotate(-6deg)}to{transform:rotate(8deg)}}
        .bracos-andando.braco-e{animation:balanco .5s ease-in-out infinite alternate}
        .bracos-andando.braco-d{animation:balanco .5s ease-in-out infinite alternate-reverse}
        @keyframes balanco{from{transform:rotate(-18deg)}to{transform:rotate(18deg)}}
        .pose-andando .perna-e{animation:passo .5s ease-in-out infinite alternate}
        .pose-andando .perna-d{animation:passo .5s ease-in-out infinite alternate-reverse}
        @keyframes passo{from{transform:translateY(0)}to{transform:translateY(-4px)}}
        .pose-andando{animation:quica .25s ease-in-out infinite alternate}
        @keyframes quica{to{transform:translateY(-2px)}}
        .pose-digitando .cabeca,.pose-jogando .cabeca,.pose-pebolim .cabeca{animation:balanca 2.4s ease-in-out infinite}
        @keyframes balanca{0%,100%{transform:rotate(0)}30%{transform:rotate(-4deg)}60%{transform:rotate(3deg)}}
        .pose-sentado .cabeca,.pose-lendo .cabeca{animation:olha 7s ease-in-out infinite}
        @keyframes olha{0%,55%,100%{transform:translateX(0)}62%,72%{transform:translateX(-2.5px)}80%,88%{transform:translateX(2.5px)}}
        .gole{animation:gole 6s ease-in-out infinite}
        @keyframes gole{0%,60%,100%{transform:rotate(0)}70%,82%{transform:rotate(-120deg)}}
        .olhos{animation:pisca 4.5s infinite;transform-origin:0 -61px}
        @keyframes pisca{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
        .pose-dormindo .cabeca{transform:rotate(14deg) translateY(4px)}
        .pose-dormindo .olhos{animation:none;transform:scaleY(.12)}
        .zzz{animation:sobe 2.6s ease-in infinite}
        @keyframes sobe{0%{opacity:0;transform:translate(0,6px)}30%{opacity:1}100%{opacity:0;transform:translate(6px,-14px)}}
        .rabo{transform-origin:10px -66px;animation:rabo 1.8s ease-in-out infinite}
        @keyframes rabo{50%{transform:rotate(8deg)}}
        .tela-linhas{animation:rola 1.2s linear infinite}
        @keyframes rola{from{transform:translateY(0)}to{transform:translateY(-6px)}}
        .icone{animation:flutua 3.2s ease-out infinite;opacity:0}
        @keyframes flutua{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:1;transform:translateY(-6px) scale(1)}100%{opacity:0;transform:translateY(-46px) scale(.9)}}
        .balao{animation:pop .5s cubic-bezier(.3,1.6,.5,1) both;transform-box:fill-box;transform-origin:50% 100%}
        @keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
        .vapor{animation:vapor 2.4s ease-out infinite}
        @keyframes vapor{0%{opacity:0;transform:translateY(0)}30%{opacity:.8}100%{opacity:0;transform:translateY(-22px)}}
        .planta{transform-origin:50% 100%;transform-box:fill-box;animation:vento 5s ease-in-out infinite}
        @keyframes vento{50%{transform:rotate(3deg)}}
        .vareta{animation:vareta .6s ease-in-out infinite alternate}
        @keyframes vareta{to{transform:translate(3px,-2px)}}
        .bolinha{animation:bola 1.6s ease-in-out infinite alternate}
        @keyframes bola{to{transform:translate(38px,20px)}}
        .tela-game{animation:game 1.5s steps(3) infinite}
        @keyframes game{33%{fill:#db2777}66%{fill:#2563eb}}
        .luz-status-trabalhando{animation:pulsa 1.4s ease-in-out infinite}
        @keyframes pulsa{50%{opacity:.35}}
        .mesa{cursor:pointer}
        .mesa:focus-visible{outline:none}
        @media (prefers-reduced-motion:reduce){*{animation:none!important}}
      `}</style>

      {/* paredes */}
      <polygon points={pts(iso(0, 0), iso(W, 0), up(iso(W, 0), PAREDE), up(iso(0, 0), PAREDE))} fill="#c7d2fe" />
      <polygon points={pts(iso(0, 0), iso(0, D), up(iso(0, D), PAREDE), up(iso(0, 0), PAREDE))} fill="#e0e7ff" />
      <polygon points={pts(iso(0, 0), iso(W, 0), up(iso(W, 0), 14), up(iso(0, 0), 14))} fill="#a5b4fc" />
      {/* janela com o céu do horário */}
      <polygon points={pts(up(jA, 118), up(jB, 118), up(jB, 50), up(jA, 50))} fill={ceu} stroke="#fff" strokeWidth={5} />
      {dia ? <circle cx={r1(jM.x - 14)} cy={r1(jM.y - 96)} r={9} fill="#fde047" />
        : <><circle cx={r1(jM.x - 14)} cy={r1(jM.y - 96)} r={8} fill="#f8fafc" /><circle cx={r1(jM.x - 10)} cy={r1(jM.y - 99)} r={7} fill={ceu} />
          {[[-30, -80], [10, -70], [24, -104]].map(([dx, dy], i) => <circle key={i} cx={r1(jM.x + dx)} cy={r1(jM.y + dy)} r={1.3} fill="#fff" />)}</>}
      <polyline points={pts(up(iso(0, 2.2), 118), up(iso(0, 2.2), 50))} stroke="#fff" strokeWidth={4} />
      {/* letreiro */}
      {(() => {
        const a = up(iso(1.4, 0), 112), b = up(iso(7.2, 0), 112), c = up(iso(7.2, 0), 76), e = up(iso(1.4, 0), 76);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + 22, ang = Math.atan2(ALT, LARG) * 180 / Math.PI;
        return (<g><polygon points={pts(a, b, c, e)} fill="#0f172a" />
          <text x={r1(cx)} y={r1(cy)} fill="#fde047" fontSize={15} fontWeight={900} textAnchor="middle" letterSpacing={3} transform={`rotate(${r1(ang)} ${r1(cx)} ${r1(cy - 5)})`}>PROSYSTEM · COMERCIAL</text></g>);
      })()}
      {/* placas dos cantos */}
      {[['📚 BIBLIOTECA', 12.2], ['☕ CAFÉ', 15.2]].map(([t, x]) => {
        const p = up(iso(x as number, 0), 124), ang = Math.atan2(ALT, LARG) * 180 / Math.PI;
        return <text key={t as string} x={r1(p.x)} y={r1(p.y)} fontSize={11} fontWeight={800} fill="#3730a3" textAnchor="middle" transform={`rotate(${r1(ang)} ${r1(p.x)} ${r1(p.y)})`}>{t}</text>;
      })}
      {/* relógio com a hora real */}
      <g transform={`translate(${r1(relogio.x)} ${r1(relogio.y)})`}>
        <ellipse rx={20} ry={22} fill="#fff" stroke="#1e293b" strokeWidth={3} />
        {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={r1(Math.sin(i * Math.PI / 6) * 15)} cy={r1(-Math.cos(i * Math.PI / 6) * 16)} r={1.2} fill="#334155" />)}
        <line x1={0} y1={0} x2={0} y2={-9} stroke="#0f172a" strokeWidth={3} strokeLinecap="round" transform={`rotate(${(hSP % 12) * 30 + mSP * 0.5})`} />
        <line x1={0} y1={0} x2={0} y2={-14} stroke="#0f172a" strokeWidth={2} strokeLinecap="round" transform={`rotate(${mSP * 6 + sSP * 0.1})`} />
        <line x1={0} y1={2} x2={0} y2={-15} stroke="#ef4444" strokeWidth={1} transform={`rotate(${sSP * 6})`} />
        <circle r={2} fill="#ef4444" />
      </g>
      {/* piso */}
      <polygon points={pts(...cantos)} fill="#fde7c4" />
      {Array.from({ length: W + 1 }, (_, i) => <polyline key={`gx${i}`} points={pts(iso(i, 0), iso(i, D))} stroke="#f3d3a1" strokeWidth={1.2} fill="none" />)}
      {Array.from({ length: Math.ceil(D) + 1 }, (_, i) => <polyline key={`gy${i}`} points={pts(iso(0, i), iso(W, i))} stroke="#f3d3a1" strokeWidth={1.2} fill="none" />)}
      {/* tapete do canto da diversão */}
      <polygon points={pts(iso(10.6, 4.5), iso(15.6, 4.5), iso(15.6, 7.3), iso(10.6, 7.3))} fill="#c4b5fd" opacity={0.45} />
      <text x={r1(iso(13.1, 7.3).x)} y={r1(iso(13.1, 7.3).y + 14)} fontSize={11} fontWeight={800} fill="#6d28d9" textAnchor="middle">🎮 CANTO DA DIVERSÃO</text>

      {itens.map(i => i.el)}
      {rotulos}
    </svg>
  );
}
