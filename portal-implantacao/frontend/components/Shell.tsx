'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { captarTokenDaUrl } from '@/lib/api';

const NAV = [
  { href: '/funis', label: 'Funis (Kanban)' },
  { href: '/dashboard', label: 'Dashboard' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useEffect(() => { captarTokenDaUrl(); }, []);
  return (
    <div className="min-h-screen">
      <header className="text-white" style={{ background: 'linear-gradient(90deg,#0D2C52,#1A4E82,#2E6EAB)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <div>
            <h1 className="font-bold text-lg leading-tight">Portal de Implantação</h1>
            <p className="text-xs text-blue-100">Prosystem · Onboarding & Setup técnico</p>
          </div>
          <nav className="flex gap-1 ml-4">
            {NAV.map(n => {
              const ativo = path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${ativo ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <a href="https://suporteprosystem.freshdesk.com/support/home" target="_blank" rel="noreferrer"
            className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">📚 Base de Conhecimento</a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
