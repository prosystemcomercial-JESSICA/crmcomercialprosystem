'use client';

// Tela "Aprovar": tudo o que espera a decisão da gestão, com um toque.
// Mensagens dos agentes (Aprovar / Editar / Refazer) e autorizações de campanha do
// Luiz Felipe (30% / 20% / Não autorizar). Cartões no padrão iOS; no computador também funciona.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';

type Item = { id: string; texto: string; criado_em: string; tipo: 'mensagem' | 'negociacao'; fase: string | null; agente: string; cliente: string | null; empresa: string | null; conversaId: string | null };

const FASE: Record<string, string> = { abertura: 'Primeiro contato', retomada: 'Retomada', resposta: 'Resposta', encerramento: 'Encerramento' };
const tempo = (d: string) => {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export default function AprovarPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [refazendo, setRefazendo] = useState<Record<string, string>>({});

  const carregar = useCallback(() => {
    apiClient.listarAprovacoes().then(r => { setItens(r.data.data); setErro(null); })
      .catch(e => setErro(e?.response?.data?.message || 'Não foi possível carregar. Só a gestão aprova.'));
  }, []);
  useEffect(() => { if (!loading && !isAuthenticated) router.push('/login'); }, [loading, isAuthenticated, router]);
  useEffect(() => { if (isAuthenticated) { carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); } }, [isAuthenticated, carregar]);

  const agir = async (id: string, fn: () => Promise<any>) => {
    setOcupado(id);
    try { const r = await fn(); setAviso(r?.data?.message || 'Pronto.'); setItens(xs => (xs || []).filter(x => x.id !== id)); }
    catch (e: any) { setAviso(e?.response?.data?.message || 'Não deu certo. Tente de novo.'); }
    finally { setOcupado(null); setTimeout(carregar, 1500); }
  };

  if (loading || !isAuthenticated) return null;
  return (
    <DashboardLayout>
      <div className="ios-tela ap-tela">
        <div className="ios-topo" style={{ marginBottom: 12 }}>
          <div>
            <h1 className="ios-large-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Aprovar</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>
              {itens == null ? 'Carregando…' : itens.length === 0 ? 'Nada esperando por você. 🎉' : `${itens.length} ${itens.length === 1 ? 'item espera' : 'itens esperam'} sua decisão`}
            </p>
          </div>
        </div>

        {aviso && <div className="ap-aviso" role="status" onClick={() => setAviso(null)}>{aviso}</div>}
        {erro && <div className="ap-aviso erro">{erro}</div>}

        <div className="ap-lista">
          {(itens || []).map(it => {
            const emEdicao = editando[it.id] !== undefined;
            const emRefazer = refazendo[it.id] !== undefined;
            const travado = ocupado === it.id;
            return (
              <article key={it.id} className="ap-cartao ps-card">
                <header className="ap-cab">
                  <span className={`ap-selo ${it.tipo === 'negociacao' ? 'neg' : ''}`}>{it.tipo === 'negociacao' ? '💸 Campanha' : `✉️ ${FASE[it.fase || ''] || 'Mensagem'}`}</span>
                  <span className="ap-tempo">{tempo(it.criado_em)}</span>
                </header>
                <p className="ap-quem"><strong>{it.cliente || 'Cliente'}</strong>{it.empresa ? ` · ${it.empresa}` : ''}</p>
                <p className="ap-agente">{it.agente} quer enviar:</p>
                {emEdicao ? (
                  <textarea className="ap-campo" rows={5} value={editando[it.id]} onChange={e => setEditando(s => ({ ...s, [it.id]: e.target.value }))} />
                ) : (
                  <blockquote className="ap-texto">{it.texto}</blockquote>
                )}
                {emRefazer && (
                  <input className="ap-campo" autoFocus placeholder="O que mudar? (ex.: mais curto, sem pergunta)" value={refazendo[it.id]}
                    onChange={e => setRefazendo(s => ({ ...s, [it.id]: e.target.value }))} />
                )}

                {it.tipo === 'negociacao' ? (
                  <div className="ap-acoes">
                    <button disabled={travado} className="ap-btn prim" onClick={() => agir(it.id, () => apiClient.decidirNegociacao(it.id, 30))}>Autorizar 30%</button>
                    <button disabled={travado} className="ap-btn prim" onClick={() => agir(it.id, () => apiClient.decidirNegociacao(it.id, 20))}>Autorizar 20%</button>
                    <button disabled={travado} className="ap-btn" onClick={() => agir(it.id, () => apiClient.decidirNegociacao(it.id, 0))}>Não autorizar</button>
                  </div>
                ) : emEdicao ? (
                  <div className="ap-acoes">
                    <button disabled={travado || !editando[it.id].trim()} className="ap-btn prim" onClick={() => agir(it.id, () => apiClient.decidirMensagemCaroline(it.id, true, editando[it.id]))}>Enviar com meu ajuste</button>
                    <button className="ap-btn" onClick={() => setEditando(s => { const n = { ...s }; delete n[it.id]; return n; })}>Cancelar</button>
                  </div>
                ) : emRefazer ? (
                  <div className="ap-acoes">
                    <button disabled={travado} className="ap-btn prim" onClick={() => agir(it.id, () => apiClient.decidirMensagemCaroline(it.id, false, refazendo[it.id]))}>🔄 Refazer</button>
                    <button className="ap-btn" onClick={() => setRefazendo(s => { const n = { ...s }; delete n[it.id]; return n; })}>Cancelar</button>
                  </div>
                ) : (
                  <div className="ap-acoes">
                    <button disabled={travado} className="ap-btn prim" onClick={() => agir(it.id, () => apiClient.decidirMensagemCaroline(it.id, true))}>{travado ? 'Enviando…' : 'Aprovar e enviar'}</button>
                    <button className="ap-btn" onClick={() => setEditando(s => ({ ...s, [it.id]: it.texto }))}>Editar</button>
                    <button className="ap-btn" onClick={() => setRefazendo(s => ({ ...s, [it.id]: '' }))}>Refazer</button>
                  </div>
                )}
                {it.conversaId && <a className="ap-link" href={`/whatsapp?c=${it.conversaId}`}>Ver conversa ›</a>}
              </article>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
