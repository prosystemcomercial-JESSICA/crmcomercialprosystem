'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

type Opcao = { id: string; nome: string; n?: number };
type Props = {
  opcoes: Opcao[]; ativa: string; total: number; tipo: string;
  tipos: { valor: string; nome: string }[];
  onAba: (id: string) => void; onTipo: (tipo: string) => void;
};

// Um único acesso aos filtros; a seleção permanece visível com o menu fechado.
export default function FiltrosConversas({ opcoes, ativa, total, tipo, tipos, onAba, onTipo }: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const nome = opcoes.find(o => o.id === ativa)?.nome || 'Conversas';
  const nomeTipo = tipos.find(t => t.valor === tipo)?.nome;
  const fechar = () => { setAberto(false); botao.current?.focus(); };
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  return <div className="wpp-filtro-compacto" ref={caixa} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}>
    <button ref={botao} type="button" className="wpp-filtro-resumo" aria-label={'Filtrar conversas: ' + nome + (nomeTipo ? ', ' + nomeTipo : '')} aria-expanded={aberto} aria-haspopup="dialog" onClick={() => setAberto(v => !v)}>
      <span className="wpp-filtro-nome">{nome}{nomeTipo && <small> · {nomeTipo}</small>}</span>
      <span className="wpp-filtro-total">{total}</span><ChevronDown size={15} />
    </button>
    {aberto && <div className="wpp-filtros-menu" role="dialog" aria-label="Filtros das conversas">
      <p className="wpp-filtros-titulo">Mostrar conversas</p>
      {opcoes.map(o => <button type="button" key={o.id} className="wpp-filtro-opcao" aria-pressed={ativa === o.id} onClick={() => { onAba(o.id); fechar(); }}>
        <span>{o.nome}</span>{!!o.n && <span className="wpp-filtro-contador">{o.n}</span>}{ativa === o.id && <Check size={15} />}
      </button>)}
      <label className="wpp-filtros-tipo">Tipo de contato
        <select value={tipo} onChange={e => { onTipo(e.target.value); fechar(); }} aria-label="Filtrar por tipo de contato" className="wpp-tipos">
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
        </select>
      </label>
      {tipo && <button type="button" className="wpp-limpar-tipo" onClick={() => { onTipo(''); fechar(); }}>Remover filtro de tipo</button>}
    </div>}
  </div>;
}
