'use client';

// Sala do escritório virtual em SVG isométrico: chão, paredes, uma mesa por
// agente e a pessoa atrás dela, com crachá, luz de status e balão da última ação.

export type AgenteSala = {
  id: string; nome: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado';
  ultima: { texto: string } | null;
};

const LARG = 70, ALT = 40; // meia-largura e meia-altura de uma célula do piso
const COLS = 4, LINHAS = 2, ESPACO = 2.2; // mesas a cada 2,2 células
const MULHER_CABELO_LONGO = new Set(['bia', 'lurdinha', 'clarice', 'helena', 'laya', 'marta']);
const COR_STATUS = { trabalhando: '#22c55e', parado: '#eab308', desligado: '#94a3b8' } as const;

const iso = (x: number, y: number) => ({ x: (x - y) * LARG, y: (x + y) * ALT });
const pts = (...p: { x: number; y: number }[]) => p.map(q => `${q.x},${q.y}`).join(' ');

function quebrar(texto: string, max = 26, linhas = 2): string[] {
  const palavras = texto.split(/\s+/);
  const out: string[] = [''];
  for (const w of palavras) {
    if ((out[out.length - 1] + ' ' + w).trim().length > max) {
      if (out.length === linhas) { out[out.length - 1] = out[out.length - 1].replace(/.{0,2}$/, '…'); break; }
      out.push(w);
    } else out[out.length - 1] = (out[out.length - 1] + ' ' + w).trim();
  }
  return out;
}

/** Caixa isométrica (top + faces esquerda/direita) com base em (x, y), tamanho w×d e altura h (px). */
function Caixa({ x, y, w, d, h, topo, esq, dir }: { x: number; y: number; w: number; d: number; h: number; topo: string; esq: string; dir: string }) {
  const a = iso(x, y), b = iso(x + w, y), c = iso(x + w, y + d), e = iso(x, y + d);
  const up = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - h });
  return (
    <g>
      <polygon points={pts(e, c, up(c), up(e))} fill={esq} />
      <polygon points={pts(b, c, up(c), up(b))} fill={dir} />
      <polygon points={pts(up(a), up(b), up(c), up(e))} fill={topo} />
    </g>
  );
}

function Pessoa({ cx, cy, cor, id, status }: { cx: number; cy: number; cor: string; id: string; status: AgenteSala['status'] }) {
  const cabeloLongo = MULHER_CABELO_LONGO.has(id);
  const cabelo = id === 'zequinha' ? '#3f2a1d' : id === 'luiz_felipe' ? '#1f2937' : ['#5b3a24', '#1f1f1f', '#a0522d', '#2b1b10', '#7c4a2d', '#111'][id.length % 6];
  const pele = ['#f1c7a3', '#d9a066', '#8d5524', '#e0ac69', '#c68642'][id.charCodeAt(0) % 5];
  return (
    <g className={status === 'trabalhando' ? 'pessoa-trabalhando' : undefined} opacity={status === 'desligado' ? 0.45 : 1}>
      <ellipse cx={cx} cy={cy + 2} rx={16} ry={6} fill="rgba(15,23,42,.18)" />
      <rect x={cx - 12} y={cy - 40} width={24} height={40} rx={9} fill={cor} />
      {cabeloLongo && <rect x={cx - 12} y={cy - 62} width={24} height={30} rx={11} fill={cabelo} />}
      <circle cx={cx} cy={cy - 52} r={11} fill={pele} />
      <path d={`M ${cx - 11} ${cy - 54} Q ${cx} ${cy - 70} ${cx + 11} ${cy - 54} Q ${cx + 4} ${cy - 60} ${cx - 11} ${cy - 54}`} fill={cabelo} />
    </g>
  );
}

export default function SalaIsometrica({ agentes, selecionado, onSelecionar }: { agentes: AgenteSala[]; selecionado: string | null; onSelecionar: (id: string) => void }) {
  const W = COLS * ESPACO + 1.2, D = LINHAS * ESPACO + 1.6;
  const cantos = [iso(0, 0), iso(W, 0), iso(W, D), iso(0, D)];
  const minX = cantos[3].x - 40, maxX = cantos[1].x + 40, minY = cantos[0].y - 190, maxY = cantos[2].y + 30;
  const PAREDE = 120;

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" aria-label="Sala do escritório virtual com os agentes" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <style>{`
        .pessoa-trabalhando{animation:quica 1.6s ease-in-out infinite}
        @keyframes quica{50%{transform:translateY(-3px)}}
        .mesa{cursor:pointer}
        .mesa:focus-visible{outline:none}
        .mesa:focus-visible .cracha,.mesa:hover .cracha{stroke:var(--t-primary, #2563eb);stroke-width:2}
        @media (prefers-reduced-motion:reduce){.pessoa-trabalhando{animation:none}}
      `}</style>
      {/* paredes do fundo */}
      <polygon points={pts(iso(0, 0), iso(W, 0), { x: iso(W, 0).x, y: iso(W, 0).y - PAREDE }, { x: iso(0, 0).x, y: iso(0, 0).y - PAREDE })} fill="#cbd5e1" />
      <polygon points={pts(iso(0, 0), iso(0, D), { x: iso(0, D).x, y: iso(0, D).y - PAREDE }, { x: iso(0, 0).x, y: iso(0, 0).y - PAREDE })} fill="#e2e8f0" />
      {/* quadro da marca na parede */}
      <polygon points={pts({ x: iso(1.2, 0).x, y: iso(1.2, 0).y - 95 }, { x: iso(4.6, 0).x, y: iso(4.6, 0).y - 95 }, { x: iso(4.6, 0).x, y: iso(4.6, 0).y - 55 }, { x: iso(1.2, 0).x, y: iso(1.2, 0).y - 55 })} fill="#0f172a" />
      {(() => {
        const cx = (iso(1.2, 0).x + iso(4.6, 0).x) / 2, cy = (iso(1.2, 0).y + iso(4.6, 0).y) / 2 - 70;
        const ang = Math.atan2(ALT, LARG) * 180 / Math.PI; // inclinação da parede
        return <text x={cx} y={cy + 5} fill="#e2e8f0" fontSize={16} fontWeight={800} textAnchor="middle" letterSpacing={2} transform={`rotate(${ang} ${cx} ${cy})`}>PROSYSTEM · COMERCIAL</text>;
      })()}
      {/* piso */}
      <polygon points={pts(...cantos)} fill="#f1e9dc" />
      {Array.from({ length: Math.ceil(W) }, (_, i) => <polyline key={`gx${i}`} points={pts(iso(i, 0), iso(i, D))} stroke="#e4d8c5" strokeWidth={1} fill="none" />)}
      {Array.from({ length: Math.ceil(D) }, (_, i) => <polyline key={`gy${i}`} points={pts(iso(0, i), iso(W, i))} stroke="#e4d8c5" strokeWidth={1} fill="none" />)}
      {/* planta e sofá */}
      <Caixa x={W - 0.9} y={0.2} w={0.5} d={0.5} h={22} topo="#b45309" esq="#92400e" dir="#78350f" />
      <circle cx={iso(W - 0.65, 0.45).x} cy={iso(W - 0.65, 0.45).y - 40} r={20} fill="#16a34a" />

      {/* mesas em ordem de profundidade (de trás para a frente) */}
      {agentes
        .map((a, i) => ({ a, col: i % COLS, lin: Math.floor(i / COLS) }))
        .sort((p, q) => (p.col + p.lin) - (q.col + q.lin))
        .map(({ a, col, lin }) => {
          const bx = 0.8 + col * ESPACO, by = 0.9 + lin * ESPACO;
          const pessoa = iso(bx + 0.6, by + 1.15); // sentada na frente da mesa, virada para o monitor
          const tag = { x: pessoa.x, y: pessoa.y - 92 };
          const sel = selecionado === a.id;
          const balao = a.status === 'trabalhando' && a.ultima ? quebrar(a.ultima.texto) : null;
          return (
            <g key={a.id} className="mesa" tabIndex={0} role="button" aria-label={`${a.nome}, ${a.status}`}
              onClick={() => onSelecionar(a.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelecionar(a.id); } }}>
              {sel && <polygon points={pts(iso(bx - 0.25, by - 0.2), iso(bx + 1.45, by - 0.2), iso(bx + 1.45, by + 1.6), iso(bx - 0.25, by + 1.6))} fill="none" stroke={a.cor} strokeWidth={3} strokeDasharray="6 5" />}
              {/* mesa + monitor no fundo da mesa, tela virada para a pessoa */}
              <Caixa x={bx} y={by} w={1.2} d={0.7} h={30} topo="#e7c9a0" esq="#c9a57a" dir="#b8925f" />
              <Caixa x={bx + 0.35} y={by + 0.08} w={0.5} d={0.06} h={30 + 30} topo="#1e293b" esq="#0f172a" dir="#334155" />
              <polygon points={pts(
                { x: iso(bx + 0.38, by + 0.14).x, y: iso(bx + 0.38, by + 0.14).y - 34 }, { x: iso(bx + 0.82, by + 0.14).x, y: iso(bx + 0.82, by + 0.14).y - 34 },
                { x: iso(bx + 0.82, by + 0.14).x, y: iso(bx + 0.82, by + 0.14).y - 56 }, { x: iso(bx + 0.38, by + 0.14).x, y: iso(bx + 0.38, by + 0.14).y - 56 },
              )} fill={a.status === 'desligado' ? '#334155' : '#38bdf8'} opacity={0.85} />
              {/* cadeira + pessoa */}
              <Caixa x={bx + 0.4} y={by + 1.0} w={0.4} d={0.35} h={14} topo="#6366f1" esq="#4f46e5" dir="#4338ca" />
              <Pessoa cx={pessoa.x} cy={pessoa.y} cor={a.cor} id={a.id} status={a.status} />
              {/* crachá */}
              <g>
                <rect className="cracha" x={tag.x - 52} y={tag.y - 14} width={104} height={24} rx={6} fill="#0f172a" />
                <rect x={tag.x - 52} y={tag.y - 14} width={4} height={24} rx={2} fill={a.cor} />
                <text x={tag.x - 4} y={tag.y + 3} fill="#f8fafc" fontSize={12} fontWeight={700} textAnchor="middle">{a.nome}</text>
                <circle cx={tag.x + 40} cy={tag.y - 2} r={5} fill={COR_STATUS[a.status]} stroke="#0f172a" strokeWidth={1.5} />
              </g>
              {/* balão */}
              {balao && (
                <g>
                  <rect x={tag.x - 90} y={tag.y - 30 - balao.length * 14} width={180} height={balao.length * 14 + 10} rx={8} fill="#ffffff" stroke="#cbd5e1" />
                  {balao.map((l, k) => <text key={k} x={tag.x} y={tag.y - 30 - balao.length * 14 + 16 + k * 14} fontSize={11} fill="#0f172a" textAnchor="middle">{l}</text>)}
                </g>
              )}
            </g>
          );
        })}
    </svg>
  );
}
