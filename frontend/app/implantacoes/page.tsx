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

const GRUPO_LABEL: Record<string, string> = {
  INSTALACAO: 'Instalação do Sistema',
  CONVERSAO: 'Conversão de Dados',
  TREINAMENTO: 'Treinamento',
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
  // Execução técnica (drawer detalhado)
  const [exec, setExec] = useState<any | null>(null);
  const [execTab, setExecTab] = useState<'trilha' | 'atividades' | 'testes' | 'arquivos' | 'checklist'>('trilha');
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [novaNota, setNovaNota] = useState('');
  const [novoArq, setNovoArq] = useState<{ nome: string; tipo: string; url: string }>({ nome: '', tipo: 'LINK', url: '' });
  const [novoChk, setNovoChk] = useState('');
  const [novoChkGrupo, setNovoChkGrupo] = useState('');

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

  // ── Execução técnica ──
  useEffect(() => {
    if (isAuthenticated) apiClient.getTecnicosImplantacao().then(r => setTecnicos(r.data?.data || [])).catch(() => {});
  }, [isAuthenticated]);

  const abrirExec = async (i: Implantacao) => {
    setExecTab('trilha');
    try {
      const r = await apiClient.getImplantacao(i.id);
      setExec(r.data.data);
    } catch { /* ignore */ }
  };
  const recarregarExec = async () => {
    if (!exec) return;
    const r = await apiClient.getImplantacao(exec.id);
    setExec(r.data.data);
    load();
  };
  const designar = async (tecnicoId: string) => {
    if (!exec || !tecnicoId) return;
    try { await apiClient.designarTecnico(exec.id, tecnicoId); await recarregarExec(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao designar.'); }
  };
  const moverEtapa = async (etapa: string) => { if (exec) { await apiClient.moverEtapaImplantacao(exec.id, etapa); await recarregarExec(); } };
  const treinamento = async (acao: 'INICIAR' | 'ENCERRAR') => { if (exec) { await apiClient.treinamentoImplantacao(exec.id, acao); await recarregarExec(); } };
  const addNota = async () => { if (exec && novaNota.trim()) { await apiClient.addAtividadeImplantacao(exec.id, novaNota.trim()); setNovaNota(''); await recarregarExec(); } };
  const setTeste = async (testeId: string, resultado: string) => { await apiClient.updateTesteImplantacao(testeId, { resultado }); await recarregarExec(); };
  const addArquivo = async () => { if (exec && novoArq.nome && novoArq.url) { await apiClient.addArquivoImplantacao(exec.id, novoArq); setNovoArq({ nome: '', tipo: 'LINK', url: '' }); await recarregarExec(); } };
  const delArquivo = async (aid: string) => { await apiClient.delArquivoImplantacao(aid); await recarregarExec(); };
  const addChk = async (grupo: string) => { if (exec && novoChk.trim()) { await apiClient.addChecklistImplantacao(exec.id, novoChk.trim(), grupo); setNovoChk(''); setNovoChkGrupo(''); await recarregarExec(); } };
  const toggleChk = async (itemId: string, feito: boolean) => { await apiClient.toggleChecklistImplantacao(itemId, feito); await recarregarExec(); };

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
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => abrir(i)} style={{ fontSize: 12, fontWeight: 600, color: '#2E6EAB', background: 'transparent', border: '1px solid #c7d8ec', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', marginRight: 6 }}>
                        Datas
                      </button>
                      <button onClick={() => abrirExec(i)} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#2E6EAB', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
                        Executar
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

        {/* Drawer de EXECUÇÃO técnica */}
        {exec && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setExec(null)}>
            <div style={{ background: 'var(--t-card-bg)', width: '100%', maxWidth: 640, height: '100%', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)', position: 'sticky', top: 0, background: 'var(--t-card-bg)', zIndex: 1 }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--t-text-primary)', fontSize: 16 }}>{exec.cliente_razao_social}</div>
                    <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{exec.plano || '—'} · Setup {fmtBRL(exec.valor_setup)}</div>
                    {/* Tipo da base: banco zerado x conversão (vem da proposta) */}
                    {exec.tipo_base && (
                      <div className="mt-1">
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: exec.tipo_base === 'CONVERSAO' ? '#fef3c7' : '#dcfce7',
                          color: exec.tipo_base === 'CONVERSAO' ? '#d97706' : '#16a34a' }}>
                          {exec.tipo_base === 'CONVERSAO'
                            ? `Conversão de dados${exec.sistema_anterior ? ` · de ${exec.sistema_anterior}` : ''}`
                            : 'Banco zerado (nova instalação)'}
                        </span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setExec(null)}><X size={18} style={{ color: 'var(--t-text-muted)' }} /></button>
                </div>

                {/* Designação + etapa */}
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Técnico:</span>
                  <select value={exec.tecnico_id || ''} onChange={e => designar(e.target.value)} className="ps-input" style={{ fontSize: 12, padding: '4px 8px' }}>
                    <option value="">Designar técnico…</option>
                    {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.cargo})</option>)}
                  </select>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2E6EAB', background: '#EBF4FF', padding: '3px 8px', borderRadius: 999 }}>{exec.etapa_execucao}</span>
                </div>

                {/* Botões de etapa */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {['EM_ANALISE', 'EM_CONVERSAO', 'EM_CONFIGURACAO', 'FINALIZADO'].map(et => (
                    <button key={et} onClick={() => moverEtapa(et)} disabled={!exec.tecnico_id}
                      style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: exec.tecnico_id ? 'pointer' : 'not-allowed',
                        border: '1px solid var(--t-card-border)', background: exec.etapa_execucao === et ? '#2E6EAB' : 'transparent', color: exec.etapa_execucao === et ? '#fff' : 'var(--t-text-muted)' }}>
                      {et.replace('EM_', '').replace('_', ' ')}
                    </button>
                  ))}
                  {!exec.treinamento_inicio
                    ? <button onClick={() => treinamento('INICIAR')} disabled={!exec.tecnico_id} style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer' }}>▶ Iniciar treinamento</button>
                    : !exec.treinamento_fim
                      ? <button onClick={() => treinamento('ENCERRAR')} style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#d97706', color: '#fff', cursor: 'pointer' }}>■ Encerrar treinamento</button>
                      : <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>✓ Treinamento concluído</span>}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-3" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                  {([['trilha', 'Trilha'], ['atividades', 'Atividades'], ['testes', 'Testes'], ['arquivos', 'Arquivos'], ['checklist', 'Checklist']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setExecTab(k)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer',
                      borderBottom: execTab === k ? '2px solid #2E6EAB' : '2px solid transparent', color: execTab === k ? '#2E6EAB' : 'var(--t-text-muted)' }}>{label}</button>
                  ))}
                </div>
              </div>

              <div style={{ padding: 20 }}>
                {/* TRILHA DE TEMPO */}
                {execTab === 'trilha' && exec.trilha && (
                  <div className="grid grid-cols-2 gap-3">
                    <TrilhaCard label="Negociação → assinatura" dias={exec.trilha.negociacao_dias} cor="#2563eb" />
                    <TrilhaCard label="Implantação (assinatura → instalado)" dias={exec.trilha.implantacao_dias} cor="#d97706" />
                    <TrilhaCard label="Treinamento (início → fim)" dias={exec.trilha.treinamento_dias} cor="#7c3aed" />
                    <TrilhaCard label="Tempo total do ciclo" dias={exec.trilha.total_dias} cor="#16a34a" />
                  </div>
                )}

                {/* ATIVIDADES */}
                {execTab === 'atividades' && (
                  <div>
                    <div className="flex gap-2 mb-3">
                      <input value={novaNota} onChange={e => setNovaNota(e.target.value)} placeholder="Registrar atividade/nota…" className="ps-input flex-1" />
                      <button onClick={addNota} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer' }}>Registrar</button>
                    </div>
                    <div className="space-y-2">
                      {(exec.atividades || []).map((a: any) => (
                        <div key={a.id} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                          <div style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{a.descricao}</div>
                          <div style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 2 }}>{a.autor_nome || '—'} · {new Date(a.created_at).toLocaleString('pt-BR')}</div>
                        </div>
                      ))}
                      {(!exec.atividades || exec.atividades.length === 0) && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhuma atividade ainda.</p>}
                    </div>
                  </div>
                )}

                {/* TESTES DE CONVERSÃO */}
                {execTab === 'testes' && (
                  <div className="space-y-2">
                    {(exec.testes || []).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--t-card-border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{t.item}</span>
                        <div className="flex gap-1">
                          {[['OK', '#16a34a'], ['DIVERGENTE', '#dc2626'], ['NAO_APLICA', '#9ca3af'], ['PENDENTE', '#d97706']].map(([r, c]) => (
                            <button key={r} onClick={() => setTeste(t.id, r as string)}
                              style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${c}`,
                                background: t.resultado === r ? c as string : 'transparent', color: t.resultado === r ? '#fff' : c as string }}>
                              {r === 'NAO_APLICA' ? 'N/A' : r}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ARQUIVOS */}
                {execTab === 'arquivos' && (
                  <div>
                    <div className="grid grid-cols-12 gap-2 mb-3">
                      <input value={novoArq.nome} onChange={e => setNovoArq(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className="ps-input col-span-4" />
                      <select value={novoArq.tipo} onChange={e => setNovoArq(p => ({ ...p, tipo: e.target.value }))} className="ps-input col-span-3">
                        <option value="LINK">Link</option><option value="ANEXO">Anexo (URL)</option>
                      </select>
                      <input value={novoArq.url} onChange={e => setNovoArq(p => ({ ...p, url: e.target.value }))} placeholder="URL" className="ps-input col-span-4" />
                      <button onClick={addArquivo} style={{ borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer' }} className="col-span-1">+</button>
                    </div>
                    <div className="space-y-2">
                      {(exec.arquivos || []).map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--t-card-border)' }}>
                          <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#2E6EAB', fontWeight: 600 }}>📎 {a.nome} ↗</a>
                          <button onClick={() => delArquivo(a.id)} style={{ fontSize: 11, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer' }}>remover</button>
                        </div>
                      ))}
                      {(!exec.arquivos || exec.arquivos.length === 0) && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhum arquivo. Adicione anexos (URL) ou links que o técnico vai baixar.</p>}
                    </div>
                  </div>
                )}

                {/* CHECKLIST */}
                {execTab === 'checklist' && (
                  <div className="space-y-5">
                    {(exec.grupos || []).map((g: any) => (
                      <div key={g.grupo}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--t-text-primary)' }}>{GRUPO_LABEL[g.grupo] || g.grupo}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: g.progresso === 100 ? '#16a34a' : '#2E6EAB' }}>{g.progresso}% · {g.feitos}/{g.total}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'var(--t-card-border)', marginBottom: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${g.progresso}%`, height: '100%', background: g.progresso === 100 ? '#16a34a' : '#2E6EAB' }} />
                        </div>
                        <div className="space-y-1">
                          {g.itens.map((c: any) => (
                            <label key={c.id} className="flex items-start gap-2" style={{ cursor: 'pointer', padding: '3px 4px' }}>
                              <input type="checkbox" checked={c.feito} onChange={e => toggleChk(c.id, e.target.checked)} style={{ marginTop: 3 }} />
                              <span style={{ fontSize: 12.5, color: 'var(--t-text-primary)', textDecoration: c.feito ? 'line-through' : 'none', opacity: c.feito ? .55 : 1 }}>{c.titulo}</span>
                            </label>
                          ))}
                          <div className="flex gap-2 mt-1.5">
                            <input value={novoChkGrupo === g.grupo ? novoChk : ''} onFocus={() => setNovoChkGrupo(g.grupo)} onChange={e => { setNovoChkGrupo(g.grupo); setNovoChk(e.target.value); }}
                              placeholder="Adicionar item…" className="ps-input flex-1" style={{ fontSize: 12 }} />
                            <button onClick={() => addChk(g.grupo)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#2E6EAB', color: '#fff', border: 'none', cursor: 'pointer' }}>+</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!exec.grupos || exec.grupos.length === 0) && (
                      <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Designe um técnico para gerar a trilha de implantação (Instalação, Conversão e Treinamento).</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function TrilhaCard({ label, dias, cor }: { label: string; dias: number | null; cor: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${cor}33`, background: `${cor}0d` }}>
      <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: cor }}>{dias == null ? '—' : `${dias}`}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 4 }}>{dias == null ? '' : 'dia(s)'}</span></div>
    </div>
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
