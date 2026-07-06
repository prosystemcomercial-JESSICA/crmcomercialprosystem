'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
interface ContatoCliente { id: string; nome: string; telefone?: string; cargo?: string; email?: string; origem?: string; }
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
  // Base / gestão
  situacao?: string; segmento?: string; grupo_tecnico?: string; plano?: string;
  motivo_inativacao?: string; mrr_perdido?: number;
  contato?: string; data_entrada?: string; observacoes?: string;
  // Campanha de ativos
  apresentou_plus?: boolean; conhece_dashboard?: boolean; conhece_mensageria?: boolean;
  conhece_gerencial?: boolean; conhece_atencao_farma?: boolean; risco_atencao?: boolean;
  ativo_observacoes?: string;
  mensalidade?: {
    base: number; total_acrescimos: number; total: number;
    acrescimos: { id: string; valor: number; origem: string; categoria: string; status: string; data: string }[];
  };
  renegociacoes?: {
    id: string; reneg_data?: string; reneg_valor_devido?: number; reneg_valor_entrada?: number;
    reneg_parcelas?: number; valor_parcela?: number; reneg_responsavel?: string; reneg_responsavel_cpf?: string;
    reneg_proximo_vencimento?: string; reneg_como_mantido?: string; reneg_resultado?: string;
    motivo_principal?: string; status?: string;
    resumo?: { mensalidade_atual: number; valor_devido: number; entrada: number; parcelas: number; valor_parcela: number; proximo_vencimento?: string };
  }[];
  eventos?: {
    id: string; tipo: string; titulo: string; descricao?: string; referencia_id?: string;
    metadados?: any; feito_por_nome?: string; created_at: string;
  }[];
  historico_cnpj?: {
    id: string; cnpj_anterior?: string; razao_social_anterior?: string; nome_fantasia_anterior?: string;
    inscricao_anterior?: string; cnpj_novo?: string; razao_social_nova?: string; nome_fantasia_nova?: string;
    motivo?: string; trocado_por_nome?: string; created_at: string;
  }[];
}

type TabName = 'cadastro' | 'contatos' | 'historico' | 'endereco' | 'info' | 'financeiro' | 'ativos';

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('pt-BR'); } catch { return s; }
}
function statusInfo(v: string) {
  return STATUS_OPTIONS.find(s => s.value === v) || { label: v, color: 'var(--t-text-muted)' };
}
function prioInfo(v: string) {
  return PRIORIDADE_OPTIONS.find(p => p.value === v) || { label: v, color: 'var(--t-text-muted)' };
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
// ── Card de pesquisa com modal embutido (hook fora do .map) ──────────────────
function CardPesquisaCliente({ p }: { p: any }) {
  const [aberto, setAberto] = useState(false);
  const score = p.score && p.score > 0 ? p.score
    : p.nota_atendimento
      ? Math.round(((p.nota_atendimento - 1) / 4) * 25 + ((p.nota_conhecimento - 1) / 4) * 15 + ((p.nota_geral - 1) / 4) * 15 + 20)
      : Math.round(((((p.nota_suporte + p.nota_sistema) / 2) - 1) / 4) * 100);
  const scoreColor = score >= 90 ? '#15803d' : score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const resolucaoLabel: Record<string, string> = { totalmente: '✅ Resolveu totalmente', parcialmente: '⚠️ Resolveu parcialmente', nao_resolveu: '❌ Ainda não resolveu', nao_sei: '🤔 Não sei avaliar' };
  const rapidezLabel: Record<string, string> = { muito_rapido: '⚡ Muito rápido', esperado: '👍 Dentro do esperado', demorou_pouco: '⏳ Demorou um pouco', demorou_muito: '😔 Demorou muito' };

  return (
    <>
      {aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setAberto(false); }}>
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(13,34,56,0.35)' }}>
            <div style={{ background: 'linear-gradient(135deg,#0D2238,#1A4E82)', padding: '22px 26px', borderRadius: '20px 20px 0 0', color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#90BEF0', textTransform: 'uppercase', margin: '0 0 4px' }}>Formulário completo respondido</p>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{p.identificacao}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#90BEF0' }}>
                    {new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {p.respondente_nome && ` · ${p.respondente_nome}`}
                  </p>
                </div>
                <button onClick={() => setAberto(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'white', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
                  <svg width={60} height={60} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={30} cy={30} r={25} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={4} />
                    <circle cx={30} cy={30} r={25} fill="none" stroke={scoreColor} strokeWidth={4}
                      strokeDasharray={`${(score / 100) * 2 * Math.PI * 25} ${2 * Math.PI * 25}`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: 'white', lineHeight: 1 }}>{score}</span>
                    <span style={{ fontSize: 8, color: '#90BEF0' }}>/100</span>
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 12, color: '#90BEF0', fontWeight: 600 }}>Score NPS de Satisfação</p>
                  <span style={{ fontSize: 14, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: scoreColor + '30', color: 'white' }}>
                    {score >= 90 ? '🏆 Excelente' : score >= 80 ? '😊 Bom' : score >= 70 ? '⚠️ Atenção' : '🚨 Risco de churn'}
                  </span>
                  {score < 70 && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#fca5a5' }}>Caso de churn aberto automaticamente</p>}
                  {p.alerta_motivo && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#fde68a' }}>⚠️ {p.alerta_motivo}</p>}
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(p.resolucao || p.rapidez) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {p.resolucao && <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 700 }}>SOLICITAÇÃO RESOLVIDA?</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{resolucaoLabel[p.resolucao] || p.resolucao}</p>
                  </div>}
                  {p.rapidez && <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 700 }}>RAPIDEZ</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{rapidezLabel[p.rapidez] || p.rapidez}</p>
                  </div>}
                </div>
              )}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>Notas</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { l: 'Atendimento', n: p.nota_atendimento || p.nota_suporte },
                    { l: 'Conhecimento do técnico', n: p.nota_conhecimento },
                    { l: 'ProSystem (nota geral)', n: p.nota_geral || p.nota_sistema },
                  ].filter(x => x.n).map(({ l, n }) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{l}</span>
                      <span style={{ color: '#FBBF24', fontSize: 16 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: n >= 4 ? '#16a34a' : n === 3 ? '#d97706' : '#dc2626', minWidth: 28 }}>{n}/5</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>Conhece os diferenciais ProSystem?</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[{ l: 'Plano Plus', v: p.conhece_plus, e: '⭐' }, { l: 'Dashboard', v: p.conhece_dashboard, e: '📊' }, { l: 'Mensageria', v: p.conhece_mensageria, e: '💬' }, { l: 'Gerencial', v: p.conhece_gerencial, e: '📈' }].map(({ l, v, e }) => (
                    <div key={l} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid', background: v ? '#f0fdf4' : '#fef2f2', borderColor: v ? '#86efac' : '#fca5a5' }}>
                      <span style={{ fontSize: 12 }}>{e} </span><span style={{ fontSize: 12, fontWeight: 600, color: v ? '#15803d' : '#991b1b' }}>{l}</span>
                      <p style={{ margin: 0, fontSize: 11, color: v ? '#16a34a' : '#dc2626' }}>{v ? '✓ Conhece / usa' : '✗ Não conhece — oportunidade'}</p>
                    </div>
                  ))}
                </div>
              </div>
              {(p.recado || p.observacao) && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Mensagem do cliente</p>
                  {p.recado && <div style={{ padding: '12px 14px', borderLeft: '3px solid #4B8EC8', background: '#f8fafc', borderRadius: '0 10px 10px 0', fontSize: 13, color: 'var(--t-text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>"{p.recado}"</div>}
                  {p.observacao && <div style={{ padding: '12px 14px', borderLeft: '3px solid #4B8EC8', background: '#f8fafc', borderRadius: '0 10px 10px 0', fontSize: 13, color: 'var(--t-text-primary)', lineHeight: 1.6, marginTop: 8 }}>{p.observacao}</div>}
                </div>
              )}
              {(p.email || p.whatsapp) && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.email && <a href={`mailto:${p.email}`} style={{ padding: '7px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: 'var(--t-primary)', fontWeight: 600, textDecoration: 'none' }}>✉️ {p.email}</a>}
                  {p.whatsapp && <a href={`https://wa.me/${p.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ padding: '7px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', fontSize: 12, color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>📱 {p.whatsapp}</a>}
                </div>
              )}
              <button onClick={() => setAberto(false)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 14, fontWeight: 600, color: 'var(--t-text-muted)', cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Card clicável */}
      <div className="rounded-lg border p-3 cursor-pointer" onClick={() => setAberto(true)}
        style={{ borderColor: score >= 90 ? '#86efac' : p.critico ? '#fecaca' : 'var(--t-card-border)', background: score >= 90 ? '#f0fdf4' : p.critico ? '#fef2f2' : 'var(--t-content-bg)', transition: 'all 0.15s' }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
              <svg width={36} height={36} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={18} cy={18} r={14} fill="none" stroke="#e2e8f0" strokeWidth={3} />
                <circle cx={18} cy={18} r={14} fill="none" stroke={scoreColor} strokeWidth={3}
                  strokeDasharray={`${(score / 100) * 2 * Math.PI * 14} ${2 * Math.PI * 14}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold" style={{ color: scoreColor }}>{score >= 90 ? '🏆 Excelente' : score >= 70 ? '✅ Satisfeito' : score >= 50 ? '⚠️ Atenção' : '🚨 Crítico'}</span>
                {p.critico && score < 90 && <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠️</span>}
                {p.alerta_especial && <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">🔔</span>}
              </div>
              <div className="flex gap-2 mt-0.5 text-xs flex-wrap" style={{ color: 'var(--t-text-muted)' }}>
                {p.nota_atendimento ? <span>Atend.:{p.nota_atendimento}★</span> : null}
                {p.nota_geral ? <span>Geral:{p.nota_geral}★</span> : null}
                {!p.nota_atendimento && <span>{p.nota_suporte}★·{p.nota_sistema}★</span>}
                {p.resolucao === 'nao_resolveu' && <span className="text-red-600 font-semibold">❌ Não resolveu</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
            <p className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--t-primary)' }}>Ver completo →</p>
          </div>
        </div>
        {p.recado && <p className="text-xs mt-1.5 italic" style={{ color: 'var(--t-text-secondary)' }}>💬 "{p.recado}"</p>}
      </div>
    </>
  );
}

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
  const [pesquisas, setPesquisas] = useState<any[]>([]);
  const [showDesativar, setShowDesativar] = useState(false);
  const [desativaMotivo, setDesativaMotivo] = useState('');
  const [desativaMrr, setDesativaMrr] = useState('');
  // Troca de CNPJ (mantém o código; dados antigos vão p/ o histórico)
  const [showTrocaCnpj, setShowTrocaCnpj] = useState(false);
  const [trocaForm, setTrocaForm] = useState({ cnpj_novo: '', razao_social_nova: '', nome_fantasia_nova: '', inscricao_nova: '', motivo: '' });
  const [trocandoCnpj, setTrocandoCnpj] = useState(false);
  const [ativosForm, setAtivosForm] = useState({
    situacao: '', segmento: '', grupo_tecnico: '', plano: '', contato: '', observacoes: '',
    apresentou_plus: false, conhece_dashboard: false, conhece_mensageria: false,
    conhece_gerencial: false, conhece_atencao_farma: false, risco_atencao: false, ativo_observacoes: '',
  });

  // Contatos
  const [contatos, setContatos] = useState<ContatoCliente[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoCargo, setNovoCargo] = useState('');
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
        cep: c.cep || '', endereco: c.endereco || '', numero: (c as any).numero_end || c.numero || '',
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
      setAtivosForm({
        situacao: c.situacao || '', segmento: c.segmento || '', grupo_tecnico: c.grupo_tecnico || '',
        plano: c.plano || '', contato: c.contato || '', observacoes: c.observacoes || '',
        apresentou_plus: !!c.apresentou_plus, conhece_dashboard: !!c.conhece_dashboard,
        conhece_mensageria: !!c.conhece_mensageria, conhece_gerencial: !!c.conhece_gerencial,
        conhece_atencao_farma: !!c.conhece_atencao_farma, risco_atencao: !!c.risco_atencao,
        ativo_observacoes: c.ativo_observacoes || '',
      });
      setContatos(c.contatos || []);
      setSolicitacoes(c.solicitacoes || []);
      apiClient.getPesquisasCliente(id as string).then(r => setPesquisas(r.data.data || [])).catch(() => {});
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
        ...form, ...endForm, ...infoForm, ...ativosForm,
        numero_end: endForm.numero || undefined, // banco usa numero_end (não "numero")
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

  const desativarCliente = async () => {
    if (desativaMotivo.trim().length < 3) { console.warn('Descreva o motivo da desativação.'); return; }
    try {
      await apiClient.desativarCliente(id as string, desativaMotivo, desativaMrr ? Number(desativaMrr) : undefined);
      setShowDesativar(false); setDesativaMotivo(''); setDesativaMrr('');
      fetchCliente();
    } catch (e: any) { console.error('Falha ao desativar', e); }
  };
  const reativarCliente = async () => {
    if (!confirm('Reativar este cliente?')) return;
    try { await apiClient.reativarCliente(id as string); fetchCliente(); }
    catch (e: any) { console.error('Falha ao reativar', e); }
  };
  const abrirTrocaCnpj = () => {
    setTrocaForm({ cnpj_novo: '', razao_social_nova: cliente?.razao_social || '', nome_fantasia_nova: cliente?.fantasia || '', inscricao_nova: '', motivo: '' });
    setShowTrocaCnpj(true);
  };
  const trocarCnpj = async () => {
    if (!trocaForm.cnpj_novo.trim()) { console.warn('Informe o novo CNPJ.'); return; }
    setTrocandoCnpj(true);
    try {
      await apiClient.trocarCnpjCliente(id as string, trocaForm);
      setShowTrocaCnpj(false);
      fetchCliente();
      console.warn('CNPJ trocado. Os dados antigos foram guardados no histórico.');
    } catch (e: any) { console.error('Falha ao trocar o CNPJ', e); }
    finally { setTrocandoCnpj(false); }
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
      const res = await apiClient.client.post(`/clientes/${id}/contatos`, { nome: novoNome, telefone: novoTelefone, cargo: novoCargo || undefined });
      setContatos(prev => [...prev, res.data.data]);
      setNovoNome(''); setNovoTelefone(''); setNovoCargo('');
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
    { key: 'ativos', label: '🎯 Ativos' },
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
                {/* Satisfação (estrelas) — análise do módulo Ativos */}
                {(() => { const saude = (cliente as any)?.saude; if (!saude) return null; return (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                    title={`Saúde: ${saude.rotulo} (${saude.score}/100) · atualizado ${saude.atualizado_em ? new Date(saude.atualizado_em).toLocaleDateString('pt-BR') : ''}`}
                    style={{ background: saude.estrelas >= 4 ? '#dcfce7' : saude.estrelas === 3 ? '#fef9c3' : '#fee2e2', color: saude.estrelas >= 4 ? '#15803d' : saude.estrelas === 3 ? '#a16207' : '#b91c1c' }}>
                    {'★'.repeat(saude.estrelas)}{'☆'.repeat(5 - saude.estrelas)} {saude.rotulo}
                  </span>
                ); })()}
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
                  href={`/whatsapp?numero=${tel}&nome=${encodeURIComponent(cliente?.razao_social || cliente?.nome || '')}`}
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
            {/* Desativar / Reativar cliente (situação + MRR perdido) */}
            {cliente?.situacao === 'INATIVA' ? (
              <button onClick={reativarCliente}
                className="px-4 py-2 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#16a34a', color: '#16a34a' }}>
                ↺ Reativar
              </button>
            ) : (
              <button onClick={() => setShowDesativar(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#dc2626', color: '#dc2626' }}>
                Desativar
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--t-primary)' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Badge de cliente inativo */}
        {cliente?.situacao === 'INATIVA' && (
          <div className="rounded-lg p-3 mb-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p className="text-sm font-semibold text-red-700">⚠️ Cliente inativo (churn)</p>
            {cliente.motivo_inativacao && <p className="text-xs text-red-600 mt-0.5">Motivo: {cliente.motivo_inativacao}</p>}
            {cliente.mrr_perdido ? <p className="text-xs text-red-600">MRR perdido: R$ {Number(cliente.mrr_perdido).toLocaleString('pt-BR')}</p> : null}
          </div>
        )}

        {/* Modal desativar */}
        {showDesativar && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="ps-card rounded-xl p-5 w-full max-w-md">
              <h3 className="text-lg font-bold text-sm font-semibold mb-1">Desativar cliente</h3>
              <p className="text-sm  mb-4">Registre o motivo detalhado e o MRR perdido (churn).</p>
              <label className="block text-xs font-medium  mb-1">Motivo detalhado *</label>
              <textarea value={desativaMotivo} onChange={e => setDesativaMotivo(e.target.value)} rows={3}
                placeholder="Ex.: trocou de sistema; insatisfação com suporte…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3" />
              <label className="block text-xs font-medium  mb-1">MRR perdido (R$)</label>
              <input type="number" value={desativaMrr} onChange={e => setDesativaMrr(e.target.value)}
                placeholder={`Mensalidade do cliente (${Number(cliente?.mensalidade_base || 0).toLocaleString('pt-BR')})`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDesativar(false)} className="px-4 py-2 text-sm ">Cancelar</button>
                <button onClick={desativarCliente} className="px-4 py-2 text-sm font-semibold text-white rounded-lg" style={{ background: '#dc2626' }}>Confirmar desativação</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal: Trocar CNPJ ─────────────── */}
        {showTrocaCnpj && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="ps-card rounded-xl p-5 w-full max-w-lg">
              <h3 className="text-lg font-bold text-sm font-semibold mb-1">🔁 Trocar CNPJ</h3>
              <p className="text-sm  mb-3">
                Mantém o mesmo código do cliente. Os dados <b>atuais</b> ({cliente?.cnpj || 'sem CNPJ'}) serão guardados no histórico de trocas.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium  mb-1">Novo CNPJ *</label>
                  <input value={trocaForm.cnpj_novo} onChange={e => setTrocaForm(f => ({ ...f, cnpj_novo: e.target.value }))}
                    placeholder="00.000.000/0001-00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium  mb-1">Nova razão social</label>
                  <input value={trocaForm.razao_social_nova} onChange={e => setTrocaForm(f => ({ ...f, razao_social_nova: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium  mb-1">Novo nome fantasia</label>
                  <input value={trocaForm.nome_fantasia_nova} onChange={e => setTrocaForm(f => ({ ...f, nome_fantasia_nova: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium  mb-1">Nova inscrição estadual</label>
                  <input value={trocaForm.inscricao_nova} onChange={e => setTrocaForm(f => ({ ...f, inscricao_nova: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium  mb-1">Motivo da troca</label>
                  <textarea value={trocaForm.motivo} onChange={e => setTrocaForm(f => ({ ...f, motivo: e.target.value }))} rows={2}
                    placeholder="Ex.: abertura de nova empresa, mudança de razão social, sucessão…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowTrocaCnpj(false)} className="px-4 py-2 text-sm ">Cancelar</button>
                <button onClick={trocarCnpj} disabled={trocandoCnpj || !trocaForm.cnpj_novo.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: 'var(--t-primary)' }}>
                  {trocandoCnpj ? 'Trocando…' : 'Confirmar troca'}
                </button>
              </div>
            </div>
          </div>
        )}

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
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button type="button" onClick={abrirTrocaCnpj}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: 'var(--t-primary)', color: 'var(--t-primary)', background: 'transparent' }}>
                  🔁 Trocar CNPJ
                </button>
                <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                  Mantém o mesmo código; os dados antigos ficam no histórico.
                </span>
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
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome do contato" className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                <input value={novoCargo} onChange={e => setNovoCargo(e.target.value)}
                  placeholder="Cargo (ex.: Gerente)" className="w-full sm:w-40 px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }} />
                <input value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)}
                  placeholder="Telefone" className="w-full sm:w-44 px-3 py-2 border rounded-lg text-sm"
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
                        <p className="text-sm font-medium" style={{ color: 'var(--t-text-primary)' }}>
                          {c.nome}
                          {c.cargo && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-secondary)' }}>{c.cargo}</span>}
                          {c.origem === 'WHATSAPP' && <span className="ml-1.5 text-[10px]" title="Vindo do WhatsApp">💬</span>}
                        </p>
                        {c.telefone && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{c.telefone}</p>
                            <a
                              href={`/whatsapp?numero=${c.telefone.replace(/\D/g, '')}&nome=${encodeURIComponent(c.nome || '')}`}
                              title="Abrir WhatsApp no CRM"
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

            {/* Histórico de troca de CNPJ */}
            {cliente.historico_cnpj && cliente.historico_cnpj.length > 0 && (
              <Section title={`🔁 Trocas de CNPJ (${cliente.historico_cnpj.length})`}>
                <div className="space-y-2">
                  {cliente.historico_cnpj.map(h => (
                    <div key={h.id} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--t-card-border)' }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span style={{ color: 'var(--t-text-primary)' }}>
                          <b>{h.cnpj_anterior || '(vazio)'}</b> → <b className="text-emerald-700">{h.cnpj_novo || '—'}</b>
                        </span>
                        <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{new Date(h.created_at).toLocaleDateString('pt-BR')} · {h.trocado_por_nome || '—'}</span>
                      </div>
                      {(h.razao_social_anterior || h.razao_social_nova) && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>
                          Razão: {h.razao_social_anterior || '—'} → {h.razao_social_nova || '—'}
                        </div>
                      )}
                      {h.motivo && <div className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Motivo: {h.motivo}</div>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Linha do tempo — TUDO que foi registrado no cliente (monitoramento) */}
            {cliente.eventos && cliente.eventos.length > 0 && (
              <Section title={`🕓 Linha do tempo do cliente (${cliente.eventos.length})`}>
                <div className="space-y-2">
                  {cliente.eventos.map(ev => {
                    const ICON: Record<string, string> = { SERVICO: '🛠️', CHURN: '⚠️', RENEGOCIACAO: '💰', TROCA_CNPJ: '🔁', DESATIVACAO: '🔴', REATIVACAO: '🟢', MENSALIDADE: '💵', OBSERVACAO: '📝' };
                    return (
                      <div key={ev.id} className="flex gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--t-card-border)' }}>
                        <span className="text-lg leading-none">{ICON[ev.tipo] || '•'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-medium" style={{ color: 'var(--t-text-primary)' }}>{ev.titulo}</span>
                            <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{new Date(ev.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          {ev.descricao && <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>{ev.descricao}</p>}
                          {ev.feito_por_nome && <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>por {ev.feito_por_nome}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

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

            {/* Renegociações por dificuldade financeira (acordos lançados nos casos de churn) */}
            {cliente.renegociacoes && cliente.renegociacoes.length > 0 && (
              <Section title={`💰 Renegociações de débito (${cliente.renegociacoes.length})`}>
                <div className="space-y-3">
                  {cliente.renegociacoes.map(r => {
                    const brl = (v?: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    const dt = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
                    return (
                      <div key={r.id} className="rounded-xl border p-4" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                          <span className="text-sm font-bold text-emerald-800">Acordo de {dt(r.reneg_data)}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{r.motivo_principal || 'Dificuldade financeira'}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm" style={{ color: 'var(--t-text-secondary)' }}>
                          <div><span className="text-xs block" style={{ color: 'var(--t-text-muted)' }}>Mensalidade (cadastro)</span><b style={{ color: 'var(--t-text-primary)' }}>{brl(r.resumo?.mensalidade_atual)}</b></div>
                          <div><span className="text-xs block" style={{ color: 'var(--t-text-muted)' }}>Valor devido</span><b style={{ color: 'var(--t-text-primary)' }}>{brl(r.reneg_valor_devido)}</b></div>
                          <div><span className="text-xs block" style={{ color: 'var(--t-text-muted)' }}>Entrada</span><b style={{ color: 'var(--t-text-primary)' }}>{brl(r.reneg_valor_entrada)}</b></div>
                          <div><span className="text-xs block" style={{ color: 'var(--t-text-muted)' }}>Parcelamento</span><b className="text-emerald-700">{r.reneg_parcelas && r.reneg_parcelas > 0 ? `${r.reneg_parcelas}x de ${brl(r.valor_parcela)}` : 'À vista'}</b></div>
                          <div><span className="text-xs block" style={{ color: 'var(--t-text-muted)' }}>Próximo vencimento</span><b style={{ color: '#b45309' }}>{dt(r.reneg_proximo_vencimento)}</b></div>
                          <div><span className="text-xs block" style={{ color: 'var(--t-text-muted)' }}>Responsável</span><b style={{ color: 'var(--t-text-primary)' }}>{r.reneg_responsavel || '—'}</b></div>
                        </div>
                        {(r.reneg_como_mantido || r.reneg_resultado) && (
                          <div className="mt-2 pt-2 border-t text-xs space-y-1" style={{ borderColor: '#bbf7d0', color: 'var(--t-text-secondary)' }}>
                            {r.reneg_como_mantido && <p><b>O que foi feito:</b> {r.reneg_como_mantido}</p>}
                            {r.reneg_resultado && <p><b>Como ficou:</b> {r.reneg_resultado}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>
        )}

        {activeTab === 'ativos' && (
          <div className="space-y-5">
            {pesquisas.length > 0 && (
              <Section title={`Pesquisas de satisfação (${pesquisas.length})`}>
                {/* Resumo da última pesquisa em destaque */}
                {(() => {
                  const ultima = pesquisas[0];
                  const score = ultima.score && ultima.score > 0 ? ultima.score
                    : ultima.nota_atendimento
                      ? Math.round(((ultima.nota_atendimento - 1) / 4) * 0.25 * 100 + ((ultima.nota_conhecimento - 1) / 4) * 0.15 * 100 + ((ultima.nota_geral - 1) / 4) * 0.15 * 100 + 20)
                      : Math.round(((((ultima.nota_suporte + ultima.nota_sistema) / 2) - 1) / 4) * 100);
                  const scoreColor = score >= 90 ? '#15803d' : score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
                  return (
                    <div className="mb-3 rounded-xl border-2 p-4" style={{ borderColor: scoreColor + '40', background: scoreColor + '08' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                          <svg width={52} height={52} style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx={26} cy={26} r={22} fill="none" stroke="#e2e8f0" strokeWidth={4} />
                            <circle cx={26} cy={26} r={22} fill="none" stroke={scoreColor} strokeWidth={4}
                              strokeDasharray={`${(score / 100) * 2 * Math.PI * 22} ${2 * Math.PI * 22}`} strokeLinecap="round" />
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
                            <span style={{ fontSize: 7, color: 'var(--t-text-muted)' }}>/100</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold mb-1" style={{ color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Última pesquisa</p>
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: scoreColor + '20', color: scoreColor }}>
                              {score >= 90 ? '🏆 Excelente' : score >= 70 ? '✅ Satisfeito' : score >= 50 ? '⚠️ Atenção' : '🚨 Risco'}
                            </span>
                            {ultima.alerta_especial && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🔔 Alerta</span>}
                            {ultima.critico && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠️ Crítico</span>}
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>
                            {new Date(ultima.created_at).toLocaleDateString('pt-BR')}
                            {ultima.respondente_nome && ` · por ${ultima.respondente_nome}`}
                          </p>
                        </div>
                      </div>
                      {ultima.recado && (
                        <p className="text-xs mt-2 italic" style={{ color: '#4A6E8A', borderLeft: '2px solid #90BEF0', paddingLeft: 8 }}>
                          "{ultima.recado}"
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  {pesquisas.map((p: any) => <CardPesquisaCliente key={p.id} p={p} />)}
                </div>
              </Section>
            )}
            <Section title="Dados da base">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Situação (ATIVA/INATIVA)" value={ativosForm.situacao} onChange={v => setAtivosForm(f => ({ ...f, situacao: v }))} placeholder="ATIVA" />
                <Field label="Segmento" value={ativosForm.segmento} onChange={v => setAtivosForm(f => ({ ...f, segmento: v }))} placeholder="Farmácia, Padaria, Varejo…" />
                <Field label="Grupo técnico" value={ativosForm.grupo_tecnico} onChange={v => setAtivosForm(f => ({ ...f, grupo_tecnico: v }))} placeholder="Grupo de atendimento" />
                <Field label="Plano" value={ativosForm.plano} onChange={v => setAtivosForm(f => ({ ...f, plano: v }))} placeholder="BASIC, PRO, PLUS…" />
                <Field label="Contato principal" value={ativosForm.contato} onChange={v => setAtivosForm(f => ({ ...f, contato: v }))} placeholder="Nome do contato" cols={2} />
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--t-text-muted)' }}>
                Campos vindos da importação. Se algum veio em branco, preencha aqui manualmente.
              </p>
            </Section>

            <Section title="Campanha de Ativos — apresentação de produtos">
              <p className="text-xs mb-3" style={{ color: 'var(--t-text-muted)' }}>
                Marque o que já foi apresentado a este cliente (Plus, novas ferramentas, integrações).
              </p>
              <div className="space-y-2">
                {[
                  { k: 'apresentou_plus', label: 'Plano Plus + novas ferramentas apresentado' },
                  { k: 'conhece_dashboard', label: 'Conhece o Dashboard' },
                  { k: 'conhece_mensageria', label: 'Conhece o serviço de mensageria' },
                  { k: 'conhece_gerencial', label: 'Conhece o Gerencial' },
                  { k: 'conhece_atencao_farma', label: 'Conhece a Atenção Farmacêutica' },
                ].map(item => (
                  <label key={item.k} className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer"
                    style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                    <input type="checkbox" checked={(ativosForm as any)[item.k]}
                      onChange={e => setAtivosForm(f => ({ ...f, [item.k]: e.target.checked }))}
                      className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm" style={{ color: 'var(--t-text-primary)' }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Radar de risco">
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer"
                style={{ borderColor: ativosForm.risco_atencao ? '#dc2626' : 'var(--t-card-border)', background: ativosForm.risco_atencao ? '#fef2f2' : 'var(--t-content-bg)' }}>
                <input type="checkbox" checked={ativosForm.risco_atencao}
                  onChange={e => setAtivosForm(f => ({ ...f, risco_atencao: e.target.checked }))}
                  className="w-4 h-4 accent-red-600" />
                <span className="text-sm font-medium" style={{ color: ativosForm.risco_atencao ? '#dc2626' : 'var(--t-text-primary)' }}>
                  ⚠️ Cliente em risco / precisa de atenção
                </span>
              </label>
              <div className="mt-3">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Observações da campanha de ativos</label>
                <textarea value={ativosForm.ativo_observacoes} onChange={e => setAtivosForm(f => ({ ...f, ativo_observacoes: e.target.value }))}
                  rows={3} placeholder="Ex.: interessado em upgrade para Plus; aguardando retorno sobre arquivo fiscal…"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
              </div>
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
