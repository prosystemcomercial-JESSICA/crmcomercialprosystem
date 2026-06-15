'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

const ROLES_GESTOR = ['CEO', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'ADMIN', 'DIRETOR'];
const ETAPAS = [
  { id: 'A_CONTATAR', label: 'A contatar', cor: '#6b7280', bg: '#f3f4f6' },
  { id: 'EM_CONTATO', label: 'Em contato', cor: '#d97706', bg: '#fef3c7' },
  { id: 'CONCLUIDO', label: 'Concluído', cor: '#16a34a', bg: '#dcfce7' },
  { id: 'SEM_SUCESSO', label: 'Sem sucesso', cor: '#dc2626', bg: '#fee2e2' },
];
const SAUDE = ['CRITICO', 'RISCO', 'ATENCAO', 'SAUDAVEL', 'EXCELENTE'];
const SAUDE_COR: Record<string, string> = { CRITICO: '#b91c1c', RISCO: '#dc2626', ATENCAO: '#d97706', SAUDAVEL: '#16a34a', EXCELENTE: '#047857' };
const TIPO_VENDA = ['UPGRADE', 'INDICACAO', 'FISCAL', 'PAC', 'TEF', 'COMUNICACAO', 'OUTRO'];

export default function AtivosPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const isGestor = ROLES_GESTOR.includes(user?.role || '');

  const [aba, setAba] = useState<'fila' | 'painel'>('fila');
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [campAtiva, setCampAtiva] = useState<string | null>(null);
  const [contatos, setContatos] = useState<any[]>([]);
  const [painel, setPainel] = useState<any>(null);
  const [editando, setEditando] = useState<any>(null); // contato em edição (questionário)

  // Designar campanha (gestão)
  const [grupos, setGrupos] = useState<string[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [novaCamp, setNovaCamp] = useState({ grupo_tecnico: '', vendedor_id: '', meta_cobertura_pct: '100' });
  const [criando, setCriando] = useState(false);
  const [showNova, setShowNova] = useState(false);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const loadCampanhas = useCallback(async () => {
    try { const r = await apiClient.getCampanhasAtivo(); const cs = r.data?.data || []; setCampanhas(cs); if (!campAtiva && cs.length) setCampAtiva(cs[0].id); }
    catch { /* */ }
  }, [campAtiva]);
  useEffect(() => { if (isAuthenticated) loadCampanhas(); }, [isAuthenticated]);

  const loadContatos = useCallback(async () => {
    if (!campAtiva) { setContatos([]); return; }
    try { const r = await apiClient.getContatosAtivo(campAtiva); setContatos(r.data?.data?.contatos || []); }
    catch { setContatos([]); }
  }, [campAtiva]);
  useEffect(() => { loadContatos(); }, [loadContatos]);

  useEffect(() => {
    if (isAuthenticated && isGestor) {
      apiClient.getGruposTecnicos().then(r => setGrupos(r.data?.data || [])).catch(() => {});
      apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
      apiClient.getPainelAtivos().then(r => setPainel(r.data?.data || null)).catch(() => {});
    }
  }, [isAuthenticated, isGestor]);

  const criarCampanha = async () => {
    if (!novaCamp.grupo_tecnico || !novaCamp.vendedor_id) return alert('Escolha o grupo e o vendedor.');
    setCriando(true);
    try {
      const r = await apiClient.criarCampanhaAtivo({ grupo_tecnico: novaCamp.grupo_tecnico, vendedor_id: novaCamp.vendedor_id, meta_cobertura_pct: Number(novaCamp.meta_cobertura_pct) || 100 });
      alert(`Fila designada! ${r.data?.data?.fila || 0} clientes na fila.`);
      setShowNova(false); setNovaCamp({ grupo_tecnico: '', vendedor_id: '', meta_cobertura_pct: '100' });
      loadCampanhas();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao designar fila.'); }
    finally { setCriando(false); }
  };

  const moverEtapa = async (contato: any, etapa: string) => {
    try { await apiClient.atualizarContatoAtivo(contato.id, { etapa }); loadContatos(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao mover.'); }
  };

  const salvarQuestionario = async () => {
    if (!editando) return;
    try {
      await apiClient.atualizarContatoAtivo(editando.id, {
        etapa: 'CONCLUIDO',
        usa_sistema_ok: editando.usa_sistema_ok, suporte_ok: editando.suporte_ok, tecnico_ok: editando.tecnico_ok,
        conhece_novas_ferr: editando.conhece_novas_ferr, plus_apresentado: editando.plus_apresentado,
        nota_prosystem: editando.nota_prosystem ? Number(editando.nota_prosystem) : undefined,
        sugestoes: editando.sugestoes || undefined, saude: editando.saude || undefined,
        tem_problema: !!editando.tem_problema, problema_descricao: editando.problema_descricao || undefined,
        abrir_caso: !!editando.abrir_caso,
        gerou_venda: !!editando.gerou_venda, tipo_venda: editando.tipo_venda || undefined, venda_obs: editando.venda_obs || undefined,
      });
      setEditando(null); loadContatos();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao salvar.'); }
  };

  if (loading || !isAuthenticated) return null;

  const campObj = campanhas.find(c => c.id === campAtiva);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ativos — CS Comercial</h1>
            <p className="text-sm text-gray-500">Contatos proativos com a carteira: mede saúde, abre casos e gera oportunidades.</p>
          </div>
          {isGestor && (
            <button onClick={() => setShowNova(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">+ Designar fila</button>
          )}
        </div>

        {/* Abas (gestão tem painel) */}
        {isGestor && (
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {[{ id: 'fila', label: '📋 Minhas filas / Kanban' }, { id: 'painel', label: '📊 Painel da Supervisão' }].map(a => (
              <button key={a.id} onClick={() => setAba(a.id as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>{a.label}</button>
            ))}
          </div>
        )}

        {/* ─── FILA / KANBAN ─── */}
        {(!isGestor || aba === 'fila') && (
          <>
            {campanhas.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">Nenhuma fila de ativos designada {isGestor ? '— clique em "Designar fila".' : 'para você ainda.'}</div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap mb-4">
                  {campanhas.map(c => (
                    <button key={c.id} onClick={() => setCampAtiva(c.id)}
                      className={`px-3 py-2 rounded-lg text-sm border ${campAtiva === c.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                      {c.grupo_tecnico} {!isGestor ? '' : `· ${c.vendedor_nome || ''}`}
                      <span className="ml-2 text-xs text-gray-400">{c.progresso?.cobertura_pct ?? 0}% · meta {c.meta_cobertura_pct}%</span>
                    </button>
                  ))}
                </div>

                {campObj && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <KPI label="Fila total" valor={campObj.progresso?.total ?? campObj.total_fila} />
                    <KPI label="Concluídos" valor={campObj.progresso?.concluidos ?? 0} cor="text-green-700" />
                    <KPI label="Cobertura" valor={`${campObj.progresso?.cobertura_pct ?? 0}%`} cor={campObj.progresso?.bateu_meta ? 'text-green-700' : 'text-amber-600'} />
                    <KPI label="Meta cobertura" valor={`${campObj.meta_cobertura_pct}%`} />
                  </div>
                )}

                {/* Kanban */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {ETAPAS.map(et => {
                    const itens = contatos.filter(c => c.etapa === et.id);
                    return (
                      <div key={et.id} className="bg-gray-50 rounded-xl p-2 min-h-[200px]">
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: et.cor }}>{et.label}</span>
                          <span className="text-xs text-gray-400">{itens.length}</span>
                        </div>
                        <div className="space-y-2">
                          {itens.map(c => (
                            <div key={c.id} className="bg-white rounded-lg border border-gray-100 p-2.5 shadow-sm">
                              <p className="text-sm font-semibold text-gray-800">{c.cliente_codigo ? `${c.cliente_codigo} · ` : ''}{c.cliente_nome || 'Cliente'}</p>
                              {c.saude && <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: SAUDE_COR[c.saude] }}>{c.saude}</span>}
                              {c.nota_prosystem != null && <span className="ml-1 text-[10px] text-gray-500">★ {c.nota_prosystem}/5</span>}
                              {c.caso_churn_id && <span className="ml-1 text-[10px] text-red-600">⚠ caso</span>}
                              {c.gerou_venda && <span className="ml-1 text-[10px] text-blue-600">💰 {c.tipo_venda}</span>}
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {et.id === 'A_CONTATAR' && <button onClick={() => moverEtapa(c, 'EM_CONTATO')} className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Iniciar</button>}
                                {(et.id === 'A_CONTATAR' || et.id === 'EM_CONTATO') && <button onClick={() => setEditando({ ...c })} className="text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Registrar contato</button>}
                                {et.id === 'EM_CONTATO' && <button onClick={() => moverEtapa(c, 'SEM_SUCESSO')} className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Sem sucesso</button>}
                                {(et.id === 'CONCLUIDO' || et.id === 'SEM_SUCESSO') && <button onClick={() => setEditando({ ...c })} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">Ver / editar</button>}
                              </div>
                            </div>
                          ))}
                          {itens.length === 0 && <p className="text-[11px] text-gray-300 text-center py-3">vazio</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ─── PAINEL DA SUPERVISÃO ─── */}
        {isGestor && aba === 'painel' && painel && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPI label="Filas ativas" valor={painel.totais.filas} />
              <KPI label="Contatos na carteira" valor={painel.totais.contatos_total} />
              <KPI label="Concluídos" valor={painel.totais.concluidos} cor="text-green-700" />
              <KPI label="Casos abertos" valor={painel.totais.casos_abertos} cor="text-red-600" />
              <KPI label="Vendas geradas" valor={painel.totais.vendas_geradas} cor="text-blue-700" />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Filas por vendedor</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-400 border-b">
                    {['Grupo / Técnico', 'Vendedor', 'Cobertura', 'Saudáveis', 'Em risco', 'Casos', 'Vendas', 'Nota média'].map(h => <th key={h} className="py-1.5 pr-3">{h}</th>)}
                  </tr></thead>
                  <tbody>{painel.filas.map((f: any) => (
                    <tr key={f.campanha_id} className="border-b border-gray-50">
                      <td className="py-2 pr-3 font-medium text-gray-800">{f.grupo_tecnico}</td>
                      <td className="pr-3 text-gray-600">{f.vendedor_nome || '—'}</td>
                      <td className="pr-3" style={{ color: f.bateu_meta ? '#16a34a' : '#d97706' }}>{f.cobertura_pct}% <span className="text-gray-400 text-xs">/ {f.meta_cobertura_pct}%</span></td>
                      <td className="pr-3 text-green-700">{f.saudaveis}</td>
                      <td className="pr-3 text-red-600">{f.em_risco}</td>
                      <td className="pr-3">{f.casos_abertos}</td>
                      <td className="pr-3 text-blue-700">{f.vendas}</td>
                      <td className="pr-3">{f.nota_media != null ? `★ ${f.nota_media}` : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">🩺 Saúde da carteira por técnico</h2>
              <div className="space-y-2">
                {painel.ranking_tecnicos.map((g: any, i: number) => (
                  <div key={g.grupo_tecnico} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                    <span className="font-medium text-gray-800">{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{g.grupo_tecnico}</span>
                    <span className="text-sm flex items-center gap-3">
                      {g.indice_saude != null && <b className="text-gray-900">{g.indice_saude}% saúde</b>}
                      <span className="text-green-700">{g.saudaveis} ok</span>
                      <span className="text-red-600">{g.em_risco} risco</span>
                      <span className="text-gray-500">{g.casos_abertos} casos</span>
                      <span className="text-blue-700">{g.vendas} vendas</span>
                      {g.nota_media != null && <span className="text-amber-600">★ {g.nota_media}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal: Designar fila ─── */}
      {showNova && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3">
            <h2 className="text-lg font-semibold">Designar fila de Ativos</h2>
            <div>
              <label className="text-xs font-medium text-gray-600">Grupo técnico *</label>
              <select value={novaCamp.grupo_tecnico} onChange={e => setNovaCamp({ ...novaCamp, grupo_tecnico: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">— selecione —</option>
                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Vendedor responsável *</label>
              <select value={novaCamp.vendedor_id} onChange={e => setNovaCamp({ ...novaCamp, vendedor_id: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">— selecione —</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Meta de cobertura (%)</label>
              <input type="number" value={novaCamp.meta_cobertura_pct} onChange={e => setNovaCamp({ ...novaCamp, meta_cobertura_pct: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <p className="text-xs text-gray-500">Os clientes ATIVOS do grupo vão para a fila do vendedor (kanban).</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowNova(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button>
              <button onClick={criarCampanha} disabled={criando} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg disabled:opacity-50">{criando ? 'Designando…' : 'Designar fila'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Registrar contato (questionário) ─── */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">Contato ativo — {editando.cliente_nome}</h2>
            <div className="space-y-2">
              {[
                ['usa_sistema_ok', 'Usa bem o sistema e as ferramentas?'],
                ['suporte_ok', 'Satisfeito com o atendimento do suporte?'],
                ['tecnico_ok', 'Satisfeito com o técnico que atende?'],
                ['conhece_novas_ferr', 'Conhece as novas ferramentas?'],
                ['plus_apresentado', 'O plano Plus foi apresentado?'],
              ].map(([campo, label]) => (
                <div key={campo} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{label}</span>
                  <div className="flex gap-1">
                    {[['Sim', true], ['Não', false]].map(([txt, val]) => (
                      <button key={txt as string} onClick={() => setEditando({ ...editando, [campo as string]: val })}
                        className={`px-3 py-1 rounded text-xs border ${editando[campo as string] === val ? (val ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300') : 'bg-white text-gray-500 border-gray-200'}`}>{txt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Nota geral do Prosystem (1 a 5)</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setEditando({ ...editando, nota_prosystem: n })}
                    className={`w-9 h-9 rounded-lg text-sm font-bold border ${Number(editando.nota_prosystem) === n ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-400 border-gray-200'}`}>{n}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Saúde percebida do cliente</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {SAUDE.map(s => (
                  <button key={s} onClick={() => setEditando({ ...editando, saude: s })}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border ${editando.saude === s ? 'text-white' : 'bg-white text-gray-500 border-gray-200'}`}
                    style={editando.saude === s ? { background: SAUDE_COR[s], borderColor: SAUDE_COR[s] } : {}}>{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Sugestões</label>
              <textarea value={editando.sugestoes || ''} onChange={e => setEditando({ ...editando, sugestoes: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>

            <div className="bg-red-50 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!editando.tem_problema} onChange={e => setEditando({ ...editando, tem_problema: e.target.checked })} />
                Há um problema / algo não resolvido
              </label>
              {editando.tem_problema && (
                <>
                  <textarea value={editando.problema_descricao || ''} onChange={e => setEditando({ ...editando, problema_descricao: e.target.value })} rows={2} placeholder="Descreva o problema" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  {!editando.caso_churn_id && (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={!!editando.abrir_caso} onChange={e => setEditando({ ...editando, abrir_caso: e.target.checked })} />
                      Abrir caso de retenção (churn) para tratar
                    </label>
                  )}
                  {editando.caso_churn_id && <p className="text-xs text-red-600">⚠ Já existe um caso aberto a partir deste contato.</p>}
                </>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!editando.gerou_venda} onChange={e => setEditando({ ...editando, gerou_venda: e.target.checked })} />
                Gerou oportunidade de venda
              </label>
              {editando.gerou_venda && (
                <div className="grid grid-cols-2 gap-2">
                  <select value={editando.tipo_venda || ''} onChange={e => setEditando({ ...editando, tipo_venda: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Tipo…</option>
                    {TIPO_VENDA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={editando.venda_obs || ''} onChange={e => setEditando({ ...editando, venda_obs: e.target.value })} placeholder="Observação" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button>
              <button onClick={salvarQuestionario} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg">Salvar e concluir contato</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function KPI({ label, valor, cor = 'text-gray-800' }: { label: string; valor: any; cor?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}
