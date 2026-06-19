'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

const ROLES_GESTOR = ['CEO', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'ADMIN', 'DIRETOR'];
const ETAPAS = [
  { id: 'A_CONTATAR', label: 'A contatar', cor: '#6b7280', bg: '#f3f4f6' },
  { id: 'EM_CONTATO', label: 'Em contato', cor: '#d97706', bg: '#fef3c7' },
  { id: 'COTACAO', label: 'Cotação enviada', cor: '#7c3aed', bg: '#f5f3ff' },
  { id: 'EM_TRATAMENTO', label: 'Em tratamento', cor: '#dc2626', bg: '#fef2f2' },
  { id: 'SEM_SUCESSO', label: 'Sem sucesso', cor: '#b45309', bg: '#fffbeb' },
  { id: 'CONCLUIDO', label: 'Concluído', cor: '#16a34a', bg: '#dcfce7' },
];
const SAUDE = ['CRITICO', 'RISCO', 'ATENCAO', 'SAUDAVEL', 'EXCELENTE'];
const SAUDE_COR: Record<string, string> = { CRITICO: '#b91c1c', RISCO: '#dc2626', ATENCAO: '#d97706', SAUDAVEL: '#16a34a', EXCELENTE: '#047857' };
// Cor da etiqueta de plano (info essencial p/ o vendedor).
const planoCor = (p?: string) => {
  const s = (p || '').toLowerCase();
  if (s.includes('plus')) return '#0B7384';
  if (s.includes('pro')) return '#417ABC';
  if (s.includes('basic') || s.includes('lite')) return '#6b7280';
  if (s.includes('mei')) return '#C2540A';
  return '#94a3b8';
};

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
  const [savingQ, setSavingQ] = useState(false); // trava duplo clique ao salvar o questionário
  const kanbanRef = useRef<HTMLDivElement>(null); // p/ as setas de rolagem do kanban
  const [buscaAtivo, setBuscaAtivo] = useState('');     // busca por nome/código na fila
  const [filtroEtapa, setFiltroEtapa] = useState('');   // '' = todas; ou uma etapa específica
  const [ficha, setFicha] = useState<any>(null);        // mini-ficha aberta (consulta)
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaAba, setFichaAba] = useState<'dados' | 'atualizacoes' | 'questionario' | 'cadastro' | 'caso' | 'oportunidades'>('dados');
  const [fichaOports, setFichaOports] = useState<any[]>([]);
  const [fichaOportsLoading, setFichaOportsLoading] = useState(false);
  const [novaOport, setNovaOport] = useState<{ parceiroId: string; valor: string; acrescimo: string; obs: string } | null>(null);
  const [savingOport, setSavingOport] = useState(false);
  const [novaAtualizacao, setNovaAtualizacao] = useState('');
  const [savingAtualizacao, setSavingAtualizacao] = useState(false);

  const abrirFicha = async (contato: any, aba: 'dados' | 'questionario' | 'oportunidades' = 'dados') => {
    setFicha({ contato, dados: null });
    setFichaAba(aba);
    setFichaLoading(true);
    setFichaOports([]);
    try {
      const [fichaR, oportsR] = await Promise.all([
        apiClient.getFichaContatoAtivo(contato.id),
        apiClient.getOportunidadesContato(contato.id),
      ]);
      setFicha({ contato, dados: fichaR.data?.data || null });
      setFichaOports(oportsR.data?.data || []);
    } catch { setFicha({ contato, dados: null }); }
    finally { setFichaLoading(false); }
  };

  const carregarOports = async (contatoId: string) => {
    setFichaOportsLoading(true);
    try { const r = await apiClient.getOportunidadesContato(contatoId); setFichaOports(r.data?.data || []); }
    catch { /* */ } finally { setFichaOportsLoading(false); }
  };

  // Designar campanha (gestão)
  const [grupos, setGrupos] = useState<string[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<any[]>([]);
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
    if (isAuthenticated) {
      // Catálogo de ofertas (parceiros ativos) — usado por todos no questionário.
      apiClient.getParceiros().then(r => setParceiros((r.data?.data || []).filter((p: any) => p.ativo !== false))).catch(() => {});
    }
    if (isAuthenticated && isGestor) {
      apiClient.getGruposTecnicos().then(r => setGrupos(r.data?.data || [])).catch(() => {});
      apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
      apiClient.getPainelAtivos().then(r => setPainel(r.data?.data || null)).catch(() => {});
      // Migração silenciosa: converte VendasAdicionais PENDENTE do fluxo antigo em OportunidadeAtivo
      apiClient.migrarOportunidadesAtivos().catch(() => {});
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
    try {
      await apiClient.atualizarContatoAtivo(contato.id, { etapa });
      // Atualiza localmente: move o card para o topo da coluna destino (sem reordenar o resto)
      setContatos(prev => {
        const sem = prev.filter(c => c.id !== contato.id);
        const atualizado = { ...contato, etapa, updated_at: new Date().toISOString() };
        return [atualizado, ...sem];
      });
    }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao mover.'); }
  };

  // Registra uma tentativa de contato SEM precisar responder o questionário.
  const registrarTentativa = async (contato: any, semSucesso = false) => {
    const obs = prompt(semSucesso ? 'Tentativa sem sucesso — observação (opcional):' : 'Registrar tentativa de contato — observação (opcional):', '');
    if (obs === null) return; // cancelou
    try { await apiClient.registrarTentativaAtivo(contato.id, { obs: obs || undefined, sem_sucesso: semSucesso }); loadContatos(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao registrar tentativa.'); }
  };

  // Supervisão: ocultar/exibir um cliente da fila do vendedor.
  const ocultarContato = async (contato: any) => {
    const ocultar = !contato.oculto;
    const motivo = ocultar ? (prompt('Motivo de ocultar (opcional):', '') || undefined) : undefined;
    try { await apiClient.supervisaoContatoAtivo(contato.id, { oculto: ocultar, oculto_motivo: motivo }); loadContatos(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao ocultar.'); }
  };
  // Supervisão: etiquetar (ex.: Cliente crítico). Vazio = remover etiqueta.
  const etiquetarContato = async (contato: any) => {
    const et = prompt('Etiqueta (ex.: Cliente crítico, Não contatar). Vazio remove:', contato.etiqueta || 'Cliente crítico');
    if (et === null) return;
    const cor = et.toLowerCase().includes('crit') ? '#dc2626' : et.toLowerCase().includes('contat') ? '#b45309' : '#6d28d9';
    try { await apiClient.supervisaoContatoAtivo(contato.id, { etiqueta: et.trim() || null, etiqueta_cor: cor }); loadContatos(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao etiquetar.'); }
  };

  const salvarQuestionario = async () => {
    if (!editando || savingQ) return; // trava duplo clique
    setSavingQ(true);
    // Risco médio automático: nota 3/4 + não conhece ferramentas → caso de churn.
    const nota = Number(editando.nota_prosystem) || 0;
    const subutilizacao = (nota === 3 || nota === 4) && editando.conhece_novas_ferr === false;
    // 100% de satisfação = nota 5 + sistema/suporte/técnico OK + conhece ferramentas + sem problema.
    const satisfacao100 = nota === 5 && editando.usa_sistema_ok === true && editando.suporte_ok === true
      && editando.tecnico_ok === true && editando.conhece_novas_ferr === true && !editando.tem_problema;
    // Etapa de destino:
    //  abriu caso (manual) ou subutilização → Em Tratamento (resolve no churn)
    //  ofertou/cotou venda                  → Cotação enviada (até fechar)
    //  100% satisfação                      → Concluído
    //  caso contrário                       → fica Em Contato (acompanhamento; não conclui sozinho)
    const etapaFinal = (editando.abrir_caso || subutilizacao) ? 'EM_TRATAMENTO'
      : editando.gerou_venda ? 'COTACAO'
      : satisfacao100 ? 'CONCLUIDO'
      : 'EM_CONTATO';
    try {
      await apiClient.atualizarContatoAtivo((editando.id || ficha?.contato?.id), {
        etapa: etapaFinal,
        usa_sistema_ok: editando.usa_sistema_ok, suporte_ok: editando.suporte_ok, tecnico_ok: editando.tecnico_ok,
        conhece_novas_ferr: editando.conhece_novas_ferr, plus_apresentado: editando.plus_apresentado,
        nota_prosystem: editando.nota_prosystem ? Number(editando.nota_prosystem) : undefined,
        sugestoes: editando.sugestoes || undefined, saude: editando.saude || undefined,
        tem_problema: !!editando.tem_problema, problema_descricao: editando.problema_descricao || undefined,
        abrir_caso: !!editando.abrir_caso,
        gerou_venda: !!editando.gerou_venda, tipo_venda: editando.tipo_venda || undefined, venda_obs: editando.venda_obs || undefined,
        parceiro_id: editando.gerou_venda ? (editando.parceiro_id || undefined) : undefined,
        venda_valor: editando.gerou_venda && editando.venda_valor ? Number(editando.venda_valor) : undefined,
        venda_acrescimo: editando.gerou_venda && editando.venda_acrescimo ? Number(editando.venda_acrescimo) : undefined,
        atualizar_cliente: !!editando.atualizar_cliente,
        cli_nome: editando.atualizar_cliente ? (editando.cli_nome || undefined) : undefined,
        cli_telefone1: editando.atualizar_cliente ? (editando.cli_telefone1 || undefined) : undefined,
        cli_telefone2: editando.atualizar_cliente ? (editando.cli_telefone2 || undefined) : undefined,
        cli_segmento: editando.atualizar_cliente ? (editando.cli_segmento || undefined) : undefined,
      });
      setEditando(null);
      loadContatos();
      // Se a ficha estiver aberta, permanece aberta na aba questionário com dados frescos
      if (ficha) {
        const id = editando.id || ficha.contato?.id;
        if (id) { setFichaLoading(true); apiClient.getFichaContatoAtivo(id).then(r => setFicha((f: any) => f ? { ...f, dados: r.data?.data || null } : f)).catch(() => {}).finally(() => setFichaLoading(false)); }
      }
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao salvar.'); }
    finally { setSavingQ(false); }
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

                {/* Filtros: buscar cliente + etapa (ex.: só "Em tratamento") */}
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  <input value={buscaAtivo} onChange={e => setBuscaAtivo(e.target.value)}
                    placeholder="🔍 Buscar cliente por nome ou código…"
                    className="flex-1 min-w-[220px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="">Todas as etapas</option>
                    {ETAPAS.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                  </select>
                  <button onClick={() => setFiltroEtapa('EM_TRATAMENTO')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${filtroEtapa === 'EM_TRATAMENTO' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200'}`}>
                    Em tratamento
                  </button>
                  {(buscaAtivo || filtroEtapa) && <button onClick={() => { setBuscaAtivo(''); setFiltroEtapa(''); }} className="text-xs text-gray-500 hover:text-gray-700 underline">limpar</button>}
                </div>

                {/* Kanban — 6 colunas lado a lado, com setas flutuantes para rolar */}
                <div className="relative">
                  {/* Seta ◀ — rola para a esquerda (fixa no meio vertical da área visível) */}
                  <button onClick={() => kanbanRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                    className="hidden md:flex items-center justify-center sticky top-1/2 z-20 float-left -ml-3 w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    style={{ position: 'sticky' }} title="Rolar para a esquerda">◀</button>
                  {/* Seta ▶ — rola para a direita */}
                  <button onClick={() => kanbanRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                    className="hidden md:flex items-center justify-center sticky top-1/2 z-20 float-right -mr-3 w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    title="Rolar para a direita">▶</button>
                <div ref={kanbanRef} className="flex gap-3 overflow-x-auto pb-2 scroll-smooth">
                  {ETAPAS.filter(et => !filtroEtapa || et.id === filtroEtapa).map(et => {
                    const termo = buscaAtivo.trim().toLowerCase();
                    const itens = contatos.filter(c => c.etapa === et.id
                      && (!termo || (c.cliente_nome || '').toLowerCase().includes(termo) || String(c.cliente_codigo || '').includes(termo)));
                    return (
                      <div key={et.id} className="bg-gray-50 rounded-xl p-2 min-h-[200px] flex-shrink-0 w-[280px]">
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: et.cor }}>{et.label}</span>
                          <span className="text-xs text-gray-400">{itens.length}</span>
                        </div>
                        <div className="space-y-2">
                          {itens.map(c => (
                            <div key={c.id}
                              onClick={() => abrirFicha(c, 'dados')}
                              className={`bg-white rounded-lg border p-2.5 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all ${c.oculto ? 'border-dashed border-gray-300 opacity-70' : 'border-gray-100'}`}>
                              <p className="text-sm font-semibold text-gray-800">
                                {c.cliente_codigo ? `${c.cliente_codigo} · ` : ''}{c.cliente_nome || 'Cliente'}
                                {c.plano && <span className="ml-1.5 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: planoCor(c.plano) }}>{c.plano}</span>}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {c.etiqueta && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: c.etiqueta_cor || '#dc2626' }}>{c.etiqueta}</span>}
                                {c.oculto && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">🙈 Oculto</span>}
                                {c.saude && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: SAUDE_COR[c.saude] }}>{c.saude}</span>}
                                {c.nota_prosystem != null && <span className="text-[10px] text-gray-500">★ {c.nota_prosystem}/5</span>}
                                {c.caso_churn_id && <span className="text-[10px] text-red-600">⚠ caso</span>}
                                {c.gerou_venda && <span className="text-[10px] text-blue-600">💰 oport.</span>}
                              </div>
                              {/* Setas ◀ ▶ para mover o card — stopPropagation para não abrir a ficha */}
                              <div className="flex items-center justify-between mt-2 mb-1" onClick={e => e.stopPropagation()}>
                                {(() => { const idx = ETAPAS.findIndex(e => e.id === et.id); return (
                                  <>
                                    <button disabled={idx <= 0} onClick={e => { e.stopPropagation(); moverEtapa(c, ETAPAS[idx - 1].id); }}
                                      className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 disabled:opacity-30" title={idx > 0 ? `Mover p/ ${ETAPAS[idx - 1].label}` : ''}>◀</button>
                                    <span className="text-[10px] text-gray-400">{et.label}</span>
                                    <button disabled={idx >= ETAPAS.length - 1} onClick={e => { e.stopPropagation(); moverEtapa(c, ETAPAS[idx + 1].id); }}
                                      className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 disabled:opacity-30" title={idx < ETAPAS.length - 1 ? `Mover p/ ${ETAPAS[idx + 1].label}` : ''}>▶</button>
                                  </>
                                ); })()}
                              </div>
                              <div className="flex gap-1 mt-1 flex-wrap" onClick={e => e.stopPropagation()}>
                                {et.id === 'A_CONTATAR' && <button onClick={e => { e.stopPropagation(); moverEtapa(c, 'EM_CONTATO'); }} className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Iniciar</button>}
                                {(et.id === 'A_CONTATAR' || et.id === 'EM_CONTATO') && <button onClick={e => { e.stopPropagation(); registrarTentativa(c); }} className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">📞 +1{c.tentativas ? ` (${c.tentativas})` : ''}</button>}
                                {(et.id === 'A_CONTATAR' || et.id === 'EM_CONTATO') && <button onClick={e => { e.stopPropagation(); abrirFicha(c, 'questionario'); }} className="text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">📋 Questionário</button>}
                                {et.id === 'EM_CONTATO' && <button onClick={e => { e.stopPropagation(); registrarTentativa(c, true); }} className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Sem sucesso</button>}
                                {/* COTACAO com oportunidade: fechamento é feito dentro da ficha → sem botão externo */}
                                {et.id === 'COTACAO' && !c.gerou_venda && <button onClick={e => { e.stopPropagation(); moverEtapa(c, 'CONCLUIDO'); }} className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">✓ Fechou</button>}
                                {et.id === 'COTACAO' && c.gerou_venda && <button onClick={e => { e.stopPropagation(); abrirFicha(c, 'oportunidades'); }} className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">💰 Ver oport.</button>}
                                {et.id === 'EM_TRATAMENTO' && <button onClick={e => { e.stopPropagation(); moverEtapa(c, 'CONCLUIDO'); }} className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">✓ Resolvido</button>}
                                {(et.id === 'COTACAO' || et.id === 'EM_TRATAMENTO' || et.id === 'SEM_SUCESSO') && <button onClick={e => { e.stopPropagation(); abrirFicha(c, 'questionario'); }} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">Ver / editar</button>}
                                {et.id === 'CONCLUIDO' && <button onClick={e => { e.stopPropagation(); abrirFicha(c, 'questionario'); }} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">Ver / editar</button>}
                                {isGestor && <button onClick={e => { e.stopPropagation(); etiquetarContato(c); }} className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">🏷️</button>}
                                {isGestor && <button onClick={e => { e.stopPropagation(); ocultarContato(c); }} className="text-[11px] px-2 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200">{c.oculto ? '👁️' : '🙈'}</button>}
                              </div>
                            </div>
                          ))}
                          {itens.length === 0 && <p className="text-[11px] text-gray-300 text-center py-3">vazio</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── PAINEL DA SUPERVISÃO ─── */}
        {isGestor && aba === 'painel' && painel && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <KPI label="Filas ativas" valor={painel.totais.filas} />
              <KPI label="Contatos na carteira" valor={painel.totais.contatos_total} />
              <KPI label="Concluídos" valor={painel.totais.concluidos} cor="text-green-700" />
              <KPI label="Casos abertos" valor={painel.totais.casos_abertos} cor="text-red-600" />
              <KPI label="Vendas geradas" valor={painel.totais.vendas_geradas} cor="text-blue-700" />
              <KPI label="Valor gerado" valor={`R$ ${Number(painel.totais.valor_gerado || 0).toLocaleString('pt-BR')}`} cor="text-emerald-700" />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Filas por vendedor</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-400 border-b">
                    {['Grupo / Técnico', 'Vendedor', 'Cobertura', 'Saudáveis', 'Em risco', 'Casos', 'Vendas', 'Valor gerado', 'Nota média'].map(h => <th key={h} className="py-1.5 pr-3">{h}</th>)}
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
                      <td className="pr-3 text-emerald-700">R$ {Number(f.valor_gerado || 0).toLocaleString('pt-BR')}</td>
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

      {/* ─── Modal: Registrar contato (questionário) — só abre quando a ficha NÃO está aberta ─── */}
      {editando && !ficha && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Questionário — {editando.cliente_nome}</h2>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
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

            {/* Atualizar cadastro do cliente (vai p/ a ficha) */}
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!editando.atualizar_cliente} onChange={e => setEditando({ ...editando, atualizar_cliente: e.target.checked, cli_nome: editando.cli_nome ?? editando.cliente_nome })} />
                Atualizar cadastro do cliente (nome, telefones, segmento)
              </label>
              {editando.atualizar_cliente && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nome / razão social</label>
                    <input value={editando.cli_nome ?? ''} onChange={e => setEditando({ ...editando, cli_nome: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder={editando.cliente_nome || ''} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Telefone 1</label>
                      <input value={editando.cli_telefone1 ?? ''} onChange={e => setEditando({ ...editando, cli_telefone1: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Telefone 2</label>
                      <input value={editando.cli_telefone2 ?? ''} onChange={e => setEditando({ ...editando, cli_telefone2: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="opcional" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Segmento</label>
                    <select value={editando.cli_segmento ?? ''} onChange={e => setEditando({ ...editando, cli_segmento: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">— identificar segmento —</option>
                      {['Farmácia', 'Manipulação', 'Padaria', 'Varejo'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <p className="text-[11px] text-gray-500">Só os campos preenchidos são atualizados na ficha do cliente.</p>
                </div>
              )}
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
                Gerou oportunidade de venda (oferta Prosystem / parceiro)
              </label>
              {editando.gerou_venda && (
                editando.venda_ref_id ? (
                  <p className="text-xs text-blue-700">✅ Venda já criada a partir deste contato (em Indicações). Confirme/date por lá.</p>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Oferta / parceiro *</label>
                      <select value={editando.parceiro_id || ''} onChange={e => setEditando({ ...editando, parceiro_id: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
                        <option value="">— escolha a oferta —</option>
                        {parceiros.map(p => <option key={p.id} value={p.id}>{p.categoria} · {p.nome}</option>)}
                      </select>
                      {(() => { const p = parceiros.find(x => x.id === editando.parceiro_id); return p?.pitch ? <p className="text-[11px] text-gray-500 mt-1">{p.pitch}</p> : null; })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Valor / setup (R$)</label>
                        <input type="number" value={editando.venda_valor || ''} onChange={e => setEditando({ ...editando, venda_valor: e.target.value })} placeholder="0" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Acréscimo mensal (R$)</label>
                        <input type="number" value={editando.venda_acrescimo || ''} onChange={e => setEditando({ ...editando, venda_acrescimo: e.target.value })} placeholder="0" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                      </div>
                    </div>
                    <input value={editando.venda_obs || ''} onChange={e => setEditando({ ...editando, venda_obs: e.target.value })} placeholder="Observação da venda" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    <p className="text-[11px] text-gray-500">Ao salvar, a venda é criada em <b>Indicações</b> (origem: Ativo) e fica rastreada. A gestão confirma/data depois.</p>
                  </div>
                )
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button>
              <button onClick={salvarQuestionario} disabled={savingQ} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg disabled:opacity-50">{savingQ ? 'Salvando…' : 'Salvar contato'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Ficha do cliente com abas ─── */}
      {ficha && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Cabeçalho fixo */}
            {(() => {
              const d = ficha.dados; const cli = d?.cliente; const c = ficha.contato;
              const fone = (t?: string) => (t || '').replace(/\D/g, '');
              const wpp = (t?: string) => { const n = fone(t); return n ? (n.startsWith('55') ? n : '55' + n) : ''; };
              return (
                <>
                  <div className="flex items-start justify-between p-5 border-b border-gray-100">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{cli?.razao_social || cli?.nome_fantasia || cli?.nome || c.cliente_nome}</h2>
                      <p className="text-xs text-gray-500">{cli?.codigo ? `Código ${cli.codigo}` : ''}{cli?.grupo_tecnico ? ` · ${cli.grupo_tecnico}` : ''}</p>
                    </div>
                    <div className="flex items-start gap-2 flex-wrap justify-end">
                      {(cli?.plano || c.plano) && <span className="text-[11px] font-bold px-2 py-0.5 rounded text-white" style={{ background: planoCor(cli?.plano || c.plano) }}>{cli?.plano || c.plano}</span>}
                      {(cli?.segmento || c.cli_segmento) && <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">{cli?.segmento || c.cli_segmento}</span>}
                      <button onClick={() => { setFicha(null); setEditando(null); }} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-2">×</button>
                    </div>
                  </div>

                  {/* Abas */}
                  <div className="flex border-b border-gray-100 px-5">
                    {([
                      { id: 'dados', label: '📋 Dados' },
                      { id: 'atualizacoes', label: '✏️ Atualizações' },
                      { id: 'questionario', label: '📝 Questionário' },
                      { id: 'cadastro', label: '👤 Cadastro' },
                      { id: 'caso', label: c.caso_churn_id ? '⚠️ Caso ●' : '⚠️ Caso' },
                      { id: 'oportunidades', label: `💰 Oport.${fichaOports.filter(o => o.status === 'NEGOCIACAO').length ? ` (${fichaOports.filter(o => o.status === 'NEGOCIACAO').length})` : ''}` },
                    ] as const).map(a => (
                      <button key={a.id} onClick={() => {
                        setFichaAba(a.id);
                        if (a.id === 'questionario' && !editando) setEditando({ ...c });
                        if (a.id === 'atualizacoes') setNovaAtualizacao('');
                      }}
                        className={`px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${fichaAba === a.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>

                  {/* Conteúdo com scroll */}
                  <div className="overflow-y-auto flex-1 p-5 space-y-3">
                    {fichaLoading ? <p className="text-sm text-gray-400 py-4 text-center">Carregando…</p> : (
                      <>
                        {/* ── ABA: DADOS ── */}
                        {fichaAba === 'dados' && (
                          <>
                            <div className="bg-slate-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Contato</p>
                              {cli?.contato && <p className="text-sm text-gray-700 mb-1">👤 {cli.contato}</p>}
                              {[cli?.telefone || cli?.telefone1, cli?.telefone2].filter(Boolean).map((t: string, i: number) => (
                                <div key={i} className="flex items-center justify-between text-sm py-1">
                                  <span className="text-gray-700">📞 {t}</span>
                                  <span className="flex gap-2">
                                    <a href={`tel:${fone(t)}`} className="text-blue-600 text-xs font-semibold">Ligar</a>
                                    <a href={`https://wa.me/${wpp(t)}`} target="_blank" rel="noopener noreferrer" className="text-green-600 text-xs font-semibold">WhatsApp</a>
                                  </span>
                                </div>
                              ))}
                              {!(cli?.telefone || cli?.telefone1 || cli?.telefone2) && <p className="text-xs text-gray-400">Sem telefone cadastrado. Atualize ao registrar o contato.</p>}
                              {cli?.email && <p className="text-sm text-gray-600 mt-1">✉️ {cli.email}</p>}
                              {cli?.mensalidade_base != null && <p className="text-xs text-gray-500 mt-1">Mensalidade base: R$ {Number(cli.mensalidade_base).toLocaleString('pt-BR')}</p>}
                            </div>
                            {d?.contatos_pessoas?.length > 0 && (
                              <div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Pessoas</p>
                                {d.contatos_pessoas.map((p: any) => (
                                  <p key={p.id} className="text-sm text-gray-700">• {p.nome}{p.cargo ? ` (${p.cargo})` : ''}{p.telefone ? ` — ${p.telefone}` : ''}{p.principal ? ' ⭐' : ''}</p>
                                ))}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Atualizações recentes</p>
                              {d?.eventos?.length > 0 ? d.eventos.map((ev: any) => (
                                <div key={ev.id} className="border-b border-gray-50 py-1.5">
                                  <p className="text-sm text-gray-800">{ev.titulo}</p>
                                  {ev.descricao && <p className="text-xs text-gray-500 whitespace-pre-line">{ev.descricao}</p>}
                                  <p className="text-[10px] text-gray-400">{new Date(ev.created_at).toLocaleString('pt-BR')}{ev.feito_por_nome ? ` · ${ev.feito_por_nome}` : ''}</p>
                                </div>
                              )) : <p className="text-xs text-gray-400">Sem atualizações ainda.</p>}
                            </div>
                          </>
                        )}

                        {/* ── ABA: ATUALIZAÇÕES ── */}
                        {fichaAba === 'atualizacoes' && (
                          <div className="space-y-3">
                            {/* Campo livre para nova atualização */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                              <p className="text-xs font-semibold text-gray-600">Nova atualização</p>
                              <textarea
                                value={novaAtualizacao}
                                onChange={e => setNovaAtualizacao(e.target.value)}
                                rows={3}
                                placeholder="Escreva uma observação, próximo passo, retorno combinado…"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                              <button
                                disabled={!novaAtualizacao.trim() || savingAtualizacao}
                                onClick={async () => {
                                  if (!novaAtualizacao.trim()) return;
                                  setSavingAtualizacao(true);
                                  try {
                                    await apiClient.registrarTentativaAtivo(c.id, { obs: novaAtualizacao.trim() });
                                    setNovaAtualizacao('');
                                    // Recarrega ficha para mostrar nova entrada na linha do tempo
                                    const r = await apiClient.getFichaContatoAtivo(c.id);
                                    setFicha((f: any) => f ? { ...f, dados: r.data?.data || null } : f);
                                  } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao salvar'); }
                                  finally { setSavingAtualizacao(false); }
                                }}
                                className="w-full py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white disabled:opacity-40 transition-opacity"
                              >
                                {savingAtualizacao ? 'Salvando…' : '💾 Salvar atualização'}
                              </button>
                            </div>

                            {/* Histórico de atualizações */}
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Histórico</p>
                              {d?.eventos?.length > 0 ? d.eventos.map((ev: any) => (
                                <div key={ev.id} className="border-b border-gray-100 py-2">
                                  <p className="text-sm text-gray-800">{ev.titulo}</p>
                                  {ev.descricao && <p className="text-xs text-gray-600 whitespace-pre-line mt-0.5">{ev.descricao}</p>}
                                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(ev.created_at).toLocaleString('pt-BR')}{ev.feito_por_nome ? ` · ${ev.feito_por_nome}` : ''}</p>
                                </div>
                              )) : <p className="text-xs text-gray-400">Sem registros ainda.</p>}
                            </div>
                          </div>
                        )}

                        {/* ── ABA: QUESTIONÁRIO ── */}
                        {fichaAba === 'questionario' && (
                          <div className="space-y-3">
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
                                      <button key={txt as string} onClick={() => setEditando({ ...(editando || c), [campo as string]: val })}
                                        className={`px-3 py-1 rounded text-xs border ${(editando || c)[campo as string] === val ? (val ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300') : 'bg-white text-gray-500 border-gray-200'}`}>{txt}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600">Nota geral do Prosystem (1 a 5)</label>
                              <div className="flex gap-1 mt-1">
                                {[1,2,3,4,5].map(n => (
                                  <button key={n} onClick={() => setEditando({ ...(editando || c), nota_prosystem: n })}
                                    className={`w-9 h-9 rounded-lg text-sm font-bold border ${Number((editando || c).nota_prosystem) === n ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-400 border-gray-200'}`}>{n}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600">Saúde percebida do cliente</label>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {SAUDE.map(s => (
                                  <button key={s} onClick={() => setEditando({ ...(editando || c), saude: s })}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold border ${(editando || c).saude === s ? 'text-white' : 'bg-white text-gray-500 border-gray-200'}`}
                                    style={(editando || c).saude === s ? { background: SAUDE_COR[s], borderColor: SAUDE_COR[s] } : {}}>{s}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600">Sugestões / observações</label>
                              <textarea value={(editando || c).sugestoes || ''} onChange={e => setEditando({ ...(editando || c), sugestoes: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => { setFichaAba('oportunidades'); }} className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                                💰 Registrar oportunidade
                              </button>
                              <button onClick={() => { if (!editando) setEditando({ ...c }); salvarQuestionario(); }} disabled={savingQ}
                                className="flex-1 px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg disabled:opacity-50">
                                {savingQ ? 'Salvando…' : 'Salvar questionário'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ── ABA: CADASTRO ── */}
                        {fichaAba === 'cadastro' && (
                          <div className="space-y-3">
                            <p className="text-xs text-gray-500">Atualize os dados cadastrais do cliente. As alterações são salvas junto com o questionário.</p>
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs font-medium text-gray-600">Nome / Razão social</label>
                                <input value={(editando || c).cli_nome ?? c.cliente_nome ?? ''} onChange={e => setEditando({ ...(editando || c), cli_nome: e.target.value, atualizar_cliente: true })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Nome / razão social" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-600">Telefone 1</label>
                                  <input value={(editando || c).cli_telefone1 ?? ''} onChange={e => setEditando({ ...(editando || c), cli_telefone1: e.target.value, atualizar_cliente: true })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="(00) 00000-0000" />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-600">Telefone 2</label>
                                  <input value={(editando || c).cli_telefone2 ?? ''} onChange={e => setEditando({ ...(editando || c), cli_telefone2: e.target.value, atualizar_cliente: true })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="(00) 00000-0000" />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-600">Segmento</label>
                                <select value={(editando || c).cli_segmento ?? ''} onChange={e => setEditando({ ...(editando || c), cli_segmento: e.target.value, atualizar_cliente: true })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
                                  <option value="">— segmento —</option>
                                  {['Farmácia', 'Manipulação', 'Padaria', 'Varejo'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            </div>
                            <button onClick={() => { if (!editando) setEditando({ ...c }); salvarQuestionario(); }} disabled={savingQ}
                              className="w-full py-2 text-sm font-semibold bg-green-600 text-white rounded-lg disabled:opacity-50">
                              {savingQ ? 'Salvando…' : '💾 Salvar cadastro'}
                            </button>
                          </div>
                        )}

                        {/* ── ABA: CASO ── */}
                        {fichaAba === 'caso' && (
                          <div className="space-y-3">
                            {c.caso_churn_id ? (
                              <div className="bg-red-50 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-semibold text-red-700">⚠️ Caso de retenção aberto</p>
                                <p className="text-xs text-red-600">Este cliente já possui um caso de churn vinculado. Acesse a aba Churn para acompanhar.</p>
                              </div>
                            ) : (
                              <div className="bg-red-50 rounded-lg p-4 space-y-3">
                                <p className="text-sm font-semibold text-red-700">Abrir caso de retenção</p>
                                <p className="text-xs text-gray-600">Use quando o cliente reportar um problema sério, risco de cancelamento ou insatisfação que precisa de acompanhamento.</p>
                                <div>
                                  <label className="text-xs font-medium text-gray-600">Descrição do problema</label>
                                  <textarea
                                    value={(editando || c).problema_descricao || ''}
                                    onChange={e => setEditando({ ...(editando || c), problema_descricao: e.target.value, tem_problema: true })}
                                    rows={3}
                                    placeholder="Descreva o problema ou motivo do risco de churn…"
                                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                                  />
                                </div>
                                <button
                                  disabled={!(editando || c).problema_descricao?.trim() || savingQ}
                                  onClick={() => {
                                    setEditando({ ...(editando || c), abrir_caso: true, tem_problema: true });
                                    setTimeout(() => salvarQuestionario(), 0);
                                  }}
                                  className="w-full py-2 text-sm font-semibold bg-red-600 text-white rounded-lg disabled:opacity-40">
                                  {savingQ ? 'Abrindo…' : '⚠️ Abrir caso de retenção'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── ABA: OPORTUNIDADES ── */}
                        {fichaAba === 'oportunidades' && (
                          <div className="space-y-3">
                            {fichaOports.length === 0 && !fichaOportsLoading && (
                              <p className="text-xs text-gray-400 text-center py-3">Nenhuma oportunidade registrada ainda.</p>
                            )}
                            {fichaOports.map((o: any) => (
                              <div key={o.id} className={`rounded-lg border p-3 ${o.status === 'NEGOCIACAO' ? 'border-blue-200 bg-blue-50' : o.status === 'CONFIRMADA' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold text-gray-800">{o.parceiro_nome || o.categoria || '—'}</p>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${o.status === 'NEGOCIACAO' ? 'bg-blue-200 text-blue-800' : o.status === 'CONFIRMADA' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                    {o.status === 'NEGOCIACAO' ? 'Em negociação' : o.status === 'CONFIRMADA' ? 'Confirmada' : 'Cancelada'}
                                  </span>
                                </div>
                                {o.observacao && <p className="text-xs text-gray-600 mt-1">{o.observacao}</p>}
                                {(o.valor_venda || o.acrescimo_mensal) && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {o.valor_venda ? `Setup: R$ ${Number(o.valor_venda).toLocaleString('pt-BR')}` : ''}
                                    {o.acrescimo_mensal ? ` +R$ ${Number(o.acrescimo_mensal).toLocaleString('pt-BR')}/mês` : ''}
                                  </p>
                                )}
                                <p className="text-[10px] text-gray-400 mt-1">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                                {o.status === 'NEGOCIACAO' && (
                                  <div className="flex gap-1 mt-2">
                                    <button onClick={async () => {
                                      if (!window.confirm('Confirmar fechamento? Isso vai criar a venda em Indicações.')) return;
                                      try { await apiClient.confirmarOportunidade(o.id); carregarOports(c.id); loadContatos(); }
                                      catch (e: any) { alert(e?.response?.data?.message || 'Erro'); }
                                    }} className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">✓ Confirmar fechamento</button>
                                    <button onClick={async () => {
                                      if (!window.confirm('Cancelar esta oportunidade?')) return;
                                      try { await apiClient.cancelarOportunidade(o.id); carregarOports(c.id); }
                                      catch (e: any) { alert(e?.response?.data?.message || 'Erro'); }
                                    }} className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">✕ Cancelar</button>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Form nova oportunidade */}
                            {novaOport ? (
                              <div className="bg-white rounded-lg border border-blue-200 p-3 space-y-2">
                                <p className="text-xs font-semibold text-blue-700">Nova oportunidade</p>
                                <select value={novaOport.parceiroId} onChange={e => setNovaOport({ ...novaOport, parceiroId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                                  <option value="">— escolha o produto/oferta —</option>
                                  {parceiros.map((p: any) => <option key={p.id} value={p.id}>{p.categoria} · {p.nome}</option>)}
                                </select>
                                {novaOport.parceiroId && (() => { const p = parceiros.find((x: any) => x.id === novaOport.parceiroId); return p?.pitch ? <p className="text-[11px] text-gray-500">{p.pitch}</p> : null; })()}
                                <div className="grid grid-cols-2 gap-2">
                                  <input type="number" value={novaOport.valor} onChange={e => setNovaOport({ ...novaOport, valor: e.target.value })} placeholder="Setup R$" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                  <input type="number" value={novaOport.acrescimo} onChange={e => setNovaOport({ ...novaOport, acrescimo: e.target.value })} placeholder="+Mensal R$" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                </div>
                                <textarea value={novaOport.obs} onChange={e => setNovaOport({ ...novaOport, obs: e.target.value })} placeholder="Observação (opcional)" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                                <div className="flex gap-2">
                                  <button onClick={() => setNovaOport(null)} className="flex-1 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg">Cancelar</button>
                                  <button disabled={!novaOport.parceiroId || savingOport} onClick={async () => {
                                    if (!novaOport.parceiroId) return;
                                    setSavingOport(true);
                                    try {
                                      await apiClient.criarOportunidadeAtivo(c.id, {
                                        parceiro_id: novaOport.parceiroId,
                                        valor_venda: novaOport.valor ? Number(novaOport.valor) : undefined,
                                        acrescimo_mensal: novaOport.acrescimo ? Number(novaOport.acrescimo) : undefined,
                                        observacao: novaOport.obs || undefined,
                                      });
                                      setNovaOport(null);
                                      carregarOports(c.id);
                                      loadContatos();
                                    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao registrar oportunidade'); }
                                    finally { setSavingOport(false); }
                                  }} className="flex-1 px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg disabled:opacity-50">
                                    {savingOport ? 'Salvando…' : 'Registrar'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setNovaOport({ parceiroId: '', valor: '', acrescimo: '', obs: '' })}
                                className="w-full py-2.5 rounded-lg border-2 border-dashed border-blue-200 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors">
                                + Nova oportunidade de venda
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer fixo */}
                  <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100">
                    <button onClick={() => { setFicha(null); setEditando(null); }} className="px-4 py-2 text-sm text-gray-500">Fechar</button>
                    <button onClick={() => { setFichaAba('questionario'); if (!editando) setEditando({ ...c }); }}
                      className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg">
                      📝 Ir ao questionário
                    </button>
                  </div>
                </>
              );
            })()}
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
