'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────
interface Etapa {
  id: string; codigo: string; nome: string; cor: string; ordem: number;
  tipo: 'ANDAMENTO'|'FECHAMENTO'|'PERDIDA'|'SEM_PERFIL'|'REATIVACAO';
  conta_pipeline: boolean; visivel_vendedor: boolean; ativa: boolean; fixo: boolean;
  leads: Lead[]; total: number; valor_total: number;
}
interface Lead {
  id: string; nome: string; empresa?: string; email?: string; telefone?: string;
  cidade?: string; estado?: string; origem?: string; temperatura: 'FRIO'|'MORNO'|'QUENTE';
  valor_estimado?: number; probabilidade?: number; status: string;
  etapa_funil: string; responsavel_id?: string; observacoes?: string;
  created_at: string;
}
interface Metricas {
  leads_ativos: number; pipeline_total: number; vendido_mes: number;
  fechados_mes: number; perdidos_mes: number;
  meta_valor: number; meta_falta: number; meta_pct: number;
  meta_trim_valor: number; vendido_trim: number; bonus_valor: number;
  bonus_pct: number; bonus_falta: number; taxa_conversao: number;
  meu_papel: string; eh_vendedor: boolean;
}

// ─── Mensagens motivacionais ─────────────────────────────────
function reguaMotivacional(pct: number): { titulo: string; texto: string; cor: string } {
  if (pct >= 100) return { titulo: 'Você é campeão/campeã! 🏆', texto: 'Meta batida! Agora é hora de superar o próprio resultado.', cor: '#16a34a' };
  if (pct >= 81)  return { titulo: 'Só mais um pouquinho! 🚀', texto: 'Você está muito perto de bater a meta do mês.', cor: '#22c55e' };
  if (pct >= 61)  return { titulo: 'Quase lá! 💪', texto: 'Só mais um pouco para chegar na meta. Priorize propostas em negociação.', cor: '#84cc16' };
  if (pct >= 41)  return { titulo: 'Você está indo bem! 🔥', texto: 'A meta está cada vez mais próxima. Continue focando nas oportunidades quentes.', cor: '#eab308' };
  if (pct >= 21)  return { titulo: 'Vamos lá, você está construindo resultado! ✨', texto: 'Continue alimentando o funil e mantendo os retornos em dia.', cor: '#f97316' };
  return                   { titulo: 'Vamos começar um bom mês! 🎯', texto: 'Cada contato é uma nova oportunidade. Bora movimentar esse funil.', cor: '#3b82f6' };
}

const MOTIVOS_PERDA = [
  'Preço','Cliente sem orçamento','Cliente não respondeu','Fechou com concorrente',
  'Não era o momento','Sem perfil para o produto','Dados incorretos','Desistiu da contratação',
  'Problema operacional','Atendimento demorou','Produto/plano não atendia','Outro'
];

const TEMP_BADGE: Record<string, { icone: string; cor: string }> = {
  FRIO: { icone: '🔵', cor: '#3b82f6' },
  MORNO: { icone: '🟡', cor: '#eab308' },
  QUENTE: { icone: '🔴', cor: '#ef4444' },
};

const ORIGENS = ['MANUAL','SITE','INDICACAO','CAMPANHA','EVENTO','OUTRO'];

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

// ─── Componente principal ───────────────────────────────────────
export default function FunilPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dragging, setDragging] = useState<{ leadId: string; fromEtapa: string } | null>(null);

  // Modais
  const [showNovoLead, setShowNovoLead] = useState(false);
  const [showNovaEtapa, setShowNovaEtapa] = useState(false);
  const [showConfigFunil, setShowConfigFunil] = useState(false);
  const [showPerda, setShowPerda] = useState<{ lead: Lead; etapaDestino: Etapa; etapaAnterior: string } | null>(null);
  const [showControle, setShowControle] = useState(false);

  // Form novo lead
  const [formLead, setFormLead] = useState({
    nome: '', empresa: '', cnpj: '', telefone: '', email: '', cidade: '', estado: '',
    origem: 'MANUAL', produto: '', valor_implantacao: '', valor_mensalidade: '',
    valor_estimado: '', observacoes: '', proxima_acao: '', data_retorno: '',
    etapa_funil: '', temperatura: 'FRIO' as 'FRIO'|'MORNO'|'QUENTE',
  });
  const [savingLead, setSavingLead] = useState(false);

  // Form nova etapa
  const [formEtapa, setFormEtapa] = useState({ codigo: '', nome: '', cor: '#6b7280', ordem: 99, tipo: 'ANDAMENTO' as Etapa['tipo'], conta_pipeline: true });

  // Form perda
  const [formPerda, setFormPerda] = useState({ motivo: '', motivo_outro: '', observacoes: '' });

  // Controle total
  const [controleData, setControleData] = useState<any[]>([]);

  const isGestor = user?.role === 'CEO' || user?.role?.includes('SUPERVISAO') || user?.role === 'ADMIN';
  const isVendedor = user?.role === 'VENDEDOR';

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const fetchBoard = useCallback(async () => {
    setDataLoading(true);
    try {
      const [boardRes, metricasRes] = await Promise.all([
        apiClient.client.get('/funil/board'),
        apiClient.client.get('/funil/metricas'),
      ]);
      setEtapas(boardRes.data.data.etapas);
      setMetricas(metricasRes.data.data);
    } catch { } finally { setDataLoading(false); }
  }, []);

  useEffect(() => { if (isAuthenticated) fetchBoard(); }, [isAuthenticated, fetchBoard]);

  // ─── Drag & Drop ────────────────────────────────────────────
  const handleDragStart = (leadId: string, fromEtapa: string) => setDragging({ leadId, fromEtapa });

  const handleDrop = async (toEtapa: Etapa) => {
    if (!dragging || dragging.fromEtapa === toEtapa.codigo) { setDragging(null); return; }

    // Encontrar lead
    const lead = etapas.flatMap(e => e.leads).find(l => l.id === dragging.leadId);
    if (!lead) { setDragging(null); return; }

    // Se a etapa de destino é PERDIDA, abre modal obrigatório
    if (toEtapa.tipo === 'PERDIDA') {
      setShowPerda({ lead, etapaDestino: toEtapa, etapaAnterior: dragging.fromEtapa });
      setFormPerda({ motivo: '', motivo_outro: '', observacoes: '' });
      setDragging(null);
      return;
    }

    try {
      await apiClient.client.post(`/leads/${dragging.leadId}/mover`, { etapa_funil: toEtapa.codigo });
      await fetchBoard();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao mover lead'); }
    finally { setDragging(null); }
  };

  const confirmarPerda = async () => {
    if (!showPerda) return;
    if (!formPerda.motivo) { alert('Selecione o motivo da perda'); return; }
    if (formPerda.motivo === 'Outro' && !formPerda.motivo_outro.trim()) { alert('Descreva o motivo'); return; }
    try {
      await apiClient.client.post(`/leads/${showPerda.lead.id}/mover`, {
        etapa_funil: showPerda.etapaDestino.codigo,
        perda: formPerda
      });
      setShowPerda(null);
      await fetchBoard();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao registrar perda'); }
  };

  // ─── Salvar novo lead ────────────────────────────────────────
  const salvarLead = async () => {
    if (!formLead.nome) return alert('Informe o nome do cliente');
    setSavingLead(true);
    try {
      const payload: any = {
        nome: formLead.nome, empresa: formLead.empresa, telefone: formLead.telefone,
        email: formLead.email || undefined, cidade: formLead.cidade, estado: formLead.estado,
        origem: formLead.origem, temperatura: formLead.temperatura,
        valor_estimado: formLead.valor_estimado ? Number(formLead.valor_estimado) : undefined,
        observacoes: [formLead.observacoes,
          formLead.cnpj ? `CNPJ/CPF: ${formLead.cnpj}` : '',
          formLead.produto ? `Produto: ${formLead.produto}` : '',
          formLead.valor_implantacao ? `Implantação: R$ ${formLead.valor_implantacao}` : '',
          formLead.valor_mensalidade ? `Mensalidade: R$ ${formLead.valor_mensalidade}` : '',
          formLead.proxima_acao ? `Próxima ação: ${formLead.proxima_acao}` : '',
          formLead.data_retorno ? `Data retorno: ${formLead.data_retorno}` : '',
        ].filter(Boolean).join('\n'),
      };
      const res = await apiClient.client.post('/leads', payload);
      // Se etapa inicial diferente da padrão, mover
      if (formLead.etapa_funil && formLead.etapa_funil !== 'PROSPECCAO') {
        await apiClient.client.post(`/leads/${res.data.data.id}/mover`, { etapa_funil: formLead.etapa_funil });
      }
      setShowNovoLead(false);
      setFormLead({ nome: '', empresa: '', cnpj: '', telefone: '', email: '', cidade: '', estado: '', origem: 'MANUAL', produto: '', valor_implantacao: '', valor_mensalidade: '', valor_estimado: '', observacoes: '', proxima_acao: '', data_retorno: '', etapa_funil: '', temperatura: 'FRIO' });
      await fetchBoard();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao salvar lead'); }
    finally { setSavingLead(false); }
  };

  // ─── Salvar nova etapa ───────────────────────────────────────
  const salvarEtapa = async () => {
    if (!formEtapa.codigo || !formEtapa.nome) return alert('Código e nome são obrigatórios');
    try {
      await apiClient.client.post('/funil/etapas', formEtapa);
      setShowNovaEtapa(false);
      setFormEtapa({ codigo: '', nome: '', cor: '#6b7280', ordem: 99, tipo: 'ANDAMENTO', conta_pipeline: true });
      await fetchBoard();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao criar etapa'); }
  };

  const editarEtapa = async (etapa: Etapa, dados: Partial<Etapa>) => {
    try {
      await apiClient.client.patch(`/funil/etapas/${etapa.id}`, dados);
      await fetchBoard();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro'); }
  };

  const removerEtapa = async (etapa: Etapa) => {
    if (etapa.fixo) {
      alert(`A etapa "${etapa.nome}" é uma coluna fixa do sistema e não pode ser removida.`);
      return;
    }
    if (!confirm(`Remover a etapa "${etapa.nome}"? Leads nessa etapa não serão excluídos.`)) return;
    try {
      await apiClient.client.delete(`/funil/etapas/${etapa.id}`);
      await fetchBoard();
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao remover etapa'); }
  };

  const abrirControle = async () => {
    try {
      const res = await apiClient.client.get('/funil/controle-total');
      setControleData(res.data.data.por_vendedor);
      setShowControle(true);
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro'); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--t-primary)', borderTopColor: 'transparent' }} /></div>;
  }

  const m = metricas;
  const regua = m ? reguaMotivacional(m.meta_pct) : null;

  return (
    <DashboardLayout>
      <div className="w-full px-3 py-5 space-y-5">

        {/* ─── Header + actions ────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Funil Comercial</h1>
            <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>
              {isVendedor ? 'Acompanhe seus leads, metas e bônus' : 'Painel de performance da equipe comercial'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowNovoLead(true)} className="px-3 py-2 rounded-lg text-white text-xs font-semibold" style={{ background: 'var(--t-primary)' }}>+ Novo Lead</button>
            {isGestor && <>
              <button onClick={() => setShowNovaEtapa(true)} className="px-3 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>+ Nova Coluna</button>
              <button onClick={() => setShowConfigFunil(true)} className="px-3 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>⚙ Configurar</button>
              <button onClick={abrirControle} className="px-3 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>📊 Controle Total</button>
            </>}
            <button onClick={() => router.push('/leads')} className="px-3 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>📋 Lista</button>
          </div>
        </div>

        {/* ─── Cards de resumo ─────────────────────────── */}
        {m && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card label="Leads ativos" value={m.leads_ativos.toString()} color="#3b82f6" />
            <Card label="Pipeline" value={fmtBRL(m.pipeline_total)} color="#8b5cf6" />
            <Card label="Fechado no mês" value={fmtBRL(m.vendido_mes)} color="#22c55e" />
            {isVendedor && m.meta_valor > 0 && <Card label="Meta do mês" value={fmtBRL(m.meta_valor)} color="#f97316" />}
            {isVendedor && m.meta_valor > 0 && <Card label="% Meta" value={`${m.meta_pct.toFixed(1)}%`} color={m.meta_pct >= 100 ? '#16a34a' : m.meta_pct >= 60 ? '#eab308' : '#ef4444'} />}
            {isVendedor && m.meta_trim_valor > 0 && <Card label="Bônus trim." value={`${m.bonus_pct.toFixed(0)}%`} color="#7c3aed" />}
            <Card label="Conversão" value={`${m.taxa_conversao.toFixed(1)}%`} color="#0ea5e9" />
            <Card label="Perdidos mês" value={m.perdidos_mes.toString()} color="#ef4444" />
          </div>
        )}

        {/* ─── Bloco motivacional + bônus (só vendedor com meta) ── */}
        {isVendedor && m && m.meta_valor > 0 && regua && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Meta mensal */}
            <div className="rounded-2xl border p-5" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--t-text-muted)' }}>Minha meta do mês</p>
                  <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--t-text-primary)' }}>{fmtBRL(m.meta_valor)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Falta</p>
                  <p className="text-lg font-bold" style={{ color: regua.cor }}>{fmtBRL(m.meta_falta)}</p>
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'var(--t-content-bg)' }}>
                <div className="h-full transition-all" style={{ width: `${Math.min(100, m.meta_pct)}%`, background: regua.cor }} />
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--t-text-muted)' }}>
                Vendido: <strong style={{ color: 'var(--t-text-primary)' }}>{fmtBRL(m.vendido_mes)}</strong> · {m.meta_pct.toFixed(1)}% da meta
              </p>
              <div className="rounded-xl p-3 border-l-4" style={{ background: 'var(--t-content-bg)', borderLeftColor: regua.cor }}>
                <p className="text-sm font-bold" style={{ color: regua.cor }}>{regua.titulo}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>{regua.texto}</p>
              </div>
            </div>

            {/* Bônus trimestral */}
            {m.meta_trim_valor > 0 && (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--t-text-muted)' }}>Meu bônus trimestral</p>
                    <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--t-text-primary)' }}>{fmtBRL(m.bonus_valor)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Progresso</p>
                    <p className="text-lg font-bold" style={{ color: '#7c3aed' }}>{m.bonus_pct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'var(--t-content-bg)' }}>
                  <div className="h-full transition-all" style={{ width: `${Math.min(100, m.bonus_pct)}%`, background: '#7c3aed' }} />
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--t-text-muted)' }}>
                  Meta tri.: <strong>{fmtBRL(m.meta_trim_valor)}</strong> · Vendido: <strong>{fmtBRL(m.vendido_trim)}</strong> · Falta: <strong>{fmtBRL(m.bonus_falta)}</strong>
                </p>
                <div className="rounded-xl p-3 border-l-4" style={{ background: 'var(--t-content-bg)', borderLeftColor: '#7c3aed' }}>
                  <p className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>
                    {m.bonus_pct >= 100 ? '🎉 Bônus liberado! Mantenha o ritmo para superar.' : 'Você está no caminho certo para liberar seu bônus. Mantenha o ritmo!'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Kanban ──────────────────────────────────── */}
        {dataLoading ? (
          <div className="text-center p-12 text-sm" style={{ color: 'var(--t-text-muted)' }}>Carregando funil...</div>
        ) : (
          <div className="kanban-scroll" style={{ minHeight: '60vh', overflowX: 'auto', paddingBottom: '12px' }}>
            <style>{`
              .kanban-scroll::-webkit-scrollbar { height: 14px; }
              .kanban-scroll::-webkit-scrollbar-track {
                background: var(--t-content-bg);
                border-radius: 8px;
                margin: 0 4px;
              }
              .kanban-scroll::-webkit-scrollbar-thumb {
                background: var(--t-primary);
                border-radius: 8px;
                border: 3px solid var(--t-content-bg);
                min-width: 60px;
              }
              .kanban-scroll::-webkit-scrollbar-thumb:hover {
                background: color-mix(in srgb, var(--t-primary) 80%, #000);
              }
              .kanban-scroll { scrollbar-width: thin; scrollbar-color: var(--t-primary) var(--t-content-bg); }
            `}</style>
            <div
              className="flex gap-2"
              style={{
                minWidth: `${etapas.length * 200}px`,
                width: '100%',
                alignItems: 'stretch',
              }}
            >
              {etapas.map(etapa => (
                <ColunaKanban key={etapa.id} etapa={etapa}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(etapa)}
                  onLeadDragStart={handleDragStart}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--t-text-muted)' }}>
          Arraste os cards para mover entre etapas · Mover para "Perdido" exige justificativa
        </p>
      </div>

      {/* ═════ MODAL: Novo Lead ═════ */}
      {showNovoLead && (
        <Modal title="+ Novo Lead" onClose={() => setShowNovoLead(false)}>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="Nome do cliente/empresa *" value={formLead.nome} onChange={v => setFormLead(f => ({ ...f, nome: v }))} cols={2} />
            <FieldInput label="Empresa (fantasia)" value={formLead.empresa} onChange={v => setFormLead(f => ({ ...f, empresa: v }))} />
            <FieldInput label="CNPJ/CPF" value={formLead.cnpj} onChange={v => setFormLead(f => ({ ...f, cnpj: v }))} />
            <FieldInput label="Telefone" value={formLead.telefone} onChange={v => setFormLead(f => ({ ...f, telefone: v }))} />
            <FieldInput label="E-mail" value={formLead.email} onChange={v => setFormLead(f => ({ ...f, email: v }))} />
            <FieldInput label="Cidade" value={formLead.cidade} onChange={v => setFormLead(f => ({ ...f, cidade: v }))} />
            <FieldInput label="UF" value={formLead.estado} onChange={v => setFormLead(f => ({ ...f, estado: v }))} />
            <FieldSelect label="Origem" value={formLead.origem} onChange={v => setFormLead(f => ({ ...f, origem: v }))} options={ORIGENS} />
            <FieldSelect label="Temperatura" value={formLead.temperatura} onChange={v => setFormLead(f => ({ ...f, temperatura: v as any }))} options={['FRIO','MORNO','QUENTE']} />
            <FieldInput label="Produto/plano de interesse" value={formLead.produto} onChange={v => setFormLead(f => ({ ...f, produto: v }))} cols={2} />
            <FieldInput label="Valor implantação" value={formLead.valor_implantacao} onChange={v => setFormLead(f => ({ ...f, valor_implantacao: v }))} type="number" />
            <FieldInput label="Valor mensalidade" value={formLead.valor_mensalidade} onChange={v => setFormLead(f => ({ ...f, valor_mensalidade: v }))} type="number" />
            <FieldInput label="Valor total previsto" value={formLead.valor_estimado} onChange={v => setFormLead(f => ({ ...f, valor_estimado: v }))} type="number" cols={2} />
            <FieldInput label="Próxima ação" value={formLead.proxima_acao} onChange={v => setFormLead(f => ({ ...f, proxima_acao: v }))} />
            <FieldInput label="Data de retorno" value={formLead.data_retorno} onChange={v => setFormLead(f => ({ ...f, data_retorno: v }))} type="date" />
            <FieldSelect label="Etapa inicial" value={formLead.etapa_funil} onChange={v => setFormLead(f => ({ ...f, etapa_funil: v }))}
              options={etapas.filter(e => e.tipo === 'ANDAMENTO').map(e => e.codigo)}
              labelMap={Object.fromEntries(etapas.map(e => [e.codigo, e.nome]))}
              cols={2} />
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Observações</label>
              <textarea value={formLead.observacoes} onChange={e => setFormLead(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowNovoLead(false)} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--t-text-secondary)' }}>Cancelar</button>
            <button onClick={salvarLead} disabled={savingLead || !formLead.nome}
              className="px-5 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
              style={{ background: 'var(--t-primary)' }}>
              {savingLead ? 'Salvando...' : 'Cadastrar Lead'}
            </button>
          </div>
        </Modal>
      )}

      {/* ═════ MODAL: Nova Coluna ═════ */}
      {showNovaEtapa && (
        <Modal title="+ Nova Coluna" onClose={() => setShowNovaEtapa(false)} maxW="max-w-md">
          <div className="space-y-3">
            <FieldInput label="Código (ex: REATIVACAO_FUTURA)" value={formEtapa.codigo} onChange={v => setFormEtapa(f => ({ ...f, codigo: v.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))} />
            <FieldInput label="Nome visível" value={formEtapa.nome} onChange={v => setFormEtapa(f => ({ ...f, nome: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Cor</label>
                <input type="color" value={formEtapa.cor} onChange={e => setFormEtapa(f => ({ ...f, cor: e.target.value }))}
                  className="w-full h-10 border rounded-lg" style={{ borderColor: 'var(--t-card-border)' }} />
              </div>
              <FieldInput label="Ordem" type="number" value={String(formEtapa.ordem)} onChange={v => setFormEtapa(f => ({ ...f, ordem: Number(v) || 99 }))} />
            </div>
            <FieldSelect label="Tipo da etapa" value={formEtapa.tipo}
              onChange={v => setFormEtapa(f => ({ ...f, tipo: v as any }))}
              options={['ANDAMENTO','FECHAMENTO','PERDIDA','SEM_PERFIL','REATIVACAO']} />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={formEtapa.conta_pipeline}
                onChange={e => setFormEtapa(f => ({ ...f, conta_pipeline: e.target.checked }))}
                className="w-4 h-4" style={{ accentColor: 'var(--t-primary)' }} />
              <span style={{ color: 'var(--t-text-primary)' }}>Contar no pipeline</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowNovaEtapa(false)} className="px-4 py-2 text-sm" style={{ color: 'var(--t-text-secondary)' }}>Cancelar</button>
            <button onClick={salvarEtapa} className="px-5 py-2 text-sm rounded-lg text-white font-medium" style={{ background: 'var(--t-primary)' }}>Criar Coluna</button>
          </div>
        </Modal>
      )}

      {/* ═════ MODAL: Configurar Funil ═════ */}
      {showConfigFunil && (
        <Modal title="⚙ Configurar Etapas do Funil" onClose={() => setShowConfigFunil(false)} maxW="max-w-3xl">
          <div className="space-y-2">
            {etapas.map(et => (
              <div key={et.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg border"
                style={{ borderColor: et.fixo ? 'var(--t-primary)' : 'var(--t-card-border)', background: et.fixo ? 'color-mix(in srgb, var(--t-primary) 4%, var(--t-card-bg))' : undefined }}>
                {et.fixo && <span className="col-span-12 text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--t-primary)' }}>🔒 Coluna fixa do sistema</span>}
                <input value={et.nome} onChange={e => setEtapas(prev => prev.map(p => p.id === et.id ? { ...p, nome: e.target.value } : p))}
                  onBlur={() => editarEtapa(et, { nome: et.nome })}
                  className="col-span-4 px-2 py-1.5 border rounded text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                <input type="color" value={et.cor} onChange={e => setEtapas(prev => prev.map(p => p.id === et.id ? { ...p, cor: e.target.value } : p))}
                  onBlur={() => editarEtapa(et, { cor: et.cor })}
                  className="col-span-1 w-full h-8 border rounded" style={{ borderColor: 'var(--t-card-border)' }} />
                <input type="number" value={et.ordem} onChange={e => setEtapas(prev => prev.map(p => p.id === et.id ? { ...p, ordem: Number(e.target.value) } : p))}
                  onBlur={() => editarEtapa(et, { ordem: et.ordem })}
                  className="col-span-1 px-2 py-1.5 border rounded text-sm text-center"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                {et.fixo ? (
                  <span className="col-span-3 px-2 py-1.5 rounded text-xs font-medium" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}>
                    {et.tipo === 'ANDAMENTO' ? 'Andamento' : et.tipo === 'FECHAMENTO' ? 'Fechamento' : et.tipo === 'PERDIDA' ? 'Perdida' : et.tipo === 'SEM_PERFIL' ? 'Sem perfil' : 'Reativação'}
                  </span>
                ) : (
                  <select value={et.tipo} onChange={e => { const novo = e.target.value as Etapa['tipo']; setEtapas(prev => prev.map(p => p.id === et.id ? { ...p, tipo: novo } : p)); editarEtapa(et, { tipo: novo }); }}
                    className="col-span-3 px-2 py-1.5 border rounded text-xs"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="ANDAMENTO">Andamento</option>
                    <option value="FECHAMENTO">Fechamento</option>
                    <option value="PERDIDA">Perdida</option>
                    <option value="SEM_PERFIL">Sem perfil</option>
                    <option value="REATIVACAO">Reativação</option>
                  </select>
                )}
                <span className="col-span-2 text-xs truncate" style={{ color: 'var(--t-text-muted)' }}>{et.codigo}</span>
                {et.fixo ? (
                  <span className="col-span-1 text-center text-sm" title="Coluna fixa — não pode ser removida">🔒</span>
                ) : (
                  <button onClick={() => removerEtapa(et)} className="col-span-1 text-red-500 text-xs hover:underline">Remover</button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--t-text-muted)' }}>
            🔒 Colunas fixas não podem ser removidas, mas nome, cor e ordem podem ser editados. Tipo "Perdida" exige motivo ao mover cards.
          </p>
        </Modal>
      )}

      {/* ═════ MODAL: Registrar perda (obrigatório) ═════ */}
      {showPerda && (
        <Modal title="🛑 Registrar motivo da perda" onClose={() => setShowPerda(null)} maxW="max-w-lg" closable={false}>
          <div className="rounded-xl p-3 mb-4 grid grid-cols-2 gap-3" style={{ background: 'var(--t-content-bg)' }}>
            <div><p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Cliente</p><p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{showPerda.lead.nome}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Valor da oportunidade</p><p className="text-sm font-semibold text-red-500">{fmtBRL(showPerda.lead.valor_estimado || 0)}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Data da perda</p><p className="text-sm" style={{ color: 'var(--t-text-primary)' }}>{new Date().toLocaleString('pt-BR')}</p></div>
            <div><p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Etapa anterior</p><p className="text-sm" style={{ color: 'var(--t-text-primary)' }}>{etapas.find(e => e.codigo === showPerda.etapaAnterior)?.nome || showPerda.etapaAnterior}</p></div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Motivo da perda *</label>
              <select value={formPerda.motivo} onChange={e => setFormPerda(f => ({ ...f, motivo: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                <option value="">Selecione o motivo</option>
                {MOTIVOS_PERDA.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {formPerda.motivo === 'Outro' && (
              <FieldInput label="Descreva o motivo *" value={formPerda.motivo_outro} onChange={v => setFormPerda(f => ({ ...f, motivo_outro: v }))} />
            )}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Observações sobre a perda</label>
              <textarea value={formPerda.observacoes} onChange={e => setFormPerda(f => ({ ...f, observacoes: e.target.value }))}
                rows={3} placeholder="Ex: Cliente informou que achou o valor da implantação alto e pediu retorno em 3 meses..."
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowPerda(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
              Cancelar movimentação
            </button>
            <button onClick={confirmarPerda} disabled={!formPerda.motivo || (formPerda.motivo === 'Outro' && !formPerda.motivo_outro.trim())}
              className="px-5 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 bg-red-500 hover:bg-red-600">
              Confirmar perda
            </button>
          </div>
        </Modal>
      )}

      {/* ═════ MODAL: Controle Total ═════ */}
      {showControle && (
        <Modal title="📊 Controle Total do Comercial" onClose={() => setShowControle(false)} maxW="max-w-4xl">
          {controleData.length === 0 ? (
            <p className="text-sm text-center p-6" style={{ color: 'var(--t-text-muted)' }}>Nenhum dado disponível</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                  <tr>
                    {['#','Vendedor','Leads ativos','Pipeline','Vendido (mês)','Fechados','Perdidos'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {controleData.map((v, i) => (
                    <tr key={v.vendedor_id} style={{ borderBottom: '1px solid var(--t-card-border)', background: i % 2 === 0 ? 'var(--t-card-bg)' : 'var(--t-content-bg)' }}>
                      <td className="px-3 py-2"><span className="text-xs font-bold" style={{ color: i === 0 ? '#eab308' : 'var(--t-text-muted)' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span></td>
                      <td className="px-3 py-2 font-medium" style={{ color: 'var(--t-text-primary)' }}>{v.vendedor_id}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--t-text-secondary)' }}>{v.leads_ativos}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--t-text-secondary)' }}>{fmtBRL(v.pipeline)}</td>
                      <td className="px-3 py-2 font-bold text-green-600">{fmtBRL(v.vendido_mes)}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--t-text-secondary)' }}>{v.fechados_mes}</td>
                      <td className="px-3 py-2 text-red-500">{v.perdidos_mes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </DashboardLayout>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────
function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
      <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--t-text-muted)' }}>{label}</p>
      <p className="text-lg font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

function ColunaKanban({ etapa, onDragOver, onDrop, onLeadDragStart }:
  { etapa: Etapa; onDragOver: (e: any) => void; onDrop: () => void; onLeadDragStart: (id: string, etapa: string) => void }) {
  const isPerdida = etapa.tipo === 'PERDIDA';
  return (
    <div
      className="rounded-xl border-2 flex flex-col"
      style={{
        flex: '1 1 0',
        minWidth: '180px',
        maxWidth: '280px',
        borderColor: etapa.cor,
        background: `color-mix(in srgb, ${etapa.cor} 6%, var(--t-card-bg))`,
      }}
      onDragOver={onDragOver} onDrop={onDrop}>
      <div className="px-3 py-2.5 rounded-t-lg flex items-center justify-between" style={{ background: etapa.cor, color: '#fff' }}>
        <div className="flex items-center gap-1.5 truncate">
          {isPerdida && <span>🛑</span>}
          {etapa.tipo === 'FECHAMENTO' && <span>🏆</span>}
          <p className="font-semibold text-sm truncate">{etapa.nome}</p>
        </div>
        <span className="text-xs font-bold px-1.5 py-0.5 bg-white/30 rounded-full">{etapa.total}</span>
      </div>
      {etapa.valor_total > 0 && (
        <div className="px-3 py-1.5 text-xs font-medium border-b" style={{ borderColor: etapa.cor, color: etapa.cor, background: 'var(--t-card-bg)' }}>
          {fmtBRL(etapa.valor_total)}
        </div>
      )}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ minHeight: 200 }}>
        {etapa.leads.length === 0 ? (
          <p className="text-center py-6 text-xs" style={{ color: 'var(--t-text-muted)' }}>Nenhum lead</p>
        ) : etapa.leads.map(lead => (
          <CardLead key={lead.id} lead={lead} onDragStart={() => onLeadDragStart(lead.id, etapa.codigo)} />
        ))}
      </div>
    </div>
  );
}

function CardLead({ lead, onDragStart }: { lead: Lead; onDragStart: () => void }) {
  const t = TEMP_BADGE[lead.temperatura] || TEMP_BADGE.FRIO;
  return (
    <div draggable onDragStart={onDragStart}
      className="rounded-lg p-2.5 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--t-text-primary)' }}>{lead.nome}</p>
          {lead.empresa && <p className="text-xs truncate" style={{ color: 'var(--t-text-muted)' }}>{lead.empresa}</p>}
        </div>
        <span title={`Temperatura: ${lead.temperatura}`} className="text-sm shrink-0">{t.icone}</span>
      </div>
      {lead.valor_estimado ? (
        <p className="text-xs font-bold mt-1.5 text-green-600">{fmtBRL(lead.valor_estimado)}</p>
      ) : null}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {lead.origem && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}>{lead.origem}</span>}
        {lead.cidade && <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>📍 {lead.cidade}</span>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, maxW = 'max-w-2xl', closable = true }:
  { title: string; onClose: () => void; children: React.ReactNode; maxW?: string; closable?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={closable ? onClose : undefined}>
      <div className={`w-full ${maxW} rounded-2xl shadow-2xl my-6`}
        style={{ background: 'var(--t-card-bg)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--t-card-border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>{title}</h2>
          {closable && <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-sm" style={{ color: 'var(--t-text-muted)' }}>✕</button>}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', cols = 1 }:
  { label: string; value: string; onChange: (v: string) => void; type?: string; cols?: number }) {
  return (
    <div className={cols === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, labelMap, cols = 1 }:
  { label: string; value: string; onChange: (v: string) => void; options: string[]; labelMap?: Record<string, string>; cols?: number }) {
  return (
    <div className={cols === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
        <option value="">Selecione</option>
        {options.map(o => <option key={o} value={o}>{labelMap?.[o] || o}</option>)}
      </select>
    </div>
  );
}
