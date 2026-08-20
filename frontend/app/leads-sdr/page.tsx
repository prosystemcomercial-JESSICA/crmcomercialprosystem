'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  Plus, Search, Phone, Loader2, ChevronLeft, ChevronRight, RefreshCw,
  Flame, Thermometer, Snowflake, Zap, Clock, X,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

interface LeadEtiqueta { etiqueta: { id: string; nome: string; cor: string } }

interface LeadSdr {
  id: string; nome: string; razao_social?: string; nome_fantasia?: string;
  segmento?: string; responsavel_telefone?: string; origem: string;
  temperatura: string; etapa_sdr: string | null; proximo_contato?: string;
  completude_pct?: number; created_at: string;
  etiquetas_lead?: LeadEtiqueta[];
  _count?: { atividades: number; propostas: number; observacoes_lead: number };
}

const TEMP_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  MUITO_QUENTE: { icon: Zap,         color: '#dc2626', label: 'Muito Quente' },
  QUENTE:       { icon: Flame,       color: '#ea580c', label: 'Quente' },
  MORNO:        { icon: Thermometer, color: '#d97706', label: 'Morno' },
  FRIO:         { icon: Snowflake,   color: '#2563eb', label: 'Frio' },
};

const ORIGENS_PAGAS = ['Instagram', 'Facebook', 'Google'];
const ehOrigemPaga = (origem?: string) => !!origem && ORIGENS_PAGAS.includes(origem);

const ORIGENS_MANUAL = [
  'Indicação', 'Prospecção ativa', 'WhatsApp', 'Instagram', 'Facebook',
  'Google', 'Visita comercial', 'Cliente antigo', 'Site', 'Telefone', 'Evento', 'Outro',
];

// Funil PRÓPRIO do SDR — separado do funil comercial do vendedor. Quando o
// lead é distribuído pela supervisão, ele some daqui e passa a viver só no
// kanban do vendedor (Central de Leads); volta a aparecer aqui apenas se
// devolvido explicitamente.
const COLUNAS_SDR = [
  { chave: 'NOVO_LEAD',        nome: 'Novo Lead',        cor: '#6b7280' },
  { chave: 'PRIMEIRO_CONTATO', nome: 'Primeiro Contato', cor: '#2563eb' },
  { chave: 'EM_QUALIFICACAO',  nome: 'Em Qualificação',  cor: '#7c3aed' },
  { chave: 'QUALIFICADO',      nome: 'Qualificado',      cor: '#16a34a' },
];

function iniciaisDono(nome?: string): string {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

// ── Lead Card (mesmo padrão visual da Central de Leads: 1 cor de destaque) ──

function LeadCardSdr({ lead, onClick, onDragStart }: {
  lead: LeadSdr; onClick: () => void; onDragStart: (e: React.DragEvent) => void;
}) {
  const temp = TEMP_CONFIG[lead.temperatura] || TEMP_CONFIG.FRIO;
  const empresa = lead.razao_social || lead.nome_fantasia || lead.nome;
  const tel = lead.responsavel_telefone;
  const origemPaga = ehOrigemPaga(lead.origem);
  const atrasado = !!(lead.proximo_contato && new Date(lead.proximo_contato) <= new Date());
  const destaqueCor = origemPaga ? '#16a34a' : atrasado ? '#dc2626' : null;

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      className="group relative rounded-xl cursor-grab active:cursor-grabbing transition-shadow duration-150 hover:shadow-md overflow-hidden"
      style={{
        background: 'var(--t-card-bg)',
        border: destaqueCor ? `1px solid color-mix(in srgb, ${destaqueCor} 40%, var(--t-card-border))` : '1px solid var(--t-card-border)',
        boxShadow: destaqueCor ? `0 0 0 1px color-mix(in srgb, ${destaqueCor} 18%, transparent)` : undefined,
      }}
    >
      <div className="p-2.5">
        <p className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--t-text-primary)' }}>{empresa}</p>

        {origemPaga && (
          <p className="flex items-center gap-1 text-[10px] font-semibold mt-1" style={{ color: '#16a34a' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#16a34a' }} />
            {lead.origem} · prioridade
          </p>
        )}
        {!origemPaga && atrasado && (
          <p className="flex items-center gap-1 text-[10px] font-semibold mt-1" style={{ color: '#dc2626' }}>
            <Clock size={9} /> Retorno atrasado
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          <span className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--t-text-muted)' }}>
            <temp.icon size={9} style={{ color: temp.color, opacity: 0.7 }} />
            {lead.segmento || temp.label}
          </span>
          {tel && (
            <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'var(--t-text-muted)' }}>
              <Phone size={8} />{tel}
            </span>
          )}
        </div>
        {typeof lead.completude_pct === 'number' && lead.completude_pct < 80 && (
          <p className="text-[9px] mt-1" style={{ color: 'var(--t-text-muted)' }} title="Completude do cadastro">
            Cadastro {lead.completude_pct}% completo
          </p>
        )}
      </div>

      <div className="flex items-center justify-between px-2.5 py-2" style={{ borderTop: '1px solid var(--t-card-border)' }}>
        <span className="text-[9px] font-medium" style={{ color: 'var(--t-text-muted)' }}>
          {(lead._count?.observacoes_lead || 0) > 0 ? `${lead._count?.observacoes_lead} obs.` : ''}
        </span>
        <span className="inline-flex items-center justify-center rounded-full flex-shrink-0 text-[8px] font-bold" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-secondary)', width: 17, height: 17 }}>
          {iniciaisDono(empresa)}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function LeadsSdrPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const isGestor = podeVerTudo((user as any)?.role);

  const [kanban, setKanban] = useState<Record<string, LeadSdr[]>>({ NOVO_LEAD: [], PRIMEIRO_CONTATO: [], EM_QUALIFICACAO: [], QUALIFICADO: [] });
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draggingLead, setDraggingLead] = useState<LeadSdr | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [savingNewLead, setSavingNewLead] = useState(false);
  const criandoLeadRef = useRef(false);
  const [newLeadForm, setNewLeadForm] = useState<any>({ temperatura: 'FRIO', origem: '' });
  const [selectedLead, setSelectedLead] = useState<LeadSdr | null>(null);

  // Navegação entre colunas (mesmo padrão da Central de Leads)
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [colunaAtiva, setColunaAtiva] = useState(0);
  const colWidth = 236;
  const irParaColuna = useCallback((idx: number) => {
    const alvo = Math.max(0, Math.min(COLUNAS_SDR.length - 1, idx));
    setColunaAtiva(alvo);
    boardScrollRef.current?.scrollTo({ left: alvo * colWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getMeuFunilSdr();
      setKanban(res.data?.data?.leads || { NOVO_LEAD: [], PRIMEIRO_CONTATO: [], EM_QUALIFICACAO: [], QUALIFICADO: [] });
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  }, []);
  useEffect(() => { if (isAuthenticated) loadData(); }, [isAuthenticated, loadData]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const editing = tag === 'input' || tag === 'textarea' || tag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable;
      if (editing || showNewLead) return;
      if (e.key === 'ArrowRight') irParaColuna(colunaAtiva + 1);
      else if (e.key === 'ArrowLeft') irParaColuna(colunaAtiva - 1);
      else if (/^[1-4]$/.test(e.key)) irParaColuna(Number(e.key) - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [colunaAtiva, irParaColuna, showNewLead]);

  const onBoardScroll = useCallback(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / colWidth);
    setColunaAtiva(prev => (prev === idx ? prev : idx));
  }, []);

  const moveColumn = async (lead: LeadSdr, novaEtapa: string) => {
    if (lead.etapa_sdr === novaEtapa) return;
    // Otimista: move na hora, reverte se a API falhar.
    setKanban(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = next[k].filter(l => l.id !== lead.id);
      next[novaEtapa] = [{ ...lead, etapa_sdr: novaEtapa }, ...(next[novaEtapa] || [])];
      return next;
    });
    try {
      await apiClient.moverEtapaSdr(lead.id, novaEtapa);
    } catch (e: any) {
      console.error('Falha ao mover etapa SDR:', e?.response?.data || e);
      loadData();
    }
  };

  const createNewLead = async () => {
    if (criandoLeadRef.current) return;
    criandoLeadRef.current = true;
    setSavingNewLead(true);
    try {
      const payload: any = { ...newLeadForm };
      if (!payload.nome) payload.nome = payload.razao_social || 'Lead';
      if (!payload.origem) payload.origem = 'MANUAL';
      await apiClient.createLead(payload);
      await loadData();
      setShowNewLead(false);
      setNewLeadForm({ temperatura: 'FRIO', origem: '' });
    } catch (e: any) {
      console.error('Erro ao salvar lead:', e?.response?.data || e);
    } finally {
      criandoLeadRef.current = false;
      setSavingNewLead(false);
    }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--t-sidebar-grad-from)' }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--t-primary)' }} /></div>;
  }

  const filtered = Object.fromEntries(Object.entries(kanban).map(([col, leads]) => [
    col, search ? leads.filter(l => (l.razao_social || l.nome || '').toLowerCase().includes(search.toLowerCase())) : leads,
  ]));
  const totalLeads = Object.values(kanban).reduce((s, a) => s + a.length, 0);

  return (
    <DashboardLayout>
      <div className="w-full space-y-4" style={{ background: 'var(--t-content-bg)', minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--t-text-primary)' }}>Meu Funil — SDR</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Prospecção e qualificação · <span style={{ color: 'var(--t-primary)' }}>{totalLeads} leads</span> no funil
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--t-text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead ou empresa..." className="pl-8 pr-3 h-8 text-xs rounded-lg outline-none" style={{ border: '1px solid var(--t-card-border)', width: 210, color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
            </div>
            <button onClick={loadData} title="Atualizar" className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)' }}>
              <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} style={{ color: 'var(--t-primary)' }} />
            </button>
            <button onClick={() => { setNewLeadForm({ temperatura: 'FRIO', origem: '' }); setShowNewLead(true); }}
              className="ps-btn-primary h-8 flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold text-white">
              <Plus size={13} /> Novo Lead
            </button>
          </div>
        </div>

        {/* ── Kanban ─────────────────────────────────────────────── */}
        <div className="rounded-2xl ps-card overflow-hidden" style={{ border: '1px solid var(--t-card-border)', boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => irParaColuna(colunaAtiva - 1)} disabled={colunaAtiva === 0}
                  className="w-[26px] h-[26px] flex items-center justify-center rounded-md transition-colors disabled:opacity-35"
                  style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-primary-dark)' }}>
                  <ChevronLeft size={13} />
                </button>
                <button onClick={() => irParaColuna(colunaAtiva + 1)} disabled={colunaAtiva >= COLUNAS_SDR.length - 1}
                  className="w-[26px] h-[26px] flex items-center justify-center rounded-md transition-colors disabled:opacity-35"
                  style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-primary-dark)' }}>
                  <ChevronRight size={13} />
                </button>
              </div>
              <span className="text-xs font-bold truncate" style={{ color: 'var(--t-text-primary)' }}>
                {COLUNAS_SDR[colunaAtiva]?.nome}
                <span className="font-semibold ml-1.5" style={{ color: 'var(--t-text-muted)' }}>{colunaAtiva + 1} de {COLUNAS_SDR.length}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {COLUNAS_SDR.map((col, i) => (
                <button key={col.chave} onClick={() => irParaColuna(i)} title={col.nome}
                  className="rounded-full transition-all"
                  style={{ width: i === colunaAtiva ? 16 : 6, height: 6, background: i === colunaAtiva ? 'var(--t-primary-dark)' : 'var(--t-card-border)' }} />
              ))}
            </div>
            <p className="text-[10px] hidden lg:block flex-shrink-0" style={{ color: 'var(--t-text-secondary)' }}>
              <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>←→</kbd>
              {' '}navega ·{' '}
              <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>1–4</kbd>
              {' '}pula etapa
            </p>
          </div>

          <div ref={boardScrollRef} onScroll={onBoardScroll}
            className="overflow-x-auto overflow-y-hidden"
            style={{ height: 'min(72vh, 720px)', scrollSnapType: 'x mandatory' }}
            onDragEnd={() => { setDraggingLead(null); setDragOverCol(null); }}>
            <div className="flex h-full gap-3 p-4" style={{ minWidth: `${COLUNAS_SDR.length * 230}px` }}>
              {COLUNAS_SDR.map(col => {
                const colLeads = filtered[col.chave] || [];
                const isOver = dragOverCol === col.chave;
                return (
                  <div key={col.chave}
                    className="flex flex-col rounded-xl flex-shrink-0 transition-colors"
                    style={{
                      width: 224, scrollSnapAlign: 'start',
                      background: isOver ? `${col.cor}08` : 'var(--t-card-bg)',
                      border: `1px solid ${isOver ? col.cor : `${col.cor}22`}`,
                      outline: isOver ? `3px solid ${col.cor}18` : 'none',
                      outlineOffset: -1,
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                    onDragEnter={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverCol(null);
                      if (draggingLead) moveColumn(draggingLead, col.chave);
                      setDraggingLead(null);
                    }}
                  >
                    <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.cor }} />
                        <span className="text-[11px] font-bold truncate" style={{ color: 'var(--t-text-primary)' }}>{col.nome}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}>{colLeads.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {colLeads.map(lead => (
                        <div key={lead.id} style={{ opacity: draggingLead?.id === lead.id ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                          <LeadCardSdr
                            lead={lead}
                            onClick={() => setSelectedLead(lead)}
                            onDragStart={e => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', lead.id);
                              setTimeout(() => setDraggingLead(lead), 0);
                            }}
                          />
                        </div>
                      ))}
                      {colLeads.length === 0 && (
                        <p className="text-center text-[10px] py-5" style={{ color: isOver ? col.cor : `${col.cor}66` }}>
                          {isOver && draggingLead ? '⬇ Soltar aqui' : 'Vazio'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Detalhe do lead (painel simples — edição completa fica na Central
          de Leads, que é a tela do vendedor; aqui o SDR só confere dados) ── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.6)' }} onClick={() => setSelectedLead(null)}>
          <div className="ps-card rounded-2xl shadow-2xl flex flex-col" style={{ width: 440, maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold truncate" style={{ color: 'var(--t-text-primary)' }}>
                {selectedLead.razao_social || selectedLead.nome_fantasia || selectedLead.nome}
              </h2>
              <button onClick={() => setSelectedLead(null)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Segmento</p>
                  <p style={{ color: 'var(--t-text-primary)' }}>{selectedLead.segmento || '—'}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Telefone</p>
                  <p style={{ color: 'var(--t-text-primary)' }}>{selectedLead.responsavel_telefone || '—'}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Origem</p>
                  <p style={{ color: 'var(--t-text-primary)' }}>{selectedLead.origem}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Temperatura</p>
                  <p style={{ color: 'var(--t-text-primary)' }}>{TEMP_CONFIG[selectedLead.temperatura]?.label || selectedLead.temperatura}</p>
                </div>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wide text-[10px] mb-1" style={{ color: 'var(--t-text-muted)' }}>Etapa no funil</p>
                <select
                  value={selectedLead.etapa_sdr || 'NOVO_LEAD'}
                  onChange={e => { const nova = e.target.value; moveColumn(selectedLead, nova); setSelectedLead(p => p ? { ...p, etapa_sdr: nova } : p); }}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                  {COLUNAS_SDR.map(c => <option key={c.chave} value={c.chave}>{c.nome}</option>)}
                </select>
              </div>
              {selectedLead.etapa_sdr === 'QUALIFICADO' && (
                <p className="text-[11px] rounded-lg p-3" style={{ background: 'var(--t-success-bg, #F0FDF4)', color: 'var(--t-success, #16A34A)' }}>
                  Lead qualificado — já está na fila de distribuição da supervisão.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── New Lead Modal (simplificado — dados essenciais de prospecção) ── */}
      {showNewLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.6)' }}>
          <div className="ps-card rounded-2xl shadow-2xl flex flex-col" style={{ width: 480, maxHeight: '88vh' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--t-text-primary)' }}>Novo Lead</h2>
              <button onClick={() => setShowNewLead(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Razão Social *</label>
                <input value={newLeadForm.razao_social || ''} onChange={e => setNewLeadForm((p: any) => ({ ...p, razao_social: e.target.value, nome: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Telefone/WhatsApp</label>
                <input value={newLeadForm.responsavel_telefone || ''} onChange={e => setNewLeadForm((p: any) => ({ ...p, responsavel_telefone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Origem *</label>
                  <select value={newLeadForm.origem || ''} onChange={e => setNewLeadForm((p: any) => ({ ...p, origem: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="">Selecione...</option>
                    {ORIGENS_MANUAL.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Temperatura</label>
                  <select value={newLeadForm.temperatura || 'FRIO'} onChange={e => setNewLeadForm((p: any) => ({ ...p, temperatura: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    {Object.entries(TEMP_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Segmento</label>
                <input value={newLeadForm.segmento || ''} onChange={e => setNewLeadForm((p: any) => ({ ...p, segmento: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--t-card-border)' }}>
              <button onClick={() => setShowNewLead(false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)' }}>Cancelar</button>
              <button onClick={createNewLead} disabled={savingNewLead || !newLeadForm.razao_social || !newLeadForm.origem}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: '#16a34a' }}>
                {savingNewLead ? <Loader2 size={12} className="animate-spin" /> : null} Criar Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
