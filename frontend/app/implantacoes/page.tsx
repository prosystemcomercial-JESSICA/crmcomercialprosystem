'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Wrench, CalendarCheck, Clock, CheckCircle, X } from 'lucide-react';

interface Implantacao {
  id: string;
  contrato_id: string;
  cliente_razao_social: string;
  cliente_cnpj?: string;
  plano?: string;
  vendedor_nome?: string;
  valor_setup?: number;
  mensalidade?: number;
  status: string;
  data_assinatura?: string;
  data_agendada?: string;
  data_instalacao?: string;
  data_primeiro_vencimento?: string;
  mes_pagamento_comissao?: string;
  observacoes?: string;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  AGUARDANDO_INSTALACAO: { label: 'Aguardando Instalação', color: '#d97706', bg: '#fef3c7' },
  AGENDADA:              { label: 'Agendada',              color: '#2563eb', bg: '#dbeafe' },
  INSTALADO:             { label: 'Instalado',             color: '#16a34a', bg: '#dcfce7' },
  CANCELADA:             { label: 'Cancelada',             color: '#9ca3af', bg: '#f3f4f6' },
};

const fmtBRL = (v?: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtMes = (m?: string) => {
  if (!m) return '—';
  const [a, mes] = m.split('-');
  const nomes = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[Number(mes)]}/${a}`;
};

export default function ImplantacoesPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [lista, setLista] = useState<Implantacao[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [sel, setSel] = useState<Implantacao | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const r = await apiClient.getImplantacoes();
      setLista(r.data.data.implantacoes || []);
      setResumo(r.data.data.resumo || null);
    } catch { /* ignore */ } finally { setDataLoading(false); }
  }, []);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  const abrir = (i: Implantacao) => {
    setSel(i);
    setForm({
      data_instalacao: i.data_instalacao?.split('T')[0] || '',
      data_primeiro_vencimento: i.data_primeiro_vencimento?.split('T')[0] || '',
      data_agendada: i.data_agendada?.split('T')[0] || '',
      status: i.status,
      observacoes: i.observacoes || '',
    });
  };

  const salvar = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      await apiClient.atualizarImplantacao(sel.id, {
        data_instalacao: form.data_instalacao || undefined,
        data_primeiro_vencimento: form.data_primeiro_vencimento || undefined,
        data_agendada: form.data_agendada || undefined,
        status: form.status || undefined,
        observacoes: form.observacoes || undefined,
      });
      setSel(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  // Pré-visualização do mês de pagamento (1º vencimento + 1 mês).
  const previewMesPag = (() => {
    if (!form.data_primeiro_vencimento) return null;
    const d = new Date(form.data_primeiro_vencimento + 'T00:00:00');
    const alvo = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}`;
  })();

  if (loading || dataLoading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><p style={{ color: 'var(--t-text-muted)' }}>Carregando…</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200 }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#4B8EC8,#2E6EAB)' }}>
            <Wrench size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Acompanhamento de Implantação</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>
              Informe a data de instalação e o 1º vencimento — o sistema define o mês de pagamento da comissão.
            </p>
          </div>
        </div>

        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi label="Aguardando instalação" value={resumo.aguardando} color="#d97706" icon={Clock} />
            <Kpi label="Agendadas" value={resumo.agendada} color="#2563eb" icon={CalendarCheck} />
            <Kpi label="Instaladas" value={resumo.instalado} color="#16a34a" icon={CheckCircle} />
            <Kpi label="Total" value={resumo.total} color="#6b7280" icon={Wrench} />
          </div>
        )}

        <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--t-content-bg)', textAlign: 'left' }}>
                {['Cliente', 'Plano', 'Vendedor', 'Status', 'Instalação', '1º Vencimento', 'Comissão paga em', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--t-text-muted)' }}>
                  Nenhuma implantação ainda. Elas aparecem aqui quando um contrato é assinado.
                </td></tr>
              )}
              {lista.map(i => {
                const cfg = STATUS[i.status] || STATUS.AGUARDANDO_INSTALACAO;
                return (
                  <tr key={i.id} style={{ borderTop: '1px solid var(--t-card-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--t-text-primary)' }}>{i.cliente_razao_social}</div>
                      {i.cliente_cnpj && <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{i.cliente_cnpj}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{i.plano || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{i.vendedor_nome || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 999 }}>{cfg.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{fmtData(i.data_instalacao)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--t-text-muted)' }}>{fmtData(i.data_primeiro_vencimento)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: i.mes_pagamento_comissao ? '#2E6EAB' : 'var(--t-text-muted)' }}>{fmtMes(i.mes_pagamento_comissao)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button onClick={() => abrir(i)} style={{ fontSize: 12, fontWeight: 600, color: '#2E6EAB', background: 'transparent', border: '1px solid #c7d8ec', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
                        Informar datas
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal informar datas */}
        {sel && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setSel(null)}>
            <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, color: 'var(--t-text-primary)' }}>{sel.cliente_razao_social}</div>
                <button onClick={() => setSel(null)}><X size={16} style={{ color: 'var(--t-text-muted)' }} /></button>
              </div>
              <div style={{ padding: 20 }} className="space-y-3">
                <Campo label="Data de instalação">
                  <input type="date" value={form.data_instalacao} onChange={e => setForm((p: any) => ({ ...p, data_instalacao: e.target.value }))} className="ps-input w-full" />
                </Campo>
                <Campo label="1º vencimento da mensalidade">
                  <input type="date" value={form.data_primeiro_vencimento} onChange={e => setForm((p: any) => ({ ...p, data_primeiro_vencimento: e.target.value }))} className="ps-input w-full" />
                </Campo>
                {previewMesPag && (
                  <div style={{ background: '#EBF4FF', border: '1px solid #c7d8ec', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#2E6EAB' }}>
                    💰 Comissão será paga em <strong>{fmtMes(previewMesPag)}</strong> (mês seguinte ao 1º vencimento).
                  </div>
                )}
                <Campo label="Status">
                  <select value={form.status} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))} className="ps-input w-full">
                    {Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
                  </select>
                </Campo>
                <Campo label="Observações">
                  <textarea value={form.observacoes} onChange={e => setForm((p: any) => ({ ...p, observacoes: e.target.value }))} className="ps-input w-full" rows={2} />
                </Campo>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setSel(null)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'transparent', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={salvar} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, color, icon: Icon }: any) {
  return (
    <div className="ps-card p-3 rounded-xl flex items-center gap-3" style={{ border: '1px solid var(--t-card-border)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}><Icon size={16} style={{ color }} /></div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}
function Campo({ label, children }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--t-text-muted)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
