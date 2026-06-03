'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, User } from './api-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (token exists)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Decode token to get user info
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const decoded = JSON.parse(jsonPayload);
          setUser({
            id: decoded.userId,
            email: decoded.email,
            nome: decoded.nome,
            role: decoded.role
          });
        } catch (error) {
          console.error('Failed to decode token', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const response = await apiClient.login(email, password);
      try { localStorage.setItem('lastActivity', String(Date.now())); } catch {}
      setUser(response.user);
      return response.user as User;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // ── Logout automático por INATIVIDADE (3h sem uso) ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const LIMITE = 3 * 60 * 60 * 1000;   // 3 horas
    const KEY = 'lastActivity';
    const tocar = () => { localStorage.setItem(KEY, String(Date.now())); };

    const expirou = () => {
      const t = parseInt(localStorage.getItem(KEY) || '0', 10);
      return t > 0 && (Date.now() - t) > LIMITE;
    };

    const encerrarSessao = () => {
      try { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); localStorage.removeItem(KEY); } catch {}
      setUser(null);
      if (window.location.pathname !== '/') window.location.href = '/';
    };

    // Se já estava expirado ao abrir/recarregar, encerra
    if (localStorage.getItem('accessToken') && expirou()) { encerrarSessao(); return; }
    tocar();

    const eventos = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    eventos.forEach(ev => window.addEventListener(ev, tocar, { passive: true }));
    const intervalo = setInterval(() => {
      if (localStorage.getItem('accessToken') && expirou()) encerrarSessao();
    }, 60 * 1000);   // verifica a cada minuto

    return () => {
      eventos.forEach(ev => window.removeEventListener(ev, tocar));
      clearInterval(intervalo);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: user !== null
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// ── Papéis com visão TOTAL (espelha backend/src/lib/scope.ts) ──
// CEO, ADMIN e Supervisão Comercial veem todos os vendedores / KPIs / projeções.
// Demais (vendedor) só veem o próprio resultado.
const ROLES_VISAO_TOTAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];

export function podeVerTudo(role?: string | null): boolean {
  const r = (role || '').toUpperCase();
  return ROLES_VISAO_TOTAL.some(x => r.includes(x));
}

/** Hook prático: true = gestor (vê tudo); false = vendedor (só o próprio). */
export function useIsGestor(): boolean {
  const { user } = useAuth();
  return podeVerTudo(user?.role);
}

/**
 * Hook de guarda de página: redireciona não-gestores para `redirectTo`.
 * Retorna { isGestor, blocked } — use `blocked` para mostrar spinner enquanto sai.
 *   const { isGestor, blocked } = useRequireGestorRedirect();
 *   if (blocked) return <Spinner/>;
 */
export function useRequireGestorRedirect(redirectTo = '/comercial') {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const isGestor = podeVerTudo(user?.role);
  const blocked = !loading && isAuthenticated && !!user && !isGestor;
  useEffect(() => {
    if (blocked) router.replace(redirectTo);
  }, [blocked, redirectTo, router]);
  return { isGestor, blocked };
}
