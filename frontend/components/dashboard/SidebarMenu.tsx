'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from 'lucide-react';
import { activeMenuHref, useMenuGroups } from '@/lib/use-menu-groups';
import './sidebar-menu.css';

type MenuItem = { href: string; icon: LucideIcon; label: string; destaque?: 'whatsapp'; externoComToken?: boolean };
type MenuGroup = { label: string; items: MenuItem[] };

export default function SidebarMenu({ groups, pathname, open, onClose, onOpenExternal }: {
  groups: MenuGroup[]; pathname: string | null; open: boolean; onClose: () => void; onOpenExternal: (item: MenuItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { closed, toggle, toggleAll } = useMenuGroups();
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('ps_sidebar_collapsed') === '1'); } catch { /* padrão expandido */ }
  }, []);
  const compact = collapsed && !open;
  const labels = groups.map(g => g.label);
  const allClosed = labels.every(g => closed.includes(g));
  const current = activeMenuHref(pathname, groups.flatMap(g => g.items.map(i => i.href)));
  const toggleWidth = () => {
    setCollapsed(!collapsed);
    try { localStorage.setItem('ps_sidebar_collapsed', collapsed ? '0' : '1'); } catch { /* preferência opcional */ }
  };
  const controls = (
<div className="ps-menu-toolbar">
        {!compact && <button type="button" onClick={() => toggleAll(labels)} aria-label={allClosed ? 'Expandir todos os grupos' : 'Recolher todos os grupos'} title={allClosed ? 'Expandir todos os grupos' : 'Recolher todos os grupos'}>{allClosed ? <ChevronsUpDown size={15} /> : <ChevronsDownUp size={15} />}</button>}
        <button type="button" className="ps-menu-width" onClick={toggleWidth} aria-label={compact ? 'Expandir menu' : 'Recolher menu'} title={compact ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!compact}>{compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
        <button type="button" className="ps-menu-close" onClick={onClose} aria-label="Fechar menu"><X size={18} /></button>
      </div>
  );
  return (
    <aside aria-label="Menu lateral" className={`ps-sidebar ps-menu ${compact ? 'ps-menu-compact' : ''} ${open ? 'ps-menu-open' : ''}`}>
      {compact && controls}
      <nav aria-label="Navegação principal" className="ps-menu-scroll">
        {groups.map((group, index) => {
          const expanded = compact || !closed.includes(group.label);
          const activeGroup = group.items.some(i => i.href === current);
          const id = 'ps-menu-group-' + index;
          return <section key={group.label} className="ps-menu-group">
            {!compact && <div className="ps-menu-group-header"><button type="button" className="ps-menu-heading" aria-expanded={expanded} aria-controls={id} onClick={() => toggle(group.label)} data-current={activeGroup && !expanded || undefined}>
              <span>{group.label}</span><ChevronDown size={12} aria-hidden="true" />
            </button>{index === 0 && controls}</div>}
            <ul id={id} hidden={!expanded}>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = item.href === current;
                const content = <><Icon size={14} aria-hidden="true" /><span className={compact ? 'sr-only' : 'ps-menu-label'}>{item.label}</span>{!compact && item.externoComToken && <span className="ps-menu-external" aria-hidden="true">↗</span>}{!compact && item.destaque === 'whatsapp' && <span className="ps-menu-status" aria-hidden="true" />}</>;
                const className = 'ps-sidebar-item ps-menu-link' + (active ? ' active' : '');
                return <li key={item.href}>{item.externoComToken
                  ? <a href={item.href} target="_blank" rel="noopener" className={className} title={compact ? item.label : undefined} onClick={e => { e.preventDefault(); onOpenExternal(item); }}>{content}</a>
                  : <Link href={item.href} className={className} aria-current={active ? 'page' : undefined} title={compact ? item.label : undefined}>{content}</Link>}
                </li>;
              })}
            </ul>
          </section>;
        })}
      </nav>
      {!compact && <div className="ps-menu-footer">Prosystem · Desde 2008</div>}
    </aside>
  );
}
