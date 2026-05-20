'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, Target, GitMerge, CalendarCheck, FileText, FileCheck2,
  TrendingDown, Megaphone, Trophy, Medal, Building2, Users, DollarSign,
  Handshake, Flame, Activity, Star, Package, KeyRound, Rocket, RefreshCw,
  Headphones, CalendarDays, Bell, TrendingUp, Sprout, Upload,
  Settings, BarChart2, LineChart, LogOut, ChevronRight, User,
  MessageSquare, Shield,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/leads',       icon: Target,       label: 'Leads' },
      { href: '/funil',       icon: GitMerge,     label: 'Funil Comercial' },
      { href: '/atividades',  icon: CalendarCheck,label: 'Atividades' },
      { href: '/propostas',   icon: FileText,     label: 'Propostas' },
      { href: '/contratos',   icon: FileCheck2,   label: 'Contratos' },
      { href: '/perdidos',    icon: TrendingDown, label: 'Perdidos' },
      { href: '/campanhas',   icon: Megaphone,    label: 'Campanhas' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/metas',   icon: Trophy, label: 'Metas Comerciais' },
      { href: '/ranking', icon: Medal,  label: 'Ranking' },
    ],
  },
  {
    label: 'Base',
    items: [
      { href: '/clientes', icon: Building2, label: 'Clientes' },
      { href: '/usuarios', icon: Users,     label: 'Usuários' },
    ],
  },
  {
    label: 'Incentivos',
    items: [
      { href: '/comissoes',  icon: DollarSign, label: 'Comissões' },
      { href: '/indicacoes', icon: Handshake,  label: 'Indicações' },
    ],
  },
  {
    label: 'Retenção',
    items: [
      { href: '/casos',        icon: Flame,    label: 'Churn & Retenção' },
      { href: '/health-score', icon: Activity, label: 'Health Score' },
      { href: '/nps',          icon: Star,     label: 'NPS' },
    ],
  },
  {
    label: 'Serviços',
    items: [
      { href: '/catalogo',   icon: Package,    label: 'Catálogo' },
      { href: '/licencas',   icon: KeyRound,   label: 'Licenças' },
      { href: '/onboarding', icon: Rocket,     label: 'Onboarding' },
      { href: '/renovacoes', icon: RefreshCw,  label: 'Renovações' },
      { href: '/suporte',    icon: Headphones, label: 'Suporte' },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { href: '/agenda',      icon: CalendarDays, label: 'Agenda' },
      { href: '/alertas',     icon: Bell,         label: 'Alertas' },
      { href: '/previsao',    icon: TrendingUp,   label: 'Previsão' },
      { href: '/nutricao',    icon: Sprout,       label: 'Nutrição' },
      { href: '/importacao',  icon: Upload,       label: 'Importar Leads' },
      { href: '/configuracoes', icon: Settings,   label: 'Configurações' },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { href: '/relatorios-comerciais', icon: BarChart2,  label: 'Comercial' },
      { href: '/relatorios',            icon: LineChart,  label: 'Retenção' },
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
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F7FB' }}>

      {/* ── Topbar ─────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-6 h-14 border-b bg-white"
        style={{ borderColor: '#D8E8F5', boxShadow: '0 1px 0 0 rgba(75,142,200,0.08)' }}
      >
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 select-none">
          <Image
            src="/logo-prosystem.png"
            alt="ProSystem"
            width={140}
            height={36}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        {/* Right: user info + logout */}
        <div className="flex items-center gap-3">
          <button
            className="relative p-1.5 rounded-lg transition-colors"
            style={{ color: '#7AAACB' }}
            title="Alertas"
          >
            <Bell size={18} />
          </button>

          <div
            className="h-7 w-px"
            style={{ background: '#D8E8F5' }}
          />

          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4B8EC8 0%, #2E6EAB 100%)' }}
            >
              {initials}
            </div>
            <div className="leading-tight hidden sm:block">
              <p className="text-sm font-semibold" style={{ color: '#0D2238' }}>
                {user?.nome}
              </p>
              <p className="text-xs" style={{ color: '#7AAACB' }}>
                {ROLE_LABELS[user?.role || ''] || user?.role}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
            style={{ color: '#4B8EC8', borderColor: '#C3DCFC', background: '#EBF4FF' }}
            title="Sair"
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside
          className="w-56 flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ background: '#0D2238', borderRight: '1px solid #1A3350' }}
        >
          <nav className="flex-1 py-4 px-2 space-y-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p
                  className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: '#2D5A7A' }}
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
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all select-none group ${
                          isActive ? 'active' : ''
                        } ps-sidebar-item`}
                        style={
                          isActive
                            ? {
                                background: '#1C3A5A',
                                color: '#ffffff',
                                borderLeft: '2px solid #4B8EC8',
                                paddingLeft: '10px',
                              }
                            : {
                                color: '#A8C8E8',
                                borderLeft: '2px solid transparent',
                              }
                        }
                      >
                        <Icon
                          size={14}
                          className="flex-shrink-0"
                          style={{ opacity: isActive ? 1 : 0.7 }}
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
            style={{ background: '#152E49', border: '1px solid #1E3D5C' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#2D5A7A' }}>
              ProSystem
            </p>
            <p className="text-[11px]" style={{ color: '#4B7A9C' }}>
              CRM Comercial v2.0
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto" style={{ background: '#F4F7FB' }}>
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
