'use client';

// Faixa de saúde (10/11/2026): agentes, IAs, WhatsApp e o que espera a Jessica, sempre no topo.
// Vermelho = precisa de atenção agora. Clicar leva ao lugar onde se resolve.

import type { Painel } from './tipos';
import { NOME_PROVEDOR } from './tipos';

type Item = { chave: string; nivel: 'ok' | 'atencao' | 'erro'; titulo: string; detalhe: string; onClick?: () => void };
const COR = { ok: '#16a34a', atencao: '#ca8a04', erro: '#dc2626' } as const;

export default function FaixaSaude({ p, onIr }: { p: Painel | null; onIr: (vista: string) => void }) {
  if (!p) return <div className="esc-faixa" aria-busy="true"><span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Conferindo a saúde do escritório…</span></div>;
  const s = p.saude;
  const erros = s.agentes.com_erro;
  const iasFalha = s.ias.com_falha;
  const itens: Item[] = [
    {
      chave: 'agentes', nivel: erros.length ? 'erro' : 'ok', onClick: () => onIr('todos'),
      titulo: `${s.agentes.ligados} de ${s.agentes.total} agentes ligados`,
      detalhe: erros.length ? `Com erro: ${erros.map(e => e.nome).join(', ')}` : 'Nenhum agente com erro',
    },
    {
      chave: 'ias', nivel: iasFalha.length ? (iasFalha.length >= s.ias.total ? 'erro' : 'atencao') : 'ok', onClick: () => onIr('consumo'),
      titulo: iasFalha.length ? `IAs: ${iasFalha.length} em pausa` : `IAs: ${s.ias.total} respondendo`,
      detalhe: iasFalha.length ? iasFalha.map(x => `${NOME_PROVEDOR[x.provedor] || x.provedor} volta em ${x.volta_em_min} min`).join(' · ') : 'Os agentes trocam de IA sozinhos se uma falhar',
    },
    {
      chave: 'whatsapp', nivel: s.whatsapp.total && s.whatsapp.conectados < s.whatsapp.total ? (s.whatsapp.conectados === 0 ? 'erro' : 'atencao') : 'ok',
      titulo: `WhatsApp: ${s.whatsapp.conectados} de ${s.whatsapp.total} conectados`,
      detalhe: s.whatsapp.desconectados.length ? `Desconectado: ${s.whatsapp.desconectados.join(', ')}` : 'Todos os números no ar',
    },
    {
      chave: 'esperando', nivel: s.esperando > 20 ? 'erro' : s.esperando ? 'atencao' : 'ok', onClick: () => onIr('esperando'),
      titulo: `${s.esperando} esperando você`, detalhe: s.esperando ? 'Mensagens, perguntas e documentos para decidir' : 'Nada parado com você',
    },
  ];
  return (
    <div className="esc-faixa" role="region" aria-label="Saúde do escritório">
      {itens.map(i => {
        const conteudo = (
          <>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: COR[i.nivel], flex: '0 0 auto', marginTop: 5 }} />
            <span style={{ display: 'grid', gap: 2, minWidth: 0, textAlign: 'left' }}>
              <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>{i.titulo}</b>
              <span style={{ fontSize: 12, color: i.nivel === 'ok' ? 'var(--t-text-muted)' : COR[i.nivel], overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.detalhe}</span>
            </span>
          </>
        );
        const estilo: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: 'var(--t-card-bg)', border: `1px solid ${i.nivel === 'ok' ? 'var(--t-card-border)' : COR[i.nivel]}`, minWidth: 0 };
        return i.onClick
          ? <button key={i.chave} onClick={i.onClick} style={{ ...estilo, cursor: 'pointer', font: 'inherit' }}>{conteudo}</button>
          : <div key={i.chave} style={estilo}>{conteudo}</div>;
      })}
    </div>
  );
}
