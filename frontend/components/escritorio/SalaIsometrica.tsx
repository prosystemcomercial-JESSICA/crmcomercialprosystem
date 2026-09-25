'use client';

import { useEffect, useState } from 'react';

// Escritório virtual em SVG isométrico com bonecos no estilo minifigura de LEGO.
// Cada agente fica atrás da sua mesa, de frente para quem olha, com crachá, luz de
// status e balão da última ação. Movimento por CSS: digitando (trabalhando),
// piscando/olhando/café (parado) e cochilando (desligado). Relógio com a hora real
// e janela que muda de dia para noite no horário de São Paulo.

export type AgenteSala = {
  id: string; nome: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado';
  ultima: { texto: string } | null;
};

const LARG = 70, ALT = 40;
const COLS = 4, LINHAS = 2, ESPACO = 2.3;
const AMARELO = '#f6c90e', AMARELO_SOMBRA = '#d9ac00';
const COR_STATUS = { trabalhando: '#22c55e', parado: '#eab308', desligado: '#94a3b8' } as const;

const iso = (x: number, y: number) => ({ x: (x - y) * LARG, y: (x + y) * ALT });
const pts = (...p: { x: number; y: number }[]) => p.map(q => `${q.x},${q.y}`).join(' ');
const esc = (n: number) => Math.round(n * 10) / 10;

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

function Caixa({ x, y, w, d, h, topo, esq, dir, z = 0 }: { x: number; y: number; w: number; d: number; h: number; topo: string; esq: string; dir: string; z?: number }) {
  const s = (p: { x: number; y: number }, k: number) => ({ x: p.x, y: p.y - k });
  const a = iso(x, y), b = iso(x + w, y), c = iso(x + w, y + d), e = iso(x, y + d);
  return (
    <g>
      <polygon points={pts(s(e, z), s(c, z), s(c, z + h), s(e, z + h))} fill={esq} />
      <polygon points={pts(s(b, z), s(c, z), s(c, z + h), s(b, z + h))} fill={dir} />
      <polygon points={pts(s(a, z + h), s(b, z + h), s(c, z + h), s(e, z + h))} fill={topo} />
    </g>
  );
}

// ── Minifigura ─────────────────────────────────────────────────────────────
// Coordenadas locais: (0,0) = altura do tampo da mesa; y negativo para cima.

type Visual = { cabelo?: string; corCabelo: string; feminina: boolean; estampa: string; extra?: string };
const VISUAL: Record<string, Visual> = {
  bia:         { cabelo: 'rabo',     corCabelo: '#5b3a1a', feminina: true,  estampa: 'headset', extra: 'headset' },
  lurdinha:    { cabelo: 'coque',    corCabelo: '#9ca3af', feminina: true,  estampa: 'agenda',  extra: 'oculos' },
  clarice:     { cabelo: 'longo',    corCabelo: '#1f1a17', feminina: true,  estampa: 'brilho' },
  luiz_felipe: { cabelo: 'bone',     corCabelo: '#2b2b2b', feminina: false, estampa: 'gravata' },
  zequinha:    { cabelo: 'moicano',  corCabelo: '#ef4444', feminina: false, estampa: 'megafone' },
  helena:      { cabelo: 'cacheado', corCabelo: '#3b2314', feminina: true,  estampa: 'coracao' },
  laya:        { cabelo: 'ondulado', corCabelo: '#6b21a8', feminina: true,  estampa: 'circuito' },
  marta:       { cabelo: 'chanel',   corCabelo: '#7c2d12', feminina: true,  estampa: 'blazer',  extra: 'oculos' },
};

function Cabelo({ tipo, cor, corAgente }: { tipo?: string; cor: string; corAgente: string }) {
  switch (tipo) {
    case 'rabo': return (<g>
      <path d="M -12 -64 Q -12 -80 0 -80 Q 12 -80 12 -64 L 12 -60 Q 0 -70 -12 -60 Z" fill={cor} />
      <path d="M 10 -72 Q 26 -70 22 -50 Q 20 -44 16 -46 Q 18 -60 9 -64 Z" fill={cor} className="rabo" />
      <circle cx={11} cy={-70} r={2.5} fill={corAgente} /></g>);
    case 'coque': return (<g>
      <path d="M -12 -63 Q -12 -79 0 -79 Q 12 -79 12 -63 L 12 -59 Q 0 -68 -12 -59 Z" fill={cor} />
      <circle cx={0} cy={-83} r={7} fill={cor} /><circle cx={0} cy={-83} r={3} fill="#6b7280" opacity={0.4} /></g>);
    case 'longo': return (<g>
      <path d="M -13 -62 Q -13 -80 0 -80 Q 13 -80 13 -62 L 14 -36 L 9 -36 L 9 -58 Q 0 -66 -9 -58 L -9 -36 L -14 -36 Z" fill={cor} />
      <path d="M -4 -79 Q 2 -70 10 -66" stroke="#3f3a36" strokeWidth={1.2} fill="none" /></g>);
    case 'bone': return (<g>
      <path d="M -12 -66 Q -12 -80 0 -80 Q 12 -80 12 -66 Z" fill="#1d4ed8" />
      <path d="M -12 -66 L 18 -66 Q 20 -63 16 -62 L -12 -62 Z" fill="#1e3a8a" />
      <circle cx={0} cy={-80} r={1.6} fill="#1e3a8a" />
      <text x={0} y={-70} fontSize={6} fontWeight={800} fill="#fff" textAnchor="middle">PS</text></g>);
    case 'moicano': return (<g>
      <path d="M -4 -70 L -6 -86 L -2 -80 L 0 -92 L 2 -80 L 6 -88 L 5 -70 Z" fill={cor} />
      <rect x={-12} y={-70} width={24} height={3} fill="#1f2937" opacity={0.25} /></g>);
    case 'cacheado': return (<g>
      {[-14, -8, -1, 6, 13, -12, 12, -15, 15].map((dx, i) => (
        <circle key={i} cx={dx} cy={i < 5 ? -78 + Math.abs(dx) * 0.2 : i < 7 ? -64 : -52} r={i < 5 ? 7 : 6} fill={cor} />
      ))}</g>);
    case 'ondulado': return (<g>
      <path d="M -13 -62 Q -14 -80 0 -80 Q 14 -80 13 -62 Q 16 -54 12 -46 Q 16 -40 11 -36 L 9 -58 Q 0 -66 -9 -58 L -11 -36 Q -16 -40 -12 -46 Q -16 -54 -13 -62 Z" fill={cor} />
      <path d="M 6 -79 Q 13 -70 12 -48" stroke="#f472b6" strokeWidth={2.4} fill="none" /></g>);
    case 'chanel': return (
      <path d="M -13 -62 Q -13 -80 0 -80 Q 13 -80 13 -62 L 14 -50 L 8 -50 L 8 -60 Q 0 -67 -8 -60 L -8 -50 L -14 -50 Z" fill={cor} />);
    default: return <rect x={-6} y={-75} width={12} height={5} rx={1.5} fill={AMARELO} />;
  }
}

function Estampa({ tipo }: { tipo: string }) {
  switch (tipo) {
    case 'gravata': return <path d="M -2 -44 L 2 -44 L 3 -40 L 0 -26 L -3 -40 Z" fill="#dc2626" />;
    case 'megafone': return <g><path d="M -6 -36 L 2 -40 L 2 -30 L -6 -34 Z" fill="#fff" /><rect x={-9} y={-36} width={3} height={2} fill="#fff" /></g>;
    case 'coracao': return <path d="M 0 -30 C -8 -36 -5 -42 0 -38 C 5 -42 8 -36 0 -30 Z" fill="#fff" />;
    case 'brilho': return <path d="M 0 -42 L 2 -36 L 8 -34 L 2 -32 L 0 -26 L -2 -32 L -8 -34 L -2 -36 Z" fill="#fde68a" />;
    case 'circuito': return <g stroke="#fbcfe8" strokeWidth={1.2} fill="none"><path d="M -8 -40 H -2 V -32 H 6" /><circle cx={6} cy={-32} r={1.5} fill="#fbcfe8" /><circle cx={-8} cy={-40} r={1.5} fill="#fbcfe8" /></g>;
    case 'agenda': return <g><rect x={-6} y={-40} width={12} height={11} rx={1} fill="#fff" /><rect x={-6} y={-40} width={12} height={3} fill="#ef4444" /></g>;
    case 'blazer': return <g><path d="M -12 -46 L -2 -46 L -6 -28 Z" fill="rgba(0,0,0,.25)" /><path d="M 12 -46 L 2 -46 L 6 -28 Z" fill="rgba(0,0,0,.25)" /><circle cx={0} cy={-34} r={1.3} fill="#fbbf24" /></g>;
    case 'headset': return <g><rect x={-4} y={-40} width={8} height={6} rx={1} fill="#fff" /><text x={0} y={-35} fontSize={5} textAnchor="middle" fill="#e11d74" fontWeight={800}>OI</text></g>;
    default: return null;
  }
}

function Minifig({ id, cor, status, atraso }: { id: string; cor: string; status: AgenteSala['status']; atraso: number }) {
  const v = VISUAL[id] || { corCabelo: '#333', feminina: true, estampa: '' };
  const d = { animationDelay: `${atraso}s` };
  return (
    <g className={`fig fig-${status}`} style={d}>
      {/* braços (atrás do tronco) e mãos em C */}
      <g transform="translate(-13 -42)"><g className="braco braco-e" style={d}>
        <path d="M 0 0 Q -7 6 -6 18 L 0 20 Q -1 10 4 4 Z" fill={cor} />
        <circle cx={-3} cy={22} r={4.2} fill={AMARELO} /><circle cx={-3} cy={24} r={1.8} fill={AMARELO_SOMBRA} />
      </g></g>
      <g transform="translate(13 -42)"><g className={`braco braco-d ${status === 'parado' ? 'cafe' : ''}`} style={d}>
        <path d="M 0 0 Q 7 6 6 18 L 0 20 Q 1 10 -4 4 Z" fill={cor} />
        <circle cx={3} cy={22} r={4.2} fill={AMARELO} /><circle cx={3} cy={24} r={1.8} fill={AMARELO_SOMBRA} />
        {status === 'parado' && <g className="xicara"><rect x={-1} y={14} width={8} height={8} rx={1.5} fill="#fff" stroke="#cbd5e1" /><path d="M 7 16 q 3 2 0 4" stroke="#cbd5e1" fill="none" /></g>}
      </g></g>
      {/* tronco trapezoidal com estampa */}
      <path d="M -12 -46 L 12 -46 L 16 -14 L -16 -14 Z" fill={cor} />
      <path d="M -12 -46 L 12 -46 L 12.6 -42 L -12.6 -42 Z" fill="rgba(255,255,255,.18)" />
      <Estampa tipo={v.estampa} />
      {/* pescoço + cabeça */}
      <rect x={-5} y={-49} width={10} height={4} fill={AMARELO_SOMBRA} />
      <g className="cabeca" style={d}>
        {(v.cabelo === 'longo' || v.cabelo === 'ondulado') && <Cabelo tipo={v.cabelo} cor={v.corCabelo} corAgente={cor} />}
        <rect x={-11} y={-72} width={22} height={24} rx={6} fill={AMARELO} />
        <rect x={-11} y={-72} width={5} height={24} rx={3} fill="rgba(255,255,255,.25)" />
        {/* rosto */}
        <g className="olhos" style={d}>
          <ellipse cx={-4.5} cy={-61} rx={1.7} ry={2.1} fill="#111" /><ellipse cx={4.5} cy={-61} rx={1.7} ry={2.1} fill="#111" />
          {v.feminina && <path d="M -7 -63.5 l -1.6 -1.4 M 7 -63.5 l 1.6 -1.4" stroke="#111" strokeWidth={0.9} />}
        </g>
        {status === 'desligado'
          ? <path d="M -3 -54 q 3 1.5 6 0" stroke="#111" strokeWidth={1.2} fill="none" />
          : <path d="M -5 -55 q 5 5 10 0" stroke={v.feminina ? '#dc2626' : '#111'} strokeWidth={v.feminina ? 1.8 : 1.3} fill="none" strokeLinecap="round" />}
        {v.feminina && <><circle cx={-8} cy={-56} r={2} fill="#fb923c" opacity={0.45} /><circle cx={8} cy={-56} r={2} fill="#fb923c" opacity={0.45} /></>}
        {v.extra === 'oculos' && <g stroke="#111" strokeWidth={1} fill="rgba(255,255,255,.35)"><circle cx={-4.5} cy={-61} r={3.6} /><circle cx={4.5} cy={-61} r={3.6} /><path d="M -1 -61 h 2" /></g>}
        {!(v.cabelo === 'longo' || v.cabelo === 'ondulado') && <Cabelo tipo={v.cabelo} cor={v.corCabelo} corAgente={cor} />}
        {v.cabelo === 'longo' || v.cabelo === 'ondulado' ? <path d="M -11 -64 Q -11 -80 0 -80 Q 11 -80 11 -64 Q 4 -72 -11 -64 Z" fill={v.corCabelo} /> : null}
        {v.extra === 'headset' && <g><path d="M -13 -62 Q -13 -84 0 -84 Q 13 -84 13 -62" stroke="#111827" strokeWidth={2} fill="none" /><rect x={-15} y={-65} width={4} height={8} rx={2} fill="#111827" /><path d="M -13 -58 Q -10 -52 -4 -52" stroke="#111827" strokeWidth={1.3} fill="none" /><circle cx={-4} cy={-52} r={1.4} fill="#e11d74" /></g>}
      </g>
      {status === 'desligado' && <g className="zzz" style={d}><text x={14} y={-80} fontSize={10} fontWeight={800} fill="#64748b">z</text><text x={20} y={-90} fontSize={13} fontWeight={800} fill="#64748b">z</text></g>}
    </g>
  );
}

// ── Sala ───────────────────────────────────────────────────────────────────

function useAgora() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => { setAgora(new Date()); const i = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(i); }, []);
  return agora;
}

export default function SalaIsometrica({ agentes, selecionado, onSelecionar }: { agentes: AgenteSala[]; selecionado: string | null; onSelecionar: (id: string) => void }) {
  const agora = useAgora();
  const W = COLS * ESPACO + 1.4, D = LINHAS * ESPACO + 1.4;
  const cantos = [iso(0, 0), iso(W, 0), iso(W, D), iso(0, D)];
  const minX = cantos[3].x - 30, maxX = cantos[1].x + 30, minY = cantos[0].y - 210, maxY = cantos[2].y + 20;
  const PAREDE = 140;
  const up = (p: { x: number; y: number }, k: number) => ({ x: p.x, y: p.y - k });

  // hora de São Paulo para relógio e janela
  const hSP = agora ? Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(agora)) : 12;
  const mSP = agora ? agora.getUTCMinutes() : 0, sSP = agora ? agora.getUTCSeconds() : 0;
  const dia = hSP >= 6 && hSP < 18, entardecer = hSP >= 17 && hSP < 19;
  const ceu = dia ? (entardecer ? '#fdba74' : '#7dd3fc') : '#1e1b4b';

  // janela na parede esquerda (eixo y) e relógio na parede do fundo (eixo x)
  const jA = iso(0, 1.0), jB = iso(0, 2.6);
  const relogio = up(iso(W - 1.6, 0), 88);
  const angMin = mSP * 6 + sSP * 0.1, angHora = (hSP % 12) * 30 + mSP * 0.5, angSeg = sSP * 6;
  const cafe = iso(W - 1.0, 0.5);

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" aria-label="Escritório virtual com os agentes em estilo LEGO" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <style>{`
        .fig-trabalhando .braco-e{animation:digita .38s ease-in-out infinite alternate}
        .fig-trabalhando .braco-d{animation:digita .38s ease-in-out infinite alternate-reverse}
        @keyframes digita{from{transform:rotate(-6deg)}to{transform:rotate(8deg)}}
        .fig-trabalhando .cabeca{animation:balanca 2.4s ease-in-out infinite}
        @keyframes balanca{0%,100%{transform:rotate(0)}30%{transform:rotate(-4deg)}60%{transform:rotate(3deg)}}
        .fig-parado .cabeca{animation:olha 7s ease-in-out infinite}
        @keyframes olha{0%,55%,100%{transform:translateX(0)}62%,72%{transform:translateX(-2.5px)}80%,88%{transform:translateX(2.5px)}}
        .fig-parado .cafe{animation:gole 6s ease-in-out infinite}
        @keyframes gole{0%,60%,100%{transform:rotate(0)}70%,82%{transform:rotate(-120deg)}}
        .olhos{animation:pisca 4.5s infinite}
        @keyframes pisca{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
        .olhos{transform-origin:0 -61px}
        .fig-desligado .cabeca{transform:rotate(14deg) translateY(4px)}
        .fig-desligado .olhos{animation:none;transform:scaleY(.12)}
        .zzz{animation:sobe 2.6s ease-in infinite}
        @keyframes sobe{0%{opacity:0;transform:translate(0,6px)}30%{opacity:1}100%{opacity:0;transform:translate(6px,-14px)}}
        .rabo{transform-origin:10px -66px;animation:rabo 1.8s ease-in-out infinite}
        @keyframes rabo{50%{transform:rotate(8deg)}}
        .tela-linhas{animation:rola 1.2s linear infinite}
        @keyframes rola{from{transform:translateY(0)}to{transform:translateY(-8px)}}
        .icone{animation:flutua 3.2s ease-out infinite;opacity:0}
        @keyframes flutua{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:1;transform:translateY(-6px) scale(1)}100%{opacity:0;transform:translateY(-46px) scale(.9)}}
        .balao{animation:pop .5s cubic-bezier(.3,1.6,.5,1) both;transform-box:fill-box;transform-origin:50% 100%}
        @keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
        .vapor{animation:vapor 2.4s ease-out infinite}
        @keyframes vapor{0%{opacity:0;transform:translateY(0)}30%{opacity:.8}100%{opacity:0;transform:translateY(-22px)}}
        .planta{transform-origin:50% 100%;transform-box:fill-box;animation:vento 5s ease-in-out infinite}
        @keyframes vento{50%{transform:rotate(3deg)}}
        .luz-status-trabalhando{animation:pulsa 1.4s ease-in-out infinite}
        @keyframes pulsa{50%{opacity:.35}}
        .mesa{cursor:pointer}
        .mesa:focus-visible{outline:none}
        .mesa:hover .cracha,.mesa:focus-visible .cracha{stroke:#60a5fa;stroke-width:2}
        @media (prefers-reduced-motion:reduce){*{animation:none!important}}
      `}</style>

      {/* paredes */}
      <polygon points={pts(iso(0, 0), iso(W, 0), up(iso(W, 0), PAREDE), up(iso(0, 0), PAREDE))} fill="#c7d2fe" />
      <polygon points={pts(iso(0, 0), iso(0, D), up(iso(0, D), PAREDE), up(iso(0, 0), PAREDE))} fill="#e0e7ff" />
      <polygon points={pts(iso(0, 0), iso(W, 0), up(iso(W, 0), 14), up(iso(0, 0), 14))} fill="#a5b4fc" />
      {/* janela com céu do horário */}
      <polygon points={pts(up(jA, 118), up(jB, 118), up(jB, 50), up(jA, 50))} fill={ceu} stroke="#fff" strokeWidth={5} />
      {dia
        ? <circle cx={esc((jA.x + jB.x) / 2 - 14)} cy={esc((jA.y + jB.y) / 2 - 96)} r={9} fill="#fde047" />
        : <><circle cx={esc((jA.x + jB.x) / 2 - 14)} cy={esc((jA.y + jB.y) / 2 - 96)} r={8} fill="#f8fafc" /><circle cx={esc((jA.x + jB.x) / 2 - 10)} cy={esc((jA.y + jB.y) / 2 - 99)} r={7} fill={ceu} />
          {[[-30, -80], [10, -70], [24, -104]].map(([dx, dy], i) => <circle key={i} cx={esc((jA.x + jB.x) / 2 + dx)} cy={esc((jA.y + jB.y) / 2 + dy)} r={1.3} fill="#fff" />)}</>}
      <polyline points={pts(up(iso(0, 1.8), 118), up(iso(0, 1.8), 50))} stroke="#fff" strokeWidth={4} />
      {/* letreiro */}
      {(() => {
        const a = up(iso(1.4, 0), 112), b = up(iso(5.6, 0), 112), c = up(iso(5.6, 0), 76), e = up(iso(1.4, 0), 76);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + 22, ang = Math.atan2(ALT, LARG) * 180 / Math.PI;
        return (<g><polygon points={pts(a, b, c, e)} fill="#0f172a" />
          <text x={cx} y={cy} fill="#fde047" fontSize={15} fontWeight={900} textAnchor="middle" letterSpacing={3} transform={`rotate(${ang} ${cx} ${cy - 5})`}>PROSYSTEM · COMERCIAL</text></g>);
      })()}
      {/* relógio com a hora real */}
      <g transform={`translate(${esc(relogio.x)} ${esc(relogio.y)})`}>
        <ellipse rx={20} ry={22} fill="#fff" stroke="#1e293b" strokeWidth={3} />
        {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={esc(Math.sin(i * Math.PI / 6) * 15)} cy={esc(-Math.cos(i * Math.PI / 6) * 16)} r={1.2} fill="#334155" />)}
        <line x1={0} y1={0} x2={0} y2={-9} stroke="#0f172a" strokeWidth={3} strokeLinecap="round" transform={`rotate(${angHora})`} />
        <line x1={0} y1={0} x2={0} y2={-14} stroke="#0f172a" strokeWidth={2} strokeLinecap="round" transform={`rotate(${angMin})`} />
        <line x1={0} y1={2} x2={0} y2={-15} stroke="#ef4444" strokeWidth={1} transform={`rotate(${angSeg})`} />
        <circle r={2} fill="#ef4444" />
      </g>
      {/* piso em placas */}
      <polygon points={pts(...cantos)} fill="#fde7c4" />
      {Array.from({ length: Math.ceil(W) + 1 }, (_, i) => <polyline key={`gx${i}`} points={pts(iso(i, 0), iso(i, D))} stroke="#f3d3a1" strokeWidth={1.2} fill="none" />)}
      {Array.from({ length: Math.ceil(D) + 1 }, (_, i) => <polyline key={`gy${i}`} points={pts(iso(0, i), iso(W, i))} stroke="#f3d3a1" strokeWidth={1.2} fill="none" />)}
      {/* cafeteira com vapor */}
      <Caixa x={W - 1.3} y={0.25} w={0.6} d={0.45} h={34} topo="#94a3b8" esq="#64748b" dir="#475569" />
      <Caixa x={W - 1.2} y={0.3} w={0.4} d={0.3} h={22} z={34} topo="#1f2937" esq="#111827" dir="#0b1220" />
      {[0, 0.8, 1.6].map(t => <circle key={t} className="vapor" style={{ animationDelay: `${t}s` }} cx={esc(cafe.x - 8)} cy={esc(cafe.y - 64)} r={4} fill="#fff" opacity={0} />)}
      {/* planta */}
      <Caixa x={0.25} y={D - 0.8} w={0.45} d={0.45} h={22} topo="#b45309" esq="#92400e" dir="#78350f" />
      <g className="planta">
        {[-14, 0, 14, -7, 7].map((dx, i) => <ellipse key={i} cx={esc(iso(0.47, D - 0.57).x + dx)} cy={esc(iso(0.47, D - 0.57).y - 36 - (i > 2 ? 12 : 0))} rx={9} ry={16} fill={i % 2 ? '#15803d' : '#22c55e'} transform={`rotate(${dx * 2} ${esc(iso(0.47, D - 0.57).x + dx)} ${esc(iso(0.47, D - 0.57).y - 36)})`} />)}
      </g>

      {/* estações de trabalho (de trás para a frente) */}
      {agentes
        .map((a, i) => ({ a, col: i % COLS, lin: Math.floor(i / COLS), i }))
        .sort((p, q) => (p.col + p.lin) - (q.col + q.lin))
        .map(({ a, col, lin, i }) => {
          const bx = 0.9 + col * ESPACO, by = 1.1 + lin * ESPACO;
          const fig = iso(bx + 0.62, by + 0.12); // sentado atrás da mesa: o tampo cobre a cintura
          const topoMesa = { x: fig.x, y: fig.y - 30 };
          const tag = { x: fig.x, y: topoMesa.y - 104 };
          const sel = selecionado === a.id;
          const trabalhando = a.status === 'trabalhando';
          const balao = trabalhando && a.ultima ? quebrar(a.ultima.texto) : null;
          const nb = iso(bx + 0.12, by + 0.2);
          return (
            <g key={a.id} className="mesa" tabIndex={0} role="button" aria-label={`${a.nome}: ${a.status}`}
              onClick={() => onSelecionar(a.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelecionar(a.id); } }}>
              {sel && <polygon points={pts(iso(bx - 0.3, by - 0.8), iso(bx + 1.5, by - 0.8), iso(bx + 1.5, by + 1.1), iso(bx - 0.3, by + 1.1))} fill={a.cor} opacity={0.14} stroke={a.cor} strokeWidth={2.5} strokeDasharray="7 5" />}
              {/* cadeira (encosto atrás do boneco) */}
              <Caixa x={bx + 0.32} y={by - 0.2} w={0.6} d={0.1} h={44} topo="#4338ca" esq="#3730a3" dir="#312e81" />
              <g transform={`translate(${esc(topoMesa.x)} ${esc(topoMesa.y)})`}>
                <Minifig id={a.id} cor={a.cor} status={a.status} atraso={-(i * 0.37)} />
              </g>
              {/* mesa */}
              <Caixa x={bx} y={by} w={1.2} d={0.7} h={30} topo="#fef3c7" esq="#e5c07b" dir="#d4a857" />
              {/* notebook de lado, tela virada para o boneco */}
              <Caixa x={bx + 0.1} y={by + 0.15} w={0.35} d={0.4} h={2} z={30} topo="#94a3b8" esq="#64748b" dir="#475569" />
              <g>
                <polygon points={pts(up(nb, 32), up(iso(bx + 0.12, by + 0.55), 32), up(iso(bx + 0.12, by + 0.55), 58), up(nb, 58))} fill="#1e293b" />
                <clipPath id={`tela-${a.id}`}><polygon points={pts(up(nb, 35), up(iso(bx + 0.12, by + 0.52), 35), up(iso(bx + 0.12, by + 0.52), 55), up(nb, 55))} /></clipPath>
                <g clipPath={`url(#tela-${a.id})`}>
                  <polygon points={pts(up(nb, 35), up(iso(bx + 0.12, by + 0.52), 35), up(iso(bx + 0.12, by + 0.52), 55), up(nb, 55))} fill={a.status === 'desligado' ? '#0f172a' : '#38bdf8'} />
                  {a.status !== 'desligado' && <g className={trabalhando ? 'tela-linhas' : undefined}>
                    {[0, 1, 2, 3, 4].map(k => <line key={k} x1={esc(nb.x - 2 - k)} y1={esc(nb.y - 51 + k * 5)} x2={esc(nb.x - 14 - k)} y2={esc(nb.y - 44 + k * 5)} stroke="#e0f2fe" strokeWidth={1.4} />)}
                  </g>}
                </g>
              </g>
              {/* caneca e papéis */}
              <Caixa x={bx + 0.95} y={by + 0.45} w={0.12} d={0.12} h={9} z={30} topo="#fff" esq={a.cor} dir={a.cor} />
              <polygon points={pts(up(iso(bx + 0.6, by + 0.35), 31), up(iso(bx + 0.85, by + 0.35), 31), up(iso(bx + 0.85, by + 0.6), 31), up(iso(bx + 0.6, by + 0.6), 31))} fill="#fff" stroke="#e2e8f0" />
              {/* ícones subindo quando trabalha */}
              {trabalhando && ['✉️', '💬', '✅'].map((ic, k) => (
                <text key={k} className="icone" style={{ animationDelay: `${k * 1.05 - i * 0.3}s` }} x={esc(fig.x + 26 + k * 4)} y={esc(topoMesa.y - 10)} fontSize={13}>{ic}</text>
              ))}
              {/* crachá */}
              <g>
                <rect className="cracha" x={esc(tag.x - 54)} y={esc(tag.y - 14)} width={108} height={24} rx={12} fill="#0f172a" />
                <circle cx={esc(tag.x - 41)} cy={esc(tag.y - 2)} r={7} fill={a.cor} />
                <text x={esc(tag.x - 41)} y={esc(tag.y + 1.5)} fontSize={8} fontWeight={800} fill="#fff" textAnchor="middle">{a.nome[0]}</text>
                <text x={esc(tag.x + 2)} y={esc(tag.y + 2.5)} fill="#f8fafc" fontSize={11.5} fontWeight={700} textAnchor="middle">{a.nome}</text>
                <circle className={`luz-status-${a.status}`} cx={esc(tag.x + 43)} cy={esc(tag.y - 2)} r={4.5} fill={COR_STATUS[a.status]} />
              </g>
              {/* balão da última ação */}
              {balao && (
                <g className="balao">
                  <rect x={esc(tag.x - 92)} y={esc(tag.y - 24 - balao.length * 14)} width={184} height={balao.length * 14 + 10} rx={10} fill="#fff" stroke={a.cor} strokeWidth={1.5} />
                  <path d={`M ${esc(tag.x - 6)} ${esc(tag.y - 14.5)} l 6 6 l 6 -6 Z`} fill="#fff" />
                  {balao.map((l, k) => <text key={k} x={esc(tag.x)} y={esc(tag.y - 24 - balao.length * 14 + 16 + k * 14)} fontSize={11} fill="#0f172a" textAnchor="middle">{l}</text>)}
                </g>
              )}
            </g>
          );
        })}
    </svg>
  );
}
