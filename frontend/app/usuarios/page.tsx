'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

// ─── Constants ────────────────────────────────────────────────
const MODULOS = [
  'Dashboard Geral','Empresas / Clientes','Contatos','Histórico de Solicitações',
  'Nova Solicitação de Serviço','Atendimento / Suporte','Leads','Propostas',
  'Contratos','Comercial / Funil','Metas','Ranking','Relatórios Comerciais',
  'Relatórios Técnicos','Relatórios Financeiros','Financeiro','Comissões / Bônus',
  'Cancelamentos / Churn','Usuários e Permissões','Configurações do Sistema',
  'Integrações','Aplicativos & Ferramentas'
];

const MODULOS_CRITICOS = new Set([
  'Usuários e Permissões','Configurações do Sistema','Financeiro',
  'Relatórios Financeiros','Comissões / Bônus','Integrações'
]);

const CARGOS = [
  { value: 'CEO', label: 'CEO', color: '#7c3aed' },
  { value: 'SUPERVISAO_COMERCIAL', label: 'Supervisão Comercial', color: '#2563eb' },
  { value: 'SUPERVISAO_TECNICA', label: 'Supervisão Técnica', color: '#0891b2' },
  { value: 'TECNICO_SUPORTE', label: 'Técnico Suporte', color: '#d97706' },
  { value: 'TECNICO_IMPLANTACAO', label: 'Técnico de Implantação', color: '#0d9488' },
  { value: 'VENDEDOR', label: 'Vendedor', color: '#16a34a' },
];

const CARGO_COLORS: Record<string, string> = Object.fromEntries(CARGOS.map(c => [c.value, c.color]));
const CARGO_LABELS: Record<string, string> = Object.fromEntries(CARGOS.map(c => [c.value, c.label]));

const STATUS_OPTS = ['ATIVO','INATIVO','SUSPENSO'] as const;
const STATUS_COLORS: Record<string, string> = { ATIVO: '#22c55e', INATIVO: '#6b7280', SUSPENSO: '#ef4444' };

const CLASSIFICACOES = [
  { value: 'N1', label: 'N1 — Primeiro atendimento e demandas simples' },
  { value: 'N2', label: 'N2 — Atendimento intermediário e operacional' },
  { value: 'N3', label: 'N3 — Atendimento avançado e suporte complexo' },
];

const PERM_COLS = ['ver','criar','editar','excluir','exportar','administrar'] as const;
type PermCol = typeof PERM_COLS[number];
type Alcance = 'proprio'|'grupo'|'todos';
type Perm = Record<PermCol, boolean> & { alcance: Alcance };
type ModulosPermissao = Record<string, Perm>;

// ─── Types ────────────────────────────────────────────────────
interface Usuario {
  id: string; nome: string; email: string; telefone?: string;
  cargo: string; classificacao?: string; status: string;
  observacoes?: string; modulos_permissao: ModulosPermissao;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────
const permVazia = (): Perm => ({ ver: false, criar: false, editar: false, excluir: false, exportar: false, administrar: false, alcance: 'proprio' });

function buildEmptyPerms(): ModulosPermissao {
  return Object.fromEntries(MODULOS.map(m => [m, permVazia()]));
}

function applyPreset(preset: ModulosPermissao | null): ModulosPermissao {
  const base = buildEmptyPerms();
  if (!preset) return base;
  for (const [mod, perm] of Object.entries(preset)) {
    if (base[mod]) base[mod] = { ...permVazia(), ...perm };
  }
  return base;
}

function countModulosAtivos(perms: ModulosPermissao): number {
  return Object.values(perms).filter(p => p.ver || p.criar || p.editar || p.excluir || p.exportar || p.administrar).length;
}

function hasPermCritica(perms: ModulosPermissao): string[] {
  return Object.entries(perms)
    .filter(([mod, p]) => MODULOS_CRITICOS.has(mod) && (p.ver || p.criar || p.editar || p.excluir || p.exportar || p.administrar))
    .map(([mod]) => mod);
}

// ─── Component ────────────────────────────────────────────────
export default function UsuariosPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [presets, setPresets] = useState<Record<string, ModulosPermissao>>({});
  const [fetching, setFetching] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCritica, setConfirmCritica] = useState<string[] | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ senha: string; email: string; nome: string } | null>(null);
  const [excluindo, setExcluindo] = useState<{ id: string; nome: string; vinculos: Record<string, number>; total: number } | null>(null);
  const [confirmNomeInput, setConfirmNomeInput] = useState('');
  const [excluindoLoading, setExcluindoLoading] = useState(false);

  // Form
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', cargo: '', classificacao: '', status: 'ATIVO', observacoes: ''
  });
  const [perms, setPerms] = useState<ModulosPermissao>(buildEmptyPerms());

  const ROLES_GESTOR = ['CEO', 'DIRETOR', 'ADMIN', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA'];
  const isGestor = ROLES_GESTOR.some(r => user?.role?.includes(r));

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = useCallback(async () => {
    setFetching(true);
    // Busca isolada — uma falha não derruba a outra nem esvazia listas existentes
    try {
      const usersRes = await apiClient.client.get('/usuarios');
      const arr = usersRes.data?.data;
      if (Array.isArray(arr)) {
        // Filtra o mock user-jessica (não é usuário gerenciável neste módulo)
        setUsuarios(arr.filter((u: any) => u.id !== 'user-jessica'));
      }
    } catch (e: any) {
      console.error('[USUARIOS] erro ao carregar lista:', e?.response?.data || e?.message);
      // NÃO esvazia a lista — mantém a anterior
    }
    try {
      const presetsRes = await apiClient.client.get('/usuarios/presets');
      const p = presetsRes.data?.data?.presets;
      if (p) setPresets(p);
    } catch (e: any) {
      console.error('[USUARIOS] erro ao carregar presets:', e?.response?.data || e?.message);
    }
    setFetching(false);
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ nome: '', telefone: '', email: '', cargo: '', classificacao: '', status: 'ATIVO', observacoes: '' });
    setPerms(buildEmptyPerms());
    setShowModal(true);
  };

  const openEdit = (u: Usuario) => {
    setEditingId(u.id);
    setForm({ nome: u.nome, telefone: u.telefone || '', email: u.email, cargo: u.cargo, classificacao: u.classificacao || '', status: u.status, observacoes: u.observacoes || '' });
    setPerms(applyPreset(u.modulos_permissao as any));
    setShowModal(true);
  };

  const handleCargoChange = (cargo: string) => {
    setForm(f => ({ ...f, cargo, classificacao: '' }));
    // Sugerir preset
    const presetKey = cargo === 'TECNICO_SUPORTE' ? 'TECNICO_N1' : cargo;
    setPerms(applyPreset(presets[presetKey] || null));
  };

  const handleClassificacaoChange = (cl: string) => {
    setForm(f => ({ ...f, classificacao: cl }));
    if (form.cargo === 'TECNICO_SUPORTE' && cl) {
      setPerms(applyPreset(presets[`TECNICO_${cl}`] || null));
    }
  };

  const applyPresetBtn = (key: string) => {
    setPerms(applyPreset(presets[key] || null));
  };

  const togglePerm = (modulo: string, col: PermCol) => {
    setPerms(prev => ({
      ...prev,
      [modulo]: { ...prev[modulo], [col]: !prev[modulo][col] }
    }));
  };

  const setAlcance = (modulo: string, alcance: Alcance) => {
    setPerms(prev => ({ ...prev, [modulo]: { ...prev[modulo], alcance } }));
  };

  const handleSave = () => {
    // Verificar permissões críticas
    const criticas = hasPermCritica(perms);
    if (!editingId && criticas.length > 0) {
      setConfirmCritica(criticas);
      return;
    }
    doSave();
  };

  const doSave = async () => {
    setSaving(true);
    setConfirmCritica(null);
    try {
      const payload = { ...form, classificacao: form.classificacao || null, modulos_permissao: perms };
      if (editingId) {
        const { email: _e, ...updatePayload } = payload as any;
        await apiClient.client.patch(`/usuarios/${editingId}`, updatePayload);
        await fetchData();
        setShowModal(false);
      } else {
        const res = await apiClient.client.post('/usuarios', payload);
        const { senha_gerada, nome, email } = res.data.data;
        await fetchData();
        setShowModal(false);
        setSenhaGerada({ senha: senha_gerada, email, nome });
      }
    } catch (e: any) {
      console.error('Erro ao salvar', e);
    } finally { setSaving(false); }
  };

  const handleDesativar = async (id: string, nome: string) => {
    if (!confirm(`Desativar o usuário "${nome}"?`)) return;
    try {
      await apiClient.client.post(`/usuarios/${id}/desativar`);
      await fetchData();
    } catch { }
  };

  const VINCULO_LABELS: Record<string, string> = {
    leads: 'Leads', atividades: 'Atividades', comissoes: 'Comissões',
    propostas: 'Propostas comerciais', vendasAdicionais: 'Vendas adicionais', contratos: 'Contratos',
  };

  const handleExcluirClick = async (id: string, nome: string) => {
    try {
      const res = await apiClient.client.get(`/usuarios/${id}/vinculos`);
      const { vinculos, total } = res.data.data;
      setExcluindo({ id, nome, vinculos, total });
      setConfirmNomeInput('');
    } catch {
      alert('Não foi possível verificar os vínculos deste usuário. Tente novamente.');
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    setExcluindoLoading(true);
    try {
      const params = excluindo.total > 0 ? { confirmar_nome: confirmNomeInput } : {};
      await apiClient.client.delete(`/usuarios/${excluindo.id}`, { params });
      setExcluindo(null);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao excluir usuário');
    } finally {
      setExcluindoLoading(false);
    }
  };

  const handleRedefinirSenha = async (id: string) => {
    if (!confirm('Gerar nova senha aleatória para este usuário?')) return;
    try {
      const res = await apiClient.client.post(`/usuarios/${id}/redefinir-senha`);
      const { nova_senha, email } = res.data.data;
      const u = usuarios.find(u => u.id === id);
      setSenhaGerada({ senha: nova_senha, email, nome: u?.nome || '' });
    } catch { }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--t-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* ─── Header ─────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Usuários e Permissões</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Gerencie usuários, cargos, classificações e módulos de acesso</p>
          </div>
          {isGestor && (
            <button onClick={openCreate}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--t-primary)' }}>
              + Cadastrar Usuário
            </button>
          )}
        </div>

        {!isGestor && (
          <div className="rounded-xl border p-4 text-sm" style={{ background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>
            ⚠ Você tem permissão apenas de leitura. Apenas CEO e Supervisores podem cadastrar e editar usuários.
          </div>
        )}

        {/* ─── Tabela ──────────────────────────── */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
          {fetching ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>Carregando...</div>
          ) : usuarios.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">👤</div>
              <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Nenhum usuário cadastrado</p>
              {isGestor && (
                <button onClick={openCreate} className="mt-4 px-4 py-2 rounded-lg text-white text-sm" style={{ background: 'var(--t-primary)' }}>
                  Cadastrar primeiro usuário
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                  <tr>
                    {['Usuário','Cargo','Classificação','Módulos liberados','Status','Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, i) => (
                    <tr key={u.id}
                      style={{ borderBottom: i < usuarios.length - 1 ? '1px solid var(--t-card-border)' : undefined,
                        background: i % 2 === 0 ? 'var(--t-card-bg)' : 'var(--t-content-bg)' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ background: CARGO_COLORS[u.cargo] || '#6b7280' }}>
                            {u.nome[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm" style={{ color: 'var(--t-text-primary)' }}>{u.nome}</p>
                            <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{u.email}</p>
                            {u.telefone && <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{u.telefone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-medium text-white"
                          style={{ background: CARGO_COLORS[u.cargo] || '#6b7280' }}>
                          {CARGO_LABELS[u.cargo] || u.cargo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.classificacao ? (
                          <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ background: '#fef3c7', color: '#92400e' }}>
                            {u.classificacao}
                          </span>
                        ) : <span style={{ color: 'var(--t-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium" style={{ color: 'var(--t-text-primary)' }}>
                          {countModulosAtivos(u.modulos_permissao || {})} módulos
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-medium text-white"
                          style={{ background: STATUS_COLORS[u.status] || '#6b7280' }}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isGestor ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => openEdit(u)} className="text-xs hover:underline" style={{ color: 'var(--t-primary)' }}>Editar</button>
                            <button onClick={() => handleRedefinirSenha(u.id)} className="text-xs hover:underline" style={{ color: '#f59e0b' }}>Resetar senha</button>
                            {u.status === 'ATIVO' && (
                              <button onClick={() => handleDesativar(u.id, u.nome)} className="text-xs text-red-500 hover:text-red-700">Desativar</button>
                            )}
                            <button onClick={() => handleExcluirClick(u.id, u.nome)} className="text-xs text-red-700 hover:underline font-medium">Excluir</button>
                          </div>
                        ) : (
                          <button onClick={() => openEdit(u)} className="text-xs hover:underline" style={{ color: 'var(--t-text-muted)' }}>Ver permissões</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          MODAL: Cadastrar / Editar Usuário
      ═══════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}>
          <div className="w-full max-w-4xl rounded-2xl shadow-2xl my-6"
            style={{ background: 'var(--t-card-bg)' }} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--t-card-border)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>
                {editingId ? 'Editar Usuário' : 'Cadastrar Usuário'}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-sm" style={{ color: 'var(--t-text-muted)' }}>✕</button>
            </div>

            <div className="p-6 space-y-6">
              {/* ── Seção 1: Dados ──────────────── */}
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--t-text-primary)' }}>Dados do usuário</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Nome completo *</label>
                    <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                      placeholder="Nome completo" disabled={!isGestor}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Telefone *</label>
                    <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                      placeholder="(27) 99999-0000" disabled={!isGestor}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>E-mail *</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="usuario@prosystem.com.br" disabled={!isGestor || !!editingId}
                      className="w-full px-3 py-2 border rounded-lg text-sm disabled:opacity-60"
                      style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Cargo *</label>
                    <select value={form.cargo} onChange={e => handleCargoChange(e.target.value)} disabled={!isGestor}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                      <option value="">Selecione o cargo</option>
                      {CARGOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} disabled={!isGestor}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                      {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Classificação condicional */}
                  {form.cargo === 'TECNICO_SUPORTE' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Classificação do suporte</label>
                      <div className="flex gap-3">
                        {CLASSIFICACOES.map(cl => (
                          <label key={cl.value} className="flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-lg border flex-1"
                            style={form.classificacao === cl.value
                              ? { borderColor: '#d97706', background: '#fffbeb', color: '#92400e' }
                              : { borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                            <input type="radio" name="classificacao" value={cl.value} checked={form.classificacao === cl.value}
                              onChange={() => handleClassificacaoChange(cl.value)} disabled={!isGestor} />
                            <span className="text-xs">{cl.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Observações</label>
                    <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                      rows={2} disabled={!isGestor}
                      placeholder="Ex: Usuário responsável por clientes estratégicos, acesso temporário, em treinamento..."
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                      style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                </div>
              </div>

              {/* ── Seção 2: Presets rápidos ────── */}
              {isGestor && (
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--t-text-primary)' }}>Aplicar permissões por perfil</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'CEO', label: 'CEO' },
                      { key: 'SUPERVISAO_COMERCIAL', label: 'Sup. Comercial' },
                      { key: 'SUPERVISAO_TECNICA', label: 'Sup. Técnica' },
                      { key: 'TECNICO_N1', label: 'Técnico N1' },
                      { key: 'TECNICO_N2', label: 'Técnico N2' },
                      { key: 'TECNICO_N3', label: 'Técnico N3' },
                      { key: 'VENDEDOR', label: 'Vendedor' },
                    ].map(p => (
                      <button key={p.key} type="button" onClick={() => applyPresetBtn(p.key)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)', background: 'var(--t-card-bg)' }}>
                        {p.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => setPerms(buildEmptyPerms())}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border text-red-500"
                      style={{ borderColor: '#fca5a5' }}>
                      Limpar tudo
                    </button>
                  </div>
                </div>
              )}

              {/* ── Seção 3: Checklist de módulos ─ */}
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--t-text-primary)' }}>Liberação de Módulos</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--t-text-muted)' }}>
                  Marque os módulos que este usuário poderá acessar. As permissões foram sugeridas com base no cargo, mas podem ser ajustadas manualmente.
                </p>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--t-card-border)' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--t-text-muted)', minWidth: 180 }}>Módulo</th>
                          <th className="px-2 py-2 text-center font-semibold" style={{ color: 'var(--t-text-muted)', minWidth: 90 }}>Alcance</th>
                          {PERM_COLS.map(col => (
                            <th key={col} className="px-2 py-2 text-center font-semibold capitalize" style={{ color: 'var(--t-text-muted)', minWidth: 52 }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MODULOS.map((mod, i) => {
                          const p = perms[mod] || permVazia();
                          const ativo = PERM_COLS.some(col => p[col]);
                          const critico = MODULOS_CRITICOS.has(mod);
                          return (
                            <tr key={mod}
                              style={{
                                borderBottom: i < MODULOS.length - 1 ? '1px solid var(--t-card-border)' : undefined,
                                background: ativo
                                  ? (critico ? 'color-mix(in srgb, #ef4444 5%, var(--t-card-bg))' : 'color-mix(in srgb, var(--t-primary) 5%, var(--t-card-bg))')
                                  : (i % 2 === 0 ? 'var(--t-card-bg)' : 'var(--t-content-bg)')
                              }}>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  {critico && <span title="Permissão crítica" style={{ color: '#ef4444' }}>⚠</span>}
                                  <span style={{ color: 'var(--t-text-primary)', fontWeight: ativo ? '600' : '400' }}>{mod}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <select value={p.alcance} onChange={e => setAlcance(mod, e.target.value as Alcance)}
                                  disabled={!isGestor || !ativo}
                                  className="text-xs px-1 py-1 border rounded disabled:opacity-40"
                                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-secondary)', width: 82 }}>
                                  <option value="proprio">Próprio</option>
                                  <option value="grupo">Grupo</option>
                                  <option value="todos">Todos</option>
                                </select>
                              </td>
                              {PERM_COLS.map(col => (
                                <td key={col} className="px-2 py-2 text-center">
                                  <input type="checkbox" checked={p[col]} onChange={() => togglePerm(mod, col)}
                                    disabled={!isGestor}
                                    className="w-3.5 h-3.5 cursor-pointer"
                                    style={{ accentColor: critico ? '#ef4444' : 'var(--t-primary)' }} />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--t-text-muted)' }}>
                  ⚠ Módulos marcados em vermelho são permissões críticas que concedem acesso a dados sensíveis.
                </p>
              </div>

              {/* ── Ações ────────────────────────── */}
              {isGestor && (
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--t-text-secondary)' }}>Cancelar</button>
                  <button onClick={handleSave}
                    disabled={saving || !form.nome || !form.email || !form.cargo}
                    className="px-5 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                    style={{ background: 'var(--t-primary)' }}>
                    {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar Usuário'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Confirmação permissões críticas ══════════ */}
      {confirmCritica && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--t-card-bg)' }}>
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--t-text-primary)' }}>Permissões sensíveis detectadas</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--t-text-muted)' }}>
              Este usuário receberá acesso a módulos que contêm dados sensíveis. Confirma a liberação?
            </p>
            <ul className="mb-4 space-y-1">
              {confirmCritica.map(m => (
                <li key={m} className="text-xs font-medium text-red-600 flex items-center gap-1.5">
                  <span>⚠</span> {m}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmCritica(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                Cancelar e revisar
              </button>
              <button onClick={doSave} className="px-4 py-2 text-sm rounded-lg text-white font-medium bg-red-500 hover:bg-red-600">
                Confirmar e salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Confirmação de exclusão de usuário ═══════ */}
      {excluindo && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: 'var(--t-card-bg)' }}>
            <div className="text-3xl mb-3">{excluindo.total > 0 ? '⚠️' : '🗑️'}</div>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--t-text-primary)' }}>
              Excluir "{excluindo.nome}"?
            </h3>

            {excluindo.total > 0 ? (
              <>
                <p className="text-sm mb-3" style={{ color: 'var(--t-text-muted)' }}>
                  Este usuário possui dados gerados no sistema. Excluí-lo <strong>não apaga</strong> esses registros, mas eles ficarão sem responsável vinculado:
                </p>
                <ul className="mb-4 space-y-1 rounded-lg p-3" style={{ background: 'var(--t-content-bg)' }}>
                  {Object.entries(excluindo.vinculos).filter(([, v]) => v > 0).map(([k, v]) => (
                    <li key={k} className="text-xs font-medium flex items-center justify-between" style={{ color: 'var(--t-text-secondary)' }}>
                      <span>{VINCULO_LABELS[k] || k}</span>
                      <span className="font-bold text-red-600">{v}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs mb-2" style={{ color: 'var(--t-text-muted)' }}>
                  Considere <strong>Desativar</strong> em vez de excluir, para manter o histórico rastreável. Se ainda assim quiser excluir, digite o nome exato do usuário abaixo:
                </p>
                <input
                  value={confirmNomeInput}
                  onChange={e => setConfirmNomeInput(e.target.value)}
                  placeholder={excluindo.nome}
                  className="w-full px-3 py-2 border rounded-lg text-sm mb-4"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                />
              </>
            ) : (
              <p className="text-sm mb-4" style={{ color: 'var(--t-text-muted)' }}>
                Este usuário não possui dados vinculados (leads, propostas, contratos, comissões ou atividades). A exclusão é segura.
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setExcluindo(null)} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                disabled={excluindoLoading || (excluindo.total > 0 && confirmNomeInput.trim() !== excluindo.nome)}
                className="px-4 py-2 text-sm rounded-lg text-white font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {excluindoLoading ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Senha gerada ═════════════════════════════ */}
      {senhaGerada && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center" style={{ background: 'var(--t-card-bg)' }}>
            <div className="text-4xl mb-3">🔐</div>
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--t-text-primary)' }}>
              {senhaGerada.nome ? `Usuário ${senhaGerada.nome} criado!` : 'Nova senha gerada!'}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--t-text-muted)' }}>
              Informe a senha ao usuário. Ela não será exibida novamente.
            </p>
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--t-content-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--t-text-muted)' }}>E-mail</p>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--t-text-primary)' }}>{senhaGerada.email}</p>
              <p className="text-xs mb-1" style={{ color: 'var(--t-text-muted)' }}>Senha gerada</p>
              <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: 'var(--t-primary)' }}>{senhaGerada.senha}</p>
            </div>
            <button onClick={() => setSenhaGerada(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--t-primary)' }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
