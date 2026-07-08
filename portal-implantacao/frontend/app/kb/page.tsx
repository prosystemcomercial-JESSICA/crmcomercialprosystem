'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { crmApi } from '@/lib/api';

export default function KbPage() {
  const [artigos, setArtigos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<any | null>(null);
  const [artigoLoading, setArtigoLoading] = useState(false);
  const [feedbackEnviado, setFeedbackEnviado] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setErro('');
    Promise.all([
      crmApi.getKbArtigos({ busca: busca || undefined, categoria_id: catFiltro || undefined, status: 'PUBLICADO' }),
      crmApi.getKbCategorias(),
    ])
      .then(([artsR, catsR]) => {
        setArtigos(artsR.data?.artigos || []);
        setCategorias(catsR.data || []);
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [busca, catFiltro]);

  useEffect(() => { load(); }, [load]);

  const abrirArtigo = async (artigo: any) => {
    setArtigoLoading(true);
    setAberto(artigo);
    try {
      const r = await crmApi.getKbArtigo(artigo.id);
      setAberto(r.data);
    } catch { /* mantém o resumo */ }
    finally { setArtigoLoading(false); }
  };

  const enviarFeedback = async (util: boolean) => {
    if (!aberto || feedbackEnviado) return;
    try {
      await crmApi.feedbackKbArtigo(aberto.id, util);
      setFeedbackEnviado(util ? 'sim' : 'nao');
    } catch { /* ignore */ }
  };

  const tags = (artigo: any): string[] => {
    if (!artigo.tags) return [];
    try { return JSON.parse(artigo.tags); } catch { return []; }
  };

  // Vista de leitura de artigo
  if (aberto) {
    return (
      <Shell>
        <button onClick={() => { setAberto(null); setFeedbackEnviado(null); }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
          ← Voltar para a lista
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-3xl">
          {aberto.categoria && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 mb-3 inline-block">
              {aberto.categoria.icone} {aberto.categoria.nome}
            </span>
          )}
          <h1 className="text-xl font-bold text-slate-800 mb-2">{aberto.titulo}</h1>
          {aberto.resumo && <p className="text-sm text-slate-500 mb-4">{aberto.resumo}</p>}
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-5 pb-4 border-b border-slate-100">
            {aberto.autor_nome && <span>Por {aberto.autor_nome}</span>}
            <span>{new Date(aberto.updated_at).toLocaleDateString('pt-BR')}</span>
            {aberto.views != null && <span>{aberto.views} visualizações</span>}
          </div>
          {artigoLoading ? (
            <div className="text-slate-400 text-sm py-8 text-center">Carregando…</div>
          ) : (
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
              {aberto.conteudo}
            </div>
          )}
          {tags(aberto).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-6">
              {tags(aberto).map((tag: string) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{tag}</span>
              ))}
            </div>
          )}
          {/* Feedback */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-600 mb-2">Este artigo foi útil?</p>
            {feedbackEnviado ? (
              <p className="text-sm text-green-600 font-medium">Obrigado pelo feedback!</p>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => enviarFeedback(true)}
                  className="text-sm px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors">
                  👍 Sim
                </button>
                <button onClick={() => enviarFeedback(false)}
                  className="text-sm px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors">
                  👎 Não
                </button>
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Base de Conhecimento</h2>
        <p className="text-sm text-slate-500">Artigos e guias da equipe técnica ProSystem.</p>
      </div>

      {/* Busca + filtro */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar artigos…"
          className="flex-1 min-w-[200px] text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white" />
        <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
          className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700">
          <option value="">Todas as categorias</option>
          {categorias.map((c: any) => (
            <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
          ))}
        </select>
        <button onClick={() => load()} className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50">↻</button>
      </div>

      {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}

      {loading ? (
        <div className="text-slate-400 text-sm py-12 text-center">Carregando artigos…</div>
      ) : artigos.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-slate-500 text-sm">Nenhum artigo encontrado.</p>
          <p className="text-slate-400 text-xs mt-1">Os artigos são criados no Portal Técnico do CRM.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artigos.map((a: any) => (
            <div key={a.id} onClick={() => abrirArtigo(a)}
              className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group">
              {a.categoria && (
                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-2 block">
                  {a.categoria.icone} {a.categoria.nome}
                </span>
              )}
              <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-snug mb-1.5">{a.titulo}</h3>
              {a.resumo && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{a.resumo}</p>}
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-auto pt-2 border-t border-slate-50">
                <span>{new Date(a.updated_at).toLocaleDateString('pt-BR')}</span>
                <span>{a.views ?? 0} views · {a.util_sim ?? 0} úteis</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
