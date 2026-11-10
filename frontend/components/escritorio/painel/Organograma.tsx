'use client';

// Organograma vivo (10/11/2026): quem passa trabalho para quem, com o número de passagens de hoje em cada seta.
// Linha cheia = o lead ou o material segue; tracejada = orienta, confere ou devolve. Agente com erro em vermelho.

import type { AgenteTela, Passagem, Quadro, Setor } from './tipos';
import { COR_STATUS } from './tipos';

const W = 150, H = 58, X0 = 36, PASSO_X = 182, LINHAS = [86, 236, 386, 536];
const COLUNA: Record<string, number> = {
  heitor: 0, bia: 1, zequinha: 2, clarice: 3,
  julio: 0, caroline: 1, lurdinha: 2, luiz_felipe: 3,
  olivia: 0, rafael: 1, laya: 2, sofia: 3, joana: 4,
  helena: 0, mila: 1, otavio: 2, marta: 3,
};

export default function Organograma({ setores, agentes, quadros, passagens, onAgente }: {
  setores: Setor[]; agentes: AgenteTela[]; quadros: Quadro[]; passagens: Passagem[]; onAgente: (id: string) => void;
}) {
  const linhaDe = (id: string) => setores.findIndex(s => s.agentes.includes(id));
  const centro = (id: string) => ({ x: X0 + COLUNA[id] * PASSO_X + W / 2, y: LINHAS[Math.max(0, linhaDe(id))] + H / 2 });
  const ag = (id: string) => agentes.find(a => a.id === id);
  const erro = (id: string) => quadros.find(q => q.id === id)?.erro;
  const total = passagens.reduce((s, p) => s + (p.hoje || 0), 0);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>Quem trabalha com quem</h2>
        <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{total} passagens hoje · o número na seta é o de hoje · clique num agente para ver o quadro dele</span>
      </div>
      <div style={{ overflowX: 'auto', background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14 }}>
        <svg viewBox="0 0 960 630" style={{ width: '100%', minWidth: 720, display: 'block' }} role="img" aria-label="Organograma dos agentes com as passagens de hoje">
          <defs>
            <marker id="org-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#94a3b8" /></marker>
            <marker id="org-seta-ativa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2563eb" /></marker>
          </defs>
          {setores.map((s, i) => (
            <g key={s.id}>
              <rect x={14} y={LINHAS[i] - 34} width={932} height={H + 52} rx={12} fill="var(--t-content-bg)" />
              <text x={28} y={LINHAS[i] - 14} fontSize={12} fontWeight={700} fill="var(--t-text-muted)" letterSpacing=".06em">{s.nome.toUpperCase()}</text>
            </g>
          ))}
          {passagens.map((p, k) => {
            const a = centro(p.de), b = centro(p.para);
            const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
            // Curva suave; sai e chega na borda da caixa.
            const curva = (k % 2 ? 1 : -1) * Math.min(60, dist / 4);
            const c = { x: (a.x + b.x) / 2 - (dy / dist) * curva, y: (a.y + b.y) / 2 + (dx / dist) * curva };
            const corta = (o: { x: number; y: number }, alvo: { x: number; y: number }) => {
              const vx = alvo.x - o.x, vy = alvo.y - o.y;
              const t = Math.min(Math.abs((W / 2 + 4) / (vx || 1e-6)), Math.abs((H / 2 + 4) / (vy || 1e-6)));
              return { x: o.x + vx * Math.min(t, 1), y: o.y + vy * Math.min(t, 1) };
            };
            const ini = corta(a, c), fim = corta(b, c);
            const meio = { x: 0.25 * ini.x + 0.5 * c.x + 0.25 * fim.x, y: 0.25 * ini.y + 0.5 * c.y + 0.25 * fim.y };
            const ativa = (p.hoje || 0) > 0;
            const travada = !!erro(p.para) || !!erro(p.de);
            const cor = travada ? COR_STATUS.erro : ativa ? '#2563eb' : '#94a3b8';
            return (
              <g key={`${p.de}-${p.para}`}>
                <title>{`${ag(p.de)?.nome} → ${ag(p.para)?.nome}: ${p.rotulo}${p.hoje != null ? ` (${p.hoje} hoje)` : ''}`}</title>
                <path d={`M${ini.x} ${ini.y} Q${c.x} ${c.y} ${fim.x} ${fim.y}`} fill="none" stroke={cor} strokeWidth={ativa ? Math.min(4, 1.5 + Math.log2((p.hoje || 0) + 1) / 2) : 1.3}
                  strokeDasharray={p.tipo === 'orienta' ? '5 4' : undefined} markerEnd={`url(#${ativa && !travada ? 'org-seta-ativa' : 'org-seta'})`} opacity={ativa || travada ? 1 : 0.7} />
                {p.hoje != null && p.hoje > 0 && (
                  <g>
                    <rect x={meio.x - 14} y={meio.y - 10} width={28} height={20} rx={10} fill={cor} />
                    <text x={meio.x} y={meio.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">{p.hoje}</text>
                  </g>
                )}
              </g>
            );
          })}
          {agentes.filter(a => COLUNA[a.id] !== undefined).map(a => {
            const c = centro(a.id), x = c.x - W / 2, y = c.y - H / 2;
            const e = erro(a.id);
            return (
              <g key={a.id} role="button" tabIndex={0} aria-label={`${a.nome}: ${a.funcao}`} style={{ cursor: 'pointer' }} onClick={() => onAgente(a.id)}
                onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onAgente(a.id); } }}>
                <rect x={x} y={y} width={W} height={H} rx={10} fill="var(--t-card-bg)" stroke={e ? COR_STATUS.erro : a.cor} strokeWidth={e ? 2.5 : 1.5} />
                <circle cx={x + 16} cy={y + 20} r={5} fill={COR_STATUS[a.status]} />
                <text x={x + 28} y={y + 24} fontSize={14} fontWeight={700} fill="var(--t-text-primary)">{a.nome}</text>
                <text x={x + 12} y={y + 44} fontSize={11} fill={e ? COR_STATUS.erro : 'var(--t-text-muted)'}>{(e ? 'com erro' : a.funcao.split('·')[0].trim()).slice(0, 24)}</text>
              </g>
            );
          })}
          <g fontSize={11} fill="var(--t-text-muted)">
            <line x1={28} x2={58} y1={612} y2={612} stroke="#2563eb" strokeWidth={2.5} /><text x={64} y={616}>passou trabalho hoje</text>
            <line x1={210} x2={240} y1={612} y2={612} stroke="#94a3b8" strokeWidth={1.3} strokeDasharray="5 4" /><text x={246} y={616}>orienta, confere ou devolve</text>
            <line x1={430} x2={460} y1={612} y2={612} stroke={COR_STATUS.erro} strokeWidth={2} /><text x={466} y={616}>ligação travada (agente com erro)</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
