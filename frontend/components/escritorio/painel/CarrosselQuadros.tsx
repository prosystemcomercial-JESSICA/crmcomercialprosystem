'use client';

// Carrossel dos quadros da equipe (13/11/2026, pedido da Jessica): os cards ficavam em grade com alturas
// diferentes e pareciam "remontados". Agora ficam numa única linha, todos do mesmo tamanho, com setas para
// girar e uma busca em cima para achar um agente rápido (por nome, função ou status).

import { useEffect, useMemo, useRef, useState } from 'react';
import QuadroAgente from './QuadroAgente';
import type { AgenteTela, Quadro } from './tipos';
import { ROTULO_STATUS } from './tipos';

const tirarAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function CarrosselQuadros({ agentes, quadros, sel, onAbrir, onConversar, onAgenda }: {
  agentes: AgenteTela[]; quadros?: Quadro[]; sel: string | null;
  onAbrir: (id: string) => void; onConversar: (id: string) => void; onAgenda: (id: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const trilho = useRef<HTMLDivElement>(null);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  const lista = useMemo(() => {
    const termo = tirarAcento(busca.trim());
    const ordenados = [...agentes].sort((x, y) => Number(y.status === 'erro') - Number(x.status === 'erro'));
    if (!termo) return ordenados;
    return ordenados.filter(a => tirarAcento(`${a.nome} ${a.funcao} ${ROTULO_STATUS[a.status] || ''}`).includes(termo));
  }, [agentes, busca]);

  const medir = () => {
    const el = trilho.current;
    if (!el) return;
    setPodeVoltar(el.scrollLeft > 4);
    setPodeAvancar(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    medir();
    const el = trilho.current;
    if (!el) return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lista.length]);

  // Busca nova volta o carrossel para o começo.
  useEffect(() => { trilho.current?.scrollTo({ left: 0 }); }, [busca]);

  // Agente escolhido na sala ou no organograma: o carrossel gira até o card dele.
  useEffect(() => {
    if (!sel) return;
    const card = document.getElementById(`quadro-${sel}`);
    const el = trilho.current;
    if (!card || !el) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - (el.clientWidth - card.clientWidth) / 2, behavior: 'smooth' });
  }, [sel]);

  const girar = (dir: 1 | -1) => {
    const el = trilho.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 300), behavior: 'smooth' });
  };

  return (
    <section className="esc-carrossel" aria-label="Quadros da equipe">
      <div className="esc-carrossel-topo">
        <label className="esc-busca">
          <span aria-hidden>🔎</span>
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Procurar agente pelo nome, função ou status…" aria-label="Procurar agente" />
          {busca && <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca">✕</button>}
        </label>
        <span className="esc-carrossel-conta">{lista.length} de {agentes.length}</span>
        <div className="esc-carrossel-setas">
          <button type="button" className="esc-seta" onClick={() => girar(-1)} disabled={!podeVoltar} aria-label="Ver agentes anteriores">‹</button>
          <button type="button" className="esc-seta" onClick={() => girar(1)} disabled={!podeAvancar} aria-label="Ver mais agentes">›</button>
        </div>
      </div>

      {lista.length === 0
        ? <p className="esc-carrossel-vazio">Nenhum agente encontrado para “{busca}”.</p>
        : (
          <div className="esc-carrossel-trilho" ref={trilho} onScroll={medir} tabIndex={0}
            onKeyDown={e => { if (e.key === 'ArrowRight') { e.preventDefault(); girar(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); girar(-1); } }}>
            {lista.map(a => (
              <div key={a.id} id={`quadro-${a.id}`} className="esc-carrossel-item">
                <QuadroAgente a={a} q={quadros?.find(q => q.id === a.id)} selecionado={sel === a.id}
                  onAbrir={onAbrir} onConversar={onConversar} onAgenda={onAgenda} />
              </div>
            ))}
          </div>
        )}
    </section>
  );
}
