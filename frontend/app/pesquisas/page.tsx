'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { X, Star, Award, TrendingUp, AlertTriangle, Users, ChevronRight, Search } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Pesquisa {
  id: string; identificacao: string; respondente_nome?: string; email?: string; whatsapp?: string;
  cliente_id?: string; cliente_casado: boolean;
  cargo_respondente?: string;
  nota_suporte: number; nota_sistema: number; conhece_plano: boolean;
  nota_atendimento?: number; nota_eficiencia?: number; nota_conhecimento?: number; nota_geral?: number;
  resolucao?: string; rapidez?: string; interesse_comercial?: string;
  conhece_plus?: boolean; conhece_dashboard?: boolean; conhece_mensageria?: boolean; conhece_gerencial?: boolean;
  recado?: string; observacao?: string; sugestoes?: string; critico: boolean; media: number;
  score?: number; alerta_especial?: boolean; alerta_motivo?: string;
  created_at: string;
}
interface Resumo { total: number; criticos: number; nao_conhece_plano: number; media_suporte: number; media_sistema: number; score_medio?: number; alertas?: number; excelentes?: number; }

// ── Score 0-100 ───────────────────────────────────────────────────────────────
// Usa score calculado pelo backend quando disponível (novo formulário).
// Fallback para cálculo local em respostas antigas sem campo score.
function calcScore(p: Pesquisa): number {
  if (p.score && p.score > 0) return p.score;
  // legado: média simples das notas 1-5 convertida para 0-100
  const notas = [
    { nota: p.nota_atendimento ?? p.nota_suporte, peso: 0.30 },
    { nota: p.nota_eficiencia ?? p.nota_sistema,  peso: 0.25 },
    { nota: p.nota_conhecimento ?? 0,              peso: 0.25 },
    { nota: p.nota_geral ?? p.nota_sistema,        peso: 0.20 },
  ];
  const totalPeso = notas.filter(n => n.nota > 0).reduce((s, n) => s + n.peso, 0);
  if (totalPeso === 0) return Math.round(((p.media - 1) / 4) * 100);
  const pontuado = notas.reduce((s, n) => s + (n.nota > 0 ? ((n.nota - 1) / 4) * n.peso : 0), 0);
  return Math.round((pontuado / totalPeso) * 100);
}

function scoreConfig(score: number) {
  if (score >= 90) return { label: 'Excelente', color: '#15803d', bg: '#dcfce7', border: '#86efac', emoji: '🏆' };
  if (score >= 75) return { label: 'Muito bom',  color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', emoji: '⭐' };
  if (score >= 60) return { label: 'Bom',         color: '#d97706', bg: '#fefce8', border: '#fde68a', emoji: '👍' };
  if (score >= 40) return { label: 'Regular',     color: '#ea580c', bg: '#fff7ed', border: '#fdba74', emoji: '⚠️' };
  return                   { label: 'Crítico',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', emoji: '🚨' };
}

// ── Stars display ─────────────────────────────────────────────────────────────
function Stars({ value, max = 5, size = 14 }: { value: number; max?: number; size?: number }) {
  return (
    <span style={{ color: '#FBBF24', fontSize: size, letterSpacing: 1 }}>
      {'★'.repeat(Math.round(value))}{'☆'.repeat(max - Math.round(value))}
    </span>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const cfg = scoreConfig(score);
  const r = (size / 2) - 4;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cfg.color} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size > 56 ? 16 : 13, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, color: 'var(--t-text-muted)', fontWeight: 600 }}>/ 100</span>
      </div>
    </div>
  );
}

// ── Helpers de label ──────────────────────────────────────────────────────────
const RESOLUCAO_LABEL: Record<string, { l: string; cor: string; emoji: string }> = {
  totalmente:   { l: 'Sim, resolveu totalmente',  cor: '#16a34a', emoji: '✅' },
  parcialmente: { l: 'Resolveu parcialmente',     cor: '#d97706', emoji: '⚠️' },
  nao_resolveu: { l: 'Ainda não resolveu',        cor: '#dc2626', emoji: '❌' },
  nao_sei:      { l: 'Não sei avaliar',           cor: '#94a3b8', emoji: '🤔' },
};
const RAPIDEZ_LABEL: Record<string, { l: string; cor: string; emoji: string }> = {
  muito_rapido:   { l: 'Muito rápido',         cor: '#16a34a', emoji: '⚡' },
  esperado:       { l: 'Dentro do esperado',   cor: '#4B8EC8', emoji: '👍' },
  demorou_pouco:  { l: 'Demorou um pouco',     cor: '#d97706', emoji: '⏳' },
  demorou_muito:  { l: 'Demorou muito',        cor: '#dc2626', emoji: '😔' },
};
const CARGO_LABEL: Record<string, string> = {
  dono: '👑 Dono / Responsável', gerente: '🧑‍💼 Gerente',
  balconista: '🖥️ Balconista / Operador', financeiro: '📋 Financeiro / Adm.', outro: '👤 Outro',
};

// ── Modal formulário completo ─────────────────────────────────────────────────
function ModalFormulario({ pesquisa, onClose }: { pesquisa: Pesquisa; onClose: () => void }) {
  const score = calcScore(pesquisa);
  const cfg = scoreConfig(score);

  const notasDetalhadas = [
    { label: 'Qualidade deste atendimento',        nota: pesquisa.nota_atendimento, peso: '25 pts' },
    { label: 'Conhecimento do técnico',             nota: pesquisa.nota_conhecimento,peso: '15 pts' },
    { label: 'Nota geral para a ProSystem',         nota: pesquisa.nota_geral,       peso: '15 pts' },
    { label: 'Eficiência e rapidez',               nota: pesquisa.nota_eficiencia,  peso: '' },
  ].filter(n => n.nota);

  const legado = notasDetalhadas.length === 0 && [
    { label: 'Suporte técnico',  nota: pesquisa.nota_suporte, peso: '' },
    { label: 'Sistema',          nota: pesquisa.nota_sistema,  peso: '' },
  ];

  const diferenciais = [
    { label: 'Plano Plus',    conhece: pesquisa.conhece_plus,       icon: '⭐' },
    { label: 'Dashboard',     conhece: pesquisa.conhece_dashboard,  icon: '📊' },
    { label: 'Mensageria',    conhece: pesquisa.conhece_mensageria, icon: '💬' },
    { label: 'Gerencial',     conhece: pesquisa.conhece_gerencial,  icon: '📈' },
  ];

  const resolucaoInfo = pesquisa.resolucao ? RESOLUCAO_LABEL[pesquisa.resolucao] : null;
  const rapidezInfo   = pesquisa.rapidez   ? RAPIDEZ_LABEL[pesquisa.rapidez]     : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--t-card-bg)', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(13,34,56,0.3)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0D2238 0%, #1A4E82 100%)', padding: '24px 28px', borderRadius: '20px 20px 0 0', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#90BEF0', textTransform: 'uppercase', margin: '0 0 4px' }}>
                Formulário completo respondido
              </p>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                {pesquisa.identificacao}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {pesquisa.respondente_nome && (
                  <span style={{ fontSize: 12, color: '#90BEF0' }}>👤 {pesquisa.respondente_nome}</span>
                )}
                {pesquisa.cargo_respondente && (
                  <span style={{ fontSize: 12, color: '#90BEF0' }}>{CARGO_LABEL[pesquisa.cargo_respondente] || pesquisa.cargo_respondente}</span>
                )}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--t-text-secondary)' }}>
                📅 {new Date(pesquisa.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: 'white', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* Score destaque */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 18px' }}>
            <ScoreRing score={score} size={72} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, color: '#90BEF0', fontWeight: 600 }}>Score de Satisfação NPS</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: 'white' }}>{score}</span>
                <span style={{ fontSize: 14, color: '#90BEF0' }}>/ 100</span>
                <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              </div>
              {score >= 90 && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#86efac', fontWeight: 600 }}>🏆 Radar de Excelência — promotor da ProSystem</p>}
              {score < 70 && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>🚨 Caso de churn aberto automaticamente</p>}
              {pesquisa.alerta_especial && pesquisa.alerta_motivo && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#fde68a', fontWeight: 600 }}>⚠️ Alerta: {pesquisa.alerta_motivo}</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Resolução e Rapidez — destaque visual */}
          {(resolucaoInfo || rapidezInfo) && (
            <div style={{ display: 'grid', gridTemplateColumns: resolucaoInfo && rapidezInfo ? '1fr 1fr' : '1fr', gap: 10 }}>
              {resolucaoInfo && (
                <div style={{ padding: '14px 16px', borderRadius: 14, border: `2px solid ${resolucaoInfo.cor}40`, background: resolucaoInfo.cor + '10' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Solicitação resolvida?</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: resolucaoInfo.cor }}>{resolucaoInfo.emoji} {resolucaoInfo.l}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>peso 20 pts no score</p>
                </div>
              )}
              {rapidezInfo && (
                <div style={{ padding: '14px 16px', borderRadius: 14, border: `2px solid ${rapidezInfo.cor}40`, background: rapidezInfo.cor + '10' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Rapidez do atendimento</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: rapidezInfo.cor }}>{rapidezInfo.emoji} {rapidezInfo.l}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>peso 15 pts no score</p>
                </div>
              )}
            </div>
          )}

          {/* Notas detalhadas */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: 'var(--t-text-muted)', textTransform: 'uppercase', margin: '0 0 12px' }}>
              Notas por categoria
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(notasDetalhadas.length > 0 ? notasDetalhadas : (legado || [])).map(({ label, nota, peso }: any) => (
                nota ? (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{label}</p>
                      {peso && <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>{peso} no score</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <Stars value={nota} size={16} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: nota >= 4 ? '#16a34a' : nota === 3 ? '#d97706' : '#dc2626', marginTop: 2 }}>
                        {nota}/5 — {['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'][nota]}
                      </span>
                    </div>
                    <div style={{ width: 40, height: 5, background: '#e2e8f0', borderRadius: 3, flexShrink: 0 }}>
                      <div style={{ width: `${(nota / 5) * 100}%`, height: '100%', borderRadius: 3, background: nota >= 4 ? '#16a34a' : nota === 3 ? '#d97706' : '#dc2626' }} />
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          </div>

          {/* Diferenciais ProSystem */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: 'var(--t-text-muted)', textTransform: 'uppercase', margin: '0 0 12px' }}>
              Conhece os diferenciais ProSystem?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {diferenciais.map(({ label, conhece, icon }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, border: '1px solid',
                  background: conhece ? '#f0fdf4' : '#fef2f2',
                  borderColor: conhece ? '#86efac' : '#fca5a5',
                }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: conhece ? '#15803d' : '#991b1b' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: conhece ? '#16a34a' : '#dc2626' }}>
                      {conhece ? '✓ Conhece / usa' : '✗ Oportunidade comercial'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {pesquisa.interesse_comercial && pesquisa.interesse_comercial !== 'nao' && (
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--t-primary-light)', border: '1px solid #90BEF0' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A4E82' }}>
                  📞 {pesquisa.interesse_comercial === 'sim' ? 'Quer conhecer as ferramentas — contato comercial!' : 'Talvez queira conhecer — pode chamar depois'}
                </p>
              </div>
            )}
          </div>

          {/* Recado/mensagem */}
          {(pesquisa.recado || pesquisa.observacao || pesquisa.sugestoes) && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: 'var(--t-text-muted)', textTransform: 'uppercase', margin: '0 0 12px' }}>
                Mensagem do cliente
              </p>
              {pesquisa.recado && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #4B8EC8', borderRadius: '0 12px 12px 0', padding: '14px 16px' }}>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--t-text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>"{pesquisa.recado}"</p>
                </div>
              )}
              {pesquisa.observacao && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #4B8EC8', borderRadius: '0 12px 12px 0', padding: '14px 16px', marginTop: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--t-text-primary)', lineHeight: 1.6 }}>{pesquisa.observacao}</p>
                </div>
              )}
              {pesquisa.sugestoes && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #d97706', borderRadius: '0 12px 12px 0', padding: '14px 16px', marginTop: 8 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#92400e' }}>💡 Sugestão</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#78350f', lineHeight: 1.6 }}>{pesquisa.sugestoes}</p>
                </div>
              )}
            </div>
          )}

          {/* Contato */}
          {(pesquisa.email || pesquisa.whatsapp) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pesquisa.email && (
                <a href={`mailto:${pesquisa.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: 'var(--t-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  ✉️ {pesquisa.email}
                </a>
              )}
              {pesquisa.whatsapp && (
                <a href={`https://wa.me/${pesquisa.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac', fontSize: 13, color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>
                  📱 {pesquisa.whatsapp}
                </a>
              )}
            </div>
          )}

          {/* Score e classificação */}
          <div style={{ background: score >= 90 ? '#f0fdf4' : score < 70 ? '#fef2f2' : '#f8fafc', border: `1px solid ${cfg.border}`, borderRadius: 14, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: 1 }}>
              {cfg.emoji} Classificação: {cfg.label}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { f: score >= 90,           l: '🏆 Radar de Excelência', c: '#15803d' },
                { f: score >= 80 && score < 90, l: '✅ Bom — acompanhar', c: '#2E6EAB' },
                { f: score >= 70 && score < 80, l: '⚠️ Ponto de atenção — tarefa CS', c: '#d97706' },
                { f: score < 70,            l: '🚨 Churn aberto automaticamente', c: '#dc2626' },
                { f: !!pesquisa.alerta_especial, l: '🔔 Alerta especial ativo', c: '#7c3aed' },
              ].filter(x => x.f).map(x => (
                <span key={x.l} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: x.c + '15', color: x.c, border: `1px solid ${x.c}30` }}>{x.l}</span>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.5 }}>
              Score ponderado: Atend. 25pts · Resolução 20pts · Rapidez 15pts · Técnico 15pts · ProSystem 15pts · Ferramentas 10pts
            </p>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 10 }}>
            {pesquisa.cliente_id && (
              <a href={`/clientes/${pesquisa.cliente_id}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)', color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Ver ficha do cliente <ChevronRight size={14} />
              </a>
            )}
            <button onClick={onClose}
              style={{ flex: pesquisa.cliente_id ? 0 : 1, padding: '13px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'var(--t-card-bg)', fontSize: 13, fontWeight: 600, color: 'var(--t-text-muted)', cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de pesquisa ──────────────────────────────────────────────────────────
function CardPesquisa({ p, onVerDetalhes, comVincular, onVincular }: {
  p: Pesquisa;
  onVerDetalhes: (p: Pesquisa) => void;
  comVincular?: boolean;
  onVincular?: (p: Pesquisa) => void;
}) {
  const score = calcScore(p);
  const cfg = scoreConfig(score);

  const naoConhece = [
    !p.conhece_plus && 'Plus', !p.conhece_dashboard && 'Dashboard',
    !p.conhece_mensageria && 'Mensageria', !p.conhece_gerencial && 'Gerencial',
  ].filter(Boolean);

  return (
    <div
      style={{
        borderRadius: 16, border: '1px solid',
        borderColor: score >= 90 ? '#86efac' : p.critico ? '#fca5a5' : '#e5e7eb',
        background: score >= 90 ? '#f0fdf4' : p.critico ? '#fef2f2' : '#fff',
        padding: '16px 18px',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onClick={() => onVerDetalhes(p)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Score ring */}
        <ScoreRing score={score} size={52} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--t-text-primary)' }}>{p.identificacao}</p>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              {cfg.emoji} {cfg.label}
            </span>
            {score >= 90 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                🏆 Excelência
              </span>
            )}
            {p.critico && score < 90 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#991b1b' }}>
                ⚠️ Crítico
              </span>
            )}
          </div>

          {p.respondente_nome && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t-text-secondary)' }}>por {p.respondente_nome}</p>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {p.nota_atendimento && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Atend.: <Stars value={p.nota_atendimento} size={12} /></span>}
            {p.nota_eficiencia && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Efic.: <Stars value={p.nota_eficiencia} size={12} /></span>}
            {p.nota_conhecimento && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Conhec.: <Stars value={p.nota_conhecimento} size={12} /></span>}
            {p.nota_geral && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)' }}>Geral: <Stars value={p.nota_geral} size={12} /></span>}
            {!p.nota_atendimento && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Média: <Stars value={p.media} size={12} /></span>}
          </div>

          {naoConhece.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Oportunidade — não conhece:</span>
              {naoConhece.map(n => (
                <span key={n as string} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>{n}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--t-text-muted)' }}>
            {new Date(p.created_at).toLocaleDateString('pt-BR')}
          </p>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-primary)' }}>Ver detalhes →</span>
          {!p.cliente_casado && comVincular && onVincular && (
            <button
              onClick={e => { e.stopPropagation(); onVincular(p); }}
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-primary)', background: 'var(--t-primary-light)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
            >
              🔗 Vincular
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PesquisasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [respostas, setRespostas] = useState<Pesquisa[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [naoCasadas, setNaoCasadas] = useState<Pesquisa[]>([]);
  const [aba, setAba] = useState<'todas' | 'excelentes' | 'criticas' | 'nao_casadas'>('todas');
  const [dataLoading, setDataLoading] = useState(true);
  const [modalPesquisa, setModalPesquisa] = useState<Pesquisa | null>(null);
  const [busca, setBusca] = useState('');

  // Vínculo manual
  const [vinculando, setVinculando] = useState<string | null>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [resultados, setResultados] = useState<{ id: string; nome: string; razao_social?: string; codigo?: string }[]>([]);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const [list, nc] = await Promise.all([
        apiClient.getPesquisas(aba === 'criticas' ? { critico: true } : undefined),
        apiClient.getPesquisasNaoCasadas(),
      ]);
      setRespostas(list.data.data.respostas);
      setResumo(list.data.data.resumo);
      setNaoCasadas(nc.data.data);
    } catch (e) { console.error(e); } finally { setDataLoading(false); }
  }, [aba]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  useEffect(() => {
    if (!vinculando || buscaCliente.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await apiClient.getClientes(0, 10, buscaCliente);
        setResultados(r.data.data.clientes);
      } catch { setResultados([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [buscaCliente, vinculando]);

  const vincular = async (pesquisaId: string, clienteId: string) => {
    try {
      await apiClient.vincularPesquisa(pesquisaId, clienteId);
      setVinculando(null); setBuscaCliente(''); setResultados([]);
      load();
    } catch (e: any) {
      console.error('Erro ao vincular', e?.response?.data?.message || e.message);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Filtrar lista por aba e busca
  const todasComScore = respostas.map(p => ({ ...p, _score: calcScore(p) }));
  const excelentes = todasComScore.filter(p => p._score >= 90);
  // Crítica = score < 70 OU problema não resolvido OU nota muito baixa (≤2)
  // NÃO inclui só por "desconhecer ferramentas" — isso é oportunidade, não crítica
  const criticas = todasComScore.filter(p =>
    p._score < 70 ||
    (p as any).resolucao === 'nao_resolveu' ||
    (p.nota_atendimento && p.nota_atendimento <= 2) ||
    (p.nota_geral && p.nota_geral <= 2)
  );

  const listaBase = aba === 'nao_casadas' ? naoCasadas.map(p => ({ ...p, _score: calcScore(p) }))
    : aba === 'excelentes' ? excelentes
    : aba === 'criticas'   ? criticas
    : todasComScore;

  const lista = busca.trim()
    ? listaBase.filter(p => p.identificacao.toLowerCase().includes(busca.toLowerCase()) || p.respondente_nome?.toLowerCase().includes(busca.toLowerCase()))
    : listaBase;

  // KPIs do topo
  const scoresMedio = todasComScore.length ? Math.round(todasComScore.reduce((s, p) => s + p._score, 0) / todasComScore.length) : 0;
  const cfgMedio = scoreConfig(scoresMedio);

  return (
    <DashboardLayout>
      {modalPesquisa && (
        <ModalFormulario pesquisa={modalPesquisa} onClose={() => setModalPesquisa(null)} />
      )}

      {/* Vincular overlay */}
      {vinculando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.5)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--t-text-primary)' }}>🔗 Vincular ao cliente</p>
              <button onClick={() => { setVinculando(null); setBuscaCliente(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <input autoFocus value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
              placeholder="Buscar cliente por nome, razão social ou código…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
            {resultados.length > 0 && (
              <div style={{ marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                {resultados.map(c => (
                  <button key={c.id} onClick={() => vincular(vinculando, c.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--t-card-bg)', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14 }}>
                    <span style={{ fontWeight: 600, color: 'var(--t-text-primary)' }}>{c.razao_social || c.nome}</span>
                    {c.codigo && <span style={{ fontSize: 12, color: 'var(--t-text-muted)', marginLeft: 8 }}>#{c.codigo}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--t-text-primary)' }}>Pesquisas de Satisfação</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t-text-secondary)' }}>Clique em qualquer resposta para ver o formulário completo</p>
        </div>

        {/* KPIs */}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { l: 'Total de respostas', v: resumo.total,              icon: Users,         color: 'var(--t-primary)' },
              { l: 'Score médio',        v: `${scoresMedio}/100`,       icon: Star,          color: cfgMedio.color },
              { l: 'Excelentes (≥90)',   v: excelentes.length,          icon: Award,         color: '#15803d' },
              { l: 'Críticos',           v: resumo.criticos,            icon: AlertTriangle, color: '#dc2626' },
              { l: 'Oportunidade upsell',v: resumo.nao_conhece_plano,  icon: TrendingUp,    color: '#d97706' },
            ].map(k => (
              <div key={k.l} className="ps-card border rounded-2xl p-4" style={{ borderColor: 'var(--t-card-border)', boxShadow: '0 2px 8px rgba(13,34,56,0.05)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <k.icon size={14} style={{ color: k.color }} />
                  <p className="text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>{k.l}</p>
                </div>
                <p className="text-2xl font-black" style={{ color: k.color }}>{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Radar de Excelência */}
        {excelentes.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #86efac', borderRadius: 20, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={18} color="white" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#14532d' }}>🏆 Radar de Excelência — Score ≥ 90</p>
                <p style={{ margin: 0, fontSize: 12, color: '#16a34a' }}>{excelentes.length} cliente{excelentes.length !== 1 ? 's' : ''} com satisfação máxima · promotores da ProSystem</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {excelentes.slice(0, 5).map(p => (
                <div key={p.id}
                  onClick={() => setModalPesquisa(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--t-card-bg)', borderRadius: 12, border: '1px solid #bbf7d0', cursor: 'pointer' }}>
                  <ScoreRing score={p._score} size={44} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>{p.identificacao}</p>
                    {p.respondente_nome && <p style={{ margin: 0, fontSize: 12, color: '#16a34a' }}>{p.respondente_nome}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {p.recado && <p style={{ margin: 0, fontSize: 12, color: 'var(--t-primary)', fontStyle: 'italic', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{p.recado}"</p>}
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--t-text-muted)' }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <ChevronRight size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                </div>
              ))}
              {excelentes.length > 5 && (
                <button onClick={() => setAba('excelentes')} style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 14px' }}>
                  + {excelentes.length - 5} mais → ver todos excelentes
                </button>
              )}
            </div>
          </div>
        )}

        {/* Abas + Busca */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {([
            ['todas',       `Todas (${respostas.length})`],
            ['excelentes',  `🏆 Excelentes (${excelentes.length})`],
            ['criticas',    `⚠️ Críticas (${criticas.length})`],
            ['nao_casadas', `Sem vínculo (${naoCasadas.length})`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setAba(k)}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                background: aba === k ? '#0D2238' : 'white',
                color: aba === k ? 'white' : '#64748b',
                borderColor: aba === k ? '#0D2238' : '#e2e8f0',
              }}>
              {label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--t-card-bg)', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
            <Search size={14} style={{ color: 'var(--t-text-muted)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar empresa…"
              style={{ border: 'none', outline: 'none', fontSize: 13, color: 'var(--t-text-primary)', width: 160 }} />
          </div>
        </div>

        {/* Lista */}
        {dataLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--t-text-muted)' }}>Carregando…</div>
        ) : lista.length === 0 ? (
          <div style={{ background: 'var(--t-card-bg)', borderRadius: 20, border: '1px solid #e2e8f0', padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>📋</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text-primary)', margin: '0 0 4px' }}>Nenhuma resposta encontrada</p>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)', margin: 0 }}>
              {aba === 'excelentes' ? 'Nenhum cliente com score ≥ 90 ainda.'
               : aba === 'criticas' ? 'Ótimo! Nenhuma resposta crítica.'
               : aba === 'nao_casadas' ? 'Todas as pesquisas estão vinculadas a clientes.'
               : 'Nenhuma pesquisa enviada ainda.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(p => (
              <CardPesquisa
                key={p.id}
                p={p}
                onVerDetalhes={setModalPesquisa}
                comVincular={aba === 'nao_casadas'}
                onVincular={pp => setVinculando(pp.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
