'use client';

// "Agora no escritório" (10/11/2026): ao lado da sala, o que cada agente fez por último e as conversas
// entre eles, do mais novo para o mais antigo. Clicar seleciona o agente na sala.

import type { AgenteTela, Passagem } from './tipos';
import { haQuanto } from './tipos';

type Conversa = { id: string; de: string; para: string; tema: string; em?: string };

export default function FeedAoVivo({ agentes, conversas, passagens, esperando, onAgente, onEsperando }: {
  agentes: (AgenteTela & { erro?: string | null })[]; conversas: Conversa[]; passagens: Passagem[]; esperando: number;
  onAgente: (id: string) => void; onEsperando: () => void;
}) {
  const nome = (id: string) => agentes.find(a => a.id === id)?.nome || id;
  const cor = (id: string) => agentes.find(a => a.id === id)?.cor || '#64748b';
  const erros = agentes.filter(a => a.status === 'erro');
  const acoes = agentes.filter(a => a.ultima?.em).sort((x, y) => +new Date(y.ultima!.em) - +new Date(x.ultima!.em)).slice(0, 8);
  const hoje = passagens.filter(p => p.hoje).sort((x, y) => (y.hoje || 0) - (x.hoje || 0)).slice(0, 5);
  const Av = ({ id }: { id: string }) => <span aria-hidden className="feed-av" style={{ background: cor(id) }}>{nome(id)[0]}</span>;

  return (
    <aside className="esc-feed" aria-label="Agora no escritório">
      {esperando > 0 && (
        <button className="feed-esperando" onClick={onEsperando}>
          <b>{esperando}</b><span>esperando você<small>Mensagens, perguntas e documentos</small></span>
        </button>
      )}
      {erros.map(a => (
        <button key={a.id} className="feed-item feed-erro" onClick={() => onAgente(a.id)}>
          <Av id={a.id} /><span><b>{a.nome} parou</b><small>{a.erro}</small></span>
        </button>
      ))}

      <h3>Agora no escritório</h3>
      {acoes.length === 0 && <p className="feed-vazio">Ninguém registrou ação ainda hoje.</p>}
      {acoes.map(a => (
        <button key={a.id} className="feed-item" onClick={() => onAgente(a.id)}>
          <Av id={a.id} />
          <span><b>{a.nome}</b> {a.ultima!.texto}<small>{haQuanto(a.ultima!.em)}</small></span>
        </button>
      ))}

      {(conversas.length > 0 || hoje.length > 0) && <h3>Passando trabalho</h3>}
      {conversas.slice(0, 4).map(c => (
        <button key={c.id} className="feed-item" onClick={() => onAgente(c.de)}>
          <Av id={c.de} /><span><b>{nome(c.de)} → {nome(c.para)}</b> {c.tema}{c.em && <small>{haQuanto(c.em)}</small>}</span>
        </button>
      ))}
      {hoje.map(p => (
        <button key={`${p.de}-${p.para}`} className="feed-item" onClick={() => onAgente(p.de)}>
          <Av id={p.de} /><span><b>{nome(p.de)} → {nome(p.para)}</b> {p.rotulo}<small>{p.hoje} hoje</small></span>
        </button>
      ))}
    </aside>
  );
}
