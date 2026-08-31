'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DOMINIO_EMAIL = '@prosystemnet.com.br';

const loginSchema = z.object({
  usuario: z.string().min(1, 'Informe seu usuário'),
  password: z.string().min(1, 'Informe a senha'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Esqueci a senha
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [forgotMsg, setForgotMsg] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      setLoading(true);
      const email = `${data.usuario.trim()}${DOMINIO_EMAIL}`;
      const u = await login(email, data.password);
      // Primeiro acesso ou após reset: obriga a definir uma nova senha.
      if (u?.precisa_trocar_senha) router.push('/alterar-senha?trocar=1');
      else router.push('/dashboard');
    } catch (err: any) {
      if (!err.response) {
        setError('Erro de conexão. Verifique sua internet e tente novamente.');
      } else if (err.response.status === 401) {
        setError('E-mail ou senha incorretos. Verifique e tente novamente.');
      } else {
        setError(err.response?.data?.message || 'Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotStatus('error');
      setForgotMsg('Informe um e-mail válido.');
      return;
    }
    setForgotLoading(true);
    setForgotStatus('idle');
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const json = await res.json();
      if (res.ok) {
        setForgotStatus('success');
        setForgotMsg('Se o e-mail estiver cadastrado, você receberá a nova senha em instantes. Verifique sua caixa de entrada e spam.');
      } else {
        setForgotStatus('error');
        setForgotMsg(json.message || 'Não foi possível processar. Tente novamente.');
      }
    } catch {
      setForgotStatus('error');
      setForgotMsg('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail('');
    setForgotStatus('idle');
    setForgotMsg('');
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px 10px 40px',
    border: '1px solid var(--t-primary-border)',
    borderRadius: '10px',
    fontSize: '14px',
    color: 'var(--t-text-primary)',
    background: 'var(--t-card-bg)',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {error && (
          <div
            className="flex items-center gap-2.5 p-3 rounded-xl text-sm"
            role="alert"
            aria-live="assertive"
            style={{ background: 'var(--t-error-bg)', border: '1px solid var(--t-error-border)', color: 'var(--t-error)' }}
          >
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Usuário */}
        <div>
          <label htmlFor="login-usuario" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--t-text-primary)' }}>
            Usuário
          </label>
          <div
            className={`flex items-stretch rounded-[10px] overflow-hidden border transition-[border-color,box-shadow] focus-within:border-[var(--t-primary)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--t-primary)_15%,transparent)] ${errors.usuario ? 'border-[var(--t-error-strong)]' : 'border-[var(--t-primary-border)]'}`}
          >
            <input
              {...register('usuario')}
              id="login-usuario"
              type="text"
              autoComplete="username"
              placeholder="seu.usuario"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 6px 10px 12px',
                fontSize: '14px',
                color: 'var(--t-text-primary)',
                background: 'var(--t-card-bg)',
                border: 'none',
                outline: 'none',
              }}
            />
            <span
              className="flex items-center whitespace-nowrap text-sm font-semibold"
              style={{
                padding: '0 14px',
                color: 'var(--t-text-secondary)',
                background: 'var(--t-primary-light)',
                borderLeft: '1px solid var(--t-primary-border)',
              }}
            >
              @prosystemnet.com.br
            </span>
          </div>
          {errors.usuario && <p className="text-xs mt-1" style={{ color: 'var(--t-error)' }}>{errors.usuario.message}</p>}
        </div>

        {/* Senha */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>Senha</label>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs font-medium transition-colors"
              style={{ color: 'var(--t-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--t-primary-deep)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--t-primary)')}
            >
              Esqueci a senha
            </button>
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-muted)' }} />
            <input
              {...register('password')}
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              style={{ ...inputBase, paddingRight: '40px' }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--t-primary)';
                e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--t-primary) 15%, transparent)';
              }}
              onBlur={e => {
                e.target.style.borderColor = errors.password ? 'var(--t-error-strong)' : 'var(--t-primary-border)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--t-text-muted)' }}
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p className="text-xs mt-1" style={{ color: 'var(--t-error)' }}>{errors.password.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, var(--t-primary-dark) 0%, var(--t-primary-deep) 100%)',
            boxShadow: '0 4px 12px color-mix(in srgb, var(--t-primary) 30%, transparent)',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }}
              />
              Entrando...
            </span>
          ) : (
            'Acessar CRM'
          )}
        </button>
      </form>

      {/* Modal — Esqueci a senha */}
      {showForgot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'color-mix(in srgb, var(--ps-navy) 60%, transparent)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl shadow-2xl"
            style={{ background: 'var(--t-card-bg)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--t-primary-light)' }}>
              <div>
                <h3 id="forgot-password-title" className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>Recuperar senha</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Enviaremos uma nova senha para seu e-mail</p>
              </div>
              <button
                onClick={closeForgot}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                aria-label="Fechar"
                style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--t-content-bg)')}
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {forgotStatus === 'success' ? (
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--t-success-bg)' }}>
                    <CheckCircle size={24} style={{ color: 'var(--t-success)' }} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--t-text-secondary)' }}>{forgotMsg}</p>
                  <button
                    onClick={closeForgot}
                    className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--t-primary-dark), var(--t-primary-deep))' }}
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="forgot-email" className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--t-text-primary)' }}>
                        Seu e-mail de acesso
                      </label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-muted)' }} />
                        <input
                          id="forgot-email"
                          type="email"
                          autoComplete="email"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          placeholder="seu@email.com"
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleForgot(); } }}
                          style={{
                            width: '100%', padding: '10px 12px 10px 40px',
                            border: `1px solid ${forgotStatus === 'error' ? 'var(--t-error-border)' : 'var(--t-primary-border)'}`,
                            borderRadius: '10px', fontSize: '14px', color: 'var(--t-text-primary)',
                            background: 'var(--t-card-bg)', outline: 'none',
                          }}
                          onFocus={e => { e.target.style.borderColor = 'var(--t-primary)'; e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--t-primary) 15%, transparent)'; }}
                          onBlur={e => { e.target.style.borderColor = 'var(--t-primary-border)'; e.target.style.boxShadow = 'none'; }}
                          autoFocus
                        />
                      </div>
                      {forgotStatus === 'error' && (
                        <p className="text-xs mt-1.5 flex items-center gap-1" role="alert" style={{ color: 'var(--t-error)' }}>
                          <AlertCircle size={12} /> {forgotMsg}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleForgot}
                      disabled={forgotLoading}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, var(--t-primary-dark), var(--t-primary-deep))', boxShadow: '0 4px 12px color-mix(in srgb, var(--t-primary) 25%, transparent)' }}
                    >
                      {forgotLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }} />
                          Enviando...
                        </span>
                      ) : 'Enviar nova senha'}
                    </button>

                    <button
                      onClick={closeForgot}
                      className="w-full py-2 text-sm font-medium"
                      style={{ color: 'var(--t-text-muted)' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
