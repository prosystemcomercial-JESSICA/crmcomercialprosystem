'use client';

import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import VersionWatcher from '@/components/VersionWatcher';
import {
  LayoutDashboard, Target, GitMerge, CalendarCheck, FileCheck2,
  TrendingDown, Megaphone, Trophy, Medal, Building2, Users, DollarSign,
  Handshake, Flame, Activity, Star, Package, KeyRound, Rocket, RefreshCw,
  Headphones, CalendarDays, Bell, TrendingUp, Sprout, Upload,
  Settings, BarChart2, LineChart, LogOut, Moon, Sun, User,
  MessageSquare, Shield, ClipboardList, BookOpen, Wrench, Menu, X as XIcon,
  Maximize2, Minimize2,
} from 'lucide-react';

// Cargos do CRM
const ALL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'TECNICO_SUPORTE', 'VENDEDOR'];
const COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'VENDEDOR'];
const TECNICO = ['CEO', 'ADMIN', 'SUPERVISAO_TECNICA', 'TECNICO_SUPORTE'];
const GESTORES = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA'];
// Gestão comercial — visão total de KPIs/projeções/importações/ranking (sem vendedor)
const GESTAO_COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];
const SO_CEO = ['CEO', 'ADMIN'];
// O CEO vê só o EXECUTIVO (resultado/direção) — nada de operacional/admin.
// Estas são as ÚNICAS rotas visíveis no menu para o role CEO.
const CEO_VISIVEL = ['/painel-ceo', '/relatorio-comercial', '/ranking', '/centro-custos', '/comissoes-vendas', '/vendas-adicionais', '/churn-ceo'];

type NavItem = { href: string; icon: any; label: string; roles?: string[]; destaque?: 'whatsapp'; externoComToken?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      // Painel executivo (KPIs/projeções) — só gestão. Vendedor não vê Dashboard.
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',       roles: GESTORES },
      // Radar Comercial é a primeira tela do vendedor (atividades dos próprios leads).
      { href: '/comercial', icon: BarChart2,       label: 'Radar Comercial', roles: ['VENDEDOR'] },
      { href: '/leads',     icon: GitMerge,        label: 'Pipeline Comercial', roles: COMERCIAL },
      // WhatsApp em DESTAQUE VERDE — módulo nobre do dia a dia.
      { href: '/whatsapp',  icon: MessageSquare,   label: 'WhatsApp',        roles: COMERCIAL, destaque: 'whatsapp' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/atividades',            icon: CalendarCheck, label: 'Atividades',         roles: ALL },
      { href: '/agenda',                icon: CalendarDays,  label: 'Agenda (Google)',    roles: ALL },
      { href: '/propostas-comerciais',  icon: ClipboardList, label: 'Propostas',          roles: COMERCIAL },
      { href: '/contratos',             icon: FileCheck2,    label: 'Contratos',          roles: COMERCIAL },
      { href: '/campanhas',             icon: Megaphone,     label: 'Campanhas',          roles: COMERCIAL },
      { href: '/perdidos',              icon: TrendingDown,  label: 'Perdidos',           roles: COMERCIAL },
    ],
  },
  {
    label: 'Clientes & Base',
    items: [
      { href: '/clientes',     icon: Building2,  label: 'Clientes',     roles: ALL },
      { href: '/indicacoes',   icon: Handshake,  label: 'Indicações',   roles: COMERCIAL },
      { href: '/implantacoes', icon: Wrench,     label: 'Implantações', roles: [...GESTAO_COMERCIAL, 'TECNICO_IMPLANTACAO', 'SUPERVISAO_TECNICA'] },
      // Portal de Implantação & Onboarding (app separado) — abre com SSO (token na URL).
      { href: process.env.NEXT_PUBLIC_PORTAL_URL || '#', icon: Rocket, label: 'Implantação & Onboarding', roles: [...GESTAO_COMERCIAL, 'TECNICO_IMPLANTACAO', 'SUPERVISAO_TECNICA'], externoComToken: true },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/comercial', icon: BarChart2,    label: 'Radar Comercial', roles: GESTAO_COMERCIAL },
      { href: '/metas',     icon: Trophy,       label: 'Metas Comerciais',roles: COMERCIAL },
      { href: '/ranking',   icon: Medal,        label: 'Ranking',         roles: GESTAO_COMERCIAL },
      { href: '/comissoes',    icon: DollarSign, label: 'Comissões',      roles: COMERCIAL },
      { href: '/centro-custos', icon: DollarSign, label: 'Centro de Custos', roles: GESTAO_COMERCIAL },
      { href: '/painel-ceo', icon: TrendingUp, label: 'Painel do CEO', roles: GESTAO_COMERCIAL },
      { href: '/indicadores-ceo', icon: DollarSign, label: 'Indicadores do CEO', roles: GESTAO_COMERCIAL },
      { href: '/comissoes-vendas', icon: DollarSign, label: 'Comissões', roles: GESTAO_COMERCIAL },
      { href: '/vendas-adicionais', icon: Handshake, label: 'Vendas Adicionais', roles: GESTAO_COMERCIAL },
      { href: '/relatorio-comercial', icon: LineChart, label: 'Relatório (CEO)', roles: GESTAO_COMERCIAL },
      { href: '/lancamentos-retroativos', icon: RefreshCw, label: 'Lançar Retroativo', roles: GESTAO_COMERCIAL },
      { href: '/plano-comercial', icon: Target, label: 'Plano Comercial', roles: COMERCIAL },
    ],
  },
  {
    label: 'Retenção',
    items: [
      { href: '/ativos',       icon: Sprout,   label: 'Ativos (CS)',      roles: COMERCIAL },
      { href: '/churn-ceo',    icon: Flame,    label: 'Churn — Visão CEO', roles: SO_CEO },
      { href: '/casos',        icon: Flame,    label: 'Churn & Retenção', roles: TECNICO },
      { href: '/health-score', icon: Activity, label: 'Health Score',     roles: TECNICO },
      { href: '/nps',          icon: Star,     label: 'NPS',              roles: TECNICO },
      { href: '/pesquisas',    icon: MessageSquare, label: 'Pesquisas',   roles: TECNICO },
      { href: '/renovacoes',   icon: RefreshCw,  label: 'Renovações', roles: TECNICO },
      { href: '/suporte',      icon: Headphones, label: 'Suporte',    roles: TECNICO },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { href: '/alertas',       icon: Bell,         label: 'Alertas',         roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/previsao',      icon: TrendingUp,   label: 'Previsão',        roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/nutricao',      icon: Sprout,       label: 'Nutrição',        roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/relatorios-comerciais', icon: BarChart2, label: 'Rel. Comercial',  roles: GESTAO_COMERCIAL },
      { href: '/ciclo-vendas',          icon: LineChart, label: 'Ciclo de Vendas', roles: GESTAO_COMERCIAL },
      { href: '/relatorios',            icon: LineChart, label: 'Rel. Retenção',   roles: TECNICO },
    ],
  },
  {
    label: 'Serviços',
    items: [
      { href: '/catalogo',   icon: Package,    label: 'Catálogo',   roles: GESTORES },
      { href: '/licencas',   icon: KeyRound,   label: 'Licenças',   roles: GESTORES },
      { href: '/onboarding', icon: Rocket,     label: 'Onboarding', roles: TECNICO },
    ],
  },
  // ── ADMINISTRAÇÃO (fica por último — config, usuários, importação, auditoria) ──
  {
    label: 'Administração',
    items: [
      { href: '/usuarios',      icon: Users,    label: 'Usuários',       roles: GESTORES },
      { href: '/importacao',    icon: Upload,   label: 'Importar Leads', roles: GESTAO_COMERCIAL },
      { href: '/auditoria',     icon: Shield,   label: 'Auditoria',      roles: GESTAO_COMERCIAL },
      { href: '/manual',        icon: BookOpen, label: 'Manual do CRM',  roles: ALL },
      { href: '/configuracoes', icon: Settings, label: 'Configurações',  roles: SO_CEO },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  DIRETOR: 'Diretora',
  CEO: 'CEO',
  SUPERVISAO_COMERCIAL: 'Supervisão Comercial',
  SUPERVISAO: 'Supervisão',
  VENDEDOR: 'Comercial',
  FINANCEIRO: 'Financeiro',
  TECNICO: 'Técnico',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // ── Alertas no sininho (ficam até serem vistos e tratados) ──
  type Alerta = { id: string; tipo: string; urgencia: string; titulo: string; descricao: string; link: string };
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer mobile
  useEffect(() => { setSidebarOpen(false); }, [pathname]); // fecha ao navegar

  // Tela cheia (dashboards): usa a Fullscreen API do navegador.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    const d: any = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      const el: any = d.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
    }
  };
  useEffect(() => {
    const onFs = () => {
      const d: any = document;
      setIsFullscreen(!!(d.fullscreenElement || d.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
    };
  }, []);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const bellRef = useRef<HTMLDivElement>(null);

  // Carrega "vistos" do localStorage (por usuário)
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`alertas_seen_${user.id}`);
      if (raw) setSeen(new Set(JSON.parse(raw)));
    } catch {}
  }, [user?.id]);

  // Busca alertas e revalida a cada 60s (alerta some sozinho quando o item é tratado no backend)
  useEffect(() => {
    if (!user) return;
    let ativo = true;
    const carregar = () => {
      apiClient.getAlertas()
        .then(res => { if (ativo) setAlertas(res.data?.data?.alertas || []); })
        .catch(() => {});
    };
    carregar();
    const t = setInterval(carregar, 60000);
    return () => { ativo = false; clearInterval(t); };
  }, [user]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setAlertasOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // ── Alerta de novas conversas no WhatsApp (som + badge no sino) ──
  const [wppNaoLidas, setWppNaoLidas] = useState(0);
  const [wppConversas, setWppConversas] = useState<{ id: string; nome: string; ultima?: string }[]>([]);
  const [wppOpen, setWppOpen] = useState(false);
  const wppRef = useRef<HTMLDivElement>(null);
  const wppTotalRef = useRef(0);
  const wppVistoRef = useRef(false); // true = usuário clicou no sino; badge fica zerado até chegar algo novo
  const tocarSom = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(); o.stop(ctx.currentTime + 0.4);
    } catch {}
  };
  useEffect(() => {
    if (!user) return;
    let ativo = true;
    const checar = async () => {
      try {
        const res = await apiClient.getWhatsappConversas();
        if (!ativo) return;
        const convs = res.data?.data || [];
        const total = convs.reduce((s: number, c: any) => s + (c.nao_lidas || 0), 0);
        // Aumentou o nº de não-lidas → nova mensagem → toca som + reexibe o badge.
        if (total > wppTotalRef.current && wppTotalRef.current >= 0) {
          tocarSom();
          wppVistoRef.current = false; // chegou algo novo → volta a mostrar o badge
        }
        wppTotalRef.current = total;
        // Se o usuário já clicou no sino (visto) e nada novo chegou, mantém zerado.
        setWppNaoLidas(wppVistoRef.current ? 0 : total);
        setWppConversas(convs.filter((c: any) => c.nao_lidas > 0).slice(0, 6).map((c: any) => ({
          id: c.id, nome: c.contato_nome || c.contato_numero, ultima: c.ultima_mensagem,
        })));
      } catch {}
    };
    checar();
    const t = setInterval(checar, 15000); // a cada 15s
    return () => { ativo = false; clearInterval(t); };
  }, [user]);

  const naoVistos = alertas.filter(a => !seen.has(a.id)).length;

  const abrirAlertas = () => {
    const novo = !alertasOpen;
    setAlertasOpen(novo);
    // Ao abrir, marca todos como VISTOS (mas continuam na lista até serem tratados)
    if (novo && user?.id) {
      const ids = new Set(alertas.map(a => a.id));
      setSeen(ids);
      try { localStorage.setItem(`alertas_seen_${user.id}`, JSON.stringify([...ids])); } catch {}
    }
  };

  const urgenciaCor = (u: string) => u === 'ALTA' ? '#dc2626' : u === 'MEDIA' ? '#d97706' : '#6b7280';

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const initials = user?.nome
    ?.split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: 'var(--t-content-bg)' }}>
      <VersionWatcher />

      {/* ── Topbar ─────────────────────────────────────────── */}
      <header className="ps-topbar flex-shrink-0 flex items-center justify-between px-3 sm:px-5 h-24 gap-2">

        {/* Botão menu (mobile) — abre o drawer da sidebar */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu"
          className="md:hidden flex-shrink-0 p-2 rounded-lg"
          style={{ color: 'var(--t-text-primary)' }}>
          <Menu size={22} />
        </button>

        {/* Logotipo Prosystem no topbar (parte branca). A sidebar (azul) fica só com o menu. */}
        <Link href="/dashboard" className="flex items-center select-none flex-shrink-0" aria-label="Prosystem">
          <Image
            src="/logo-prosystem.png"
            alt="Prosystem"
            width={320}
            height={86}
            className="object-contain"
            style={{ height: 78, width: 'auto' }}
            priority
          />
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2">

          {/* Dark mode toggle */}
          <button
            onClick={toggleMode}
            title={mode === 'claro' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            style={{
              width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--t-card-border)',
              background: 'var(--t-card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--t-text-muted)', flexShrink: 0
            }}
          >
            {mode === 'claro' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Tela cheia (ótimo p/ dashboards em TV/apresentação) */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            style={{
              width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--t-card-border)',
              background: 'var(--t-card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--t-text-muted)', flexShrink: 0
            }}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: 'var(--t-card-border)', margin: '0 4px' }} />

          {/* WhatsApp — novas conversas (som + badge verde + atalho p/ conversa) */}
          <div ref={wppRef} style={{ position: 'relative' }}>
            <button
              title="Conversas no WhatsApp"
              onClick={() => {
                setWppOpen(v => {
                  const abrindo = !v;
                  // Ao abrir, marca como visto e zera o badge (até chegar algo novo).
                  if (abrindo) { wppVistoRef.current = true; setWppNaoLidas(0); }
                  return abrindo;
                });
              }}
              style={{
                width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--t-card-border)',
                background: wppNaoLidas > 0 ? 'rgba(37,211,102,0.12)' : 'var(--t-card-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: wppNaoLidas > 0 ? '#25D366' : 'var(--t-text-muted)', flexShrink: 0, position: 'relative'
              }}
            >
              <MessageSquare size={15} />
              {wppNaoLidas > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, padding: '0 4px',
                  borderRadius: 9, background: '#25D366', color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>{wppNaoLidas > 9 ? '9+' : wppNaoLidas}</span>
              )}
            </button>
            {wppOpen && (
              <div style={{
                position: 'absolute', top: 44, right: 0, width: 300, background: 'var(--t-card-bg)',
                border: '1px solid var(--t-card-border)', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,.15)', zIndex: 50, overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg,#128C7E,#075E54)', color: '#fff', fontWeight: 600, fontSize: 13 }}>
                  💬 Conversas com novas mensagens
                </div>
                {wppConversas.length === 0 ? (
                  <p style={{ padding: 16, fontSize: 13, color: 'var(--t-text-muted)', textAlign: 'center' }}>Nenhuma nova mensagem</p>
                ) : wppConversas.map(c => (
                  <button key={c.id} onClick={() => { setWppOpen(false); router.push('/whatsapp'); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--t-card-border)', background: 'transparent', cursor: 'pointer' }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--t-text-primary)' }}>{c.nome}</p>
                    <p style={{ fontSize: 12, color: 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ultima}</p>
                  </button>
                ))}
                <button onClick={() => { setWppOpen(false); router.push('/whatsapp'); }}
                  style={{ width: '100%', padding: '10px', fontSize: 13, fontWeight: 600, color: '#128C7E', background: 'transparent', cursor: 'pointer' }}>
                  Abrir WhatsApp →
                </button>
              </div>
            )}
          </div>

          {/* Bell — alertas ficam aqui até serem vistos e tratados */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button
              title="Alertas"
              onClick={abrirAlertas}
              style={{
                width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--t-card-border)',
                background: 'var(--t-card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--t-text-muted)', flexShrink: 0, position: 'relative'
              }}
            >
              <Bell size={15} />
              {naoVistos > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, padding: '0 4px',
                  borderRadius: 9, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  boxShadow: '0 0 0 2px var(--t-card-bg)'
                }}>{naoVistos > 9 ? '9+' : naoVistos}</span>
              )}
            </button>

            {alertasOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 44, width: 360, maxHeight: 460, overflowY: 'auto',
                background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12,
                boxShadow: '0 16px 40px rgba(13,34,56,0.18)', zIndex: 80
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>Alertas</span>
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{alertas.length} pendente{alertas.length !== 1 ? 's' : ''}</span>
                </div>
                {alertas.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--t-text-muted)', fontSize: 13 }}>
                    🎉 Nenhum alerta — tudo em dia!
                  </div>
                ) : (
                  alertas.map(a => (
                    <button key={a.id}
                      onClick={() => { setAlertasOpen(false); router.push(a.link); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '11px 16px', display: 'flex', gap: 10,
                        borderBottom: '1px solid var(--t-card-border)', background: 'transparent', cursor: 'pointer'
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0, background: urgenciaCor(a.urgencia) }} />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--t-text-primary)' }}>{a.titulo}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--t-text-muted)', marginTop: 2 }}>{a.descricao}</span>
                      </span>
                    </button>
                  ))
                )}
                <button
                  onClick={() => { setAlertasOpen(false); router.push('/alertas'); }}
                  style={{ width: '100%', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--t-primary)', background: 'transparent', cursor: 'pointer' }}
                >
                  Ver todos os alertas
                </button>
              </div>
            )}
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: 'var(--t-card-border)', margin: '0 4px' }} />

          {/* User */}
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--t-avatar-from) 0%, var(--t-avatar-to) 100%)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                boxShadow: '0 2px 6px color-mix(in srgb, var(--t-primary) 25%, transparent)'
              }}
            >
              {initials}
            </div>
            <div className="hidden md:block leading-tight">
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>
                {user?.nome}
              </p>
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                {ROLE_LABELS[user?.role || ''] || user?.role}
              </p>
            </div>
          </div>

          {/* Alterar Senha */}
          <Link href="/alterar-senha"
            className="flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all border"
            style={{
              padding: '6px 12px',
              color: '#4A6E8A',
              borderColor: 'var(--t-primary-border)',
              background: 'var(--t-primary-light)',
              textDecoration: 'none'
            }}
            title="Alterar senha"
          >
            <KeyRound size={13} />
            <span className="hidden sm:inline">Senha</span>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg text-xs font-medium transition-all border"
            style={{
              padding: '6px 12px',
              color: 'var(--t-primary)',
              borderColor: 'var(--t-primary-border)',
              background: 'var(--t-primary-light)'
            }}
            title="Sair"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Overlay escuro atrás do drawer (mobile) */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-black/50"
            style={{ zIndex: 60 }}
          />
        )}

        {/* Sidebar — fixa no desktop; drawer deslizante no mobile */}
        <aside
          className={`ps-sidebar w-64 flex-shrink-0 flex flex-col overflow-y-auto
            fixed md:static inset-y-0 left-0 z-[70] md:z-auto
            transform transition-transform duration-200 md:transform-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          {/* Botão fechar (mobile) */}
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden absolute top-3 right-3 p-1.5 rounded-lg z-10"
            style={{ color: 'var(--t-sidebar-text)' }}>
            <XIcon size={20} />
          </button>
          {/* Sidebar (azul) fica só com o menu — a marca/logo está no topbar branco. */}
          <nav className="flex-1 py-4 px-2 space-y-4 overflow-y-auto">
            {(() => {
              const userRole = (user?.role || '').toUpperCase();
              const ehCEO = userRole === 'CEO';
              const filteredGroups = navGroups
                .map(group => ({
                  ...group,
                  items: group.items.filter(item =>
                    (!item.roles || item.roles.includes(userRole)) &&
                    // CEO só vê as rotas executivas permitidas (sem operacional/admin).
                    (!ehCEO || CEO_VISIVEL.includes(item.href))
                  )
                }))
                .filter(group => group.items.length > 0);
              return filteredGroups;
            })().map((group) => (
              <div key={group.label}>
                <p
                  className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--t-sidebar-muted)' }}
                >
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                    const Icon = item.icon;
                    const isWpp = item.destaque === 'whatsapp';

                    // WhatsApp em destaque verde (ativo = verde sólido; inativo = verde suave).
                    let estilo: React.CSSProperties;
                    if (isWpp) {
                      estilo = isActive
                        ? { background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', borderLeft: '2px solid #25D366', paddingLeft: '10px', fontWeight: 700 }
                        : { background: 'rgba(37,211,102,0.12)', color: '#25D366', borderLeft: '2px solid #25D366', paddingLeft: '10px', fontWeight: 600 };
                    } else if (isActive) {
                      estilo = { background: 'var(--t-sidebar-active)', color: '#ffffff', borderLeft: '2px solid var(--t-sidebar-active-border)', paddingLeft: '10px' };
                    } else {
                      estilo = { borderLeft: '2px solid transparent', color: 'var(--t-sidebar-text)' };
                    }

                    const conteudoItem = (
                      <>
                        <Icon size={isWpp ? 16 : 14} className="flex-shrink-0" style={{ opacity: isWpp || isActive ? 1 : 0.75 }} />
                        {item.label}
                        {item.externoComToken && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>↗</span>}
                        {isWpp && <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#25D366', boxShadow: '0 0 6px #25D366' }} />}
                      </>
                    );
                    const classeItem = `ps-sidebar-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium select-none ${isActive ? 'active' : ''}`;

                    // Portal externo: abre em nova aba COM o token SSO (?token=...).
                    if (item.externoComToken) {
                      return (
                        <a
                          key={item.label}
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            const base = process.env.NEXT_PUBLIC_PORTAL_URL || item.href;
                            if (!base || base === '#') { alert('Portal de Implantação ainda não configurado (defina NEXT_PUBLIC_PORTAL_URL).'); return; }
                            const tk = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
                            const url = tk ? `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(tk)}` : base;
                            window.open(url, '_blank', 'noopener');
                          }}
                          className={classeItem}
                          style={estilo}
                        >
                          {conteudoItem}
                        </a>
                      );
                    }

                    return (
                      <Link key={item.href} href={item.href} className={classeItem} style={estilo}>
                        {conteudoItem}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div
            className="px-3 py-3 mx-2 mb-3 rounded-xl"
            style={{
              background: 'var(--t-sidebar-footer-bg)',
              border: '1px solid var(--t-sidebar-footer-border)'
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
              style={{ color: 'var(--t-sidebar-muted)' }}>
              ProSystem Sistemas
            </p>
            <p className="text-[11px]" style={{ color: 'var(--t-sidebar-text)', opacity: 0.6 }}>
              Vitória · ES · Desde 2008
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="ps-content flex-1 overflow-auto min-h-0">
          <div className="p-3 sm:p-6 lg:p-8 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
