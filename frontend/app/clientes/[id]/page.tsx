'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

// ─── Constants ────────────────────────────────────────────────
const FERRAMENTAS_LISTA = [
  'API Domínios','Backup Mega - Externo - Terminal','CoteFácil','D-Pharma',
  'Dashboard - Painel de Aferição de Indicadores','E-Diretor','Ello Mais','EntregaFarma',
  'Farmácia Popular Prosystem','Farmácias App','Fidelimax','Figura Fiscal Avanti',
  'Gerencial','Ifood','Imendes','Melhor Compra','Monnera','MultiFarma','MyPharma',
  'Napp Esphera','Napp Solution Google','PAC Arquivos Fiscais','Pgfarma',
  'Plano Basic','Plano Plus','Plano Pro','Prosystem MEI','QMoleza','Rede Soma',
  'Rise','SmartPed','Tray','WebDecisor','Woo Commerce'
];

const REDES_OPCOES = ['Facebook','Instagram','WhatsApp','Telegram','LinkedIn','TikTok','YouTube','Twitter/X'];

const TIPOS_SERVICO: Record<string, string[]> = {
  'Suporte técnico': ['Sistema não abre','Erro de acesso','Lentidão','Falha no PDV','Problema com impressora','Problema de caixa','Problema de usuário/senha'],
  'Fiscal': ['Erro NFE','Erro NFC-e','Certificado digital','Rejeição fiscal','Tributação','SAT/ECF/NFE','Farmácia Popular'],
  'Financeiro': ['Boleto','Segunda via','Cobrança','Negociação','Mensalidade','Inadimplência','Cancelamento financeiro'],
  'Comercial': ['Upgrade Plano Plus','Plano Pro','Novo módulo','Proposta enviada','Negociação em andamento','Cliente interessado em ferramenta'],
  'Implantação': ['Conversão de dados','Virada de sistema','Configuração inicial','Treinamento inicial','Migração'],
  'Treinamento': ['Dúvida de uso','Orientação de módulo','Reforço operacional'],
  'Cadastro': ['Alteração razão social','Alteração CNPJ','Atualização contatos','Alteração endereço','Alteração responsável'],
  'Integrações': ['Ifood','Imendes','PBM','Farmácia Popular','APIs','E-commerce'],
  'Cancelamento': ['Pedido cancelamento','Risco churn','Tentativa retenção'],
  'Ferramentas': ['Dashboard','Plano Pro','Plano Plus','Gerencial','Aplicativos adicionais'],
};

const STATUS_OPTIONS = [
  { value: 'ABERTA', label: 'Aberta', color: '#3b82f6' },
  { value: 'EM_ATENDIMENTO', label: 'Em Atendimento', color: '#f59e0b' },
  { value: 'AGUARDANDO_CLIENTE', label: 'Ag. Cliente', color: '#8b5cf6' },
  { value: 'AGUARDANDO_SUPORTE_INTERNO', label: 'Ag. Suporte Interno', color: '#6366f1' },
  { value: 'AGUARDANDO_FINANCEIRO', label: 'Ag. Financeiro', color: '#ec4899' },
  { value: 'AGUARDANDO_COMERCIAL', label: 'Ag. Comercial', color: '#14b8a6' },
  { value: 'FINALIZADA', label: 'Finalizada', color: '#22c55e' },
  { value: 'CANCELADA', label: 'Cancelada', color: '#ef4444' },
  { value: 'REABERTA', label: 'Reaberta', color: '#f97316' },
];

const PRIORIDADE_OPTIONS = [
  { value: 'BAIXA', label: 'Baixa', color: '#22c55e' },
  { value: 'MEDIA', label: 'Média', color: '#f59e0b' },
  { value: 'ALTA', label: 'Alta', color: '#ef4444' },
  { value: 'URGENTE', label: 'Urgente', color: '#7c3aed' },
];

const UF_OPTIONS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

// ─── Types ────────────────────────────────────────────────────
interface ContatoCliente { id: string; nome: string; telefone?: string; }
interface SolicitacaoServico {
  id: string; tipo_servico: string; subtipo?: string; prioridade: string; status: string;
  contato_solicitante?: string; contato_telefone?: string; usuario_responsavel?: string;
  grupo_atendimento?: string; descricao?: string; observacao_interna?: string;
  data_solicitacao: string; data_finalizacao?: string;
}
interface ClienteDetalhe {
  id: string; codigo?: string; suporte?: string; nome: string; razao_social?: string;
  fantasia?: string; email: string; cnpj?: string; grupo?: string; ibge?: string;
  inscricao?: string; redes?: string[]; nfe?: boolean; ecf?: boolean;
  atencao_especial?: boolean; matriz?: boolean; observacao?: string; observacao_grupo?: string;
  ferramentas?: string[];
  cep?: string; endereco?: string; numero?: string; bairro?: string; cidade?: string;
  estado?: string; regiao?: string; complemento?: string;
  responsavel_nome?: string; responsavel_celular?: string;
  contador_nome?: string; contador_celular?: string; contador_telefone?: string; contador_email?: string;
  telefone?: string; created_at: string; _count?: { caso_churn: number };
  contatos: ContatoCliente[]; solicitacoes: SolicitacaoServico[];
  mensalidade_base?: number; observacoes_fin?: string;
  mensalidade?: {
    base: number; total_acrescimos: number; total: number;
    acrescimos: { id: string; valor: number; origem: string; categoria: string; status: string; data: string }[];
  };
}

type TabName = 'cadastro' | 'contatos' | 'historico' | 'endereco' | 'info' | 'financeiro';

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('pt-BR'); } catch { return s; }
}
function statusInfo(v: string) {
  return STATUS_OPTIONS.find(s => s.value === v) || { label: v, color: '#6b7280' };
}
function prioInfo(v: string) {
  return PRIORIDADE_OPTIONS.find(p => p.value === v) || { label: v, color: '#6b7280' };
}

// ─── Input component ──────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', disabled = false, cols = 1 }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean; cols?: number }) {
  return (
    <div className={cols === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm disabled:opacity-60"
        style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ClienteDetailPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [activeTab, setActiveTab] = useState<TabName>('cadastro');
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  // Cadastro form state
  const [form, setForm] = useState({
    codigo: '', suporte: '', nome: '', razao_social: '', fantasia: '', email: '', cnpj: '',
    grupo: '', ibge: '', inscricao: '', observacao: '', observacao_grupo: '', telefone: '',
    nfe: false, ecf: false, atencao_especial: false, matriz: false,
    redes: [] as string[], ferramentas: [] as string[],
  });

  // Endereço form
  const [endForm, setEndForm] = useState({
    cep: '', endereco: '', numero: '', bairro: '', cidade: '', estado: '', regiao: '', complemento: ''
  });

  // Informações adicionais form
  const [infoForm, setInfoForm] = useState({
    responsavel_nome: '', responsavel_celular: '',
    contador_nome: '', contador_celular: '', contador_telefone: '', contador_email: ''
  });
  // Financeiro: mensalidade base + observações (acréscimos vêm das vendas adicionais)
  const [finForm, setFinForm] = useState<{ mensalidade_base: string; observacoes_fin: string }>({ mensalidade_base: '', observacoes_fin: '' });

  // Contatos
  const [contatos, setContatos] = useState<ContatoCliente[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [addingContato, setAddingContato] = useState(false);

  // Histórico / Solicitações
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoServico[]>([]);
  const [showSolModal, setShowSolModal] = useState(false);
  const [solForm, setSolForm] = useState({
    contato_solicitante: '', contato_telefone: '', usuario_responsavel: '',
    tipo_servico: '', subtipo: '', prioridade: 'MEDIA', status: 'ABERTA',
    descricao: '', observacao_interna: '',
  });
  const [savingSol, setSavingSol] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => { if (id) fetchCliente(); }, [id]);

  const fetchCliente = useCallback(async () => {
    setFetching(true);
    try {
      const res = await apiClient.client.get(`/clientes/${id}`);
      const c: ClienteDetalhe = res.data.data;
      setCliente(c);
      setForm({
        codigo: c.codigo || '', suporte: c.suporte || '', nome: c.nome || '',
        razao_social: c.razao_social || '', fantasia: c.fantasia || '', email: c.email || '',
        cnpj: c.cnpj || '', grupo: c.grupo || '', ibge: c.ibge || '', inscricao: c.inscricao || '',
        observacao: c.observacao || '', observacao_grupo: c.observacao_grupo || '',
        telefone: c.telefone || '', nfe: !!c.nfe, ecf: !!c.ecf,
        atencao_especial: !!c.atencao_especial, matriz: !!c.matriz,
        redes: c.redes || [], ferramentas: c.ferramentas || [],
      });
      setEndForm({
        cep: c.cep || '', endereco: c.endereco || '', numero: c.numero || '',
        bairro: c.bairro || '', cidade: c.cidade || '', estado: c.estado || '',
        regiao: c.regiao || '', complemento: c.complemento || '',
      });
      setInfoForm({
        responsavel_nome: c.responsavel_nome || '', responsavel_celular: c.responsavel_celular || '',
        contador_nome: c.contador_nome || '', contador_celular: c.contador_celular || '',
        contador_telefone: c.contador_telefone || '', contador_email: c.contador_email || '',
      });
      setFinForm({
        mensalidade_base: c.mensalidade_base != null ? String(c.mensalidade_base) : '',
        observacoes_fin: c.observacoes_fin || '',
      });
      setContatos(c.contatos || []);
      setSolicitacoes(c.solicitacoes || []);
    } catch {
      setError('Erro ao carregar cliente');
    } finally {
      setFetching(false);
    }
  }, [id]);

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await apiClient.client.patch(`/clientes/${id}`, {
        ...form, ...endForm, ...infoForm,
        mensalidade_base: finForm.mensalidade_base !== '' ? parseFloat(finForm.mensalidade_base) : undefined,
        observacoes_fin: finForm.observacoes_fin || undefined,
      });
      setSaveMsg('Salvo com sucesso!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg('Erro ao salvar: ' + (e?.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const toggleFerramenta = (f: string) => {
    setForm(prev => ({
      ...prev,
      ferramentas: prev.ferramentas.includes(f)
        ? prev.ferramentas.filter(x => x !== f)
        : [...prev.ferramentas, f]
    }));
  };

  const toggleRede = (r: string) => {
    setForm(prev => ({
      ...prev,
      redes: prev.redes.includes(r)
        ? prev.redes.filter(x => x !== r)
        : [...prev.redes, r]
    }));
  };

  const handleAddContato = async () => {
    if (!novoNome.trim()) return;
    setAddingContato(true);
    try {
      const res = await apiClient.client.post(`/clientes/${id}/contatos`, { nome: novoNome, telefone: novoTelefone });
      setContatos(prev => [...prev, res.data.data]);
      setNovoNome(''); setNovoTelefone('');
    } catch { } finally { setAddingContato(false); }
  };

  const handleRemoveContato = async (cid: string) => {
    try {
      await apiClient.client.delete(`/clientes/${id}/contatos/${cid}`);
      setContatos(prev => prev.filter(c => c.id !== cid));
    } catch { }
  };

  const handleSaveSolicitacao = async () => {
    if (!solForm.tipo_servico) return;
    setSavingSol(true);
    try {
      const res = await apiClient.client.post(`/clientes/${id}/solicitacoes`, solForm);
      setSolicitacoes(prev => [res.data.data, ...prev]);
      setShowSolModal(false);
      setSolForm({ contato_solicitante: '', contato_telefone: '', usuario_responsavel: '', tipo_servico: '', subtipo: '', prioridade: 'MEDIA', status: 'ABERTA', descricao: '', observacao_interna: '' });
    } catch { } finally { setSavingSol(false); }
  };

  const handleBuscarCEP = async () => {
    const cep = endForm.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEndForm(f => ({
          ...f,
          endereco: data.logradouro || f.endereco,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
      }
    } catch { }
  };

  if (!isAuthenticated && !loading) return null;
  if (fetching) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--t-primary)', borderTopColor: 'transparent' }} />
      </div>
    </DashboardLayout>
  );
  if (error || !cliente) return (
    <DashboardLayout>
      <div className="p-8 text-center" style={{ color: 'var(--t-text-muted)' }}>{error || 'Cliente não encontrado'}</div>
    </DashboardLayout>
  );

  // ─── Derived ────────────────────────────────────────────────
  const ultimaSol = solicitacoes[0];
  const planoAtual = (form.ferramentas || []).find(f => f.startsWith('Plano ')) || '—';

  const TABS: { key: TabName; label: string }[] = [
    { key: 'cadastro', label: 'Cadastro' },
    { key: 'contatos', label: `Contatos (${contatos.length})` },
    { key: 'historico', label: `Histórico (${solicitacoes.length})` },
    { key: 'endereco', label: 'Endereço' },
    { key: 'info', label: 'Inf. Adicionais' },
    { key: 'financeiro', label: 'Mensalidade' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ─── Breadcrumb ─────────────────────── */}
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--t-text-muted)' }}>
          <button onClick={() => router.push('/clientes')} className="hover:underline">Clientes</button>
          <span>/</span>
          <span style={{ color: 'var(--t-text-primary)' }}>{form.fantasia || form.razao_social || form.nome}</span>
        </div>

        {/* ─── Header card ────────────────────── */}
        <div className="rounded-2xl border p-5 flex items-start justify-between gap-4 flex-wrap"
          style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'var(--t-primary)' }}>
              {(form.fantasia || form.nome || '?')[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--t-text-primary)' }}>
                {form.fantasia || form.razao_social || form.nome}
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {form.suporte && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">#{form.suporte}</span>}
                {form.cnpj && <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{form.cnpj}</span>}
                {form.grupo && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{form.grupo}</span>}
                {form.atencao_especial && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">⚠ Atenção especial</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveMsg && (
              <span className={`text-sm font-medium ${saveMsg.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
                {saveMsg}
              </span>
            )}
            {(form.telefone || infoForm.responsavel_celular) && (() => {
              const tel = (form.telefone || infoForm.responsavel_celular).replace(/\D/g, '');
              return (
                <a
                  href={`https://wa.me/55${tel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`WhatsApp: ${form.telefone || infoForm.responsavel_celular}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: '#25D366', textDecoration: 'none' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.532 5.847L.057 23.617a.75.75 0 0 0 .921.921l5.696-1.489A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.667-.523-5.181-1.432l-.371-.218-3.383.885.898-3.285-.237-.385A9.958 9.958 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  WhatsApp
                </a>
              );
            })()}
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--t-primary)' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* ─── Tabs ───────────────────────────── */}
        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--t-card-border)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === t.key ? 'border-b-2 -mb-px' : 'opacity-60 hover:opacity-90'}`}
              style={activeTab === t.key
                ? { borderColor: 'var(--t-primary)', color: 'var(--t-primary)' }
                : { color: 'var(--t-text-secondary)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════
            TAB: CADASTRO
        ═══════════════════════════════════════ */}
        {activeTab === 'cadastro' && (
          <div className="space-y-5">
            {/* Identificação */}
            <Section title="Identificação">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Código" value={form.codigo} onChange={v => setForm(f => ({ ...f, codigo: v }))} placeholder="ex: 001" />
                <Field label="Suporte" value={form.suporte} onChange={v => setForm(f => ({ ...f, suporte: v }))} placeholder="ex: 2011" />
                <Field label="Razão Social" cols={2} value={form.razao_social} onChange={v => setForm(f => ({ ...f, razao_social: v }))} placeholder="Razão Social" />
                <Field label="Nome Fantasia" cols={2} value={form.fantasia} onChange={v => setForm(f => ({ ...f, fantasia: v }))} placeholder="Nome Fantasia" />
                <Field label="E-mail *" cols={2} value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" placeholder="email@empresa.com" />
                <Field label="CNPJ" value={form.cnpj} onChange={v => setForm(f => ({ ...f, cnpj: v }))} placeholder="00.000.000/0001-00" />
                <Field label="Telefone" value={form.telefone} onChange={v => setForm(f => ({ ...f, telefone: v }))} placeholder="(11) 99999-9999" />
                <Field label="Grupo de Atendimento" value={form.grupo} onChange={v => setForm(f => ({ ...f, grupo: v }))} placeholder="ex: Grupo 5 - Wellington" />
                <Field label="IBGE" value={form.ibge} onChange={v => setForm(f => ({ ...f, ibge: v }))} placeholder="código IBGE" />
                <Field label="Inscrição Estadual" value={form.inscricao} onChange={v => setForm(f => ({ ...f, inscricao: v }))} placeholder="Informe a inscrição" />
              </div>
            </Section>

            {/* Checkboxes */}
            <Section title="Flags">
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'nfe', label: 'NFE' }, { key: 'ecf', label: 'ECF' },
                  { key: 'atencao_especial', label: 'Precisa de atenção especial' },
                  { key: 'matriz', label: 'Matriz' }
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox"
                      checked={form[key as keyof typeof form] as boolean}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded" style={{ accentColor: 'var(--t-primary)' }} />
                    <span style={{ color: 'var(--t-text-primary)' }}>{label}</span>
                  </label>
                ))}
              </div>
            </Section>

            {/* Redes Sociais */}
            <Section title="Redes">
              <div className="flex flex-wrap gap-2">
                {REDES_OPCOES.map(r => (
                  <button key={r} type="button" onClick={() => toggleRede(r)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={form.redes.includes(r)
                      ? { background: 'var(--t-primary)', borderColor: 'var(--t-primary)', color: '#fff' }
                      : { borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)', background: 'var(--t-card-bg)' }}>
                    {r}
                  </button>
                ))}
              </div>
            </Section>

            {/* Observações */}
            <Section title="Observações">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Observação geral</label>
                  <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                    rows={3} placeholder="Informe a observação..."
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Observação do grupo de atendimento</label>
                  <textarea value={form.observacao_grupo} onChange={e => setForm(f => ({ ...f, observacao_grupo: e.target.value }))}
                    rows={2} placeholder="ex: Cliente prioritário, contato principal com Camila..."
                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                </div>
              </div>
            </Section>

            {/* Aplicativos & Ferramentas */}
            <Section title="Aplicativos & Ferramentas">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FERRAMENTAS_LISTA.map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm cursor-pointer rounded-lg px-3 py-2 border transition-colors"
                    style={form.ferramentas.includes(f)
                      ? { borderColor: 'var(--t-primary)', background: 'color-mix(in srgb, var(--t-primary) 8%, transparent)' }
                      : { borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)' }}>
                    <input type="checkbox" checked={form.ferramentas.includes(f)}
                      onChange={() => toggleFerramenta(f)}
                      className="w-4 h-4 shrink-0" style={{ accentColor: 'var(--t-primary)' }} />
                    <span className="text-xs leading-tight" style={{ color: 'var(--t-text-primary)' }}>{f}</span>
                  </label>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════
            TAB: CONTATOS
        ═══════════════════════════════════════ */}
        {activeTab === 'contatos' && (
          <div className="space-y-4">
            <Section title="Contatos da empresa">
              {/* Add form */}
              <div className="flex gap-2 mb-4">
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome do contato" className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                <input value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)}
                  placeholder="Telefone" className="w-44 px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                <button onClick={handleAddContato} disabled={addingContato || !novoNome.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                  style={{ background: 'var(--t-primary)' }}>
                  Incluir
                </button>
              </div>

              {/* List */}
              {contatos.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--t-text-muted)' }}>Nenhum contato cadastrado</p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--t-card-border)' }}>
                  {contatos.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-3 px-1">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--t-text-primary)' }}>{c.nome}</p>
                        {c.telefone && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{c.telefone}</p>
                            <a
                              href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir WhatsApp"
                              style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: '#25D366',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.112 1.523 5.845L0 24l6.335-1.496A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.49-5.187-1.349l-.372-.22-3.762.888.938-3.65-.243-.384A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleRemoveContato(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-white text-xs transition-opacity hover:opacity-80"
                        style={{ background: '#ef4444' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════
            TAB: HISTÓRICO
        ═══════════════════════════════════════ */}
        {activeTab === 'historico' && (
          <div className="space-y-5">
            {/* Summary block */}
            <div className="rounded-2xl border p-4 grid grid-cols-2 sm:grid-cols-3 gap-3"
              style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
              <SummaryItem label="Empresa" value={form.fantasia || form.razao_social || form.nome} />
              <SummaryItem label="CNPJ" value={form.cnpj || '—'} />
              <SummaryItem label="Suporte" value={form.suporte ? `#${form.suporte}` : '—'} />
              <SummaryItem label="Plano atual" value={planoAtual} accent />
              <SummaryItem label="Grupo de atendimento" value={form.grupo || '—'} />
              <SummaryItem label="Atenção especial" value={form.atencao_especial ? 'Sim ⚠' : 'Não'} warning={form.atencao_especial} />
              <SummaryItem label="Última solicitação" value={fmtDate(ultimaSol?.data_solicitacao)} />
              <SummaryItem label="Último responsável" value={ultimaSol?.usuario_responsavel || '—'} />
              <SummaryItem label="Último contato" value={ultimaSol?.contato_solicitante || '—'} />
              {ultimaSol && (
                <SummaryItem label="Status da última" value={statusInfo(ultimaSol.status).label} />
              )}
            </div>

            {/* Header + button */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--t-text-primary)' }}>
                Histórico de Solicitações de Serviços
              </h3>
              <button onClick={() => setShowSolModal(true)}
                className="px-4 py-2 text-sm font-medium rounded-xl text-white"
                style={{ background: 'var(--t-primary)' }}>
                + Nova Solicitação
              </button>
            </div>

            {/* Table */}
            {solicitacoes.length === 0 ? (
              <div className="rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--t-card-border)' }}>
                <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Nenhuma solicitação registrada</p>
              </div>
            ) : (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--t-card-border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                        {['Data','Finalizado','Contato','Usuário','Tipo','Sub','Status','Prioridade'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {solicitacoes.map((s, i) => {
                        const st = statusInfo(s.status);
                        const pr = prioInfo(s.prioridade);
                        return (
                          <tr key={s.id}
                            style={{ borderBottom: i < solicitacoes.length - 1 ? '1px solid var(--t-card-border)' : undefined,
                              background: i % 2 === 0 ? 'var(--t-card-bg)' : 'var(--t-content-bg)' }}>
                            <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--t-text-primary)' }}>{fmtDate(s.data_solicitacao)}</td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--t-text-muted)' }}>{fmtDate(s.data_finalizacao)}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--t-text-primary)' }}>{s.contato_solicitante || '—'}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--t-text-primary)' }}>{s.usuario_responsavel || '—'}</td>
                            <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--t-text-primary)' }}>{s.tipo_servico}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--t-text-muted)' }}>{s.subtipo || '—'}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: st.color }}>{st.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ background: pr.color }}>{pr.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════
            TAB: ENDEREÇO
        ═══════════════════════════════════════ */}
        {activeTab === 'endereco' && (
          <Section title="Endereço da empresa">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>CEP</label>
                <div className="flex gap-2">
                  <input value={endForm.cep} onChange={e => setEndForm(f => ({ ...f, cep: e.target.value }))}
                    placeholder="00000-000" maxLength={9}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                  <button onClick={handleBuscarCEP}
                    className="px-3 py-2 text-xs rounded-lg font-medium"
                    style={{ background: 'var(--t-primary)', color: '#fff' }}>Buscar</button>
                </div>
              </div>
              <Field label="Número" value={endForm.numero} onChange={v => setEndForm(f => ({ ...f, numero: v }))} placeholder="ex: 1234" />
              <Field label="Endereço" cols={2} value={endForm.endereco} onChange={v => setEndForm(f => ({ ...f, endereco: v }))} placeholder="Avenida, Rua..." />
              <Field label="Bairro" value={endForm.bairro} onChange={v => setEndForm(f => ({ ...f, bairro: v }))} placeholder="Bairro" />
              <Field label="Cidade" value={endForm.cidade} onChange={v => setEndForm(f => ({ ...f, cidade: v }))} placeholder="Cidade" />
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>UF</label>
                <select value={endForm.estado} onChange={e => setEndForm(f => ({ ...f, estado: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                  <option value="">Selecione</option>
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <Field label="Região" value={endForm.regiao} onChange={v => setEndForm(f => ({ ...f, regiao: v }))} placeholder="ex: Sul, Centro-Oeste..." />
              <Field label="Complemento" cols={2} value={endForm.complemento} onChange={v => setEndForm(f => ({ ...f, complemento: v }))} placeholder="Sala, bloco, apt..." />
            </div>
          </Section>
        )}

        {/* ═══════════════════════════════════════
            TAB: INFORMAÇÕES ADICIONAIS
        ═══════════════════════════════════════ */}
        {activeTab === 'info' && (
          <div className="space-y-5">
            <Section title="Responsável">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome do responsável" cols={2} value={infoForm.responsavel_nome}
                  onChange={v => setInfoForm(f => ({ ...f, responsavel_nome: v }))} placeholder="Informe o nome do responsável" />
                <Field label="Celular do responsável" value={infoForm.responsavel_celular}
                  onChange={v => setInfoForm(f => ({ ...f, responsavel_celular: v }))} placeholder="Informe o celular do responsável" />
              </div>
            </Section>

            <Section title="Contador">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome do contador" cols={2} value={infoForm.contador_nome}
                  onChange={v => setInfoForm(f => ({ ...f, contador_nome: v }))} placeholder="Informe o nome do contador" />
                <Field label="Celular do contador" value={infoForm.contador_celular}
                  onChange={v => setInfoForm(f => ({ ...f, contador_celular: v }))} placeholder="Informe o celular do contador" />
                <Field label="Telefone do contador" value={infoForm.contador_telefone}
                  onChange={v => setInfoForm(f => ({ ...f, contador_telefone: v }))} placeholder="Informe o telefone do contador" />
                <Field label="E-mail do contador" cols={2} value={infoForm.contador_email} type="email"
                  onChange={v => setInfoForm(f => ({ ...f, contador_email: v }))} placeholder="Informe o e-mail do contador" />
              </div>
            </Section>
          </div>
        )}

        {/* ─── Mensalidade / Financeiro ─────────── */}
        {activeTab === 'financeiro' && (
          <div className="space-y-5">
            <Section title="Mensalidade">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                  <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Mensalidade base</p>
                  <p className="text-lg font-bold" style={{ color: 'var(--t-text-primary)' }}>
                    R$ {Number(cliente.mensalidade?.base ?? cliente.mensalidade_base ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: '#fde68a', background: '#fffbeb' }}>
                  <p className="text-xs text-amber-700">Acréscimos (serviços)</p>
                  <p className="text-lg font-bold text-amber-700">
                    R$ {Number(cliente.mensalidade?.total_acrescimos ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: '#86efac', background: '#f0fdf4' }}>
                  <p className="text-xs text-green-700">Mensalidade total</p>
                  <p className="text-lg font-bold text-green-700">
                    R$ {Number(cliente.mensalidade?.total ?? cliente.mensalidade_base ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <Field label="Mensalidade base (R$)" type="number" value={finForm.mensalidade_base}
                  onChange={v => setFinForm(f => ({ ...f, mensalidade_base: v }))} placeholder="Ex: 300,00" />
              </div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--t-text-muted)' }}>
                A mensalidade total = base + acréscimos de serviços confirmados (ex.: Arquivo Fiscal). Salve para recalcular.
              </p>
            </Section>

            <Section title="Acréscimos confirmados (vendas adicionais)">
              {(cliente.mensalidade?.acrescimos?.length ?? 0) === 0 ? (
                <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>
                  Nenhum acréscimo confirmado. Lance em <b>Vendas Adicionais</b> (ex.: Arquivo Fiscal) com o valor do acréscimo mensal.
                </p>
              ) : (
                <div className="space-y-2">
                  {cliente.mensalidade!.acrescimos.map(a => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2"
                      style={{ borderColor: 'var(--t-card-border)' }}>
                      <div>
                        <span className="text-sm font-medium" style={{ color: 'var(--t-text-primary)' }}>{a.origem}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--t-text-muted)' }}>{new Date(a.data).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <span className="text-sm font-bold text-amber-700">+ R$ {Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Observações financeiras (ajustes / radar)">
              <textarea value={finForm.observacoes_fin} onChange={e => setFinForm(f => ({ ...f, observacoes_fin: e.target.value }))}
                rows={3} placeholder="Ex.: negociação de desconto, reajuste pendente, observações para o radar…"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
            </Section>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          MODAL: Nova Solicitação de Serviço
      ═══════════════════════════════════════ */}
      {showSolModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowSolModal(false)}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl my-4"
            style={{ background: 'var(--t-card-bg)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--t-card-border)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>Nova Solicitação de Serviço</h2>
              <button onClick={() => setShowSolModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-sm"
                style={{ color: 'var(--t-text-muted)' }}>✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tipo + Subtipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Tipo de Serviço *</label>
                  <select value={solForm.tipo_servico}
                    onChange={e => setSolForm(f => ({ ...f, tipo_servico: e.target.value, subtipo: '' }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="">Selecione o tipo</option>
                    {Object.keys(TIPOS_SERVICO).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Subtipo</label>
                  <select value={solForm.subtipo}
                    onChange={e => setSolForm(f => ({ ...f, subtipo: e.target.value }))}
                    disabled={!solForm.tipo_servico}
                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:opacity-50"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="">Selecione o subtipo</option>
                    {(TIPOS_SERVICO[solForm.tipo_servico] || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Prioridade + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Prioridade</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRIORIDADE_OPTIONS.map(p => (
                      <button key={p.value} type="button" onClick={() => setSolForm(f => ({ ...f, prioridade: p.value }))}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
                        style={solForm.prioridade === p.value
                          ? { background: p.color, borderColor: p.color, color: '#fff' }
                          : { borderColor: p.color, color: p.color, background: 'transparent' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Status</label>
                  <select value={solForm.status}
                    onChange={e => setSolForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Contato + Usuário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Contato solicitante</label>
                  <select value={solForm.contato_solicitante}
                    onChange={e => {
                      const c = contatos.find(ct => ct.nome === e.target.value);
                      setSolForm(f => ({ ...f, contato_solicitante: e.target.value, contato_telefone: c?.telefone || f.contato_telefone }));
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="">Selecionar ou digitar abaixo</option>
                    {contatos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Telefone do contato</label>
                  <input value={solForm.contato_telefone}
                    onChange={e => setSolForm(f => ({ ...f, contato_telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Usuário responsável</label>
                <input value={solForm.usuario_responsavel}
                  onChange={e => setSolForm(f => ({ ...f, usuario_responsavel: e.target.value }))}
                  placeholder="Nome do atendente"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
              </div>

              {/* Grupo (read-only, preenchido do cliente) */}
              {form.grupo && (
                <div className="rounded-lg px-4 py-2 text-xs" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}>
                  Grupo de atendimento: <strong style={{ color: 'var(--t-text-primary)' }}>{form.grupo}</strong>
                  <span className="ml-2 text-xs opacity-60">(preenchido automaticamente do cadastro)</span>
                </div>
              )}

              {/* Descrição */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Descrição</label>
                <textarea value={solForm.descricao}
                  onChange={e => setSolForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3} placeholder="Descreva a solicitação..."
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Observação interna</label>
                <textarea value={solForm.observacao_interna}
                  onChange={e => setSolForm(f => ({ ...f, observacao_interna: e.target.value }))}
                  rows={2} placeholder="Notas internas (não visível ao cliente)..."
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowSolModal(false)}
                  className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--t-text-secondary)' }}>
                  Cancelar
                </button>
                <button onClick={handleSaveSolicitacao}
                  disabled={savingSol || !solForm.tipo_servico}
                  className="px-5 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ background: 'var(--t-primary)' }}>
                  {savingSol ? 'Salvando...' : 'Registrar Solicitação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>{title}</h3>
      {children}
    </div>
  );
}

function SummaryItem({ label, value, accent, warning }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${accent ? 'text-blue-600' : warning ? 'text-red-500' : ''}`}
        style={!accent && !warning ? { color: 'var(--t-text-primary)' } : {}}>
        {value}
      </p>
    </div>
  );
}
