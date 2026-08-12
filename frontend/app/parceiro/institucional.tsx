'use client';

import { Building2, Users, MapPin, Sparkles, Target, Eye, HeartHandshake, Pill, Croissant, Store } from 'lucide-react';

// ─── Conteúdo extraído de prosystemnet.com/home/ e /sobre-nos/ ─────────────

const NUMEROS = [
  { valor: '16+', label: 'anos de mercado', icon: Sparkles },
  { valor: '600+', label: 'clientes atendidos', icon: Users },
  { valor: '13', label: 'estados atendidos', icon: MapPin },
];

const SEGMENTOS = [
  { icon: Pill, titulo: 'Farmácias & Drogarias', descricao: 'Gestão completa com controle de medicamentos, SNGPC e integração com PBMs.' },
  { icon: Croissant, titulo: 'Padarias', descricao: 'Planejamento de produção, ficha técnica e controle de insumos.' },
  { icon: Store, titulo: 'Varejo em Geral', descricao: 'PDV rápido, gestão de estoque e indicadores em tempo real.' },
];

const PILARES = [
  {
    icon: Target,
    titulo: 'Missão',
    texto: 'Entregar soluções tecnológicas seguras, acessíveis e inteligentes que simplificam a rotina das empresas e garantem eficiência operacional com atendimento próximo, humano e personalizado.',
  },
  {
    icon: Eye,
    titulo: 'Visão',
    texto: 'Ser referência no mercado de automação comercial, sempre acompanhando o crescimento das empresas.',
  },
  {
    icon: HeartHandshake,
    titulo: 'Valores',
    texto: 'Integridade, respeito, proatividade e colaboração, sempre focando no sucesso dos nossos clientes e no aprimoramento contínuo.',
  },
];

// ─── Hero institucional ──────────────────────────────────────────────────

export function HeroInstitucional() {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#0D2238 0%,#1A4E82 55%,#2E6EAB 100%)',
      padding: '72px 24px 64px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Textura tecnológica sutil — grade de pontos no fundo do gradiente */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(144,190,240,0.12) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <p style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: -0.5 }}>
          Pro<span style={{ color: '#90BEF0' }}>System</span>
        </p>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#90BEF0', textTransform: 'uppercase', letterSpacing: 2.5, marginBottom: 20 }}>
          Tecnologia em automação comercial
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 16, letterSpacing: -0.3 }}>
          Venha ser parceiro da Prosystem
        </h1>
        <p style={{ fontSize: 15, color: '#C7DCF2', lineHeight: 1.7, maxWidth: 620, margin: '0 auto 36px' }}>
          Há mais de 16 anos desenvolvemos sistemas de gestão (ERP) especializados para farmácias, padarias e
          varejo — unindo PDV rápido, gestão integrada e suporte humanizado. Buscamos representantes comerciais
          para levar essa tecnologia a todo o Brasil.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {NUMEROS.map(n => {
            const Icone = n.icon;
            return (
              <div key={n.label} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(144,190,240,0.25)',
                borderRadius: 14, padding: '18px 28px', minWidth: 140, backdropFilter: 'blur(4px)',
              }}>
                <Icone size={18} color="#90BEF0" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{n.valor}</p>
                <p style={{ fontSize: 12, color: '#B8D4EF', marginTop: 4 }}>{n.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Segmentos atendidos ─────────────────────────────────────────────────

export function SecaoSegmentos() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 32, marginBottom: 20, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Building2 size={16} color="#2E6EAB" />
        <p style={{ fontSize: 11, fontWeight: 700, color: '#2E6EAB', textTransform: 'uppercase', letterSpacing: 1.5 }}>Onde atuamos</p>
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0D2238', marginBottom: 20 }}>Segmentos que atendemos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {SEGMENTOS.map(s => {
          const Icone = s.icon;
          return (
            <div key={s.titulo} style={{ border: '1px solid #E2ECF5', borderRadius: 12, padding: 18 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1A4E82,#2E6EAB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Icone size={17} color="#fff" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D2238', marginBottom: 6 }}>{s.titulo}</p>
              <p style={{ fontSize: 12.5, color: '#4A6E8A', lineHeight: 1.5 }}>{s.descricao}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Missão, Visão e Valores ─────────────────────────────────────────────

export function SecaoPilares() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 32, marginBottom: 20, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Sparkles size={16} color="#2E6EAB" />
        <p style={{ fontSize: 11, fontWeight: 700, color: '#2E6EAB', textTransform: 'uppercase', letterSpacing: 1.5 }}>Quem somos</p>
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0D2238', marginBottom: 20 }}>Nossos princípios</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {PILARES.map(p => {
          const Icone = p.icon;
          return (
            <div key={p.titulo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icone size={16} color="#2E6EAB" />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0D2238' }}>{p.titulo}</p>
              </div>
              <p style={{ fontSize: 12.5, color: '#4A6E8A', lineHeight: 1.6 }}>{p.texto}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
