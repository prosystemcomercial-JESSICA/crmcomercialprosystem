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
  LayoutDashboard, GitMerge, CalendarCheck, Calendar as CalendarIcon, FileCheck2,
  Megaphone, Trophy, Medal, Building2, Users, DollarSign,
  Handshake, Flame, Activity, Star, KeyRound, RefreshCw,
  Headphones, Bell, TrendingUp, Sprout, Upload,
  Settings, BarChart2, LineChart, LogOut, Moon, Sun,
  MessageSquare, Shield, ClipboardList, BookOpen, Wrench, Menu, X as XIcon,
  Maximize2, Minimize2, ChevronDown, User, Target, Send, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

const ALL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'TECNICO_SUPORTE', 'VENDEDOR'];
const COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'VENDEDOR'];
const TECNICO = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'TECNICO_SUPORTE'];
const GESTORES = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA'];
const GESTAO_COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];
// Supervisão Comercial tem acesso total ao menu (mesmo nível de CEO/ADMIN),
// mantendo o cargo/permissões de dados como Supervisão Comercial.
const SO_CEO = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];
const CEO_VISIVEL = ['/painel-ceo', '/relatorio-comercial', '/ranking', '/centro-custos', '/vendas-adicionais', '/churn-ceo', '/analise-comercial', '/ltv'];

// `modulo` liga o item ao nome usado em MODULOS (backend/src/routes/usuarios.ts,
// tela Usuários → "Liberação de Módulos"). Quando presente, um usuário SEM o cargo
// que já libera o item por `roles` ainda vê o item se tiver `ver: true` nesse
// módulo em modulos_permissao — é o que faz a liberação manual funcionar de verdade.
type NavItem = { href: string; icon: any; label: string; roles?: string[]; modulo?: string; destaque?: 'whatsapp'; externoComToken?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',            roles: GESTORES, modulo: 'Dashboard Geral' },
      { href: '/comercial', icon: BarChart2,       label: 'Radar Comercial',       roles: ['VENDEDOR'] },
      { href: '/leads',     icon: GitMerge,        label: 'Central de Leads',     roles: COMERCIAL, modulo: 'Leads' },
      { href: '/leads-sdr', icon: GitMerge,        label: 'Funil do SDR',          roles: ['SDR', 'CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'], modulo: 'Leads' },
      { href: '/whatsapp',  icon: MessageSquare,   label: 'WhatsApp',               roles: [...COMERCIAL, 'SDR'], destaque: 'whatsapp' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/atividades',            icon: CalendarCheck, label: 'Atividades',           roles: [...ALL, 'SDR'] },
      { href: '/agenda',                icon: CalendarIcon,  label: 'Agenda Google',        roles: [...ALL, 'SDR'] },
      { href: '/propostas-comerciais',  icon: ClipboardList, label: 'Propostas',          roles: COMERCIAL, modulo: 'Propostas' },
      { href: '/contratos',             icon: FileCheck2,    label: 'Contratos',          roles: COMERCIAL, modulo: 'Contratos' },
      { href: '/campanhas',             icon: Megaphone,     label: 'Campanhas',          roles: COMERCIAL },
    ],
  },
  {
    label: 'Clientes & Base',
    items: [
      { href: '/clientes',       icon: Building2, label: 'Clientes',       roles: [...ALL, 'SDR'], modulo: 'Empresas / Clientes' },
      { href: '/indicacoes',     icon: Handshake, label: 'Cross-sell',     roles: COMERCIAL },
      { href: '/representantes', icon: Handshake, label: 'Representantes', roles: COMERCIAL },
    ],
  },
  {
    label: 'Técnico',
    items: [
      { href: '/portal-tecnico', icon: Wrench, label: 'Portal Técnico', roles: [...GESTAO_COMERCIAL, 'TECNICO_IMPLANTACAO', 'SUPERVISAO_TECNICA', 'TECNICO_SUPORTE'], externoComToken: true },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/comercial',               icon: BarChart2,    label: 'Radar Comercial',    roles: GESTAO_COMERCIAL },
      { href: '/metas',                   icon: Trophy,       label: 'Metas Comerciais',   roles: COMERCIAL, modulo: 'Metas' },
      { href: '/ranking',                 icon: Medal,        label: 'Ranking',            roles: GESTAO_COMERCIAL },
      { href: '/comissoes',               icon: DollarSign,   label: 'Comissões',          roles: COMERCIAL, modulo: 'Comissões / Bônus' },
      { href: '/centro-custos',           icon: DollarSign,   label: 'Centro de Custos',   roles: GESTAO_COMERCIAL },
      { href: '/painel-ceo',              icon: TrendingUp,   label: 'Painel do CEO',      roles: GESTAO_COMERCIAL },
      { href: '/ltv',                     icon: TrendingUp,   label: 'LTV dos Clientes',   roles: GESTAO_COMERCIAL },
      { href: '/indicadores-ceo',         icon: DollarSign,   label: 'Indicadores do CEO', roles: GESTAO_COMERCIAL },
      { href: '/vendas-adicionais',       icon: Handshake,    label: 'Vendas Adicionais',  roles: GESTAO_COMERCIAL },
      { href: '/relatorio-comercial',     icon: LineChart,    label: 'Relatório (CEO)',     roles: GESTAO_COMERCIAL, modulo: 'Relatórios Comerciais' },
      { href: '/lancamentos-retroativos', icon: RefreshCw,    label: 'Lançar Retroativo',  roles: GESTAO_COMERCIAL },
      { href: '/sdr/desempenho',          icon: Target,       label: 'Meu Desempenho',     roles: ['SDR'] },
      { href: '/sdr/leads-para-distribuir', icon: Send,       label: 'Leads para Distribuir', roles: GESTAO_COMERCIAL },
    ],
  },
  {
    label: 'Retenção',
    items: [
      { href: '/ativos',       icon: Sprout,        label: 'Ativos (CS)',       roles: COMERCIAL },
      { href: '/churn-ceo',    icon: Flame,         label: 'Churn — Visão CEO', roles: SO_CEO, modulo: 'Cancelamentos / Churn' },
      { href: '/casos',        icon: Flame,         label: 'Churn & Retenção',  roles: TECNICO, modulo: 'Cancelamentos / Churn' },
      { href: '/health-score', icon: Activity,      label: 'Health Score',      roles: TECNICO },
      { href: '/nps',          icon: Star,          label: 'NPS',               roles: TECNICO },
      { href: '/pesquisas',    icon: MessageSquare, label: 'Pesquisas',         roles: TECNICO },
    ],
  },
  {
    label: 'Inteligência',
    items: [
      { href: '/alertas',               icon: Bell,      label: 'Alertas',         roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/previsao',              icon: TrendingUp, label: 'Previsão',        roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/nutricao',              icon: Sprout,    label: 'Nutrição',         roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/ciclo-vendas',          icon: LineChart, label: 'Ciclo de Vendas',  roles: GESTAO_COMERCIAL },
      { href: '/analise-comercial',     icon: BarChart2, label: 'Análise Comercial', roles: COMERCIAL },
      { href: '/campanha-padarias',     icon: Megaphone, label: 'Campanha Padarias', roles: GESTAO_COMERCIAL },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/usuarios',      icon: Users,    label: 'Usuários',       roles: GESTORES, modulo: 'Usuários e Permissões' },
      { href: '/importacao',    icon: Upload,   label: 'Importar Leads', roles: GESTAO_COMERCIAL },
      { href: '/auditoria',     icon: Shield,   label: 'Auditoria',      roles: GESTAO_COMERCIAL },
      { href: '/manual',        icon: BookOpen, label: 'Manual do CRM',  roles: [...ALL, 'SDR'] },
      { href: '/configuracoes', icon: Settings, label: 'Configurações',  roles: SO_CEO, modulo: 'Configurações do Sistema' },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', DIRETOR: 'Diretora', CEO: 'CEO',
  SUPERVISAO_COMERCIAL: 'Supervisão Comercial', SUPERVISAO: 'Supervisão',
  VENDEDOR: 'Comercial', FINANCEIRO: 'Financeiro', TECNICO: 'Técnico',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  type Alerta = { id: string; tipo: string; urgencia: string; titulo: string; descricao: string; link: string };
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Colapso da sidebar em desktop (largura cheia ↔ só ícones) — libera espaço
  // horizontal para telas densas como o kanban da Central de Leads. Persistido
  // por usuário para não voltar ao padrão a cada navegação/refresh.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ps_sidebar_collapsed') : null;
    if (saved === '1') setSidebarCollapsed(true);
  }, []);
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ps_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`alertas_seen_${user.id}`);
      if (raw) setSeen(new Set(JSON.parse(raw)));
    } catch {}
  }, [user?.id]);

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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setAlertasOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const [wppNaoLidas, setWppNaoLidas] = useState(0);
  const [wppConversas, setWppConversas] = useState<{ id: string; nome: string; ultima?: string }[]>([]);
  const [wppOpen, setWppOpen] = useState(false);
  const wppRef = useRef<HTMLDivElement>(null);
  const wppTotalRef = useRef(0);
  const wppVistoRef = useRef(false);
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
        if (total > wppTotalRef.current && wppTotalRef.current >= 0) {
          tocarSom();
          wppVistoRef.current = false;
        }
        wppTotalRef.current = total;
        setWppNaoLidas(wppVistoRef.current ? 0 : total);
        setWppConversas(convs.filter((c: any) => c.nao_lidas > 0).slice(0, 6).map((c: any) => ({
          id: c.id, nome: c.contato_nome || c.contato_numero, ultima: c.ultima_mensagem,
        })));
      } catch {}
    };
    checar();
    const t = setInterval(checar, 15000);
    return () => { ativo = false; clearInterval(t); };
  }, [user]);

  const naoVistos = alertas.filter(a => !seen.has(a.id)).length;

  const abrirAlertas = () => {
    const novo = !alertasOpen;
    setAlertasOpen(novo);
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

  // ── Popup campanha ativa ──────────────────────────────────────────────────
  const [campanhaPopup, setCampanhaPopup] = useState<{ nome: string; descricao?: string; nicho?: string; plano_alvo?: string; mensalidade?: number; meta_contratos?: number; condicao_especial?: string } | null>(null);
  const isVendedor = user?.role === 'VENDEDOR';

  useEffect(() => {
    if (!user || !isVendedor) return;
    // Só mostra uma vez por sessão (sessionStorage)
    const KEY = `campanha_popup_seen_${user.id}`;
    if (sessionStorage.getItem(KEY)) return;
    apiClient.getCampanhas(0, 10, 'ATIVA').then(res => {
      const ativas: any[] = res.data?.data?.campanhas || [];
      if (ativas.length === 0) return;
      const c = ativas[0];
      setCampanhaPopup({
        nome: c.nome,
        descricao: c.descricao,
        nicho: c.nicho,
        plano_alvo: c.plano_alvo,
        mensalidade: c.mensalidade,
        meta_contratos: c.meta_contratos,
        condicao_especial: c.condicao_especial,
      });
      sessionStorage.setItem(KEY, '1');
      // Som curto de 3 segundos: 3 bipes ascendentes
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const freqs = [523, 659, 784]; // Dó, Mi, Sol
        freqs.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.value = freq;
          const t0 = ctx.currentTime + i * 0.22;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.18, t0 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
          o.start(t0); o.stop(t0 + 0.4);
        });
      } catch {}
    }).catch(() => {});
  }, [user, isVendedor]);

  // Dropdown compartilhado
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: 46, right: 0,
    background: 'var(--t-card-bg)',
    border: '1px solid var(--t-card-border)',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
    zIndex: 80,
    overflow: 'hidden',
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: 'var(--t-content-bg)' }}>
      <VersionWatcher />

      {/* ── Popup campanha ativa (vendedor, 1x por sessão) ── */}
      {campanhaPopup && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          style={{ background: 'rgba(13,34,56,0.65)' }}>
          <div className="rounded-2xl shadow-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ maxWidth: 440, background: 'var(--t-card-bg)', border: '2px solid var(--t-primary)' }}>
            {/* Header colorido */}
            <div className="px-6 py-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, var(--t-primary), var(--t-primary-dark))' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Megaphone size={20} color="white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white opacity-70">Campanha Ativa</p>
                <h2 className="text-base font-extrabold text-white truncate">{campanhaPopup.nome}</h2>
              </div>
            </div>

            <div className="px-6 py-5 space-y-3">
              {campanhaPopup.descricao && (
                <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>{campanhaPopup.descricao}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {campanhaPopup.nicho && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-card-border)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--t-primary)' }}>Nicho</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>{campanhaPopup.nicho}</p>
                  </div>
                )}
                {campanhaPopup.plano_alvo && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-card-border)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--t-primary)' }}>Plano alvo</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>{campanhaPopup.plano_alvo}</p>
                  </div>
                )}
                {campanhaPopup.mensalidade != null && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#16a34a' }}>Mensalidade</p>
                    <p className="text-xs font-bold" style={{ color: '#16a34a' }}>
                      {campanhaPopup.mensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                    </p>
                  </div>
                )}
                {campanhaPopup.meta_contratos != null && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#16a34a' }}>Meta</p>
                    <p className="text-xs font-bold" style={{ color: '#16a34a' }}>{campanhaPopup.meta_contratos} contratos</p>
                  </div>
                )}
              </div>

              {campanhaPopup.condicao_especial && (
                <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#7c3aed' }}>Condição especial</p>
                  <p className="text-xs font-semibold" style={{ color: '#7c3aed' }}>{campanhaPopup.condicao_especial}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setCampanhaPopup(null); router.push('/campanhas'); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                  style={{ border: '1.5px solid var(--t-primary)', color: 'var(--t-primary)', background: 'var(--t-primary-light)' }}>
                  Ver campanha completa
                </button>
                <button onClick={() => setCampanhaPopup(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--t-primary), var(--t-primary-dark))' }}>
                  Entendido, vamos vender!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Topbar ─────────────────────────────────────────── */}
      <header
        className="ps-topbar flex-shrink-0 flex items-center justify-between px-4 h-14 gap-3"
      >
        {/* Mobile menu toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden flex-shrink-0 p-1.5 rounded-lg"
          style={{ color: 'var(--t-text-muted)' }}
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center select-none flex-shrink-0" aria-label="Prosystem">
          <Image
            src="/logo-prosystem.png"
            alt="Prosystem"
            width={200}
            height={54}
            className="object-contain"
            style={{ height: 44, width: 'auto' }}
            priority
          />
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 ml-auto">

          {/* Dark mode */}
          <button
            onClick={toggleMode}
            title={mode === 'claro' ? 'Modo escuro' : 'Modo claro'}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--t-text-muted)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-card-border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {mode === 'claro' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--t-text-muted)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-card-border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Divider */}
          <div className="w-px h-5 mx-1" style={{ background: 'var(--t-card-border)' }} />

          {/* WhatsApp */}
          <div ref={wppRef} className="relative">
            <button
              title="Conversas no WhatsApp"
              onClick={() => {
                setWppOpen(v => {
                  const abrindo = !v;
                  if (abrindo) { wppVistoRef.current = true; setWppNaoLidas(0); }
                  return abrindo;
                });
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative"
              style={{
                color: wppNaoLidas > 0 ? '#25D366' : 'var(--t-text-muted)',
                background: wppNaoLidas > 0 ? 'rgba(37,211,102,0.10)' : 'transparent',
              }}
              onMouseEnter={e => { if (!wppNaoLidas) e.currentTarget.style.background = 'var(--t-card-border)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = wppNaoLidas > 0 ? 'rgba(37,211,102,0.10)' : 'transparent'; }}
            >
              <MessageSquare size={15} />
              {wppNaoLidas > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3, minWidth: 15, height: 15, padding: '0 3px',
                  borderRadius: 8, background: '#25D366', color: '#fff', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{wppNaoLidas > 9 ? '9+' : wppNaoLidas}</span>
              )}
            </button>
            {wppOpen && (
              <div style={{ ...dropdownStyle, width: 280 }}>
                <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg,#128C7E,#075E54)', color: '#fff', fontWeight: 600, fontSize: 12 }}>
                  Conversas com novas mensagens
                </div>
                {wppConversas.length === 0 ? (
                  <p style={{ padding: 14, fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'center' }}>Nenhuma nova mensagem</p>
                ) : wppConversas.map(c => (
                  <button key={c.id} onClick={() => { setWppOpen(false); router.push('/whatsapp'); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', borderBottom: '1px solid var(--t-card-border)', background: 'transparent', cursor: 'pointer' }}>
                    <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--t-text-primary)' }}>{c.nome}</p>
                    <p style={{ fontSize: 11, color: 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ultima}</p>
                  </button>
                ))}
                <button onClick={() => { setWppOpen(false); router.push('/whatsapp'); }}
                  style={{ width: '100%', padding: '9px', fontSize: 12, fontWeight: 600, color: '#128C7E', background: 'transparent', cursor: 'pointer' }}>
                  Abrir WhatsApp →
                </button>
              </div>
            )}
          </div>

          {/* Bell — alertas */}
          <div ref={bellRef} className="relative">
            <button
              title="Alertas"
              onClick={abrirAlertas}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative"
              style={{ color: naoVistos > 0 ? '#dc2626' : 'var(--t-text-muted)', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-card-border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Bell size={15} />
              {naoVistos > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3, minWidth: 15, height: 15, padding: '0 3px',
                  borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 2px var(--t-topbar-bg)',
                }}>{naoVistos > 9 ? '9+' : naoVistos}</span>
              )}
            </button>
            {alertasOpen && (
              <div style={{ ...dropdownStyle, width: 340, maxHeight: 420, overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)' }}>Alertas</span>
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{alertas.length} pendente{alertas.length !== 1 ? 's' : ''}</span>
                </div>
                {alertas.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--t-text-muted)', fontSize: 12 }}>
                    Nenhum alerta — tudo em dia
                  </div>
                ) : alertas.map(a => (
                  <button key={a.id}
                    onClick={() => { setAlertasOpen(false); router.push(a.link); }}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 14px', display: 'flex', gap: 10, borderBottom: '1px solid var(--t-card-border)', background: 'transparent', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0, background: urgenciaCor(a.urgencia) }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)' }}>{a.titulo}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 1 }}>{a.descricao}</span>
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => { setAlertasOpen(false); router.push('/alertas'); }}
                  style={{ width: '100%', padding: '9px 14px', fontSize: 12, fontWeight: 600, color: 'var(--t-primary)', background: 'transparent', cursor: 'pointer' }}
                >
                  Ver todos os alertas →
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 mx-1" style={{ background: 'var(--t-card-border)' }} />

          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-card-border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--t-avatar-from) 0%, var(--t-avatar-to) 100%)' }}
              >
                {initials}
              </div>
              <div className="hidden md:block text-left leading-tight">
                <p className="text-[12px] font-semibold" style={{ color: 'var(--t-text-primary)' }}>{user?.nome?.split(' ')[0]}</p>
                <p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>{ROLE_LABELS[user?.role || ''] || user?.role}</p>
              </div>
              <ChevronDown size={12} style={{ color: 'var(--t-text-muted)' }} className="hidden md:block" />
            </button>

            {userMenuOpen && (
              <div style={{ ...dropdownStyle, width: 220, right: 0 }}>
                {/* User info header */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--t-card-border)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{user?.nome}</p>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>{user?.email}</p>
                </div>

                <div style={{ padding: '4px' }}>
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push('/alterar-senha'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
                    style={{ color: 'var(--t-text-primary)', background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <KeyRound size={13} style={{ color: 'var(--t-text-muted)' }} />
                    Alterar senha
                  </button>

                  <div style={{ height: 1, background: 'var(--t-card-border)', margin: '4px 0' }} />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
                    style={{ color: '#dc2626', background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={13} />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-black/50"
            style={{ zIndex: 60 }}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`ps-sidebar flex-shrink-0 flex flex-col overflow-y-auto
            fixed md:static inset-y-0 left-0 z-[70] md:z-auto
            transform transition-[transform,width] duration-200 md:transform-none
            ${sidebarCollapsed ? 'md:w-14' : 'md:w-56'} w-56
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          {/* Close (mobile) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute top-3 right-3 p-1 rounded-lg"
            style={{ color: 'var(--t-sidebar-text)' }}
            aria-label="Fechar menu"
          >
            <XIcon size={18} />
          </button>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex items-center justify-center flex-shrink-0 mx-2 mt-2 mb-1 p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--t-sidebar-muted)', alignSelf: sidebarCollapsed ? 'center' : 'flex-end' }}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>

          <nav className="flex-1 py-1 px-2 space-y-3 overflow-y-auto overflow-x-hidden">
            {(() => {
              const userRole = (user?.role || '').toUpperCase();
              const ehCEO = userRole === 'CEO';
              return navGroups
                .map(group => ({
                  ...group,
                  items: group.items.filter(item => {
                    // Cargo já libera o item (comportamento de sempre).
                    const liberadoPeloCargo = !item.roles || item.roles.includes(userRole);
                    // OU a supervisão liberou esse módulo manualmente pra esse usuário
                    // específico (tela Usuários → "Liberação de Módulos"), mesmo que o
                    // cargo dele não inclua o item por padrão.
                    const liberadoManualmente = !!(item.modulo && user?.modulos_permissao?.[item.modulo]?.ver);
                    return (liberadoPeloCargo || liberadoManualmente) &&
                      (!ehCEO || CEO_VISIVEL.includes(item.href));
                  })
                }))
                .filter(group => group.items.length > 0);
            })().map((group) => (
              <div key={group.label}>
                {!sidebarCollapsed && (
                  <p
                    className="px-2.5 mb-0.5 text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--t-sidebar-muted)' }}
                  >
                    {group.label}
                  </p>
                )}
                <div>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                    const Icon = item.icon;
                    const isWpp = item.destaque === 'whatsapp';

                    let estilo: React.CSSProperties;
                    if (isWpp) {
                      estilo = isActive
                        ? { background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', borderLeft: '2px solid #25D366', paddingLeft: '10px', fontWeight: 600 }
                        : { background: 'rgba(37,211,102,0.10)', color: '#25D366', borderLeft: '2px solid #25D366', paddingLeft: '10px' };
                    } else if (isActive) {
                      estilo = { background: 'var(--t-sidebar-active)', color: '#ffffff', borderLeft: '2px solid var(--t-sidebar-active-border)', paddingLeft: '10px' };
                    } else {
                      estilo = { borderLeft: '2px solid transparent', color: 'var(--t-sidebar-text)' };
                    }

                    const conteudoItem = (
                      <>
                        <Icon size={13} className="flex-shrink-0" style={{ opacity: isWpp || isActive ? 1 : 0.7 }} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        {!sidebarCollapsed && item.externoComToken && <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.5 }}>↗</span>}
                        {!sidebarCollapsed && isWpp && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#25D366', flexShrink: 0 }} />}
                      </>
                    );

                    const classeItem = `ps-sidebar-item flex items-center gap-2 py-1.5 rounded-md text-[12px] font-medium select-none ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'md:justify-center md:px-0 px-2.5' : 'px-2.5'}`;

                    if (item.externoComToken) {
                      return (
                        <a
                          key={item.label}
                          href="#"
                          title={sidebarCollapsed ? item.label : undefined}
                          onClick={(e) => {
                            e.preventDefault();
                            const base = process.env.NEXT_PUBLIC_PORTAL_URL || item.href;
                            if (!base || base === '#') return;
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
                      <Link key={item.href} href={item.href} className={classeItem} style={estilo} title={sidebarCollapsed ? item.label : undefined}>
                        {conteudoItem}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          {!sidebarCollapsed && (
            <div
              className="px-2 py-2 mx-2 mb-2 rounded-lg"
              style={{
                background: 'var(--t-sidebar-footer-bg)',
                border: '1px solid var(--t-sidebar-footer-border)',
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--t-sidebar-muted)' }}>
                ProSystem Sistemas
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--t-sidebar-text)', opacity: 0.5 }}>
                Vitória · ES · Desde 2008
              </p>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="ps-content flex-1 overflow-auto min-h-0">
          <div className="p-4 sm:p-6 lg:p-7 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
