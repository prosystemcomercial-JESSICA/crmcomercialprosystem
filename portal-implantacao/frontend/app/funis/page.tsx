'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import FichaProjeto from '@/components/FichaProjeto';

type Funil = { codigo: string; nome: string; fases: { codigo: string; nome: string; sla_dias?: number }[] };

export default function FunisPage() {
  const [funis, setFunis] = useState<Funil[]>([]);
  const [funilAtivo, setFunilAtivo] = useState('IMPLANTACAO');
  const [projetos, setProjetos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => { api.config().then(r => setFunis(r.data.funis)).catch(() => {}); }, []);

  const load = useCallback(() => {
    setCarregando(true); setErro('');
    api.projetos({ funil: funilAtivo, busca: busca || undefined })
      .then(r => setProjetos(r.data || []))
      .catch(e => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [funilAtivo, busca]);
  useEffect(() => { load(); }, [load]);

  const funil = funis.find(f => f.codigo === funilAtivo);

  const onDrop = async (projetoId: string, fase: string) => {
    try { await api.moverProjeto(projetoId, fase); load(); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <Shell>
      {/* Abas de funil + busca + novo */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {funis.map(f => (
          <button key={f.codigo} onClick={() => setFunilAtivo(f.codigo)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${funilAtivo === f.codigo ? 'bg-prosystem-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {f.nome}
          </button>
        ))}
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar cliente…"
          className="ml-auto px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-prosystem-600 text-white">+ Novo projeto</button>
      </div>

      {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {funil?.fases.map(fase => {
          const cards = projetos.filter(p => p.fase === fase.codigo);
          return (
            <div key={fase.codigo}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { const id = e.dataTransfer.getData('id'); if (id) onDrop(id, fase.codigo); }}
              className="min-w-[260px] w-[260px] shrink-0 bg-slate-100 rounded-xl p-2">
              <div className="flex items-center justify-between px-1 py-1.5">
                <span className="text-xs font-bold text-slate-700">{fase.nome}</span>
                <span className="text-xs text-slate-400">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.map(p => (
                  <div key={p.id} draggable onDragStart={e => e.dataTransfer.setData('id', p.id)}
                    onClick={() => setSel(p.id)}
                    className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-sm">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.nome_fantasia || p.razao_social || p.cliente_nome}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.tipo_implantacao && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{p.tipo_implantacao === 'BANCO_ZERADO' ? 'Zerado' : 'Migração'}</span>}
                      {p.sla_dias != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.sla_estourado ? 'bg-red-100 text-red-700 font-semibold' : 'bg-emerald-100 text-emerald-700'}`}>
                          {p.sla_estourado ? '⚠ ' : ''}{p.dias_na_fase}d / SLA {p.sla_dias}d
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <p className="text-xs text-slate-300 px-1 py-2">—</p>}
              </div>
            </div>
          );
        })}
      </div>
      {carregando && <p className="text-sm text-slate-400 mt-2">Carregando…</p>}

      {sel && <FichaProjeto id={sel} onClose={() => setSel(null)} onChange={load} />}
      {novo && <FichaProjeto id={null} onClose={() => setNovo(false)} onChange={load} />}
    </Shell>
  );
}
