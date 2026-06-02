'use client';

import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  LayoutDashboard, Target, GitMerge, CalendarCheck, FileCheck2,
  TrendingDown, Megaphone, Trophy, Medal, Building2, Users, DollarSign,
  Handshake, Flame, Activity, Star, Package, KeyRound, Rocket, RefreshCw,
  Headphones, CalendarDays, Bell, TrendingUp, Sprout, Upload,
  Settings, BarChart2, LineChart, LogOut, Moon, Sun, User,
  MessageSquare, Shield, ClipboardList, BookOpen,
} from 'lucide-react';

// Cargos do CRM
const ALL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'TECNICO_SUPORTE', 'VENDEDOR'];
const COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'VENDEDOR'];
const TECNICO = ['CEO', 'ADMIN', 'SUPERVISAO_TECNICA', 'TECNICO_SUPORTE'];
const GESTORES = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA'];
// Gestão comercial — visão total de KPIs/projeções/importações/ranking (sem vendedor)
const GESTAO_COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];
const SO_CEO = ['CEO', 'ADMIN'];

type NavItem = { href: string; icon: any; label: string; roles?: string[] };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      // Painel executivo (KPIs/projeções) — só gestão. Vendedor não vê Dashboard.
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',       roles: GESTORES },
      // Radar Comercial é a primeira tela do vendedor (atividades dos próprios leads).
      { href: '/comercial', icon: BarChart2,       label: 'Radar Comercial', roles: ['VENDEDOR'] },
      { href: '/manual',    icon: BookOpen,        label: 'Manual do CRM',   roles: ALL },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/leads',                 icon: GitMerge,      label: 'Pipeline Comercial', roles: COMERCIAL },
      { href: '/atividades',            icon: CalendarCheck, label: 'Atividades',         roles: ALL },
      { href: '/agenda',                icon: CalendarDays,  label: 'Agenda (Google)',    roles: ALL },
      { href: '/propostas-comerciais',  icon: ClipboardList, label: 'Propostas',          roles: COMERCIAL },
      { href: '/contratos',             icon: FileCheck2,    label: 'Contratos',          roles: COMERCIAL },
      { href: '/perdidos',              icon: TrendingDown,  label: 'Perdidos',           roles: COMERCIAL },
      { href: '/campanhas',             icon: Megaphone,     label: 'Campanhas',          roles: COMERCIAL },
    ],
  },
  {
    label: 'Performance',
    items: [
      // Para o vendedor, o Radar fica em "Principal" (1ª tela); aqui só p/ gestão.
      { href: '/comercial', icon: BarChart2,    label: 'Radar Comercial', roles: GESTAO_COMERCIAL },
      { href: '/metas',     icon: Trophy,       label: 'Metas Comerciais',roles: COMERCIAL },
      { href: '/ranking',   icon: Medal,        label: 'Ranking',         roles: GESTAO_COMERCIAL },
    ],
  },
  {
    label: 'Base',
    items: [
      { href: '/clientes', icon: Building2, label: 'Clientes', roles: ALL },
      { href: '/usuarios', icon: Users,     label: 'Usuários', roles: GESTORES },
    ],
  },
  {
    label: 'Incentivos',
    items: [
      { href: '/comissoes',  icon: DollarSign, label: 'Comissões',  roles: COMERCIAL },
      { href: '/indicacoes', icon: Handshake,  label: 'Indicações', roles: COMERCIAL },
    ],
  },
  {
    label: 'Retenção',
    items: [
      { href: '/casos',        icon: Flame,    label: 'Churn & Retenção', roles: TECNICO },
      { href: '/health-score', icon: Activity, label: 'Health Score',     roles: TECNICO },
      { href: '/nps',          icon: Star,     label: 'NPS',              roles: TECNICO },
    ],
  },
  {
    label: 'Serviços',
    items: [
      { href: '/catalogo',   icon: Package,    label: 'Catálogo',   roles: GESTORES },
      { href: '/licencas',   icon: KeyRound,   label: 'Licenças',   roles: GESTORES },
      { href: '/onboarding', icon: Rocket,     label: 'Onboarding', roles: TECNICO },
      { href: '/renovacoes', icon: RefreshCw,  label: 'Renovações', roles: TECNICO },
      { href: '/suporte',    icon: Headphones, label: 'Suporte',    roles: TECNICO },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { href: '/alertas',       icon: Bell,         label: 'Alertas',         roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/previsao',      icon: TrendingUp,   label: 'Previsão',        roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/nutricao',      icon: Sprout,       label: 'Nutrição',        roles: COMERCIAL.concat('SUPERVISAO_TECNICA') },
      { href: '/importacao',    icon: Upload,       label: 'Importar Leads',  roles: GESTAO_COMERCIAL },
      { href: '/configuracoes', icon: Settings,     label: 'Configurações',   roles: SO_CEO },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { href: '/relatorios-comerciais', icon: BarChart2, label: 'Comercial',       roles: GESTAO_COMERCIAL },
      { href: '/ciclo-vendas',          icon: LineChart, label: 'Ciclo de Vendas', roles: GESTAO_COMERCIAL },
      { href: '/relatorios',            icon: LineChart, label: 'Retenção',        roles: TECNICO },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  CEO: 'Diretor',
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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--t-content-bg)' }}>

      {/* ── Topbar ─────────────────────────────────────────── */}
      <header className="ps-topbar flex-shrink-0 flex items-center justify-between px-5 h-16">

        {/* Logo área — responsivo */}
        <Link href="/dashboard" className="flex items-center gap-3 select-none group" style={{ minWidth: 180 }}>
          <div style={{
            position: 'relative',
            width: 44, height: 44, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--t-primary) 0%, var(--t-primary-dark) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
            boxShadow: '0 2px 8px color-mix(in srgb, var(--t-primary) 30%, transparent)'
          }}>
            <Image
              src="/logo-prosystem.png"
              alt="ProSystem"
              width={34}
              height={34}
              className="object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              priority
            />
          </div>
          <div className="hidden sm:block leading-tight">
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--t-text-primary)' }}>
              ProSystem
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--t-text-muted)' }}>
              CRM Comercial
            </div>
          </div>
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

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: 'var(--t-card-border)', margin: '0 4px' }} />

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
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside
          className="ps-sidebar w-56 flex-shrink-0 flex flex-col overflow-y-auto"
        >
          {/* Logo marca no sidebar — destaque extra */}
          <div style={{
            padding: '20px 16px 12px',
            borderBottom: '1px solid var(--t-sidebar-border)',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--t-primary) 0%, var(--t-primary-dark) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--t-primary) 35%, transparent)',
              overflow: 'hidden'
            }}>
              <Image
                src="/logo-prosystem.png"
                alt="ProSystem"
                width={38}
                height={38}
                className="object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
                priority
              />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.1 }}>
                ProSystem
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--t-sidebar-text)', opacity: 0.7, marginTop: 2 }}>
                CRM v2.0
              </div>
            </div>
          </div>

          <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
            {(() => {
              const userRole = (user?.role || '').toUpperCase();
              const filteredGroups = navGroups
                .map(group => ({
                  ...group,
                  items: group.items.filter(item => !item.roles || item.roles.includes(userRole))
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
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`ps-sidebar-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium select-none ${
                          isActive ? 'active' : ''
                        }`}
                        style={isActive ? {
                          background: 'var(--t-sidebar-active)',
                          color: '#ffffff',
                          borderLeft: '2px solid var(--t-sidebar-active-border)',
                          paddingLeft: '10px',
                        } : {
                          borderLeft: '2px solid transparent',
                          color: 'var(--t-sidebar-text)',
                        }}
                      >
                        <Icon
                          size={14}
                          className="flex-shrink-0"
                          style={{ opacity: isActive ? 1 : 0.75 }}
                        />
                        {item.label}
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
        <main className="ps-content flex-1 overflow-auto">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
