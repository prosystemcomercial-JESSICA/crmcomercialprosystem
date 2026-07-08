'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { captarTokenDaUrl } from '@/lib/api';

const NAV_GROUPS = [
  {
    label: 'IMPLANTAÇÃO',
    items: [
      { href: '/funis',     label: 'Funis (Kanban)' },
      { href: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'SUPORTE',
    items: [
      { href: '/suporte',   label: 'Tickets & SLA' },
      { href: '/templates', label: 'Templates' },
    ],
  },
  {
    label: 'CONHECIMENTO',
    items: [
      { href: '/kb', label: 'Base de Conhecimento' },
    ],
  },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useEffect(() => { captarTokenDaUrl(); }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="text-white shrink-0" style={{ background: 'linear-gradient(90deg,#0D2C52,#1A4E82,#2E6EAB)' }}>
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
          <div>
            <h1 className="font-bold text-lg leading-tight">Portal ProSystem</h1>
            <p className="text-xs text-blue-100">Implantação · Suporte · Conhecimento</p>
          </div>
          <nav className="flex gap-4 ml-4 flex-wrap">
            {NAV_GROUPS.map(grp => (
              <div key={grp.label} className="flex items-center gap-1">
                <span className="text-[9px] font-bold text-blue-300 tracking-widest uppercase mr-1">{grp.label}</span>
                {grp.items.map(n => {
                  const ativo = path.startsWith(n.href);
                  return (
                    <Link key={n.href} href={n.href}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${ativo ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
