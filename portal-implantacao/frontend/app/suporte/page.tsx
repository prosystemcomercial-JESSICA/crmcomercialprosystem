'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { crmApi } from '@/lib/api';

const PRIO_COLOR: Record<string, { bg: string; color: string }> = {
  BAIXA:   { bg: 'rgba(148,163,184,0.12)', color: '#64748b' },
  MEDIA:   { bg: 'rgba(75,142,200,0.12)',  color: '#2E6EAB' },
  ALTA:    { bg: 'rgba(234,88,12,0.10)',   color: '#ea580c' },
  CRITICA: { bg: 'rgba(220,38,38,0.10)',   color: '#dc2626' },
};
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  ABERTO:             { bg: 'rgba(234,179,8,0.12)',   color: '#a16207' },
  EM_ATENDIMENTO:     { bg: 'rgba(75,142,200,0.12)',  color: '#2E6EAB' },
  AGUARDANDO_CLIENTE: { bg: 'rgba(147,51,234,0.10)',  color: '#7e22ce' },
  RESOLVIDO:          { bg: 'rgba(22,163,74,0.10)',   color: '#15803d' },
  FECHADO:            { bg: 'rgba(148,163,184,0.12)', color: '#64748b' },
};

type Ticket = {
  id: string; titulo: string; categoria: string; prioridade: string;
  status: string; created_at: string; sla_horas?: number; resolucao_at?: string;
  cliente: { id: string; nome: string; empresa?: string };
};

function slaStatus(t: Ticket) {
  if (!t.sla_horas || t.status === 'RESOLVIDO' || t.status === 'FECHADO') return null;
  const h = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
  const pct = (h / t.sla_horas) * 100;
  if (pct >= 100) return { label: 'SLA estourado', color: '#dc2626', pct: 100 };
  if (pct >= 75)  return { label: 'SLA em risco',  color: '#d97706', pct };
  return              { label: 'No SLA',            color: '#16a34a', pct };
}

function tempoAberto(dt: string) {
  const h = Math.floor((Date.now() - new Date(dt).getTime()) / 3600000);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export default function SuportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [prioFiltro, setPrioFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [detalhe, setDetalhe] = useState<Ticket | null>(null);
  const [showNovo, setShowNovo] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [form, setForm] = useState({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setErro('');
    const params: any = {};
    if (statusFiltro) params.status = statusFiltro;
    if (prioFiltro)   params.prioridade = prioFiltro;
    crmApi.getTickets(params)
      .then(r => setTickets(r.data?.tickets || []))
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [statusFiltro, prioFiltro]);

  useEffect(() => { load(); }, [load]);

  const abrirNovo = () => {
    crmApi.getClientes().then(r => setClientes(r.data?.clientes || [])).catch(() => {});
    setForm({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
    setShowNovo(true);
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.sla_horas) payload.sla_horas = parseInt(payload.sla_horas);
      else delete payload.sla_horas;
      await crmApi.createTicket(payload);
      setShowNovo(false);
      load();
    } catch (e: any) { setErro(e.message); }
    finally { setSaving(false); }
  };

  const mudarStatus = async (id: string, status: string) => {
    await crmApi.updateTicket(id, { status });
    load();
    if (detalhe?.id === id) setDetalhe(d => d ? { ...d, status } : d);
  };

  const abertos = tickets.filter(t => t.status === 'ABERTO').length;
  const criticos = tickets.filter(t => t.prioridade === 'CRITICA' && !['RESOLVIDO','FECHADO'].includes(t.status)).length;
  const emAtraso = tickets.filter(t => { const s = slaStatus(t); return s && s.pct >= 100; }).length;

  return (
    <Shell>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Abertos', value: abertos, color: '#a16207', bg: 'rgba(234,179,8,0.08)' },
          { label: 'Críticos', value: criticos, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
          { label: 'SLA em atraso', value: emAtraso, color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4 border border-slate-200" style={{ background: k.bg }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros + Novo */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700">
          <option value="">Todos os status</option>
          {['ABERTO','EM_ATENDIMENTO','AGUARDANDO_CLIENTE','RESOLVIDO','FECHADO'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          ))}
        </select>
        <select value={prioFiltro} onChange={e => setPrioFiltro(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700">
          <option value="">Todas as prioridades</option>
          {['BAIXA','MEDIA','ALTA','CRITICA'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={() => load()} className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50">↻ Atualizar</button>
          <button onClick={abrirNovo} className="text-sm px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: '#2E6EAB' }}>+ Novo Ticket</button>
        </div>
      </div>

      {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}

      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Carregando tickets…</div>
      ) : tickets.length === 0 ? (
        <div className="text-slate-400 text-sm py-12 text-center">Nenhum ticket encontrado.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map(t => {
            const sla = slaStatus(t);
            const pc = PRIO_COLOR[t.prioridade] || PRIO_COLOR.MEDIA;
            const sc = STATUS_COLOR[t.status] || STATUS_COLOR.ABERTO;
            return (
              <div key={t.id} onClick={() => setDetalhe(t)}
                className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-slate-800 truncate">{t.titulo}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.color }}>{t.prioridade}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>{t.status.replace(/_/g,' ')}</span>
                    </div>
                    <div className="text-xs text-slate-500">{t.cliente.nome}{t.cliente.empresa ? ` · ${t.cliente.empresa}` : ''}</div>
                    <div className="text-xs text-slate-400 mt-1">{t.categoria} · aberto há {tempoAberto(t.created_at)}</div>
                  </div>
                  {sla && (
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-bold" style={{ color: sla.color }}>{sla.label}</div>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(sla.pct,100)}%`, background: sla.color }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detalhe ticket */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800 leading-tight flex-1 mr-3">{detalhe.titulo}</h3>
              <button onClick={() => setDetalhe(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { label: detalhe.prioridade, ...PRIO_COLOR[detalhe.prioridade] },
                { label: detalhe.status.replace(/_/g,' '), ...STATUS_COLOR[detalhe.status] },
              ].map(b => (
                <span key={b.label} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: b.bg, color: b.color }}>{b.label}</span>
              ))}
            </div>
            <div className="text-sm text-slate-600 mb-4 space-y-1.5">
              <div><span className="font-medium text-slate-700">Cliente:</span> {detalhe.cliente.nome}{detalhe.cliente.empresa ? ` · ${detalhe.cliente.empresa}` : ''}</div>
              <div><span className="font-medium text-slate-700">Categoria:</span> {detalhe.categoria}</div>
              <div><span className="font-medium text-slate-700">Aberto:</span> {new Date(detalhe.created_at).toLocaleString('pt-BR')}</div>
              {detalhe.sla_horas && <div><span className="font-medium text-slate-700">SLA:</span> {detalhe.sla_horas}h</div>}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Mudar status</p>
              <div className="flex flex-wrap gap-2">
                {['ABERTO','EM_ATENDIMENTO','AGUARDANDO_CLIENTE','RESOLVIDO','FECHADO'].map(s => {
                  const sc = STATUS_COLOR[s] || STATUS_COLOR.ABERTO;
                  return (
                    <button key={s} onClick={() => mudarStatus(detalhe.id, s)}
                      className="text-xs px-2.5 py-1 rounded-full font-semibold border transition-colors"
                      style={detalhe.status === s
                        ? { background: sc.color, color: '#fff', borderColor: sc.color }
                        : { background: sc.bg, color: sc.color, borderColor: 'transparent' }}>
                      {s.replace(/_/g,' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo ticket */}
      {showNovo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNovo(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Novo Ticket</h3>
              <button onClick={() => setShowNovo(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Cliente</label>
                <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg">
                  <option value="">Selecionar…</option>
                  {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Título</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" placeholder="Descreva o problema…" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg">
                    {['TECNICO','FINANCEIRO','COMERCIAL','TREINAMENTO','OUTRO'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Prioridade</label>
                  <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg">
                    {['BAIXA','MEDIA','ALTA','CRITICA'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">SLA (horas, opcional)</label>
                <input type="number" value={form.sla_horas} onChange={e => setForm(f => ({ ...f, sla_horas: e.target.value }))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" placeholder="Ex: 24" />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowNovo(false)} className="text-sm px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={salvar} disabled={saving || !form.titulo || !form.cliente_id}
                className="text-sm px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ background: '#2E6EAB' }}>
                {saving ? 'Salvando…' : 'Criar Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
