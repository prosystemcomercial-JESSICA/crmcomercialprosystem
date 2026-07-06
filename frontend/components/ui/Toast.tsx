'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error:   <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info:    <Info size={16} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(22,163,74,0.10)',   border: 'rgba(22,163,74,0.30)',   icon: '#16a34a' },
  error:   { bg: 'rgba(220,38,38,0.10)',   border: 'rgba(220,38,38,0.30)',   icon: '#dc2626' },
  warning: { bg: 'rgba(217,119,6,0.10)',   border: 'rgba(217,119,6,0.30)',   icon: '#d97706' },
  info:    { bg: 'rgba(75,142,200,0.10)',  border: 'rgba(75,142,200,0.30)',  icon: 'var(--t-primary)' },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const c = COLORS[toast.type];

  useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl shadow-lg animate-in slide-in-from-right-4 fade-in duration-200"
      style={{
        minWidth: 300, maxWidth: 400,
        padding: '12px 14px',
        background: 'var(--t-card-bg)',
        border: `1px solid ${c.border}`,
        boxShadow: '0 8px 32px rgba(13,34,56,0.15)',
      }}
    >
      <span className="flex-shrink-0 mt-0.5" style={{ color: c.icon }}>{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{toast.title}</p>
        {toast.description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 rounded-md p-0.5 transition-colors"
        style={{ color: 'var(--t-text-muted)' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { ...opts, id }]); // máx 5 toasts
  }, []);

  const value: ToastContextValue = {
    toast: add,
    success: (title, description) => add({ type: 'success', title, description }),
    error:   (title, description) => add({ type: 'error',   title, description }),
    warning: (title, description) => add({ type: 'warning', title, description }),
    info:    (title, description) => add({ type: 'info',    title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Portal de toasts — canto inferior direito */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 flex flex-col gap-2"
        style={{ zIndex: 9999 }}
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook para usar toasts em qualquer componente */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

/**
 * Substitui window.alert() e window.confirm() com toasts do design system.
 * Uso: import { showToast } from '@/components/ui/Toast'
 * showToast.success('Salvo com sucesso')
 *
 * Para uso FORA de componentes React (sem hook), use este singleton:
 */
let _toast: ToastContextValue | null = null;
export const showToast = {
  _register: (ctx: ToastContextValue) => { _toast = ctx; },
  success: (title: string, desc?: string) => _toast?.success(title, desc),
  error:   (title: string, desc?: string) => _toast?.error(title, desc),
  warning: (title: string, desc?: string) => _toast?.warning(title, desc),
  info:    (title: string, desc?: string) => _toast?.info(title, desc),
};
