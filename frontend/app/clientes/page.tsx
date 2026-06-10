'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';

interface Cliente {
  id: string;
  codigo?: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  situacao?: string;
  segmento?: string;
  grupo_tecnico?: string;
  plano?: string;
  contato?: string;
  data_entrada?: string;
  observacoes?: string;
  risco_atencao?: boolean;
  cidade?: string;
  estado?: string;
  created_at: string;
  _count?: { caso_churn: number };
}

interface ClienteForm {
  codigo: string;
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  cidade: string;
  estado: string;
}

const emptyForm: ClienteForm = { codigo: '', nome: '', email: '', telefone: '', empresa: '', cidade: '', estado: '' };

// CSV columns the system accepts (inclui as colunas complementares da planilha legada)
const CSV_COLUMNS = [
  'codigo', 'nome', 'email', 'e_mail', 'e_mail2', 'telefone', 'empresa', 'razao_social', 'nome_fantasia', 'cnpj',
  'situacao', 'segmento', 'grupo_tecnico', 'plano', 'contato', 'cidade', 'estado', 'uf',
  'cep', 'endereco', 'numero', 'complemento', 'bairro', 'codigo_cidade_ibge',
  'ddd', 'telefone1', 'telefone2', 'inscricao', 'tel_contato', 'vencimento', 'mensalidade',
  'cadastro', 'vencimento_licenca', 'reajuste', 'ultimo_pagto', 'previsao_pagto', 'regiao',
  'instalacao', 'condicao_pagto', 'contato2', 'tel_contato2', 'contato_pesquisa',
  'cpf', 'identidade', 'responsavel', 'comunicacao', 'regime', 'complemento_obs',
] as const;
type CsvCol = typeof CSV_COLUMNS[number];

// Detect separator: semicolon (Excel PT) or comma
function detectSep(line: string): string {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi >= comma ? ';' : ',';
}

// Parse CSV text → array of objects
function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = detectSep(lines[0]);

  const splitRow = (row: string): string[] => {
    const result: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === sep && !inQ) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase().trim());
  return lines.slice(1).map(line => {
    const vals = splitRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { if (vals[i] !== undefined) obj[h] = vals[i]; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

// Map raw CSV header to known column
function mapHeader(raw: string): CsvCol | null {
  const n = raw.toLowerCase().replace(/[^a-z]/g, '');
  const MAP: Record<string, CsvCol> = {
    codigo: 'codigo', code: 'codigo', cod: 'codigo', codigocliente: 'codigo',
    nome: 'nome', name: 'nome', nomecliente: 'nome', cliente: 'nome',
    email: 'email', emailcliente: 'email', emailresponsavel: 'email',
    telefone: 'telefone', fone: 'telefone', celular: 'telefone', phone: 'telefone', whatsapp: 'telefone',
    razaosocial: 'razao_social', razao: 'razao_social',
    nomefantasia: 'nome_fantasia', fantasia: 'nome_fantasia',
    empresa: 'empresa', company: 'empresa',
    cnpj: 'cnpj', cpfcnpj: 'cnpj',
    situacao: 'situacao', status: 'situacao',
    segmento: 'segmento', ramo: 'segmento',
    grupotecnico: 'grupo_tecnico', grupoatendimento: 'grupo_tecnico', grupoatend: 'grupo_tecnico', grupo: 'grupo_tecnico', tecnico: 'grupo_tecnico',
    plano: 'plano', planocontratado: 'plano',
    contato: 'contato', contatonome: 'contato', responsavel: 'contato',
    cidade: 'cidade', municipio: 'cidade', city: 'cidade',
    estado: 'estado', uf: 'estado', state: 'estado'
  };
  return MAP[n] || null;
}

type ImportStep = 'upload' | 'preview' | 'result';
type ImportMode = 'UPSERT' | 'CRIAR' | 'ATUALIZAR' | 'COMPLEMENTAR';

interface ImportResult {
  total: number; criados: number; atualizados: number; erros_total: number;
  erros: { linha: number; email: string; motivo: string }[];
}

export default function ClientesPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  // Vendedor só consulta clientes; não cadastra/importa/edita/remove.
  const isGestor = podeVerTudo(user?.role);
  const isCEO = ['CEO', 'ADMIN', 'DIRETOR'].includes((user?.role || '').toUpperCase());

  // Limpa registros inválidos (lixo de import: código não-numérico). Mostra
  // quantos antes de apagar e pede confirmação.
  const limparInvalidos = async () => {
    try {
      const prev = await apiClient.client.post('/clientes/limpar-invalidos');
      const qtd = prev.data?.data?.invalidos ?? 0;
      if (qtd === 0) { alert('Nenhum registro inválido encontrado. ✅'); return; }
      const ex = (prev.data?.data?.amostra || []).slice(0, 5).map((a: any) => `• ${a.codigo || '(sem código)'} — ${a.nome}`).join('\n');
      if (!window.confirm(`Encontrei ${qtd} cliente(s) com código inválido (lixo de importação):\n\n${ex}${qtd > 5 ? '\n…' : ''}\n\nApagar TODOS esses ${qtd}? (não há desfazer)`)) return;
      const res = await apiClient.client.post('/clientes/limpar-invalidos?confirmar=1');
      alert(res.data?.message || 'Limpeza concluída.');
      setPage(0); fetchClientes();
    } catch (e: any) {
      alert('Erro: ' + (e?.response?.data?.message || e?.message || 'desconhecido'));
    }
  };

  // Zera a base de clientes (só CEO) — pede confirmação digitando ZERAR.
  const zerarBase = async () => {
    const c = window.prompt('⚠️ Isso APAGA TODOS os clientes (e vínculos). Não há como desfazer.\n\nDigite ZERAR para confirmar:');
    if (c !== 'ZERAR') { if (c !== null) alert('Confirmação incorreta. Nada foi apagado.'); return; }
    try {
      const res = await apiClient.client.post('/clientes/zerar-base', { confirmacao: 'ZERAR' });
      alert(res.data?.message || 'Base zerada.');
      setPage(0); fetchClientes();
    } catch (e: any) {
      alert('Erro ao zerar: ' + (e?.response?.data?.message || e?.message || 'desconhecido'));
    }
  };

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fGrupo, setFGrupo] = useState('');
  const [fSituacao, setFSituacao] = useState('');
  const [fSegmento, setFSegmento] = useState('');
  const [fPlano, setFPlano] = useState('');
  const [fRisco, setFRisco] = useState(false);
  const [opcoes, setOpcoes] = useState<{ grupos_tecnicos: string[]; segmentos: string[]; planos: string[] }>({ grupos_tecnicos: [], segmentos: [], planos: [] });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClienteForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const limit = 20;

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [importMode, setImportMode] = useState<ImportMode>('UPSERT');
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, CsvCol | ''>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchClientes = async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getClientes(page, limit, search || undefined, {
        grupo_tecnico: fGrupo || undefined,
        situacao: fSituacao || undefined,
        segmento: fSegmento || undefined,
        plano: fPlano || undefined,
        risco: fRisco || undefined,
      });
      setClientes(res.data.data.clientes);
      setTotal(res.data.data.total);
      if (res.data.data.opcoes) setOpcoes(res.data.data.opcoes);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { if (isAuthenticated) fetchClientes(); }, [isAuthenticated, page, search, fGrupo, fSituacao, fSegmento, fPlano, fRisco]);

  // Busca TODOS os clientes do filtro atual (paginando), p/ o relatório incluir
  // tudo que o filtro seleciona — não só os 20 da página visível.
  const fetchTodosClientes = async (): Promise<Cliente[]> => {
    const filtros = {
      grupo_tecnico: fGrupo || undefined,
      situacao: fSituacao || undefined,
      segmento: fSegmento || undefined,
      plano: fPlano || undefined,
      risco: fRisco || undefined,
    };
    const passo = 200; // limite máximo aceito pelo backend
    const todos: Cliente[] = [];
    let pag = 0;
    // Lê página por página até cobrir o total (guarda de segurança em 100 páginas).
    for (let i = 0; i < 100; i++) {
      const res = await apiClient.getClientes(pag, passo, search || undefined, filtros);
      const lote: Cliente[] = res.data.data.clientes || [];
      todos.push(...lote);
      const tot = res.data.data.total ?? todos.length;
      pag++;
      if (todos.length >= tot || lote.length < passo) break;
    }
    return todos;
  };

  // Tempo de casa do cliente (a partir de data_entrada; fallback created_at).
  const tempoDeCasa = (c: Cliente): string => {
    const base = c.data_entrada || c.created_at;
    if (!base) return '—';
    const meses = Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / (1000 * 60 * 60 * 24 * 30.4)));
    if (meses < 1) return 'novo';
    if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    const anos = Math.floor(meses / 12); const m = meses % 12;
    return m ? `${anos}a ${m}m` : `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  };

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setError(''); setShowModal(true); };
  const openEdit = (c: Cliente) => {
    setForm({ codigo: c.codigo || '', nome: c.nome, email: c.email || '', telefone: c.telefone || '', empresa: c.empresa || '', cidade: c.cidade || '', estado: c.estado || '' });
    setEditingId(c.id); setError(''); setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload: any = { ...form };
      if (!payload.codigo) delete payload.codigo;
      if (editingId) { await apiClient.client.patch(`/clientes/${editingId}`, payload); }
      else { await apiClient.client.post('/clientes', payload); }
      setShowModal(false); fetchClientes();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este cliente?')) return;
    try { await apiClient.deleteCliente(id); fetchClientes(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao remover'); }
  };

  // ===== IMPORT =====
  const openImport = () => {
    setImportStep('upload'); setImportRows([]); setImportMapping({}); setImportResult(null); setShowImport(true);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) { alert('Arquivo vazio ou formato inválido.'); return; }

      // Auto-map headers
      const rawHeaders = Object.keys(rows[0]);
      const mapping: Record<string, CsvCol | ''> = {};
      rawHeaders.forEach(h => { mapping[h] = mapHeader(h) || ''; });
      setImportMapping(mapping);
      setImportRows(rows);
      setImportStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    window.open('/api/template-csv-clientes', '_blank');
    // fallback: create blob
    const csv = 'codigo,nome,email,telefone,empresa,cidade,estado\n001,João Silva,joao@empresa.com,(11) 99999-9999,Empresa ABC,São Paulo,SP\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'template_importacao_clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Convert mapped rows → import payload
  const buildPayload = () => {
    return importRows.map(row => {
      const obj: any = {};
      Object.entries(importMapping).forEach(([raw, col]) => {
        if (col && row[raw] !== undefined) obj[col] = row[raw] || undefined;
      });
      return obj;
    }).filter(r => r.codigo || r.nome || r.razao_social || r.empresa || r.email);
  };

  const runImport = async () => {
    const payload = buildPayload();
    if (payload.length === 0) { alert('Nenhuma linha válida com nome e email encontrada.'); return; }
    setImporting(true);
    try {
      const res = await apiClient.client.post('/clientes/importar', { clientes: payload, modo: importMode });
      setImportResult(res.data.data);
      setImportStep('result');
      fetchClientes();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao importar. Verifique o arquivo.');
    } finally { setImporting(false); }
  };

  const validRows = buildPayload().length;
  const rawHeaders = importRows.length > 0 ? Object.keys(importRows[0]) : [];

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Clientes</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{total} clientes cadastrados</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="clientes" titulo="Clientes — ProSystem CRM"
              linhas={clientes}
              fetchLinhas={fetchTodosClientes}
              colunas={[
                { header: 'Código', value: (c: Cliente) => c.codigo || '' },
                { header: 'Nome', value: (c: Cliente) => c.nome },
                { header: 'Razão social', value: (c: Cliente) => (c as any).razao_social || '' },
                { header: 'Nome fantasia', value: (c: Cliente) => (c as any).nome_fantasia || '' },
                { header: 'CNPJ', value: (c: Cliente) => (c as any).cnpj || '' },
                { header: 'Empresa', value: (c: Cliente) => c.empresa || '' },
                { header: 'E-mail', value: (c: Cliente) => c.email || '' },
                { header: 'Telefone', value: (c: Cliente) => c.telefone || '' },
                { header: 'Cidade', value: (c: Cliente) => c.cidade || '' },
                { header: 'Estado', value: (c: Cliente) => c.estado || '' },
                { header: 'Situação', value: (c: Cliente) => (c as any).situacao || '' },
                { header: 'Segmento', value: (c: Cliente) => (c as any).segmento || '' },
                { header: 'Plano', value: (c: Cliente) => (c as any).plano || '' },
                { header: 'Mensalidade', value: (c: Cliente) => (c as any).mensalidade_base ?? '' },
                { header: 'Responsável', value: (c: Cliente) => (c as any).responsavel_nome || '' },
              ]}
            />
            {isGestor && (
              <>
                <button
                  onClick={openImport}
                  className="px-4 py-2 text-sm rounded-lg border font-medium transition-colors"
                  style={{ borderColor: 'var(--t-primary)', color: 'var(--t-primary)', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--t-primary) 8%, transparent)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Importar CSV
                </button>
                <button
                  onClick={openCreate}
                  className="px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors"
                  style={{ background: 'var(--t-primary)' }}
                >
                  + Novo Cliente
                </button>
                <button
                  onClick={limparInvalidos}
                  title="Apaga clientes com código inválido (lixo de importação)"
                  className="px-4 py-2 text-sm rounded-lg border font-medium transition-colors"
                  style={{ borderColor: '#d97706', color: '#d97706', background: 'transparent' }}
                >
                  🧹 Limpar inválidos
                </button>
                {isCEO && (
                  <button
                    onClick={zerarBase}
                    title="Apaga TODOS os clientes para reimportar do zero (só CEO)"
                    className="px-4 py-2 text-sm rounded-lg border font-medium transition-colors"
                    style={{ borderColor: '#dc2626', color: '#dc2626', background: 'transparent' }}
                  >
                    🗑️ Zerar base
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por nome, empresa, email ou código..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none text-sm"
            style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-base">🔍</span>
        </div>

        {/* Filtros da base */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { v: fSituacao, set: setFSituacao, label: 'Situação', opts: ['ATIVA', 'INATIVA'] },
            { v: fGrupo, set: setFGrupo, label: 'Grupo técnico', opts: opcoes.grupos_tecnicos },
            { v: fSegmento, set: setFSegmento, label: 'Segmento', opts: opcoes.segmentos },
            { v: fPlano, set: setFPlano, label: 'Plano', opts: opcoes.planos },
          ].map((f, i) => (
            <select key={i} value={f.v} onChange={e => { f.set(e.target.value); setPage(0); }}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
              <option value="">{f.label}: todos</option>
              {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <button onClick={() => { setFRisco(r => !r); setPage(0); }}
            className="px-3 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: fRisco ? '#dc2626' : 'var(--t-card-border)', background: fRisco ? '#fef2f2' : 'var(--t-card-bg)', color: fRisco ? '#dc2626' : 'var(--t-text-secondary)' }}>
            ⚠️ Em risco
          </button>
          {(fSituacao || fGrupo || fSegmento || fPlano || fRisco) && (
            <button onClick={() => { setFSituacao(''); setFGrupo(''); setFSegmento(''); setFPlano(''); setFRisco(false); setPage(0); }}
              className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--t-text-muted)' }}>
              Limpar filtros
            </button>
          )}
          <span className="text-xs ml-auto" style={{ color: 'var(--t-text-muted)' }}>{total} cliente(s)</span>
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
          {dataLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>Carregando...</div>
          ) : clientes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🏢</div>
              <p style={{ color: 'var(--t-text-muted)' }}>Nenhum cliente encontrado</p>
              {isGestor && (
                <div className="flex justify-center gap-2 mt-4">
                  <button onClick={openCreate} className="px-4 py-2 rounded-lg text-white text-sm" style={{ background: 'var(--t-primary)' }}>Cadastrar cliente</button>
                  <button onClick={openImport} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>Importar CSV</button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--t-content-bg)', borderBottom: `1px solid var(--t-card-border)` }}>
                  <tr>
                    {['Código','Cliente','Contato','Plano','Grupo / Segmento','Situação','Cliente desde','Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id} className="border-b transition-colors cursor-pointer" style={{ borderColor: 'var(--t-card-border)' }}
                      onClick={() => router.push(`/clientes/${c.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-content-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td className="px-4 py-3">
                        {c.codigo ? (
                          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-secondary)', border: `1px solid var(--t-card-border)` }}>{c.codigo}</span>
                        ) : <span style={{ color: 'var(--t-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ background: 'var(--t-primary)' }}>
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm" style={{ color: 'var(--t-text-primary)' }}>{c.nome}</p>
                            <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{c.empresa}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs" style={{ color: 'var(--t-text-primary)' }}>{c.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{c.telefone || '—'}</p>
                          {c.telefone && (
                            <a
                              href={`/whatsapp?numero=${c.telefone.replace(/\D/g, '')}&nome=${encodeURIComponent(c.razao_social || c.nome || '')}`}
                              onClick={e => e.stopPropagation()}
                              title={`Abrir WhatsApp no CRM: ${c.telefone}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 20, height: 20, borderRadius: '50%',
                                background: '#25D366', flexShrink: 0,
                                boxShadow: '0 1px 4px rgba(37,211,102,.4)',
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.532 5.847L.057 23.617a.75.75 0 0 0 .921.921l5.696-1.489A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.667-.523-5.181-1.432l-.371-.218-3.383.885.898-3.285-.237-.385A9.958 9.958 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.plano ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'var(--t-content-bg)', color: 'var(--t-primary)', border: `1px solid var(--t-card-border)` }}>{c.plano}</span>
                        ) : <span style={{ color: 'var(--t-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--t-text-secondary)' }}>
                        <p>{c.grupo_tecnico || '—'}</p>
                        {c.segmento && <p style={{ color: 'var(--t-text-muted)' }}>{c.segmento}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.situacao === 'INATIVA' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                          {c.situacao === 'INATIVA' ? 'Inativa' : 'Ativa'}
                        </span>
                        {c.risco_atencao && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700" title="Cliente em risco">⚠️</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--t-text-secondary)' }} title={c.data_entrada ? new Date(c.data_entrada).toLocaleDateString('pt-BR') : ''}>
                        {tempoDeCasa(c)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        {isGestor ? (
                          <>
                            <button onClick={() => openEdit(c)} className="text-xs mr-3 hover:underline" style={{ color: 'var(--t-primary)' }}>Editar</button>
                            <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Remover</button>
                          </>
                        ) : (
                          <button onClick={() => router.push(`/clientes/${c.id}`)} className="text-xs hover:underline" style={{ color: 'var(--t-primary)' }}>Ver</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between text-sm">
            <p style={{ color: 'var(--t-text-muted)' }}>Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-50 transition-colors"
                style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}>Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-50 transition-colors"
                style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}>Próximo</button>
            </div>
          </div>
        )}
      </div>

      {/* ===== MODAL CRIAR/EDITAR ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="rounded-xl shadow-xl p-6 w-full max-w-lg mx-4" style={{ background: 'var(--t-card-bg)' }}>
            <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--t-text-primary)' }}>
              {editingId ? 'Editar Cliente' : 'Novo Cliente'}
            </h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Código do Cliente</label>
                <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                  placeholder="ex: 001" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                  placeholder="Nome completo" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Empresa</label>
                <input value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                  placeholder="Nome da empresa" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                  placeholder="email@empresa.com" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Telefone</label>
                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                  placeholder="(11) 99999-0000" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Estado (UF)</label>
                <input value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                  placeholder="SP" maxLength={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Cidade</label>
                <input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                  placeholder="São Paulo" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg transition-colors" style={{ color: 'var(--t-text-secondary)' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.nome || !form.email}
                className="px-5 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50"
                style={{ background: 'var(--t-primary)' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL IMPORTAÇÃO ===== */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowImport(false)}>
          <div className="w-full max-w-3xl rounded-2xl shadow-2xl my-8" style={{ background: 'var(--t-card-bg)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--t-card-border)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--t-text-primary)' }}>Importar Clientes</h2>
                <div className="flex items-center gap-3 mt-1">
                  {(['upload','preview','result'] as ImportStep[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${importStep === s ? 'text-white' : i < (['upload','preview','result'] as ImportStep[]).indexOf(importStep) ? 'bg-green-500 text-white' : 'text-gray-400'}`}
                        style={importStep === s ? { background: 'var(--t-primary)' } : i < (['upload','preview','result'] as ImportStep[]).indexOf(importStep) ? {} : { background: 'var(--t-card-border)' }}>
                        {i < (['upload','preview','result'] as ImportStep[]).indexOf(importStep) ? '✓' : i + 1}
                      </div>
                      <span className="text-xs capitalize" style={{ color: importStep === s ? 'var(--t-text-primary)' : 'var(--t-text-muted)' }}>
                        {s === 'upload' ? 'Arquivo' : s === 'preview' ? 'Conferir' : 'Resultado'}
                      </span>
                      {i < 2 && <div className="w-6 h-px mx-1" style={{ background: 'var(--t-card-border)' }} />}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowImport(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100" style={{ color: 'var(--t-text-muted)' }}>✕</button>
            </div>

            <div className="p-6">
              {/* STEP 1: Upload */}
              {importStep === 'upload' && (
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : ''}`}
                    style={{ borderColor: dragOver ? 'var(--t-primary)' : 'var(--t-card-border)' }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <div className="text-4xl mb-3">📂</div>
                    <p className="font-medium text-sm" style={{ color: 'var(--t-text-primary)' }}>Arraste seu arquivo CSV aqui</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>ou clique para selecionar — aceita vírgula ou ponto-e-vírgula como separador</p>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </div>

                  <div className="rounded-xl p-4 border" style={{ background: 'var(--t-content-bg)', borderColor: 'var(--t-card-border)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--t-text-muted)' }}>COLUNAS ACEITAS</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { col: 'codigo', desc: 'Código único do cliente (opcional)' },
                        { col: 'nome', desc: 'Nome do responsável (obrigatório)' },
                        { col: 'email', desc: 'Email — chave de identificação (obrigatório)' },
                        { col: 'telefone', desc: 'Telefone ou WhatsApp' },
                        { col: 'empresa', desc: 'Nome da empresa' },
                        { col: 'cidade', desc: 'Cidade' },
                        { col: 'estado', desc: 'Estado (UF, 2 letras)' }
                      ].map(({ col, desc }) => (
                        <span key={col} title={desc} className="text-xs font-mono px-2 py-0.5 rounded border cursor-help"
                          style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>{col}</span>
                      ))}
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--t-text-muted)' }}>O email é obrigatório e usado como chave para evitar duplicatas.</p>
                  </div>

                  <div className="flex justify-between items-center">
                    <button onClick={downloadTemplate} className="text-xs underline" style={{ color: 'var(--t-primary)' }}>
                      Baixar template CSV de exemplo
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Preview + mapping */}
              {importStep === 'preview' && importRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: 'var(--t-text-primary)' }}>
                      {importRows.length} linha{importRows.length !== 1 ? 's' : ''} detectada{importRows.length !== 1 ? 's' : ''} — <span className="text-green-600">{validRows} válidas</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: 'var(--t-text-muted)' }}>Modo:</span>
                      {(['COMPLEMENTAR','UPSERT','CRIAR','ATUALIZAR'] as ImportMode[]).map(m => (
                        <button key={m} onClick={() => setImportMode(m)}
                          className="px-3 py-1 rounded-full border text-xs font-medium transition-colors"
                          style={importMode === m ? { background: 'var(--t-primary)', color: '#fff', borderColor: 'var(--t-primary)' } : { borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                          {m === 'COMPLEMENTAR' ? '✨ Só complementar (não sobrescreve)' : m === 'UPSERT' ? 'Criar + Atualizar' : m === 'CRIAR' ? 'Só criar novos' : 'Só atualizar (sobrescreve)'}
                        </button>
                      ))}
                    </div>
                    {importMode === 'COMPLEMENTAR' && (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--t-text-muted)' }}>
                        Preenche apenas os campos <b>vazios</b> de cada cliente já cadastrado (casa por código/CNPJ). Não duplica nem troca o que já existe; cria os que não existem.
                      </p>
                    )}
                  </div>

                  {/* Column mapping */}
                  {rawHeaders.length > 0 && (
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--t-text-muted)' }}>MAPEAMENTO DE COLUNAS</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {rawHeaders.map(h => (
                          <div key={h} className="flex items-center gap-2">
                            <span className="text-xs font-mono w-24 truncate" style={{ color: 'var(--t-text-secondary)' }} title={h}>{h}</span>
                            <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>→</span>
                            <select value={importMapping[h] || ''} onChange={e => setImportMapping(m => ({ ...m, [h]: e.target.value as CsvCol | '' }))}
                              className="flex-1 text-xs border rounded px-1.5 py-1"
                              style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}>
                              <option value="">— ignorar —</option>
                              {CSV_COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview table */}
                  <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--t-card-border)' }}>
                    <table className="w-full text-xs">
                      <thead style={{ background: 'var(--t-content-bg)', borderBottom: `1px solid var(--t-card-border)` }}>
                        <tr>
                          {rawHeaders.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--t-text-muted)' }}>
                              {h}
                              {importMapping[h] && <span className="ml-1 text-green-500">({importMapping[h]})</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 8).map((row, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid var(--t-card-border)` }}>
                            {rawHeaders.map(h => (
                              <td key={h} className="px-3 py-1.5" style={{ color: 'var(--t-text-primary)' }}>{row[h] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > 8 && (
                      <div className="px-3 py-2 text-xs" style={{ color: 'var(--t-text-muted)', background: 'var(--t-content-bg)' }}>
                        ... e mais {importRows.length - 8} linhas
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <button onClick={() => setImportStep('upload')} className="text-sm px-4 py-2 rounded-lg border transition-colors"
                      style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                      Voltar
                    </button>
                    <button onClick={runImport} disabled={importing || validRows === 0}
                      className="text-sm px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50"
                      style={{ background: 'var(--t-primary)' }}>
                      {importing ? 'Importando...' : `Importar ${validRows} cliente${validRows !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Result */}
              {importStep === 'result' && importResult && (
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Total', value: importResult.total, color: 'text-gray-600', bg: 'bg-gray-50' },
                      { label: 'Criados', value: importResult.criados, color: 'text-green-700', bg: 'bg-green-50' },
                      { label: 'Atualizados', value: importResult.atualizados, color: 'text-blue-700', bg: 'bg-blue-50' },
                      { label: 'Erros', value: importResult.erros_total, color: importResult.erros_total > 0 ? 'text-red-700' : 'text-gray-400', bg: importResult.erros_total > 0 ? 'bg-red-50' : 'bg-gray-50' }
                    ].map(k => (
                      <div key={k.label} className={`${k.bg} rounded-xl p-4 text-center`}>
                        <p className="text-xs font-medium text-gray-500">{k.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                      </div>
                    ))}
                  </div>

                  {importResult.erros.length > 0 && (
                    <div className="rounded-xl border border-red-200 overflow-hidden">
                      <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                        <p className="text-xs font-semibold text-red-700">LINHAS COM ERRO</p>
                      </div>
                      <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
                        {importResult.erros.map((e, i) => (
                          <div key={i} className="px-4 py-2 flex items-start gap-3 text-xs">
                            <span className="text-red-400 font-mono">L{e.linha}</span>
                            <span className="text-gray-600">{e.email}</span>
                            <span className="text-red-600 flex-1">{e.motivo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importResult.erros_total === 0 && (
                    <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                      <p className="text-green-700 font-medium">Importação concluída sem erros!</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setImportStep('upload'); setImportRows([]); }}
                      className="text-sm px-4 py-2 border rounded-lg" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                      Importar outro arquivo
                    </button>
                    <button onClick={() => setShowImport(false)}
                      className="text-sm px-6 py-2 rounded-lg font-medium text-white" style={{ background: 'var(--t-primary)' }}>
                      Concluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
