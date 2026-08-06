'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import { FecharLeadModal } from '@/components/ui/FecharLeadModal';
import {
  Plus, Search, X, RefreshCw, Phone, Mail, MapPin, User,
  Building2, FileText, MessageSquare, Loader2, Send,
  Flame, Thermometer, Snowflake, Zap, Tag, Clock,
  ChevronDown, Settings, Paperclip, Save, CheckCircle2,
  TrendingUp, Trophy, Target as TargetIcon, BarChart3, Users as UsersIcon,
  DollarSign, Sparkles, ListChecks, Wrench, Trash2,
  Bell, Lock, Star, Pin,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface KanbanColuna {
  id: string; chave: string; nome: string; cor: string; ordem: number;
  ativa: boolean; fixa: boolean;
}

interface Etiqueta { id: string; nome: string; cor: string; descricao?: string; }

interface LeadEtiqueta { etiqueta: Etiqueta; }

interface Lead {
  id: string; nome: string; razao_social?: string; nome_fantasia?: string;
  cnpj?: string; segmento?: string; cidade?: string; estado?: string;
  qtd_lojas?: number; qtd_caixas?: number; sistema_atual?: string;
  responsavel_nome?: string; responsavel_cargo?: string;
  responsavel_telefone?: string; responsavel_email?: string; responsavel_horario?: string;
  vendedor_nome?: string; supervisor_nome?: string; responsavel_id?: string;
  temperatura: string; origem: string; etapa_comercial: string;
  status_atendimento?: string; motivo_perda?: string;
  valor_estimado?: number; proximo_contato?: string; ultima_obs_at?: string;
  observacoes?: string;
  // UTM
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  campanha_nome?: string; plataforma?: string;
  etiquetas_lead?: LeadEtiqueta[];
  created_at: string; updated_at: string;
  _count?: { atividades: number; propostas: number; observacoes_lead: number };
}

interface Observacao {
  id: string; tipo: string; descricao: string;
  proxima_acao?: string; data_proximo_retorno?: string;
  created_by_name?: string; created_at: string;
  coluna_anterior?: string; coluna_nova?: string;
  temperatura_anterior?: string; temperatura_nova?: string;
}

// Métricas do funil
interface Metricas {
  leads_ativos: number; pipeline_total: number; vendido_mes: number;
  fechados_mes: number; perdidos_mes: number;
  meta_valor: number; meta_falta: number; meta_pct: number;
  meta_trim_valor: number; vendido_trim: number; bonus_valor: number;
  bonus_pct: number; bonus_falta: number; taxa_conversao: number;
  meu_papel: string; eh_vendedor: boolean;
}

// Etapas do funil (config)
interface EtapaFunil {
  id: string; codigo: string; nome: string; cor: string; ordem: number;
  tipo: 'ANDAMENTO'|'FECHAMENTO'|'PERDIDA'|'SEM_PERFIL'|'REATIVACAO';
  conta_pipeline: boolean; visivel_vendedor: boolean; ativa: boolean; fixo: boolean;
}

// Régua motivacional (do funil)
function reguaMotivacional(pct: number): { titulo: string; texto: string; cor: string } {
  if (pct >= 100) return { titulo: 'Meta batida!', texto: 'Agora é hora de superar o próprio resultado.', cor: '#16a34a' };
  if (pct >= 81)  return { titulo: 'Quase na meta', texto: 'Você está muito perto de bater a meta do mês.', cor: '#22c55e' };
  if (pct >= 61)  return { titulo: 'Boa evolução', texto: 'Priorize propostas em negociação para chegar na meta.', cor: '#84cc16' };
  if (pct >= 41)  return { titulo: 'Progresso consistente', texto: 'A meta está cada vez mais próxima. Foque nas oportunidades quentes.', cor: '#eab308' };
  if (pct >= 21)  return { titulo: 'Construindo resultado', texto: 'Continue alimentando o funil e mantendo os retornos em dia.', cor: '#f97316' };
  return                   { titulo: 'Início do mês', texto: 'Cada contato é uma nova oportunidade. Movimente o funil.', cor: '#3b82f6' };
}

const fmtBRL2 = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Temperature config ────────────────────────────────────────────────────────

const TEMP_CONFIG = {
  MUITO_QUENTE: { icon: Zap,         color: '#dc2626', bg: 'rgba(220,38,38,0.10)', label: 'Muito Quente' },
  QUENTE:       { icon: Flame,       color: '#ea580c', bg: 'rgba(234,88,12,0.10)', label: 'Quente' },
  MORNO:        { icon: Thermometer, color: '#d97706', bg: 'rgba(217,119,6,0.10)', label: 'Morno' },
  FRIO:         { icon: Snowflake,   color: '#2563eb', bg: 'rgba(37,99,235,0.10)', label: 'Frio' },
};

const ORIGENS_MANUAL = [
  'Indicação','Prospecção ativa','WhatsApp','Instagram','Facebook',
  'Google','Visita comercial','Cliente antigo','Site','Telefone','Evento','Outro',
];

const SEGMENTOS = [
  'Farmácia','Drogaria','Farmácia de Manipulação','Padaria',
  'Varejo em Geral','Supermercado','Restaurante','Autopeças','Posto de Combustível','Outro',
];

const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const OBS_TIPOS = [
  { value: 'LIGACAO',              label: 'Ligação realizada' },
  { value: 'WHATSAPP',             label: 'WhatsApp enviado' },
  { value: 'EMAIL',                label: 'E-mail enviado' },
  { value: 'REUNIAO',              label: 'Reunião realizada' },
  { value: 'TENTATIVA_SEM_RESP',   label: 'Tentativa sem resposta' },
  { value: 'PEDIU_RETORNO',        label: 'Cliente pediu retorno' },
  { value: 'PEDIU_DESCONTO',       label: 'Cliente pediu desconto' },
  { value: 'PEDIU_PROPOSTA',       label: 'Cliente pediu proposta' },
  { value: 'INFO_IMPORTANTE',      label: 'Informação importante' },
  { value: 'OBSERVACAO_INTERNA',   label: 'Observação interna' },
];

const OBS_ICON: Record<string, React.ElementType> = {
  LIGACAO: Phone, WHATSAPP: MessageSquare, EMAIL: Mail, REUNIAO: UsersIcon,
  TENTATIVA_SEM_RESP: Phone, PEDIU_RETORNO: Bell, PEDIU_DESCONTO: Tag,
  PEDIU_PROPOSTA: FileText, INFO_IMPORTANTE: Star, OBSERVACAO_INTERNA: Lock, SISTEMA: Settings,
};

// ── Status mapping for auto-status ────────────────────────────────────────────
const OBS_STATUS_MAP: Record<string, string> = {
  LIGACAO: 'CONTATO_TENTADO', WHATSAPP: 'CONTATO_TENTADO', EMAIL: 'CONTATO_TENTADO',
  REUNIAO: 'EM_CONVERSA', TENTATIVA_SEM_RESP: 'CONTATO_TENTADO',
  PEDIU_RETORNO: 'AGUARDANDO_RETORNO', PEDIU_PROPOSTA: 'PROPOSTA_NECESSARIA',
};

const fmtDateTime = (s?: string | null) => s
  ? new Date(s).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  : null;

const fmtBRL = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Trilha / auditoria ────────────────────────────────────────────────────────
const ETAPA_TRILHA_LABEL: Record<string, string> = {
  PROSPECCAO: 'Prospecção', QUALIFICACAO: 'Qualificação', APRESENTACAO: 'Apresentação',
  PROPOSTA: 'Proposta', NEGOCIACAO: 'Negociação', FECHAMENTO: 'Fechamento',
};

type TrilhaItem = { data: string; titulo: string; descricao?: string; ator?: string | null; cor: string };

// Junta LeadHistorico (etapas + alterações de dados + atribuição) e observações
// numa única linha do tempo ordenada (mais recente no topo).
function buildTrilhaItens(trilha: any): TrilhaItem[] {
  const itens: TrilhaItem[] = [];
  const corAcao: Record<string, string> = {
    MOVEU_ETAPA: 'var(--t-primary)', FECHOU_VENDA: '#16a34a', MARCOU_PERDIDO: '#dc2626',
    ALTEROU_DADOS: '#7c3aed', ATRIBUIU: '#00BFD1',
  };
  for (const h of (trilha?.trilha || [])) {
    let titulo = h.acao || 'Evento';
    let descricao: string | undefined;
    if (h.acao === 'MOVEU_ETAPA') { titulo = 'Mudou de etapa'; descricao = `${ETAPA_TRILHA_LABEL[h.etapa_anterior] || h.etapa_anterior || '—'} → ${ETAPA_TRILHA_LABEL[h.etapa_destino] || h.etapa_destino || '—'}`; }
    else if (h.acao === 'FECHOU_VENDA') { titulo = 'Venda fechada'; descricao = `Etapa: ${ETAPA_TRILHA_LABEL[h.etapa_destino] || h.etapa_destino}`; }
    else if (h.acao === 'MARCOU_PERDIDO') { titulo = 'Marcado como perdido'; }
    else if (h.acao === 'ALTEROU_DADOS') {
      titulo = 'Dados alterados';
      try {
        const d = typeof h.detalhes === 'string' ? JSON.parse(h.detalhes) : h.detalhes;
        descricao = (d?.mudancas || []).map((m: any) => `${m.label}: ${m.de} → ${m.para}`).join(' · ');
      } catch {}
    }
    itens.push({ data: h.created_at, titulo, descricao, ator: h.ator_nome, cor: corAcao[h.acao] || '#6b7280' });
  }
  for (const o of (trilha?.observacoes || [])) {
    if (o.tipo === 'SISTEMA' && (o.coluna_nova || o.temperatura_nova)) continue; // já coberto pela trilha de etapas
    itens.push({ data: o.created_at, titulo: o.tipo || 'Observação', descricao: o.descricao, ator: o.created_by_name, cor: '#0891b2' });
  }
  return itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

// ── Proposta form data ────────────────────────────────────────────────────────

const MODULOS_PROP = [
  'Frente de Caixa', 'Estoque', 'Financeiro', 'Relatórios', 'Multi-empresa',
  'Controle de Acesso', 'Vendas Online', 'Delivery', 'NFe/NFCe', 'SAT/MFE',
];
const SERVICOS_PROP = [
  'TEF', 'Pacote Fiscal', 'Dashboard', 'WhatsApp / Mensageria',
  'Imendes / Avant', 'Migração / Conversão de Dados', 'Treinamento', 'Suporte Prioritário',
];
const TIPOS_LOJA_PROP = ['Nova Implantação', 'Migração', 'Upgrade', 'Filial', 'Reativação'];
const ORIGENS_PROP = ['Indicação', 'Prospecção', 'WhatsApp', 'Visita', 'Tráfego Pago', 'Cliente Antigo', 'Evento'];
const SEGMENTOS_PROP = ['Varejo', 'Supermercado', 'Farmácia', 'Drogaria', 'Padaria', 'Restaurante', 'Posto de Combustível', 'Autopeças', 'Outro'];

const MENSAGENS_PROP: Record<string, { titulo: string; hero: string; valor: string }[]> = {
  farmacia: [
    { titulo: 'Farmácia com mais controle e menos perda', hero: 'Sua farmácia merece mais controle, menos perdas e decisões mais inteligentes.', valor: 'A Prosystem é uma solução ideal para farmácias que precisam controlar vendas, estoque, caixa, compras e indicadores com mais segurança. Com o Plano Plus, o cliente ganha visão gerencial, relatórios estratégicos, suporte ativo e ferramentas que ajudam a reduzir perdas e melhorar a operação todos os dias.' },
    { titulo: 'Gestão inteligente para drogarias', hero: 'Transforme sua drogaria em uma operação mais rápida, segura e inteligente.', valor: 'A Prosystem ajuda drogarias a organizar a rotina do balcão ao financeiro, integrando vendas, estoque, compras e relatórios. O Plano Plus amplia essa gestão com dashboard, indicadores e recursos que facilitam decisões mais rápidas e reduzem retrabalho.' },
    { titulo: 'Mais velocidade no balcão e no caixa', hero: 'Venda mais rápido, atenda melhor e tenha mais controle da sua farmácia.', valor: 'Para farmácias, velocidade no atendimento e segurança nas informações são essenciais. A Prosystem oferece um sistema preparado para melhorar o fluxo de vendas, reduzir falhas operacionais e garantir mais clareza sobre estoque, caixa e resultados.' },
    { titulo: 'Farmácia preparada para crescer', hero: 'Sua farmácia pronta para crescer com controle, suporte e tecnologia.', valor: 'A Prosystem acompanha o crescimento da farmácia com recursos que organizam a operação, facilitam a gestão e dão mais segurança ao empresário. Com suporte ativo das 7h às 22h e treinamento de 5 meses para novos clientes, a implantação acontece com mais tranquilidade.' },
    { titulo: 'Plano Plus para farmácias exigentes', hero: 'O Plano Plus leva sua farmácia para uma gestão mais estratégica.', valor: 'O Plano Plus é indicado para farmácias que querem mais do que operar vendas. Ele oferece recursos para acompanhar indicadores, entender resultados, melhorar processos e ter uma visão mais completa da empresa, com apoio da equipe Prosystem em toda a jornada.' },
  ],
  padaria: [
    { titulo: 'Padaria com mais controle e menos desperdício', hero: 'Sua padaria merece mais controle, menos desperdício e mais resultado.', valor: 'A Prosystem é ideal para padarias que precisam controlar vendas, estoque, produção, compras, caixa e financeiro com mais clareza. O Plano Plus ajuda o cliente a acompanhar indicadores e tomar decisões melhores para reduzir perdas e aumentar a rentabilidade.' },
    { titulo: 'Gestão inteligente para panificadoras', hero: 'Transforme sua padaria em uma operação mais organizada e lucrativa.', valor: 'A rotina de uma padaria exige controle constante de produção, insumos, vendas e fluxo de caixa. Com a Prosystem, o cliente consegue organizar melhor esses processos, reduzir retrabalho e ter uma visão mais segura do negócio.' },
    { titulo: 'Menos perda, mais margem', hero: 'Reduza perdas e acompanhe melhor a margem da sua padaria.', valor: 'Em padarias, pequenos desperdícios podem comprometer o resultado. A Prosystem ajuda o cliente a acompanhar estoque, compras, vendas e relatórios, facilitando a identificação de pontos de perda e oportunidades de melhoria.' },
    { titulo: 'Plano Plus para padarias que querem mais gestão', hero: 'O Plano Plus leva sua padaria para uma gestão mais estratégica.', valor: 'O Plano Plus é indicado para padarias que desejam mais controle, análise e segurança na tomada de decisão. Com recursos gerenciais, suporte próximo e ferramentas de acompanhamento, o cliente passa a ter uma visão mais completa da operação.' },
  ],
};

const TIPO_OP_MAP: Record<string, string> = {
  NOVA_IMPLANTACAO: 'Nova Implantação', MIGRACAO: 'Migração',
  UPGRADE: 'Upgrade', FILIAL: 'Filial', REATIVACAO: 'Reativação',
};

// ── Small form helpers ────────────────────────────────────────────────────────

function Inp({ label, value, onChange, type = 'text', placeholder = '', required = false }: any) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
        style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}

function Sel({ label, value, onChange, options, required = false }: any) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select value={value ?? ''} onChange={onChange}
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
        style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}>
        <option value="">Selecione</option>
        {options.map((o: any) => (
          <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Txt({ label, value, onChange, rows = 3 }: any) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>{label}</label>
      <textarea value={value ?? ''} onChange={onChange} rows={rows}
        className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
        style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}

function FormField({ label, children, col }: { label: string; children: React.ReactNode; col?: number }) {
  return (
    <div style={{ gridColumn: col === 2 ? 'span 2' : undefined }}>
      <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

// Cor estável por dono do lead (mesma paleta da agenda) — identifica de quem é o
// lead só de olhar o card. Usa responsavel_id; cai p/ created_by se não houver.
const CORES_DONO = ['#4B8EC8', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626', '#0f766e'];
function corDoLead(lead: Lead): string {
  const id = lead.responsavel_id || (lead as any).created_by;
  if (!id) return '#cbd5e1'; // cinza = sem dono
  const hash = String(id).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return CORES_DONO[hash % CORES_DONO.length];
}
function iniciaisDono(nome?: string): string {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

function LeadCard({ lead, onClick, onDragStart, onExcluir, podeExcluir }: {
  lead: Lead; onClick: () => void; onDragStart: (e: React.DragEvent) => void;
  onExcluir: () => void; podeExcluir: boolean;
}) {
  const temp = TEMP_CONFIG[lead.temperatura as keyof typeof TEMP_CONFIG] || TEMP_CONFIG.FRIO;
  const empresa = lead.razao_social || lead.nome_fantasia || lead.nome;
  const tel     = lead.responsavel_telefone;
  const tags    = lead.etiquetas_lead || [];
  const corDono = corDoLead(lead);
  const donoNome = lead.vendedor_nome || lead.responsavel_nome || '';

  const wppLink = tel
    ? `/whatsapp?numero=${tel.replace(/\D/g, '')}&nome=${encodeURIComponent(lead.razao_social || lead.nome || '')}${lead.id ? `&lead=${lead.id}` : ''}`
    : null;

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      className="group relative rounded-xl cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-lg overflow-hidden"
      style={{
        background: 'var(--t-card-bg)',
        border: '1px solid var(--t-card-border)',
        borderLeft: `3px solid ${temp.color}`,
      }}
    >
      <div className="p-3">
        {/* Nome da empresa */}
        <div className="flex items-start justify-between gap-1.5 mb-2">
          <p className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--t-text-primary)' }}>{empresa}</p>
          <span className="flex-shrink-0 opacity-60 mt-0.5" style={{ color: temp.color }}>
            <temp.icon size={10} />
          </span>
        </div>

        {/* Dono */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 text-[8px]"
            style={{ background: corDono, width: 17, height: 17 }}>
            {iniciaisDono(donoNome)}
          </span>
          <span className="text-[10px] truncate font-medium" style={{ color: 'var(--t-text-secondary)' }}>
            {donoNome || 'Sem responsável'}
          </span>
        </div>

        {/* Detalhes linha única */}
        <div className="flex items-center gap-2 flex-wrap">
          {lead.segmento && (
            <span className="text-[9px] font-semibold px-1.5 py-px rounded"
              style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary)' }}>
              {lead.segmento}
            </span>
          )}
          {tel && (
            <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'var(--t-text-muted)' }}>
              <Phone size={8} />{tel}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.slice(0, 2).map(t => (
              <span key={t.etiqueta.id} className="text-[8px] font-semibold px-1.5 py-px rounded-full"
                style={{ background: `${t.etiqueta.cor}18`, color: t.etiqueta.cor, border: `1px solid ${t.etiqueta.cor}30` }}>
                {t.etiqueta.nome}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[8px] font-semibold px-1.5 py-px rounded-full" style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary)' }}>
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--t-card-border)' }}>
        <div className="flex items-center gap-2">
          {lead.proximo_contato && new Date(lead.proximo_contato) <= new Date() && (
            <Clock size={9} style={{ color: '#dc2626' }} />
          )}
          {(lead._count?.observacoes_lead || 0) > 0 && (
            <span className="text-[9px] font-medium" style={{ color: 'var(--t-text-muted)' }}>
              {lead._count?.observacoes_lead} obs.
            </span>
          )}
          {lead.origem && (
            <span className="text-[9px]" style={{ color: 'var(--t-text-muted)' }}>
              {lead.origem.toLowerCase().replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {podeExcluir && (
            <button
              onClick={e => { e.stopPropagation(); onExcluir(); }}
              onDragStart={e => e.preventDefault()}
              title="Excluir lead"
              className="flex items-center justify-center rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
              style={{ width: 20, height: 20 }}
            >
              <Trash2 size={11} style={{ color: '#dc2626' }} />
            </button>
          )}
          {wppLink && (
            <a
              href={wppLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              onDragStart={e => e.preventDefault()}
              title={`WhatsApp: ${tel}`}
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 20, height: 20, background: '#25D366' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.532 5.847L.057 23.617a.75.75 0 0 0 .921.921l5.696-1.489A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.667-.523-5.181-1.432l-.371-.218-3.383.885.898-3.285-.237-.385A9.958 9.958 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  // Atribuição de vendedor (só supervisão) — isGestor já é declarado mais abaixo
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  // Filtro do quadro: '' = Total (todos), ou id de um vendedor (só gestor).
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [atribuindo, setAtribuindo] = useState(false);

  const [colunas, setColunas]     = useState<KanbanColuna[]>([]);
  const [kanban, setKanban]       = useState<Record<string, Lead[]>>({});
  // Quadros comerciais (Pipeline + Follow-up + customizados)
  const [quadros, setQuadros]       = useState<any[]>([]);
  const [quadroAtivo, setQuadroAtivo] = useState<any | null>(null); // null = Pipeline (kanban legado)
  const [showNewQuadro, setShowNewQuadro] = useState(false);
  const [newQuadro, setNewQuadro] = useState<{ nome: string; cor: string; colunas: string }>({ nome: '', cor: 'var(--t-primary)', colunas: 'A fazer, Em andamento, Concluído' });
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch]       = useState('');

  // Detail panel
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailTab, setDetailTab] = useState<'dados'|'atendimento'|'proposta'|'arquivos'|'trilha'>('dados');
  // Trilha / auditoria do lead (só supervisão)
  const [trilha, setTrilha] = useState<any | null>(null);
  const [trilhaLoading, setTrilhaLoading] = useState(false);
  const [editForm, setEditForm]   = useState<any>({});
  const [savingLead, setSavingLead] = useState(false);
  const [savedLeadOk, setSavedLeadOk] = useState(false);

  // Observações
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsForm, setObsForm] = useState({ tipo: '', descricao: '', proxima_acao: '', data_proximo_retorno: '' });
  const [addingObs, setAddingObs] = useState(false);
  const [agendaForm, setAgendaForm] = useState({ titulo: '', tipo: 'LIGACAO', data: '', hora: '' });
  const [showAgendaForm, setShowAgendaForm] = useState(false);

  // Modals
  const [showNewLead, setShowNewLead]     = useState(false);
  const [showNewCol, setShowNewCol]       = useState(false);
  const [showNewEtiq, setShowNewEtiq]     = useState(false);
  const [showPerda, setShowPerda]         = useState(false);

  const [newLeadForm, setNewLeadForm] = useState<any>({ temperatura: 'FRIO', origem: '', modulos_inclusos: [], servicos_adicionais: [] });
  const [newLeadSection, setNewLeadSection] = useState(0);
  const [savingNewLead, setSavingNewLead] = useState(false);

  const [newColForm, setNewColForm]   = useState({ nome: '', cor: '#6b7280' });
  const [newEtiqForm, setNewEtiqForm] = useState({ nome: '', cor: '#4B8EC8', descricao: '' });
  const [perdaMotivo, setPerdaMotivo] = useState('');
  const [movingToPerda, setMovingToPerda] = useState<Lead | null>(null);

  // Modal de fechamento (lead movido para ACEITO/FECHADO)
  const [showFechamento, setShowFechamento] = useState(false);
  const [movingToFechamento, setMovingToFechamento] = useState<Lead | null>(null);

  // Drag-and-drop
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null);
  const [dragOverCol, setDragOverCol]   = useState<string | null>(null);

  // Exclusão de lead (com motivo obrigatório)
  const [excluindoLead, setExcluindoLead] = useState<Lead | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [excluindoSaving, setExcluindoSaving] = useState(false);

  // Funil — métricas, etapas, controle total
  const [metricas, setMetricas]     = useState<Metricas | null>(null);
  const [etapasFunil, setEtapasFunil] = useState<EtapaFunil[]>([]);
  const [showConfigFunil, setShowConfigFunil] = useState(false);
  const [showControle, setShowControle] = useState(false);
  const [controleData, setControleData] = useState<any[]>([]);
  const [showNovaEtapa, setShowNovaEtapa] = useState(false);
  const [formEtapa, setFormEtapa] = useState({ codigo: '', nome: '', cor: '#6b7280', ordem: 99, tipo: 'ANDAMENTO' as EtapaFunil['tipo'], conta_pipeline: true });

  const isGestor   = user?.role === 'CEO' || user?.role?.includes('SUPERVISAO') || user?.role === 'ADMIN';
  const isVendedor = user?.role === 'VENDEDOR';
  const regua      = metricas ? reguaMotivacional(metricas.meta_pct) : null;

  // Proposta form inside lead detail
  const [propostaForm, setPropostaForm] = useState<any>({});
  const [propostaSection, setPropostaSection] = useState(0);
  const [pModeloSeg, setPModeloSeg]     = useState('');
  const [pModeloIdx, setPModeloIdx]     = useState('');
  const [savingProposta, setSavingProposta] = useState(false);
  const [propostaGerada, setPropostaGerada] = useState<any>(null);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      // Quando há um quadro não-pipeline ativo, o kanban vem dele; senão, o legado.
      const kanbanPromise = (quadroAtivo && quadroAtivo.tipo !== 'PIPELINE')
        ? apiClient.getQuadroKanban(quadroAtivo.id)
        : apiClient.getLeadsKanban(filtroVendedor || undefined);
      const [kanbanRes, etiqRes, metricasRes, boardRes] = await Promise.all([
        kanbanPromise,
        apiClient.getEtiquetas(),
        apiClient.client.get('/funil/metricas').catch(() => null),
        apiClient.client.get('/funil/board').catch(() => null),
      ]);
      const kd = kanbanRes.data.data;
      setColunas(kd.colunas || []);
      setKanban(kd.leads || {});
      setEtiquetas(etiqRes.data.data || []);
      if (metricasRes) setMetricas(metricasRes.data.data || null);
      if (boardRes) setEtapasFunil((boardRes.data.data.etapas || []).map((e: any) => ({
        id: e.id, codigo: e.codigo, nome: e.nome, cor: e.cor, ordem: e.ordem,
        tipo: e.tipo, conta_pipeline: e.conta_pipeline,
        visivel_vendedor: e.visivel_vendedor, ativa: e.ativa, fixo: e.fixo,
      })));
    } catch (e) { console.error(e); }
    // (vendedores p/ atribuição carregados à parte abaixo)
    finally { setDataLoading(false); }
  }, [quadroAtivo, filtroVendedor]);

  // Carrega a lista de quadros disponíveis (Pipeline, Follow-up, customizados).
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getQuadros().then(r => setQuadros(r.data?.data || [])).catch(() => {});
  }, [isAuthenticated]);

  // Carrega vendedores p/ o dropdown de atribuição (supervisão)
  useEffect(() => {
    if (isGestor) apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
  }, [isGestor]);

  // Atribui o lead aberto a um vendedor (cria alerta no sininho dele)
  // Cria um novo quadro (gestor). Colunas separadas por vírgula.
  const criarQuadro = async () => {
    if (!newQuadro.nome.trim()) { console.warn('Informe o nome do quadro'); return; }
    const colunas = newQuadro.colunas.split(',').map(s => s.trim()).filter(Boolean).map(nome => ({ nome }));
    try {
      const r = await apiClient.criarQuadro({ nome: newQuadro.nome.trim(), cor: newQuadro.cor, colunas });
      setShowNewQuadro(false);
      setNewQuadro({ nome: '', cor: 'var(--t-primary)', colunas: 'A fazer, Em andamento, Concluído' });
      const lista = await apiClient.getQuadros();
      setQuadros(lista.data?.data || []);
      const criado = (lista.data?.data || []).find((q: any) => q.id === r.data?.data?.id);
      if (criado) setQuadroAtivo(criado);
    } catch (e: any) {
      console.error('Erro ao criar quadro.', e);
    }
  };

  // Exclusão lógica: o lead sai de todos os resultados e fica só na auditoria.
  const excluirLead = async (lead: Lead) => {
    const motivo = prompt(`Excluir o lead "${lead.nome}"?\nEle sairá de TODAS as listas, quadro, dashboard e metas — ficando apenas na auditoria.\n\nMotivo da exclusão (opcional):`) ?? undefined;
    // prompt cancelado retorna null → não exclui
    if (motivo === undefined) return;
    try {
      await apiClient.deleteLead(lead.id, motivo || undefined);
      setSelectedLead(null);
      await loadData();
    } catch (e: any) {
      console.error('Erro ao excluir o lead.', e);
    }
  };

  const atribuirVendedor = async (leadId: string, vendedorId: string) => {
    if (!vendedorId) return;
    setAtribuindo(true);
    try {
      await apiClient.atribuirLeads([leadId], vendedorId);
      const v = vendedores.find(x => x.id === vendedorId);
      setSelectedLead(prev => prev && prev.id === leadId
        ? { ...prev, responsavel_id: vendedorId, vendedor_nome: v?.nome } as Lead : prev);
      await loadData();
    } catch (e: any) { console.error('Erro ao atribuir vendedor.', e); }
    finally { setAtribuindo(false); }
  };

  // Funil: editar/criar/remover etapas
  const editarEtapaFunil = async (etapa: EtapaFunil, dados: Partial<EtapaFunil>) => {
    try {
      await apiClient.client.patch(`/funil/etapas/${etapa.id}`, dados);
      await loadData();
    } catch (e: any) { console.error('Erro', e); }
  };
  const removerEtapaFunil = async (etapa: EtapaFunil) => {
    if (etapa.fixo) { return; }
    if (!confirm(`Remover a etapa "${etapa.nome}"?`)) return;
    try {
      await apiClient.client.delete(`/funil/etapas/${etapa.id}`);
      await loadData();
    } catch (e: any) { console.error('Erro ao remover etapa', e); }
  };
  const criarNovaEtapaFunil = async () => {
    if (!formEtapa.codigo || !formEtapa.nome) return console.warn('Código e nome são obrigatórios');
    try {
      await apiClient.client.post('/funil/etapas', formEtapa);
      setShowNovaEtapa(false);
      setFormEtapa({ codigo: '', nome: '', cor: '#6b7280', ordem: 99, tipo: 'ANDAMENTO', conta_pipeline: true });
      await loadData();
    } catch (e: any) { console.error('Erro ao criar etapa', e); }
  };
  const abrirControle = async () => {
    try {
      const res = await apiClient.client.get('/funil/controle-total');
      setControleData(res.data.data.por_vendedor || []);
      setShowControle(true);
    } catch (e: any) { console.error('Erro ao carregar controle total', e); }
  };

  // Recarrega ao trocar de quadro (Pipeline/Follow-up) ou de filtro — senão a aba
  // do Follow-up mostrava os leads antigos do Pipeline (parecia duplicado).
  useEffect(() => { if (isAuthenticated) loadData(); }, [isAuthenticated, quadroAtivo, filtroVendedor]);

  const openLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setDetailTab('dados');
    setEditForm({ ...lead });
    setSavedLeadOk(false);
    setObservacoes([]);
    setObsLoading(true);
    // Carrega o lead completo do servidor (o objeto do kanban é resumido e pode
    // não ter todos os campos editáveis — causaria perda de dados ao reabrir).
    try {
      const [leadRes, obsRes] = await Promise.all([
        apiClient.getLeadById(lead.id),
        apiClient.getLeadObservacoes(lead.id),
      ]);
      const leadCompleto = leadRes.data?.data || leadRes.data || lead;
      setSelectedLead(leadCompleto);
      setEditForm({ ...leadCompleto });
      setObservacoes(obsRes.data.data || []);
    } catch {
      // Fallback: usa os dados do kanban
    } finally { setObsLoading(false); }
  };

  const setF = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: v }));

  const saveLead = async () => {
    if (!selectedLead) return;
    setSavingLead(true);
    try {
      // NÃO reenviar o objeto inteiro: campos de sistema/relacionamento e datas
      // serializadas derrubavam a validação no backend (400 → dados não salvavam).
      const NAO_ENVIAR = new Set([
        'id', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'created_by',
        'atribuido_em', 'ultima_obs_at', 'deleted_at', 'deleted_by', 'deletado_motivo',
        '_count', 'observacoes', 'etiquetas', 'etiquetas_lead', 'atividades', 'quadros',
        'criado_por', 'responsavel', 'vendedor', 'supervisor',
      ]);
      const payload: any = {};
      for (const [k, v] of Object.entries(editForm as any)) {
        if (NAO_ENVIAR.has(k)) continue;
        if (v === null || v === undefined) continue;
        payload[k] = v;
      }
      if (payload.valor_estimado !== undefined && payload.valor_estimado !== '') payload.valor_estimado = parseFloat(payload.valor_estimado);
      else delete payload.valor_estimado;
      if (!payload.responsavel_email) delete payload.responsavel_email;
      await apiClient.updateLead(selectedLead.id, payload);
      await loadData();
      setSelectedLead(p => p ? { ...p, ...payload } : p);
      setSavedLeadOk(true);
      setTimeout(() => setSavedLeadOk(false), 2000);
    } catch (e: any) {
      const msg = e?.response?.data?.detalhes?.join('\n') || e?.response?.data?.message || e?.message || 'Erro desconhecido';
      console.error('Não foi possível salvar a ficha:', msg);
      console.error('[saveLead]', e?.response?.data || e);
    } finally { setSavingLead(false); }
  };

  const moveColumn = async (lead: Lead, etapa: string) => {
    // Em quadros não-pipeline (ex.: Follow-up), a posição é por quadro (não mexe no pipeline).
    if (quadroAtivo && quadroAtivo.tipo !== 'PIPELINE') {
      try {
        await apiClient.moverLeadNoQuadro(quadroAtivo.id, lead.id, etapa);
        await loadData();
      } catch { /* ignore */ }
      return;
    }
    if (etapa === 'PERDIDO') {
      setMovingToPerda(lead);
      setShowPerda(true);
      return;
    }
    // Lead movido para ACEITO/FECHADO/GANHO → abre modal de fechamento
    if (etapa === 'ACEITO' || etapa === 'FECHADO') {
      setMovingToFechamento(lead);
      setShowFechamento(true);
      return;
    }
    try {
      await apiClient.updateLead(lead.id, { etapa_comercial: etapa });
      await loadData();
      if (selectedLead?.id === lead.id) {
        setSelectedLead(p => p ? { ...p, etapa_comercial: etapa } : p);
        const res = await apiClient.getLeadObservacoes(lead.id);
        setObservacoes(res.data.data || []);
      }
    } catch (e) { console.error(e); }
  };

  const confirmPerda = async () => {
    if (!movingToPerda || !perdaMotivo) return;
    try {
      await apiClient.updateLead(movingToPerda.id, { etapa_comercial: 'PERDIDO', motivo_perda: perdaMotivo, status_atendimento: 'PERDIDO' });
      await loadData();
    } catch (e) { console.error(e); }
    setShowPerda(false); setMovingToPerda(null); setPerdaMotivo('');
  };

  const addObs = async () => {
    if (!selectedLead || !obsForm.tipo || !obsForm.descricao) return;
    setAddingObs(true);
    try {
      const statusApos = OBS_STATUS_MAP[obsForm.tipo];
      await apiClient.addLeadObservacao(selectedLead.id, {
        ...obsForm,
        status_apos: statusApos,
        created_by_name: (user as any)?.nome || 'Usuário',
        data_proximo_retorno: obsForm.data_proximo_retorno || undefined,
      });

      // Se preencheu próxima ação → Agenda, cria a atividade
      if (showAgendaForm && agendaForm.titulo && agendaForm.data && agendaForm.hora) {
        const dataPrevista = new Date(`${agendaForm.data}T${agendaForm.hora}:00`).toISOString();
        await apiClient.createAtividade({
          titulo: agendaForm.titulo,
          tipo: agendaForm.tipo,
          lead_id: selectedLead.id,
          data_prevista: dataPrevista,
          descricao: obsForm.proxima_acao || undefined,
          responsavel_id: (user as any)?.id || undefined,
          vinculo_tipo: 'LEAD',
        });
      }

      const res = await apiClient.getLeadObservacoes(selectedLead.id);
      setObservacoes(res.data.data || []);
      setObsForm({ tipo: '', descricao: '', proxima_acao: '', data_proximo_retorno: '' });
      setAgendaForm({ titulo: '', tipo: 'LIGACAO', data: '', hora: '' });
      setShowAgendaForm(false);
      await loadData();
    } catch (e: any) {
      console.error(e);
      console.error('Não foi possível registrar o contato. Tente novamente.', e);
    } finally { setAddingObs(false); }
  };

  const toggleEtiqueta = async (etiquetaId: string) => {
    if (!selectedLead) return;
    const aplicadas = selectedLead.etiquetas_lead?.map(e => e.etiqueta.id) || [];
    try {
      if (aplicadas.includes(etiquetaId)) {
        await apiClient.removeEtiquetaFromLead(selectedLead.id, etiquetaId);
      } else {
        await apiClient.addEtiquetaToLead(selectedLead.id, etiquetaId);
      }
      await loadData();
      // Refresh selected lead's etiquetas optimistically
      const etq = etiquetas.find(e => e.id === etiquetaId);
      if (!etq) return;
      if (aplicadas.includes(etiquetaId)) {
        setSelectedLead(p => p ? { ...p, etiquetas_lead: (p.etiquetas_lead || []).filter(e => e.etiqueta.id !== etiquetaId) } : p);
      } else {
        setSelectedLead(p => p ? { ...p, etiquetas_lead: [...(p.etiquetas_lead || []), { etiqueta: etq }] } : p);
      }
    } catch (e) { console.error(e); }
  };

  // Mapeia os dados do lead para o formato do formulário de proposta (mesma estrutura
  // usada pela tela aprimorada /propostas-comerciais).
  const mapLeadParaProposta = useCallback((lead: Lead) => ({
    razao_social:         (lead as any).razao_social || lead.nome || '',
    nome_fantasia:        lead.nome_fantasia || '',
    cnpj:                 lead.cnpj || '',
    segmento:             lead.segmento || '',
    cidade:               lead.cidade || '',
    estado:               lead.estado || '',
    maquinas:             lead.qtd_caixas?.toString() || '',
    tipo_loja:            TIPO_OP_MAP[(lead as any).tipo_oportunidade || ''] || '',
    sistema_atual:        lead.sistema_atual || '',
    data_virada:          '',
    responsavel_nome:     lead.responsavel_nome || '',
    responsavel_telefone: lead.responsavel_telefone || '',
    responsavel_email:    lead.responsavel_email || '',
    responsavel_cpf:      '',
    responsavel_cargo:    lead.responsavel_cargo || '',
    responsavel_horario:  lead.responsavel_horario || '',
    vendedor_nome:        lead.vendedor_nome || '',
    vendedor_telefone:    '',
    supervisor_nome:      lead.supervisor_nome || '',
    campanha:             (lead as any).campanha_nome || lead.utm_campaign || '',
    validade:             '',
    origem:               lead.origem || '',
    plano_selecionado:    (lead as any).plano_indicado || (lead as any).plano_interesse || '',
    plano_recomendado:    (lead as any).plano_recomendado || '',
    mensalidade_pro:      '',
    mensalidade_plus:     (lead as any).mensalidade_estimada?.toString() || '',
    modulos_inclusos:     Array.isArray((lead as any).modulos_inclusos) ? (lead as any).modulos_inclusos : [],
    servicos_adicionais:  Array.isArray((lead as any).servicos_adicionais) ? (lead as any).servicos_adicionais : [],
    valor_implantacao:    (lead as any).valor_setup?.toString() || '',
    valor_conversao:      (lead as any).valor_conversao?.toString() || '',
    desconto:             '',
    entrada:              (lead as any).entrada?.toString() || '',
    parcelas:             (lead as any).parcelamento?.toString() || '',
    data_vencimento:      '',
    observacao_cobranca:  '',
    condicao_especial:    (lead as any).condicao_especial || '',
    titulo_proposta:      '',
    frase_hero:           (lead as any).frase_hero || '',
    texto_valor:          (lead as any).texto_valor || '',
    observacoes:          (lead as any).observacoes_comerciais || lead.observacoes || '',
    status:               'RASCUNHO',
  }), []);

  // Gera proposta a partir do lead: leva os dados para a tela ÚNICA de proposta
  // (a aprimorada), pré-preenchida. Evita duplicação de telas de proposta.
  const gerarPropostaDoLead = useCallback((lead: Lead) => {
    try {
      sessionStorage.setItem('prefill_proposta', JSON.stringify(mapLeadParaProposta(lead)));
    } catch { /* ignore */ }
    router.push('/propostas-comerciais');
  }, [mapLeadParaProposta, router]);

  const initPropostaForm = useCallback((lead: Lead) => {
    setPropostaForm({
      razao_social:         (lead as any).razao_social || lead.nome || '',
      nome_fantasia:        lead.nome_fantasia || '',
      cnpj:                 lead.cnpj || '',
      segmento:             lead.segmento || '',
      cidade:               lead.cidade || '',
      estado:               lead.estado || '',
      maquinas:             lead.qtd_caixas?.toString() || '',
      tipo_loja:            TIPO_OP_MAP[(lead as any).tipo_oportunidade || ''] || '',
      sistema_atual:        lead.sistema_atual || '',
      data_virada:          '',
      responsavel_nome:     lead.responsavel_nome || '',
      responsavel_telefone: lead.responsavel_telefone || '',
      responsavel_email:    lead.responsavel_email || '',
      responsavel_cpf:      '',
      responsavel_cargo:    lead.responsavel_cargo || '',
      responsavel_horario:  lead.responsavel_horario || '',
      vendedor_nome:        lead.vendedor_nome || '',
      vendedor_telefone:    '',
      supervisor_nome:      lead.supervisor_nome || '',
      campanha:             (lead as any).campanha_nome || lead.utm_campaign || '',
      validade:             '',
      origem:               lead.origem || '',
      plano_selecionado:    (lead as any).plano_indicado || (lead as any).plano_interesse || '',
      plano_recomendado:    (lead as any).plano_recomendado || '',
      mensalidade_pro:      '',
      mensalidade_plus:     (lead as any).mensalidade_estimada?.toString() || '',
      modulos_inclusos:     Array.isArray((lead as any).modulos_inclusos) ? (lead as any).modulos_inclusos : [],
      servicos_adicionais:  Array.isArray((lead as any).servicos_adicionais) ? (lead as any).servicos_adicionais : [],
      valor_implantacao:    (lead as any).valor_setup?.toString() || '',
      valor_conversao:      (lead as any).valor_conversao?.toString() || '',
      desconto:             '',
      entrada:              (lead as any).entrada?.toString() || '',
      parcelas:             (lead as any).parcelamento?.toString() || '',
      data_vencimento:      '',
      observacao_cobranca:  '',
      condicao_especial:    (lead as any).condicao_especial || '',
      titulo_proposta:      '',
      frase_hero:           (lead as any).frase_hero || '',
      texto_valor:          (lead as any).texto_valor || '',
      observacoes:          (lead as any).observacoes_comerciais || lead.observacoes || '',
      status:               'RASCUNHO',
    });
    setPropostaSection(0);
    setPModeloSeg('');
    setPModeloIdx('');
    setPropostaGerada(null);
  }, []);

  useEffect(() => {
    if (detailTab === 'proposta' && selectedLead) initPropostaForm(selectedLead);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailTab, selectedLead?.id]);

  // Carrega a trilha/auditoria ao abrir a aba (só supervisão)
  useEffect(() => {
    if (detailTab === 'trilha' && selectedLead && isGestor) {
      setTrilha(null); setTrilhaLoading(true);
      apiClient.getLeadAuditoria(selectedLead.id)
        .then(r => setTrilha(r.data.data))
        .catch(() => setTrilha(null))
        .finally(() => setTrilhaLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailTab, selectedLead?.id]);

  const setPF = (k: string, v: any) => setPropostaForm((p: any) => ({ ...p, [k]: v }));
  const togglePF = (k: 'modulos_inclusos' | 'servicos_adicionais', val: string) =>
    setPropostaForm((p: any) => {
      // Garante array: o banco podia devolver {} (objeto) nesses campos Json.
      const atual: string[] = Array.isArray(p[k]) ? p[k] : [];
      return { ...p, [k]: atual.includes(val) ? atual.filter((x: string) => x !== val) : [...atual, val] };
    });

  const handleExcluirLead = async () => {
    if (!excluindoLead || !motivoExclusao.trim()) return;
    setExcluindoSaving(true);
    try {
      await apiClient.deleteLead(excluindoLead.id, motivoExclusao.trim());
      setExcluindoLead(null);
      setMotivoExclusao('');
      await loadData();
    } catch (e: any) {
      console.error('Erro ao excluir lead.', e?.response?.data?.message || e);
    } finally {
      setExcluindoSaving(false);
    }
  };

  const handleSaveProposta = async () => {
    if (!selectedLead) return;
    if (!propostaForm.razao_social?.trim()) { console.warn('Razão social é obrigatória'); return; }
    setSavingProposta(true);
    try {
      // Nunca retorna NaN (NaN passa no z.number() mas o Prisma rejeita Float NaN
      // → 500). Aceita "1.234,56".
      const pNum = (v: any): number | undefined => {
        if (v === undefined || v === null || `${v}`.trim() === '') return undefined;
        let s = `${v}`.trim().replace(/[^\d.,-]/g, '');
        if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : undefined;
      };
      const toIso = (v?: string): string | undefined => {
        if (!v) return undefined;
        const d = new Date(v);
        return isNaN(d.getTime()) ? undefined : d.toISOString();
      };
      const impl = pNum(propostaForm.valor_implantacao) || 0;
      const conv = pNum(propostaForm.valor_conversao) || 0;
      const desc = pNum(propostaForm.desconto) || 0;
      const vFinal = impl + conv - desc;
      const ent  = pNum(propostaForm.entrada) || 0;
      const parc = pNum(propostaForm.parcelas) ? Math.round(pNum(propostaForm.parcelas)!) : 0;
      const parcVal = parc > 0 ? parseFloat(((vFinal - ent) / parc).toFixed(2)) : undefined;

      const payload: any = {
        ...propostaForm,
        lead_id:          selectedLead.id,
        maquinas:         pNum(propostaForm.maquinas),
        mensalidade_pro:  pNum(propostaForm.mensalidade_pro),
        mensalidade_plus: pNum(propostaForm.mensalidade_plus),
        valor_implantacao:pNum(propostaForm.valor_implantacao),
        valor_conversao:  pNum(propostaForm.valor_conversao),
        desconto:         pNum(propostaForm.desconto),
        valor_final:      vFinal || undefined,
        entrada:          pNum(propostaForm.entrada),
        parcelas:         parc || undefined,
        valor_parcela:    parcVal,
        validade:         toIso(propostaForm.validade),
      };
      Object.keys(payload).forEach(k => {
        const v = payload[k];
        if (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) delete payload[k];
      });

      const res = await apiClient.createPropostaComercial(payload);
      setPropostaGerada(res.data.data);

      // Move o lead automaticamente para "Proposta Enviada" no kanban
      await apiClient.updateLead(selectedLead.id, {
        etapa_comercial: 'PROPOSTA_ENVIADA',
        status_atendimento: 'PROPOSTA_ENVIADA',
      });
      setSelectedLead(p => p ? { ...p, etapa_comercial: 'PROPOSTA_ENVIADA', status_atendimento: 'PROPOSTA_ENVIADA' } : p);

      const obsRes = await apiClient.getLeadObservacoes(selectedLead.id);
      setObservacoes(obsRes.data.data || []);
      await loadData();
    } catch (e: any) {
      console.error('Erro ao salvar proposta', e);
    } finally {
      setSavingProposta(false);
    }
  };

  const createNewCol = async () => {
    if (!newColForm.nome) return;
    try {
      await apiClient.createKanbanColuna(newColForm);
      await loadData();
      setShowNewCol(false); setNewColForm({ nome: '', cor: '#6b7280' });
    } catch (e) { console.error(e); }
  };

  const createNewEtiq = async () => {
    if (!newEtiqForm.nome) return;
    try {
      await apiClient.createEtiqueta(newEtiqForm);
      const res = await apiClient.getEtiquetas();
      setEtiquetas(res.data.data || []);
      setShowNewEtiq(false); setNewEtiqForm({ nome: '', cor: '#4B8EC8', descricao: '' });
    } catch (e) { console.error(e); }
  };

  const createNewLead = async () => {
    setSavingNewLead(true);
    try {
      const payload: any = { ...newLeadForm };
      if (!payload.nome) payload.nome = payload.razao_social || payload.responsavel_nome || payload.empresa || 'Lead';

      // Campos NUMÉRICOS: converter de string p/ número; vazios são removidos
      // (senão o backend recusa "5000" como string → "Dados inválidos").
      const numericos = ['qtd_lojas', 'qtd_caixas', 'valor_estimado', 'valor_setup', 'valor_conversao', 'mensalidade_estimada', 'entrada', 'parcelamento', 'probabilidade'];
      for (const k of numericos) {
        const v = payload[k];
        if (v === '' || v === null || v === undefined) { delete payload[k]; continue; }
        const n = Number(String(v).replace(',', '.'));
        if (Number.isNaN(n)) delete payload[k]; else payload[k] = n;
      }
      // Strings vazias em campos opcionais → remover (evita validação .email()/.datetime()).
      for (const k of Object.keys(payload)) {
        if (payload[k] === '' && !['nome', 'origem'].includes(k)) delete payload[k];
      }
      if (!payload.responsavel_email) delete payload.responsavel_email;
      if (!payload.email) delete payload.email;
      // origem é obrigatória no back (default MANUAL) — string vazia vira MANUAL.
      if (!payload.origem) payload.origem = 'MANUAL';
      // Lead novo entra sempre na 1ª etapa do funil, garantindo card visível.
      if (!payload.etapa_comercial) payload.etapa_comercial = 'NOVO_LEAD';

      const res = await apiClient.createLead(payload);
      const novo = res?.data?.data;
      await loadData();
      setShowNewLead(false);
      setNewLeadForm({ temperatura: 'FRIO', origem: '', modulos_inclusos: [], servicos_adicionais: [] });
      setNewLeadSection(0);
      // Abre o lead recém-criado (feedback claro de que entrou no funil).
      if (novo?.id) setSelectedLead(novo);
    } catch (e: any) {
      // NÃO engole o erro: mostra o motivo para o usuário e mantém o form aberto.
      const msg = e?.response?.data?.message
        || e?.response?.data?.errors?.[0]?.message
        || 'Não foi possível salvar o lead. Verifique os campos e tente novamente.';
      console.error('Erro ao salvar lead:', msg);
      console.error('createLead falhou:', e?.response?.data || e);
    } finally {
      setSavingNewLead(false);
    }
  };

  // Filtered kanban
  const filtered = Object.fromEntries(Object.entries(kanban).map(([col, leads]) => [
    col, search ? leads.filter(l => [l.nome, l.razao_social, l.responsavel_nome, l.segmento].some(v => v?.toLowerCase().includes(search.toLowerCase()))) : leads,
  ]));

  const colConfig = (chave: string) => colunas.find(c => c.chave === chave) || { nome: chave, cor: '#6b7280' };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--t-sidebar-grad-from)' }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--t-primary)' }} /></div>;
  }

  const totalLeads = Object.values(kanban).reduce((s, a) => s + a.length, 0);

  return (
    <DashboardLayout>
      <div className="w-full space-y-4" style={{ background: 'var(--t-content-bg)', minHeight: 'calc(100vh - 56px)' }}>

        {/* ═══ 1. HEADER ═══════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--t-text-primary)' }}>Pipeline Comercial</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              {isVendedor ? 'Seus leads, metas e bônus' : 'Performance da equipe comercial'}
              {' · '}<span style={{ color: 'var(--t-primary)' }}>{totalLeads} leads</span> no funil
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-secondary)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..." className="pl-8 pr-3 py-2 text-xs rounded-lg outline-none" style={{ border: '1px solid var(--t-card-border)', width: 190, color: 'var(--t-text-primary)' }} />
            </div>
            {/* Busca */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--t-text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..." className="pl-8 pr-3 h-8 text-xs rounded-lg outline-none" style={{ border: '1px solid var(--t-card-border)', width: 180, color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }} />
            </div>
            {/* Filtro vendedor */}
            {isGestor && (
              <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
                className="h-8 px-3 text-xs rounded-lg outline-none"
                style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: filtroVendedor ? 'var(--t-primary-light)' : 'var(--t-card-bg)', maxWidth: 160 }}>
                <option value="">Todos (Total)</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
            {/* Grupo de ações secundárias */}
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
              <button onClick={loadData} title="Atualizar" className="h-8 w-8 flex items-center justify-center transition-colors" style={{ borderRight: '1px solid var(--t-card-border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} style={{ color: 'var(--t-primary)' }} />
              </button>
              <ExportButton nome="leads" titulo="Pipeline Comercial — Leads" small
                linhas={Object.values(kanban).flat()}
                colunas={[
                  { header: 'Lead', value: (l: Lead) => l.razao_social || l.nome_fantasia || l.nome },
                  { header: 'CNPJ', value: (l: Lead) => (l as any).cnpj || '' },
                  { header: 'Segmento', value: (l: Lead) => l.segmento || '' },
                  { header: 'Etapa', value: (l: Lead) => l.etapa_comercial },
                  { header: 'Temperatura', value: (l: Lead) => l.temperatura },
                  { header: 'Vendedor', value: (l: Lead) => l.vendedor_nome || '' },
                  { header: 'Valor estimado (R$)', value: (l: Lead) => (l as any).valor_estimado ?? '' },
                  { header: 'Origem', value: (l: Lead) => l.origem || '' },
                ]}
              />
              <button onClick={() => setShowNewEtiq(true)} title="Etiquetas"
                className="h-8 px-3 flex items-center gap-1 text-xs transition-colors" style={{ borderLeft: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Tag size={11} /> Etiqueta
              </button>
              {!quadroAtivo && (
                <button onClick={() => setShowNewCol(true)} title="Nova coluna"
                  className="h-8 px-3 flex items-center gap-1 text-xs transition-colors" style={{ borderLeft: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Plus size={11} /> Coluna
                </button>
              )}
              {isGestor && !quadroAtivo && (
                <>
                  <button onClick={() => setShowConfigFunil(true)} title="Configurar Funil"
                    className="h-8 px-3 flex items-center gap-1 text-xs transition-colors" style={{ borderLeft: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <Wrench size={11} /> Configurar Funil
                  </button>
                  <button onClick={abrirControle} title="Controle Total"
                    className="h-8 px-3 flex items-center gap-1 text-xs transition-colors" style={{ borderLeft: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <BarChart3 size={11} /> Controle Total
                  </button>
                </>
              )}
            </div>
            <button onClick={() => { setNewLeadForm({ temperatura: 'FRIO', origem: '', modulos_inclusos: [], servicos_adicionais: [], vendedor_nome: (user as any)?.nome || '' }); setShowNewLead(true); }}
              className="ps-btn-primary h-8 flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold text-white">
              <Plus size={13} /> Novo Lead
            </button>
          </div>
        </div>

        {/* ═══ SELETOR DE QUADROS (Pipeline · Follow-up · customizados) ═════ */}
        {quadros.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {quadros.map((q: any) => {
              const ativo = (q.tipo === 'PIPELINE' && !quadroAtivo) || quadroAtivo?.id === q.id;
              return (
                <button key={q.id}
                  onClick={() => setQuadroAtivo(q.tipo === 'PIPELINE' ? null : q)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: ativo ? q.cor : 'var(--t-card-bg)',
                    color: ativo ? '#fff' : 'var(--t-text-secondary)',
                    border: `1.5px solid ${ativo ? q.cor : 'var(--t-card-border)'}`,
                  }}>
                  {q.nome}
                </button>
              );
            })}
            {isGestor && (
              <button onClick={() => setShowNewQuadro(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ border: '1.5px dashed #D8E8F5', color: 'var(--t-primary)' }}>
                <Plus size={12} /> Novo quadro
              </button>
            )}
          </div>
        )}
        {quadroAtivo?.descricao && (
          <p className="text-xs px-1" style={{ color: 'var(--t-text-secondary)' }}>{quadroAtivo.descricao}</p>
        )}

        {/* ═══ 2. KPI CARDS ═══════════════════════════════════════════════ */}
        {metricas && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <KpiCard icon={UsersIcon}     label="Leads ativos"   value={metricas.leads_ativos.toString()} color="#3b82f6" />
            <KpiCard icon={TrendingUp}    label="Pipeline"       value={fmtBRL2(metricas.pipeline_total)} color="#8b5cf6" />
            <KpiCard icon={DollarSign}    label="Vendido no mês" value={fmtBRL2(metricas.vendido_mes)}    color="#22c55e" />
            {isVendedor && metricas.meta_valor > 0 && (
              <KpiCard icon={TargetIcon}  label="Meta do mês"    value={fmtBRL2(metricas.meta_valor)}     color="#f97316" />
            )}
            {isVendedor && metricas.meta_valor > 0 && (
              <KpiCard icon={Trophy}      label="% Meta"
                value={`${metricas.meta_pct.toFixed(1)}%`}
                color={metricas.meta_pct >= 100 ? '#16a34a' : metricas.meta_pct >= 60 ? '#eab308' : '#ef4444'} />
            )}
            {isVendedor && metricas.meta_trim_valor > 0 && (
              <KpiCard icon={Sparkles}    label="Bônus trim."    value={`${metricas.bonus_pct.toFixed(0)}%`} color="#7c3aed" />
            )}
            <KpiCard icon={BarChart3}     label="Conversão"      value={`${metricas.taxa_conversao.toFixed(1)}%`} color="#0ea5e9" />
            <KpiCard icon={X}             label="Perdidos mês"   value={metricas.perdidos_mes.toString()} color="#ef4444" />
          </div>
        )}

        {/* ═══ 3. BLOCO MOTIVACIONAL (vendedor com meta) ══════════════════ */}
        {isVendedor && metricas && metricas.meta_valor > 0 && regua && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Meta mensal */}
            <div className="rounded-2xl ps-cardp-5" style={{ border: '1px solid var(--t-card-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--t-text-secondary)' }}>Minha meta do mês</p>
                  <p className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--t-text-primary)' }}>{fmtBRL2(metricas.meta_valor)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>Falta</p>
                  <p className="text-lg font-bold" style={{ color: regua.cor }}>{fmtBRL2(metricas.meta_falta)}</p>
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'var(--t-content-bg)' }}>
                <div className="h-full transition-all" style={{ width: `${Math.min(100, metricas.meta_pct)}%`, background: regua.cor }} />
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--t-text-secondary)' }}>
                Vendido: <strong style={{ color: 'var(--t-text-primary)' }}>{fmtBRL2(metricas.vendido_mes)}</strong> · {metricas.meta_pct.toFixed(1)}% da meta
              </p>
              <div className="rounded-xl p-3 border-l-4" style={{ background: 'var(--t-content-bg)', borderLeftColor: regua.cor }}>
                <p className="text-sm font-bold" style={{ color: regua.cor }}>{regua.titulo}</p>
                <p className="text-xs mt-0.5" style={{ color: '#4A6E8A' }}>{regua.texto}</p>
              </div>
            </div>
            {/* Bônus trimestral */}
            {metricas.meta_trim_valor > 0 && (
              <div className="rounded-2xl ps-cardp-5" style={{ border: '1px solid var(--t-card-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--t-text-secondary)' }}>Meu bônus trimestral</p>
                    <p className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--t-text-primary)' }}>{fmtBRL2(metricas.bonus_valor)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>Progresso</p>
                    <p className="text-lg font-bold" style={{ color: '#7c3aed' }}>{metricas.bonus_pct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'var(--t-content-bg)' }}>
                  <div className="h-full transition-all" style={{ width: `${Math.min(100, metricas.bonus_pct)}%`, background: '#7c3aed' }} />
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--t-text-secondary)' }}>
                  Meta tri.: <strong style={{ color: 'var(--t-text-primary)' }}>{fmtBRL2(metricas.meta_trim_valor)}</strong> · Vendido: <strong style={{ color: 'var(--t-text-primary)' }}>{fmtBRL2(metricas.vendido_trim)}</strong> · Falta: <strong style={{ color: 'var(--t-text-primary)' }}>{fmtBRL2(metricas.bonus_falta)}</strong>
                </p>
                <div className="rounded-xl p-3 border-l-4" style={{ background: 'var(--t-content-bg)', borderLeftColor: '#7c3aed' }}>
                  <p className="text-xs" style={{ color: '#4A6E8A' }}>
                    {metricas.bonus_pct >= 100 ? '🎉 Bônus liberado! Mantenha o ritmo para superar.' : 'Você está no caminho certo para liberar seu bônus. Mantenha o ritmo!'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ 4. KANBAN PRINCIPAL ════════════════════════════════════════ */}
        <div className="rounded-2xl ps-card overflow-hidden"
          style={{ border: '1px solid var(--t-card-border)', boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
            <div className="flex items-center gap-2">
              <ListChecks size={14} style={{ color: 'var(--t-primary)' }} />
              <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--t-primary)' }}>Quadro de Leads</p>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>Arraste os cards para mover entre etapas · Mover para "Perdido" exige justificativa</p>
          </div>
          <div className="overflow-x-auto overflow-y-hidden"
            style={{ height: 'min(72vh, 720px)' }}
            onDragEnd={() => { setDraggingLead(null); setDragOverCol(null); }}>
          <div className="flex h-full gap-3 p-4" style={{ minWidth: `${colunas.length * 230}px` }}>
            {colunas.map(col => {
              const colLeads = filtered[col.chave] || [];
              const isOver   = dragOverCol === col.chave;
              const isDraggingToSame = draggingLead?.etapa_comercial === col.chave;
              return (
                <div key={col.chave}
                  className="flex flex-col rounded-xl flex-shrink-0 transition-colors"
                  style={{
                    width: 224,
                    background: isOver && !isDraggingToSame ? `${col.cor}08` : 'var(--t-card-bg)',
                    border: `1px solid ${isOver && !isDraggingToSame ? col.cor : `${col.cor}22`}`,
                    outline: isOver && !isDraggingToSame ? `3px solid ${col.cor}18` : 'none',
                    outlineOffset: -1,
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                  onDragEnter={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverCol(null);
                    if (draggingLead && draggingLead.etapa_comercial !== col.chave) {
                      moveColumn(draggingLead, col.chave);
                    }
                    setDraggingLead(null);
                  }}
                >
                  <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid var(--t-card-border)` }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.cor }} />
                      <span className="text-[11px] font-bold truncate" style={{ color: 'var(--t-text-primary)' }}>{col.nome}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}>{colLeads.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {colLeads.map(lead => (
                      <div key={lead.id} style={{ opacity: draggingLead?.id === lead.id ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                        <LeadCard
                          lead={lead}
                          onClick={() => openLead(lead)}
                          onDragStart={e => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', lead.id);
                            // Adia a atualização de estado (opacity do card) para depois do
                            // navegador capturar a imagem fantasma do drag — setState síncrono
                            // aqui dentro do dragstart altera o próprio elemento sendo arrastado
                            // e o Chrome/Edge cancela o drag silenciosamente (sem erro, o card
                            // só "volta" pro lugar, e nenhum onDrop das colunas chega a disparar).
                            setTimeout(() => setDraggingLead(lead), 0);
                          }}
                          onExcluir={() => { setExcluindoLead(lead); setMotivoExclusao(''); }}
                          podeExcluir={podeVerTudo((user as any)?.role) || lead.responsavel_id === (user as any)?.id || (lead as any).created_by === (user as any)?.id}
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

      {/* ── Lead Detail Panel ────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-40 flex" style={{ background: 'rgba(13,34,56,.5)' }} onClick={() => setSelectedLead(null)}>
          <div className="ml-auto flex h-full" style={{ width: '90vw', maxWidth: 1120 }} onClick={e => e.stopPropagation()}>

            {/* LEFT: ficha */}
            <div className="flex flex-col flex-1 ps-card overflow-hidden" style={{ borderLeft: '1px solid var(--t-card-border)' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-extrabold truncate" style={{ color: 'var(--t-text-primary)' }}>
                    {selectedLead.razao_social || selectedLead.nome_fantasia || selectedLead.nome}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {selectedLead.segmento && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary-dark)' }}>{selectedLead.segmento}</span>}
                    {(() => {
                      const col = colConfig(selectedLead.etapa_comercial);
                      return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${col.cor}18`, color: col.cor }}>{col.nome}</span>;
                    })()}
                    {(() => {
                      const t = TEMP_CONFIG[selectedLead.temperatura as keyof typeof TEMP_CONFIG] || TEMP_CONFIG.FRIO;
                      return <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: t.bg, color: t.color }}>{t.label}</span>;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                  <button onClick={() => gerarPropostaDoLead(selectedLead)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#16a34a' }}>
                    <FileText size={11} /> Gerar Proposta
                  </button>
                  {(() => {
                    const tel = selectedLead.responsavel_telefone;
                    if (!tel) return null;
                    return (
                      <a
                        href={`/whatsapp?numero=${tel.replace(/\D/g, '')}&nome=${encodeURIComponent(selectedLead.razao_social || selectedLead.nome || '')}${selectedLead.id ? `&lead=${selectedLead.id}` : ''}`}
                        title={`Abrir WhatsApp no CRM: ${tel}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: '#25D366' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.559 4.122 1.532 5.847L.057 23.617a.75.75 0 0 0 .921.921l5.696-1.489A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.893 0-3.667-.523-5.181-1.432l-.371-.218-3.383.885.898-3.285-.237-.385A9.958 9.958 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                        WhatsApp
                      </a>
                    );
                  })()}
                  {isGestor && vendedores.length > 0 && (
                    <select
                      value={selectedLead.responsavel_id || ''}
                      disabled={atribuindo}
                      onChange={e => atribuirVendedor(selectedLead.id, e.target.value)}
                      title="Atribuir a um vendedor"
                      className="text-xs border rounded-lg px-2 py-1.5"
                      style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                    >
                      <option value="">👤 Atribuir vendedor…</option>
                      {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                    </select>
                  )}
                  {isGestor && (
                    <button onClick={() => excluirLead(selectedLead)} title="Excluir lead (mantido só na auditoria)"
                      className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={15} style={{ color: '#dc2626' }} /></button>
                  )}
                  <button onClick={() => setSelectedLead(null)} className="p-1.5 rounded-lg hover:opacity-80"><X size={15} style={{ color: 'var(--t-text-secondary)' }} /></button>
                </div>
              </div>

              {/* Stage mover */}
              <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                {colunas.map(col => (
                  <button key={col.chave} onClick={() => moveColumn(selectedLead, col.chave)}
                    className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full transition-all"
                    style={{ background: selectedLead.etapa_comercial === col.chave ? col.cor : `${col.cor}15`, color: selectedLead.etapa_comercial === col.chave ? 'white' : col.cor }}>
                    {col.nome}
                  </button>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex px-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                {([
                  { key: 'dados',       label: 'Dados',       icon: Building2 },
                  { key: 'atendimento', label: 'Atendimento',  icon: MessageSquare },
                  { key: 'arquivos',    label: 'Arquivos',     icon: Paperclip },
                  // Trilha de auditoria — só para a supervisão
                  ...(isGestor ? [{ key: 'trilha', label: 'Trilha / Auditoria', icon: Clock }] : []),
                ] as any[]).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setDetailTab(key)}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2"
                    style={{ borderColor: detailTab === key ? '#4B8EC8' : 'transparent', color: detailTab === key ? '#4B8EC8' : '#7AAACB' }}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5">

                {/* Dados */}
                {detailTab === 'dados' && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--t-primary)' }}>Empresa</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Inp label="Razão Social" value={editForm.razao_social} onChange={(e: any) => setF('razao_social', e.target.value)} />
                        <Inp label="Nome Fantasia" value={editForm.nome_fantasia} onChange={(e: any) => setF('nome_fantasia', e.target.value)} />
                        <Inp label="CNPJ" value={editForm.cnpj} onChange={(e: any) => setF('cnpj', e.target.value)} />
                        <Sel label="Segmento" value={editForm.segmento} onChange={(e: any) => setF('segmento', e.target.value)} options={SEGMENTOS} />
                        <Inp label="Cidade" value={editForm.cidade} onChange={(e: any) => setF('cidade', e.target.value)} />
                        <Sel label="Estado" value={editForm.estado} onChange={(e: any) => setF('estado', e.target.value)} options={ESTADOS_BR} />
                        <Inp label="Qtd. Lojas" type="number" value={editForm.qtd_lojas} onChange={(e: any) => setF('qtd_lojas', e.target.value)} />
                        <Inp label="Qtd. Caixas/Terminais" type="number" value={editForm.qtd_caixas} onChange={(e: any) => setF('qtd_caixas', e.target.value)} />
                        <Inp label="Sistema atual" value={editForm.sistema_atual} onChange={(e: any) => setF('sistema_atual', e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--t-primary)' }}>Responsável</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Inp label="Nome" value={editForm.responsavel_nome} onChange={(e: any) => setF('responsavel_nome', e.target.value)} />
                        <Inp label="Cargo" value={editForm.responsavel_cargo} onChange={(e: any) => setF('responsavel_cargo', e.target.value)} />
                        <Inp label="Telefone/WhatsApp" value={editForm.responsavel_telefone} onChange={(e: any) => setF('responsavel_telefone', e.target.value)} />
                        <Inp label="E-mail" type="email" value={editForm.responsavel_email} onChange={(e: any) => setF('responsavel_email', e.target.value)} />
                        <Inp label="Melhor horário" value={editForm.responsavel_horario} onChange={(e: any) => setF('responsavel_horario', e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--t-primary)' }}>Classificação</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Sel label="Temperatura" value={editForm.temperatura} onChange={(e: any) => setF('temperatura', e.target.value)}
                          options={Object.entries(TEMP_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
                        <Sel label="Origem" value={editForm.origem} onChange={(e: any) => setF('origem', e.target.value)} options={ORIGENS_MANUAL} />
                        <Inp label="Vendedor responsável" value={editForm.vendedor_nome} onChange={(e: any) => setF('vendedor_nome', e.target.value)} />
                        <Inp label="Valor estimado (R$)" type="number" value={editForm.valor_estimado} onChange={(e: any) => setF('valor_estimado', e.target.value)} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--t-primary)' }}>Etiquetas</p>
                      <div className="flex flex-wrap gap-2">
                        {etiquetas.map(etq => {
                          const aplicada = (selectedLead.etiquetas_lead || []).some(e => e.etiqueta.id === etq.id);
                          return (
                            <button key={etq.id} onClick={() => toggleEtiqueta(etq.id)}
                              className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all"
                              style={{ background: aplicada ? etq.cor : `${etq.cor}15`, color: aplicada ? 'white' : etq.cor, border: `1px solid ${etq.cor}40` }}>
                              {etq.nome}
                            </button>
                          );
                        })}
                        <button onClick={() => setShowNewEtiq(true)}
                          className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-secondary)', border: '1px dashed #D8E8F5' }}>
                          + Nova etiqueta
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      {savedLeadOk && <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>✓ Salvo com sucesso!</span>}
                      <button onClick={saveLead} disabled={savingLead}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: savedLeadOk ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg, #4B8EC8, #2E6EAB)' }}>
                        {savingLead ? <Loader2 size={14} className="animate-spin" /> : null}
                        {savedLeadOk ? '✓ Salvo' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Atendimento */}
                {detailTab === 'atendimento' && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--t-primary)' }}>Acompanhamento</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Sel label="Status de atendimento" value={editForm.status_atendimento} onChange={(e: any) => setF('status_atendimento', e.target.value)}
                          options={['NOVO','SEM_CONTATO','CONTATO_TENTADO','EM_CONVERSA','QUALIFICADO','AGUARDANDO_RETORNO','PROPOSTA_NECESSARIA','PROPOSTA_ENVIADA','EM_NEGOCIACAO','ACEITO','FECHADO','PERDIDO'].map(v => ({ value: v, label: v.replace(/_/g, ' ') }))} />
                        <Inp label="Próximo contato" type="datetime-local" value={editForm.proximo_contato?.slice?.(0,16)} onChange={(e: any) => setF('proximo_contato', e.target.value)} />
                        <Inp label="Vendedor responsável" value={editForm.vendedor_nome} onChange={(e: any) => setF('vendedor_nome', e.target.value)} />
                        <Inp label="Supervisora" value={editForm.supervisor_nome} onChange={(e: any) => setF('supervisor_nome', e.target.value)} />
                      </div>
                      <div className="mt-3">
                        <Txt label="Observação comercial principal" value={editForm.observacoes} onChange={(e: any) => setF('observacoes', e.target.value)} rows={3} />
                      </div>
                    </div>
                    <div className="text-xs p-3 rounded-lg" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
                      <p style={{ color: 'var(--t-text-secondary)' }}>Última obs: <span style={{ color: 'var(--t-text-primary)' }}>{fmtDateTime(selectedLead.ultima_obs_at) || '—'}</span></p>
                      <p className="mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>Próximo contato: <span style={{ color: selectedLead.proximo_contato && new Date(selectedLead.proximo_contato) <= new Date() ? '#dc2626' : '#0D2238' }}>{fmtDateTime(selectedLead.proximo_contato) || '—'}</span></p>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      {savedLeadOk && <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>✓ Salvo com sucesso!</span>}
                      <button onClick={saveLead} disabled={savingLead}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: savedLeadOk ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg, #4B8EC8, #2E6EAB)' }}>
                        {savingLead ? <Loader2 size={14} className="animate-spin" /> : null}
                        {savedLeadOk ? '✓ Salvo' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Proposta */}
                {detailTab === 'proposta' && (() => {
                  const pImpl  = propostaForm.valor_implantacao ? parseFloat(propostaForm.valor_implantacao) : 0;
                  const pConv  = propostaForm.valor_conversao   ? parseFloat(propostaForm.valor_conversao)   : 0;
                  const pDesc  = propostaForm.desconto          ? parseFloat(propostaForm.desconto)          : 0;
                  const pFinal = pImpl + pConv - pDesc;
                  const pEnt   = propostaForm.entrada ? parseFloat(propostaForm.entrada) : 0;
                  const pParc  = parseInt(propostaForm.parcelas) || 0;
                  const pPVal  = pParc > 0 ? (pFinal - pEnt) / pParc : 0;
                  const SECTIONS = ['Empresa','Responsável','Comercial','Plano & Produtos','Valores','Conteúdo'];

                  if (propostaGerada) {
                    return (
                      <div className="space-y-4">
                        <div className="rounded-xl p-5 text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <CheckCircle2 size={32} style={{ color: '#16a34a', margin: '0 auto 10px' }} />
                          <h3 className="font-bold text-sm mb-1" style={{ color: '#15803d' }}>Proposta criada com sucesso!</h3>
                          <p className="text-xs mb-3" style={{ color: '#4ade80' }}>
                            {propostaGerada.razao_social} — {propostaGerada.plano_selecionado || 'sem plano'}
                          </p>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => { setPropostaGerada(null); initPropostaForm(selectedLead); }}
                              className="px-4 py-2 text-xs font-semibold rounded-xl"
                              style={{ background: '#F0FDF4', color: '#16a34a', border: '1px solid #BBF7D0' }}>
                              Nova proposta
                            </button>
                            <a href="/propostas-comerciais" target="_blank"
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white"
                              style={{ background: '#16a34a' }}>
                              <FileText size={12} /> Ver propostas
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Stepper */}
                      <div className="flex gap-0 border-b overflow-x-auto -mx-4 px-4" style={{ borderColor: 'var(--t-card-border)' }}>
                        {SECTIONS.map((s, i) => (
                          <button key={s} onClick={() => setPropostaSection(i)}
                            className="px-3 py-2 text-[11px] font-semibold whitespace-nowrap flex-shrink-0"
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              borderBottom: propostaSection === i ? '2px solid #4B8EC8' : '2px solid transparent',
                              color: propostaSection === i ? '#4B8EC8' : '#7AAACB',
                            }}>
                            {i + 1}. {s}
                          </button>
                        ))}
                      </div>

                      {/* Section 0 — Empresa */}
                      {propostaSection === 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Razão Social *" col={2}>
                            <input value={propostaForm.razao_social || ''} onChange={e => setPF('razao_social', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Razão social completa" />
                          </FormField>
                          <FormField label="Nome Fantasia">
                            <input value={propostaForm.nome_fantasia || ''} onChange={e => setPF('nome_fantasia', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Nome fantasia" />
                          </FormField>
                          <FormField label="CNPJ">
                            <input value={propostaForm.cnpj || ''} onChange={e => setPF('cnpj', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="00.000.000/0001-00" />
                          </FormField>
                          <FormField label="Segmento">
                            <select value={propostaForm.segmento || ''} onChange={e => setPF('segmento', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              <option value="">Selecione...</option>
                              {SEGMENTOS_PROP.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </FormField>
                          <FormField label="Cidade">
                            <input value={propostaForm.cidade || ''} onChange={e => setPF('cidade', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Cidade" />
                          </FormField>
                          <FormField label="Estado">
                            <select value={propostaForm.estado || ''} onChange={e => setPF('estado', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              <option value="">UF</option>
                              {ESTADOS_BR.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </FormField>
                          <FormField label="Qtd. Máquinas / Terminais">
                            <input type="number" value={propostaForm.maquinas || ''} onChange={e => setPF('maquinas', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: 3" />
                          </FormField>
                          <FormField label="Tipo de Implantação">
                            <select value={propostaForm.tipo_loja || ''} onChange={e => setPF('tipo_loja', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              <option value="">Selecione...</option>
                              {TIPOS_LOJA_PROP.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </FormField>
                          {(propostaForm.tipo_loja === 'Migração' || propostaForm.tipo_loja === 'Upgrade') && (
                            <FormField label="Sistema Atual" col={2}>
                              <input value={propostaForm.sistema_atual || ''} onChange={e => setPF('sistema_atual', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Sistema que utiliza hoje" />
                            </FormField>
                          )}
                          <FormField label="Data Desejada para Virada" col={2}>
                            <input type="date" value={propostaForm.data_virada || ''} onChange={e => setPF('data_virada', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} />
                          </FormField>
                        </div>
                      )}

                      {/* Section 1 — Responsável */}
                      {propostaSection === 1 && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Nome do Responsável" col={2}>
                            <input value={propostaForm.responsavel_nome || ''} onChange={e => setPF('responsavel_nome', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Nome completo" />
                          </FormField>
                          <FormField label="Telefone / WhatsApp">
                            <input value={propostaForm.responsavel_telefone || ''} onChange={e => setPF('responsavel_telefone', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="(27) 99999-0000" />
                          </FormField>
                          <FormField label="E-mail">
                            <input type="email" value={propostaForm.responsavel_email || ''} onChange={e => setPF('responsavel_email', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="email@empresa.com" />
                          </FormField>
                          <FormField label="CPF">
                            <input value={propostaForm.responsavel_cpf || ''} onChange={e => setPF('responsavel_cpf', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="000.000.000-00" />
                          </FormField>
                          <FormField label="Cargo / Função">
                            <input value={propostaForm.responsavel_cargo || ''} onChange={e => setPF('responsavel_cargo', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Sócio, Gerente..." />
                          </FormField>
                          <FormField label="Melhor Horário de Contato" col={2}>
                            <input value={propostaForm.responsavel_horario || ''} onChange={e => setPF('responsavel_horario', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: manhã das 9h às 12h" />
                          </FormField>
                        </div>
                      )}

                      {/* Section 2 — Comercial */}
                      {propostaSection === 2 && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Vendedor Responsável">
                            <input value={propostaForm.vendedor_nome || ''} onChange={e => setPF('vendedor_nome', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Nome do vendedor" />
                          </FormField>
                          <FormField label="Telefone do Vendedor">
                            <input value={propostaForm.vendedor_telefone || ''} onChange={e => setPF('vendedor_telefone', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="(27) 99999-0000" />
                          </FormField>
                          <FormField label="Supervisor Responsável">
                            <input value={propostaForm.supervisor_nome || ''} onChange={e => setPF('supervisor_nome', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Nome do supervisor" />
                          </FormField>
                          <FormField label="Campanha Comercial">
                            <input value={propostaForm.campanha || ''} onChange={e => setPF('campanha', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: Campanha Junho 2026" />
                          </FormField>
                          <FormField label="Validade da Proposta">
                            <input type="date" value={propostaForm.validade || ''} onChange={e => setPF('validade', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} />
                          </FormField>
                          <FormField label="Origem do Lead">
                            <select value={propostaForm.origem || ''} onChange={e => setPF('origem', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              <option value="">Selecione...</option>
                              {ORIGENS_PROP.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </FormField>
                          <FormField label="Status da Proposta" col={2}>
                            <select value={propostaForm.status || 'RASCUNHO'} onChange={e => setPF('status', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              {['RASCUNHO','ENVIADA','EM_NEGOCIACAO','ACEITA','RECUSADA'].map(s => (
                                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                              ))}
                            </select>
                          </FormField>
                        </div>
                      )}

                      {/* Section 3 — Plano & Produtos */}
                      {propostaSection === 3 && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Plano Selecionado">
                            <select value={propostaForm.plano_selecionado || ''} onChange={e => setPF('plano_selecionado', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              <option value="">Selecione...</option>
                              <option value="Pro">Pro</option>
                              <option value="Plus">Plus</option>
                              <option value="Personalizado">Personalizado</option>
                            </select>
                          </FormField>
                          <FormField label="Plano Recomendado">
                            <select value={propostaForm.plano_recomendado || ''} onChange={e => setPF('plano_recomendado', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              <option value="">Selecione...</option>
                              <option value="Pro">Pro</option>
                              <option value="Plus">Plus</option>
                            </select>
                          </FormField>
                          <FormField label="Mensalidade Plano Pro (R$)">
                            <input type="number" value={propostaForm.mensalidade_pro || ''} onChange={e => setPF('mensalidade_pro', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: 350" />
                          </FormField>
                          <FormField label="Mensalidade Plano Plus (R$)">
                            <input type="number" value={propostaForm.mensalidade_plus || ''} onChange={e => setPF('mensalidade_plus', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: 520" />
                          </FormField>
                          <FormField label="Módulos Inclusos" col={2}>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {MODULOS_PROP.map(m => {
                                const sel = (Array.isArray(propostaForm.modulos_inclusos) ? propostaForm.modulos_inclusos : []).includes(m);
                                return (
                                  <button key={m} type="button" onClick={() => togglePF('modulos_inclusos', m)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                    style={{ border: `1.5px solid ${sel ? '#4B8EC8' : '#D8E8F5'}`, background: sel ? '#EBF4FF' : 'transparent', color: sel ? '#4B8EC8' : '#7AAACB' }}>
                                    {m}
                                  </button>
                                );
                              })}
                            </div>
                          </FormField>
                          <FormField label="Serviços Adicionais" col={2}>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {SERVICOS_PROP.map(s => {
                                const sel = (Array.isArray(propostaForm.servicos_adicionais) ? propostaForm.servicos_adicionais : []).includes(s);
                                return (
                                  <button key={s} type="button" onClick={() => togglePF('servicos_adicionais', s)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                    style={{ border: `1.5px solid ${sel ? '#16a34a' : '#D8E8F5'}`, background: sel ? '#dcfce7' : 'transparent', color: sel ? '#16a34a' : '#7AAACB' }}>
                                    {s}
                                  </button>
                                );
                              })}
                            </div>
                          </FormField>
                        </div>
                      )}

                      {/* Section 4 — Valores */}
                      {propostaSection === 4 && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Valor de Implantação / Setup (R$)">
                            <input type="number" value={propostaForm.valor_implantacao || ''} onChange={e => setPF('valor_implantacao', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="0,00" />
                          </FormField>
                          <FormField label="Valor de Conversão de Dados (R$)">
                            <input type="number" value={propostaForm.valor_conversao || ''} onChange={e => setPF('valor_conversao', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="0,00" />
                          </FormField>
                          <FormField label="Desconto (R$)">
                            <input type="number" value={propostaForm.desconto || ''} onChange={e => setPF('desconto', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="0,00" />
                          </FormField>
                          <FormField label="Valor Final (calculado)">
                            <div className="px-3 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary)', border: '1.5px solid var(--t-card-border)' }}>{fmtBRL(pFinal)}</div>
                          </FormField>
                          <FormField label="Entrada (R$)">
                            <input type="number" value={propostaForm.entrada || ''} onChange={e => setPF('entrada', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="0,00" />
                          </FormField>
                          <FormField label="Número de Parcelas">
                            <input type="number" value={propostaForm.parcelas || ''} onChange={e => setPF('parcelas', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: 12" />
                          </FormField>
                          <FormField label="Valor da Parcela (calculado)" col={2}>
                            <div className="px-3 py-2 rounded-lg text-sm font-bold" style={{ background: '#dcfce7', color: '#16a34a', border: '1.5px solid #86efac' }}>
                              {pParc > 0 ? `${pParc}x de ${fmtBRL(pPVal)}` : '—'}
                            </div>
                          </FormField>
                          <FormField label="Data de Vencimento das Parcelas">
                            <input value={propostaForm.data_vencimento || ''} onChange={e => setPF('data_vencimento', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: dia 10 de cada mês" />
                          </FormField>
                          <FormField label="Observação de Cobrança">
                            <input value={propostaForm.observacao_cobranca || ''} onChange={e => setPF('observacao_cobranca', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Obs. cobrança..." />
                          </FormField>
                          <FormField label="Condição Especial" col={2}>
                            <input value={propostaForm.condicao_especial || ''} onChange={e => setPF('condicao_especial', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: Desconto especial válido até..." />
                          </FormField>
                        </div>
                      )}

                      {/* Section 5 — Conteúdo */}
                      {propostaSection === 5 && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="Título Principal da Proposta" col={2}>
                            <input value={propostaForm.titulo_proposta || ''} onChange={e => setPF('titulo_proposta', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: Proposta Comercial Prosystem — Plano Plus" />
                          </FormField>
                          {/* Message template pickers */}
                          <FormField label="Segmento (modelos de mensagem)">
                            <select value={pModeloSeg} onChange={e => { setPModeloSeg(e.target.value); setPModeloIdx(''); }}
                              className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }}>
                              <option value="">Selecione segmento...</option>
                              <option value="farmacia">Farmácia / Drogaria</option>
                              <option value="padaria">Padaria / Panificadora</option>
                            </select>
                          </FormField>
                          <FormField label="Modelo de mensagem">
                            <select value={pModeloIdx} onChange={e => {
                              const idx = e.target.value;
                              setPModeloIdx(idx);
                              if (idx && idx !== 'outro' && pModeloSeg && MENSAGENS_PROP[pModeloSeg]) {
                                const m = MENSAGENS_PROP[pModeloSeg][Number(idx)];
                                setPF('frase_hero', m.hero);
                                setPF('texto_valor', m.valor);
                                if (!propostaForm.titulo_proposta) setPF('titulo_proposta', m.titulo);
                              } else if (idx === 'outro') {
                                setPF('frase_hero', '');
                                setPF('texto_valor', '');
                              }
                            }} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} disabled={!pModeloSeg}>
                              <option value="">Selecione modelo...</option>
                              {(MENSAGENS_PROP[pModeloSeg] || []).map((m, i) => (
                                <option key={i} value={String(i)}>{m.titulo}</option>
                              ))}
                              <option value="outro">Escrever manualmente</option>
                            </select>
                          </FormField>
                          <FormField label="Frase do Hero (destaque)" col={2}>
                            <input value={propostaForm.frase_hero || ''} onChange={e => setPF('frase_hero', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} placeholder="Ex: Seu negócio merece um sistema que cresce com ele" readOnly={!!(pModeloIdx && pModeloIdx !== 'outro')} />
                          </FormField>
                          <FormField label="Texto de Valor para o Cliente" col={2}>
                            <textarea value={propostaForm.texto_valor || ''} onChange={e => setPF('texto_valor', e.target.value)} rows={4}
                              className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none" style={{ borderColor: 'var(--t-card-border)' }}
                              placeholder="Por que a Prosystem é a melhor escolha para este cliente..."
                              readOnly={!!(pModeloIdx && pModeloIdx !== 'outro')} />
                          </FormField>
                          <FormField label="Observações Comerciais" col={2}>
                            <textarea value={propostaForm.observacoes || ''} onChange={e => setPF('observacoes', e.target.value)} rows={3}
                              className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none" style={{ borderColor: 'var(--t-card-border)' }}
                              placeholder="Condições especiais, contexto da negociação..." />
                          </FormField>
                        </div>
                      )}

                      {/* Navigation + Save */}
                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--t-card-border)' }}>
                        <div className="flex gap-2">
                          {propostaSection > 0 && (
                            <button onClick={() => setPropostaSection(s => s - 1)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg"
                              style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)', background: 'transparent' }}>
                              ← Anterior
                            </button>
                          )}
                          {propostaSection < SECTIONS.length - 1 && (
                            <button onClick={() => setPropostaSection(s => s + 1)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
                              style={{ background: '#4B8EC8', border: 'none' }}>
                              Próximo →
                            </button>
                          )}
                        </div>
                        <button onClick={handleSaveProposta} disabled={savingProposta}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                          style={{ background: '#16a34a' }}>
                          {savingProposta ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          {savingProposta ? 'Salvando...' : 'Salvar Proposta'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Arquivos */}
                {detailTab === 'arquivos' && (
                  <div className="text-center py-12" style={{ color: 'var(--t-text-secondary)' }}>
                    <Paperclip size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <p className="text-sm font-semibold mb-1">Nenhum arquivo anexado</p>
                    <p className="text-xs">Funcionalidade de upload em breve.</p>
                  </div>
                )}

                {/* Trilha / Auditoria — só supervisão */}
                {detailTab === 'trilha' && isGestor && (
                  trilhaLoading ? (
                    <div className="text-center py-12 text-sm" style={{ color: 'var(--t-text-secondary)' }}>Carregando trilha...</div>
                  ) : !trilha ? (
                    <div className="text-center py-12 text-sm" style={{ color: 'var(--t-text-secondary)' }}>Sem trilha disponível.</div>
                  ) : (
                    <div className="space-y-5">
                      {/* Resumo do ciclo */}
                      {trilha.ciclo && (
                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t-primary)' }}>Ciclo do lead</p>
                            <span className="text-xs font-bold" style={{ color: trilha.ciclo.em_aberto ? '#ea580c' : '#16a34a' }}>
                              {trilha.ciclo.assinado_em ? `Assinado em ${fmtDateTime(trilha.ciclo.assinado_em)}` : 'Em aberto'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center mb-3">
                            <div><p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Entrada</p><p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>{trilha.ciclo.criado_em ? fmtDateTime(trilha.ciclo.criado_em) : '—'}</p></div>
                            <div><p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Ciclo total</p><p className="text-lg font-extrabold" style={{ color: 'var(--t-primary)' }}>{trilha.ciclo.ciclo_dias ?? '—'} <span className="text-xs font-medium">dias</span></p></div>
                            <div><p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Etapas</p><p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>{trilha.ciclo.etapas?.length || 0}</p></div>
                          </div>
                          <div className="space-y-1.5">
                            {(trilha.ciclo.etapas || []).map((e: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span style={{ color: 'var(--t-text-primary)' }}>{ETAPA_TRILHA_LABEL[e.etapa] || e.etapa}</span>
                                <span className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>{e.dias} dias{e.saiu_em ? '' : ' (atual)'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Linha do tempo completa (auditoria) */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--t-primary)' }}>Linha do tempo (auditoria completa)</p>
                        <div className="space-y-3">
                          {buildTrilhaItens(trilha).map((it, i) => (
                            <div key={i} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <span className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: it.cor }} />
                                {i < buildTrilhaItens(trilha).length - 1 && <span className="flex-1 w-px" style={{ background: '#E3E9F0' }} />}
                              </div>
                              <div className="flex-1 pb-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>{it.titulo}</p>
                                  <span className="text-[10px] shrink-0" style={{ color: 'var(--t-text-muted)' }}>{fmtDateTime(it.data)}</span>
                                </div>
                                {it.descricao && <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>{it.descricao}</p>}
                                {it.ator && <p className="text-[10px] mt-0.5" style={{ color: 'var(--t-text-muted)' }}>por {it.ator}</p>}
                              </div>
                            </div>
                          ))}
                          {buildTrilhaItens(trilha).length === 0 && (
                            <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Sem eventos registrados ainda.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* RIGHT: Observações */}
            <div className="flex flex-col ps-card flex-shrink-0 overflow-hidden" style={{ width: 310, borderLeft: '1px solid var(--t-card-border)' }}>
              <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)' }}>
                <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--t-primary)' }}>Histórico de Contatos</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>Toda a trilha do atendimento</p>
              </div>

              {/* Add obs form */}
              <div className="p-3 flex-shrink-0 space-y-2" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                <select value={obsForm.tipo} onChange={e => setObsForm(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full text-xs px-2.5 py-2 rounded-lg outline-none" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)' }}>
                  <option value="">Tipo de contato...</option>
                  {OBS_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <textarea value={obsForm.descricao} onChange={e => setObsForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Atualização de contato — o que aconteceu..." rows={3}
                  className="w-full text-xs px-2.5 py-2 rounded-lg resize-none outline-none" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)' }} />
                <input value={obsForm.proxima_acao} onChange={e => setObsForm(p => ({ ...p, proxima_acao: e.target.value }))}
                  placeholder="Próxima ação (nota rápida)..."
                  className="w-full text-xs px-2.5 py-2 rounded-lg outline-none" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)' }} />

                {/* Toggle próxima ação → Agenda */}
                <button
                  onClick={() => setShowAgendaForm(p => !p)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                  style={{ border: `1.5px solid ${showAgendaForm ? '#4B8EC8' : '#D8E8F5'}`, color: showAgendaForm ? '#4B8EC8' : '#7AAACB', background: showAgendaForm ? '#EBF4FF' : 'transparent' }}>
                  <span>Agendar próxima ação na Agenda</span>
                  <ChevronDown size={12} style={{ transform: showAgendaForm ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>

                {showAgendaForm && (
                  <div className="space-y-2 rounded-lg p-2.5" style={{ background: 'var(--t-primary-light)', border: '1px solid #C3DCFC' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--t-primary)' }}>Próxima ação → Agenda</p>
                    <input value={agendaForm.titulo} onChange={e => setAgendaForm(p => ({ ...p, titulo: e.target.value }))}
                      placeholder="Título do compromisso..."
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none" style={{ border: '1px solid #C3DCFC', color: 'var(--t-text-primary)' }} />
                    <select value={agendaForm.tipo} onChange={e => setAgendaForm(p => ({ ...p, tipo: e.target.value }))}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none" style={{ border: '1px solid #C3DCFC', color: 'var(--t-text-primary)' }}>
                      <option value="LIGACAO">📞 Ligação</option>
                      <option value="WHATSAPP">💬 WhatsApp</option>
                      <option value="REUNIAO">🤝 Reunião</option>
                      <option value="EMAIL">✉️ E-mail</option>
                      <option value="VISITA">📍 Visita</option>
                      <option value="TAREFA">📋 Tarefa</option>
                      <option value="OUTRO">📌 Outro</option>
                    </select>
                    <div className="flex gap-1.5">
                      <input type="date" value={agendaForm.data} onChange={e => setAgendaForm(p => ({ ...p, data: e.target.value }))}
                        className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none" style={{ border: '1px solid #C3DCFC', color: 'var(--t-text-primary)' }} />
                      <input type="time" value={agendaForm.hora} onChange={e => setAgendaForm(p => ({ ...p, hora: e.target.value }))}
                        className="w-20 text-xs px-2 py-1.5 rounded-lg outline-none" style={{ border: '1px solid #C3DCFC', color: 'var(--t-text-primary)' }} />
                    </div>
                    <p className="text-[9px]" style={{ color: 'var(--t-primary)' }}>Será criado automaticamente na Agenda com vínculo a este lead.</p>
                  </div>
                )}

                <button onClick={addObs} disabled={addingObs || !obsForm.tipo || !obsForm.descricao}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                  style={{ background: '#4B8EC8' }}>
                  {addingObs ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  {showAgendaForm && agendaForm.titulo && agendaForm.data && agendaForm.hora ? 'Registrar + Agendar' : 'Registrar'}
                </button>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {obsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--t-primary)' }} /></div>
                ) : observacoes.length === 0 ? (
                  <p className="text-center text-[11px] py-6" style={{ color: 'var(--t-text-secondary)' }}>Nenhum contato registrado.</p>
                ) : observacoes.map(obs => (
                  <div key={obs.id} className="flex gap-2">
                    {(() => { const ObsIcon = OBS_ICON[obs.tipo] || Pin; return <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--t-text-muted)' }}><ObsIcon size={13} /></span>; })()}
                    <div className="flex-1 rounded-lg p-2.5" style={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)' }}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] font-bold" style={{ color: 'var(--t-text-primary)' }}>{obs.created_by_name || 'Sistema'}</span>
                        <span className="text-[9px]" style={{ color: 'var(--t-text-secondary)' }}>{fmtDateTime(obs.created_at)}</span>
                      </div>
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--t-text-primary)' }}>{obs.descricao}</p>
                      {obs.proxima_acao && <p className="text-[10px] mt-1 font-semibold" style={{ color: '#d97706' }}>→ {obs.proxima_acao}</p>}
                      {obs.data_proximo_retorno && <p className="text-[9px] mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>{fmtDateTime(obs.data_proximo_retorno)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Lead Modal ───────────────────────────────────────────────── */}
      {showNewLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.6)' }}>
          <div className="ps-card rounded-2xl shadow-2xl flex flex-col" style={{ width: 620, maxHeight: '88vh' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--t-text-primary)' }}>Novo Lead</h2>
              <button onClick={() => setShowNewLead(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="flex gap-0 px-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              {['Empresa','Responsável','Comercial'].map((s, i) => (
                <button key={s} onClick={() => setNewLeadSection(i)}
                  className="px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors"
                  style={{ borderColor: newLeadSection === i ? '#4B8EC8' : 'transparent', color: newLeadSection === i ? '#4B8EC8' : '#7AAACB' }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {newLeadSection === 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Inp label="Razão Social *" required value={newLeadForm.razao_social} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, razao_social: e.target.value, nome: e.target.value }))} /></div>
                  <Inp label="Nome Fantasia" value={newLeadForm.nome_fantasia} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, nome_fantasia: e.target.value }))} />
                  <Inp label="CNPJ" value={newLeadForm.cnpj} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, cnpj: e.target.value }))} />
                  <Sel label="Segmento" value={newLeadForm.segmento} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, segmento: e.target.value }))} options={SEGMENTOS} />
                  <Sel label="Estado" value={newLeadForm.estado} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, estado: e.target.value }))} options={ESTADOS_BR} />
                  <Inp label="Cidade" value={newLeadForm.cidade} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, cidade: e.target.value }))} />
                  <Inp label="Sistema atual" value={newLeadForm.sistema_atual} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, sistema_atual: e.target.value }))} />
                  <Inp label="Qtd. Caixas/Terminais" type="number" value={newLeadForm.qtd_caixas} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, qtd_caixas: e.target.value }))} />
                  <Inp label="Qtd. Lojas" type="number" value={newLeadForm.qtd_lojas} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, qtd_lojas: e.target.value }))} />
                </div>
              )}
              {newLeadSection === 1 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Inp label="Nome do responsável" value={newLeadForm.responsavel_nome} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, responsavel_nome: e.target.value }))} /></div>
                  <Inp label="Cargo/Função" value={newLeadForm.responsavel_cargo} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, responsavel_cargo: e.target.value }))} />
                  <Inp label="Melhor horário" value={newLeadForm.responsavel_horario} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, responsavel_horario: e.target.value }))} />
                  <Inp label="Telefone/WhatsApp" value={newLeadForm.responsavel_telefone} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, responsavel_telefone: e.target.value }))} />
                  <Inp label="E-mail" type="email" value={newLeadForm.responsavel_email} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, responsavel_email: e.target.value }))} />
                </div>
              )}
              {newLeadSection === 2 && (
                <div className="grid grid-cols-2 gap-3">
                  <Sel label="Origem *" required value={newLeadForm.origem} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, origem: e.target.value }))} options={ORIGENS_MANUAL} />
                  <Sel label="Temperatura" value={newLeadForm.temperatura} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, temperatura: e.target.value }))}
                    options={Object.entries(TEMP_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
                  <Inp label="Vendedor responsável" value={newLeadForm.vendedor_nome} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, vendedor_nome: e.target.value }))} />
                  <Inp label="Valor estimado (R$)" type="number" value={newLeadForm.valor_estimado} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, valor_estimado: e.target.value }))} />
                  <div className="col-span-2"><Txt label="Observações" value={newLeadForm.observacoes} onChange={(e: any) => setNewLeadForm((p: any) => ({ ...p, observacoes: e.target.value }))} rows={3} /></div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--t-card-border)' }}>
              <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full" style={{ background: newLeadSection === i ? '#4B8EC8' : '#D8E8F5' }} />)}</div>
              <div className="flex gap-2">
                {newLeadSection > 0 && <button onClick={() => setNewLeadSection(p => p-1)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-primary)' }}>Anterior</button>}
                {newLeadSection < 2
                  ? <button onClick={() => setNewLeadSection(p => p+1)} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#4B8EC8' }}>Próximo</button>
                  : <button onClick={createNewLead} disabled={savingNewLead || !newLeadForm.razao_social || !newLeadForm.origem}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: '#16a34a' }}>
                      {savingNewLead ? <Loader2 size={12} className="animate-spin" /> : null} Criar Lead
                    </button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Column Modal ─────────────────────────────────────────────── */}
      {showNewCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.6)' }}>
          <div className="ps-card rounded-2xl shadow-2xl p-6" style={{ width: 380 }}>
            <div className="flex justify-between mb-4">
              <h3 className="font-extrabold text-sm" style={{ color: 'var(--t-text-primary)' }}>Nova Coluna do Kanban</h3>
              <button onClick={() => setShowNewCol(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <Inp label="Nome da coluna *" value={newColForm.nome} onChange={(e: any) => setNewColForm(p => ({ ...p, nome: e.target.value }))} />
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Cor</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={newColForm.cor} onChange={e => setNewColForm(p => ({ ...p, cor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" style={{ border: '1px solid var(--t-card-border)' }} />
                  {['#6b7280','#2563eb','#7c3aed','#d97706','#dc2626','#16a34a','#0891b2','#db2777'].map(c => (
                    <button key={c} onClick={() => setNewColForm(p => ({ ...p, cor: c }))} className="w-6 h-6 rounded-full" style={{ background: c, outline: newColForm.cor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowNewCol(false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}>Cancelar</button>
                <button onClick={createNewCol} disabled={!newColForm.nome}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ background: '#4B8EC8' }}>
                  Criar Coluna
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Novo Quadro Modal ────────────────────────────────────────────── */}
      {showNewQuadro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.6)' }}>
          <div className="ps-card rounded-2xl shadow-2xl p-6" style={{ width: 440 }}>
            <div className="flex justify-between mb-4">
              <h3 className="font-extrabold text-sm" style={{ color: 'var(--t-text-primary)' }}>Novo Quadro</h3>
              <button onClick={() => setShowNewQuadro(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <Inp label="Nome do quadro *" value={newQuadro.nome} onChange={(e: any) => setNewQuadro(p => ({ ...p, nome: e.target.value }))} />
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Colunas (separadas por vírgula)</label>
                <input value={newQuadro.colunas} onChange={e => setNewQuadro(p => ({ ...p, colunas: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: 'var(--t-card-border)' }} />
                <p className="text-[10px] mt-1" style={{ color: '#9ca3af' }}>Ex: A fazer, Em andamento, Concluído</p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Cor</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={newQuadro.cor} onChange={e => setNewQuadro(p => ({ ...p, cor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" style={{ border: '1px solid var(--t-card-border)' }} />
                  {['var(--t-primary)','#d97706','#7c3aed','#16a34a','#dc2626','#0891b2'].map(c => (
                    <button key={c} onClick={() => setNewQuadro(p => ({ ...p, cor: c }))} className="w-6 h-6 rounded-full" style={{ background: c, outline: newQuadro.cor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowNewQuadro(false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}>Cancelar</button>
                <button onClick={criarQuadro} disabled={!newQuadro.nome.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ background: '#4B8EC8' }}>
                  Criar Quadro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Etiqueta Modal ───────────────────────────────────────────── */}
      {showNewEtiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.6)' }}>
          <div className="ps-card rounded-2xl shadow-2xl p-6" style={{ width: 380 }}>
            <div className="flex justify-between mb-4">
              <h3 className="font-extrabold text-sm" style={{ color: 'var(--t-text-primary)' }}>Nova Etiqueta</h3>
              <button onClick={() => setShowNewEtiq(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <Inp label="Nome da etiqueta *" value={newEtiqForm.nome} onChange={(e: any) => setNewEtiqForm(p => ({ ...p, nome: e.target.value }))} />
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Cor</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={newEtiqForm.cor} onChange={e => setNewEtiqForm(p => ({ ...p, cor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" style={{ border: '1px solid var(--t-card-border)' }} />
                  {['#0891b2','#d97706','#7c3aed','#2563eb','#dc2626','#16a34a','#1877f2','#f59e0b'].map(c => (
                    <button key={c} onClick={() => setNewEtiqForm(p => ({ ...p, cor: c }))} className="w-6 h-6 rounded-full" style={{ background: c, outline: newEtiqForm.cor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <Txt label="Descrição (opcional)" value={newEtiqForm.descricao} onChange={(e: any) => setNewEtiqForm(p => ({ ...p, descricao: e.target.value }))} rows={2} />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowNewEtiq(false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}>Cancelar</button>
                <button onClick={createNewEtiq} disabled={!newEtiqForm.nome}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ background: '#4B8EC8' }}>
                  Criar Etiqueta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Configurar Funil Modal (gestor) ──────────────────────────────── */}
      {showConfigFunil && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(13,34,56,.6)' }} onClick={() => setShowConfigFunil(false)}>
          <div className="ps-card rounded-2xl shadow-2xl my-6 w-full" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--t-text-primary)' }}>⚙ Configurar Etapas do Funil</h2>
              <button onClick={() => setShowConfigFunil(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="p-6 space-y-2 max-h-[70vh] overflow-y-auto">
              {etapasFunil.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--t-text-secondary)' }}>Nenhuma etapa de funil configurada ainda.</p>
              ) : etapasFunil.map(et => (
                <div key={et.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg"
                  style={{ border: `1px solid ${et.fixo ? 'var(--t-primary)' : 'var(--t-card-border)'}`, background: et.fixo ? 'var(--t-primary-light)' : 'var(--t-card-bg)' }}>
                  {et.fixo && <span className="col-span-12 text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--t-primary)' }}>🔒 Coluna fixa do sistema</span>}
                  <input value={et.nome}
                    onChange={e => setEtapasFunil(prev => prev.map(p => p.id === et.id ? { ...p, nome: e.target.value } : p))}
                    onBlur={() => editarEtapaFunil(et, { nome: et.nome })}
                    className="col-span-4 px-2 py-1.5 border rounded text-sm"
                    style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }} />
                  <input type="color" value={et.cor}
                    onChange={e => setEtapasFunil(prev => prev.map(p => p.id === et.id ? { ...p, cor: e.target.value } : p))}
                    onBlur={() => editarEtapaFunil(et, { cor: et.cor })}
                    className="col-span-1 w-full h-8 border rounded" style={{ borderColor: 'var(--t-card-border)' }} />
                  <input type="number" value={et.ordem}
                    onChange={e => setEtapasFunil(prev => prev.map(p => p.id === et.id ? { ...p, ordem: Number(e.target.value) } : p))}
                    onBlur={() => editarEtapaFunil(et, { ordem: et.ordem })}
                    className="col-span-1 px-2 py-1.5 border rounded text-sm text-center"
                    style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }} />
                  {et.fixo ? (
                    <span className="col-span-3 px-2 py-1.5 rounded text-xs font-medium" style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-secondary)' }}>
                      {et.tipo === 'ANDAMENTO' ? 'Andamento' : et.tipo === 'FECHAMENTO' ? 'Fechamento' : et.tipo === 'PERDIDA' ? 'Perdida' : et.tipo === 'SEM_PERFIL' ? 'Sem perfil' : 'Reativação'}
                    </span>
                  ) : (
                    <select value={et.tipo}
                      onChange={e => { const novo = e.target.value as EtapaFunil['tipo']; setEtapasFunil(prev => prev.map(p => p.id === et.id ? { ...p, tipo: novo } : p)); editarEtapaFunil(et, { tipo: novo }); }}
                      className="col-span-3 px-2 py-1.5 border rounded text-xs" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}>
                      <option value="ANDAMENTO">Andamento</option>
                      <option value="FECHAMENTO">Fechamento</option>
                      <option value="PERDIDA">Perdida</option>
                      <option value="SEM_PERFIL">Sem perfil</option>
                      <option value="REATIVACAO">Reativação</option>
                    </select>
                  )}
                  <span className="col-span-2 text-xs truncate" style={{ color: 'var(--t-text-secondary)' }}>{et.codigo}</span>
                  {et.fixo ? (
                    <span className="col-span-1 text-center text-sm" title="Coluna fixa — não pode ser removida">🔒</span>
                  ) : (
                    <button onClick={() => removerEtapaFunil(et)} className="col-span-1 text-red-500 text-xs hover:underline">Remover</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--t-card-border)' }}>
              <p className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>🔒 Colunas fixas não podem ser removidas. Tipo "Perdida" exige motivo ao mover.</p>
              <button onClick={() => { setFormEtapa({ codigo: '', nome: '', cor: '#6b7280', ordem: 99, tipo: 'ANDAMENTO', conta_pipeline: true }); setShowNovaEtapa(true); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#4B8EC8' }}>
                + Nova Etapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Nova Etapa do Funil Modal ────────────────────────────────────── */}
      {showNovaEtapa && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(13,34,56,.7)' }}>
          <div className="ps-card rounded-2xl shadow-2xl p-6" style={{ width: 420 }}>
            <div className="flex justify-between mb-4">
              <h3 className="font-extrabold text-sm" style={{ color: 'var(--t-text-primary)' }}>+ Nova Etapa de Funil</h3>
              <button onClick={() => setShowNovaEtapa(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="space-y-3">
              <Inp label="Código (ex: REATIVACAO_FUTURA) *" value={formEtapa.codigo}
                onChange={(e: any) => setFormEtapa(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))} />
              <Inp label="Nome visível *" value={formEtapa.nome} onChange={(e: any) => setFormEtapa(f => ({ ...f, nome: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Cor</label>
                  <input type="color" value={formEtapa.cor} onChange={e => setFormEtapa(f => ({ ...f, cor: e.target.value }))} className="w-full h-10 border rounded" style={{ borderColor: 'var(--t-card-border)' }} />
                </div>
                <Inp label="Ordem" type="number" value={formEtapa.ordem} onChange={(e: any) => setFormEtapa(f => ({ ...f, ordem: Number(e.target.value) || 99 }))} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--t-text-secondary)' }}>Tipo da etapa</label>
                <select value={formEtapa.tipo} onChange={e => setFormEtapa(f => ({ ...f, tipo: e.target.value as EtapaFunil['tipo'] }))}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)' }}>
                  <option value="ANDAMENTO">Andamento</option>
                  <option value="FECHAMENTO">Fechamento</option>
                  <option value="PERDIDA">Perdida</option>
                  <option value="SEM_PERFIL">Sem perfil</option>
                  <option value="REATIVACAO">Reativação</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formEtapa.conta_pipeline}
                  onChange={e => setFormEtapa(f => ({ ...f, conta_pipeline: e.target.checked }))}
                  className="w-4 h-4" style={{ accentColor: '#4B8EC8' }} />
                <span style={{ color: 'var(--t-text-primary)' }}>Contar no pipeline</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setShowNovaEtapa(false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}>Cancelar</button>
              <button onClick={criarNovaEtapaFunil} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#4B8EC8' }}>Criar Etapa</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Controle Total Modal (gestor) ────────────────────────────────── */}
      {showControle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(13,34,56,.6)' }} onClick={() => setShowControle(false)}>
          <div className="ps-card rounded-2xl shadow-2xl my-6 w-full" style={{ maxWidth: 980 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--t-text-primary)' }}>Controle Total do Comercial</h2>
              <button onClick={() => setShowControle(false)}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {controleData.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--t-text-secondary)' }}>Nenhum dado disponível</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: 'var(--t-content-bg)', borderBottom: '1px solid var(--t-card-border)' }}>
                      <tr>
                        {['#','Vendedor','Leads ativos','Pipeline','Vendido (mês)','Fechados','Perdidos'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--t-text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {controleData.map((v, i) => (
                        <tr key={v.vendedor_id} style={{ borderBottom: '1px solid var(--t-card-border)', background: i % 2 === 0 ? 'var(--t-card-bg)' : 'var(--t-content-bg)' }}>
                          <td className="px-3 py-2">
                            <span className="text-xs font-bold" style={{ color: i === 0 ? '#eab308' : '#7AAACB' }}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--t-text-primary)' }}>{v.vendedor_nome || v.vendedor_id}</td>
                          <td className="px-3 py-2" style={{ color: '#4A6E8A' }}>{v.leads_ativos}</td>
                          <td className="px-3 py-2" style={{ color: '#4A6E8A' }}>{fmtBRL2(v.pipeline)}</td>
                          <td className="px-3 py-2 font-bold text-green-600">{fmtBRL2(v.vendido_mes)}</td>
                          <td className="px-3 py-2" style={{ color: '#4A6E8A' }}>{v.fechados_mes}</td>
                          <td className="px-3 py-2 text-red-500">{v.perdidos_mes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Motivo de Perda Modal ────────────────────────────────────────── */}
      {showPerda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,34,56,.7)' }}>
          <div className="ps-card rounded-2xl shadow-2xl p-6" style={{ width: 400 }}>
            <div className="flex justify-between mb-4">
              <h3 className="font-extrabold text-sm" style={{ color: '#dc2626' }}>⚠️ Motivo da Perda</h3>
              <button onClick={() => { setShowPerda(false); setMovingToPerda(null); }}><X size={16} style={{ color: 'var(--t-text-secondary)' }} /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--t-text-secondary)' }}>Informe o motivo da perda para melhorar a estratégia comercial.</p>
            <div className="space-y-2 mb-4">
              {['Sem resposta','Preço','Cliente sem interesse','Fechou com concorrente','Momento inadequado','Não tem perfil','Sem orçamento','Duplicado','Contato inválido','Outro'].map(m => (
                <button key={m} onClick={() => setPerdaMotivo(m)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{ background: perdaMotivo === m ? '#FEF2F2' : '#F8FBFF', color: perdaMotivo === m ? '#dc2626' : '#0D2238', border: `1px solid ${perdaMotivo === m ? '#FCA5A5' : '#EBF4FF'}` }}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowPerda(false); setMovingToPerda(null); }} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }}>Cancelar</button>
              <button onClick={confirmPerda} disabled={!perdaMotivo}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ background: '#dc2626' }}>
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Fechamento — lead movido para ACEITO ──────────────── */}
      {showFechamento && movingToFechamento && (
        <FecharLeadModal
          leadId={movingToFechamento.id}
          leadNome={movingToFechamento.nome || movingToFechamento.razao_social || 'Lead'}
          onClose={() => { setShowFechamento(false); setMovingToFechamento(null); }}
          onSuccess={async () => {
            await loadData();
            if (selectedLead?.id === movingToFechamento.id) {
              setSelectedLead(p => p ? { ...p, etapa_comercial: 'ACEITO', status: 'GANHO' } : p);
            }
            setShowFechamento(false);
            setMovingToFechamento(null);
          }}
        />
      )}

      {/* ── Modal de confirmação de exclusão de lead ────────────────────── */}
      {excluindoLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setExcluindoLead(null)}>
          <div className="ps-card rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2"><Trash2 size={16} style={{ color: '#dc2626' }} /> Excluir lead</h3>
              <button onClick={() => setExcluindoLead(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>
                Você está prestes a excluir <strong>{excluindoLead.razao_social || excluindoLead.nome_fantasia || excluindoLead.nome}</strong> do pipeline comercial. O lead sai de todos os quadros e relatórios, mas fica registrado na auditoria.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Por que está excluindo este lead? *</label>
                <textarea
                  value={motivoExclusao}
                  onChange={e => setMotivoExclusao(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Descreva o motivo da exclusão…"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t">
              <button onClick={() => setExcluindoLead(null)} className="px-4 py-2 border rounded-lg text-sm" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                Cancelar
              </button>
              <button
                onClick={handleExcluirLead}
                disabled={excluindoSaving || !motivoExclusao.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {excluindoSaving ? 'Excluindo…' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Componentes auxiliares (KPI Card) ────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<any>; label: string; value: string; color: string;
}) {
  return (
    <div className="ps-card rounded-xl p-4 flex items-start gap-3 transition-all hover:shadow-md relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none" style={{ background: `radial-gradient(circle, ${color}08 0%, transparent 70%)` }} />
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}12`, color }}>
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--t-text-muted)' }}>{label}</p>
        <p className="text-[15px] font-bold leading-tight truncate mt-0.5" style={{ color: 'var(--t-text-primary)' }}>{value}</p>
      </div>
    </div>
  );
}
