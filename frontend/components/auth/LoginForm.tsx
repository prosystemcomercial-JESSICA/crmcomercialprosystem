'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
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
      await login(data.email, data.password);
      await new Promise(r => setTimeout(r, 400));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciais inválidas. Tente novamente.');
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
    border: '1px solid #C3DCFC',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#0D2238',
    background: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {error && (
          <div
            className="flex items-center gap-2.5 p-3 rounded-xl text-sm"
            style={{ background: '#FFF1F2', border: '1px solid #FECDD3', color: '#BE123C' }}
          >
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: '#0D2238' }}>
            E-mail
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7AAACB' }} />
            <input
              {...register('email')}
              type="email"
              placeholder="seu@email.com"
              style={inputBase}
              onFocus={e => {
                e.target.style.borderColor = '#4B8EC8';
                e.target.style.boxShadow = '0 0 0 3px rgba(75,142,200,0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = errors.email ? '#F43F5E' : '#C3DCFC';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          {errors.email && <p className="text-xs mt-1" style={{ color: '#BE123C' }}>{errors.email.message}</p>}
        </div>

        {/* Senha */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-semibold" style={{ color: '#0D2238' }}>Senha</label>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs font-medium transition-colors"
              style={{ color: '#4B8EC8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1A4E82')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4B8EC8')}
            >
              Esqueci a senha
            </button>
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7AAACB' }} />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              style={{ ...inputBase, paddingRight: '40px' }}
              onFocus={e => {
                e.target.style.borderColor = '#4B8EC8';
                e.target.style.boxShadow = '0 0 0 3px rgba(75,142,200,0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = errors.password ? '#F43F5E' : '#C3DCFC';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: '#7AAACB' }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p className="text-xs mt-1" style={{ color: '#BE123C' }}>{errors.password.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #4B8EC8 0%, #2E6EAB 100%)',
            boxShadow: '0 4px 12px rgba(75,142,200,0.30)',
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
          style={{ background: 'rgba(13,34,56,0.60)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl shadow-2xl"
            style={{ background: '#ffffff' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #EBF4FF' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: '#0D2238' }}>Recuperar senha</h3>
                <p className="text-xs mt-0.5" style={{ color: '#7AAACB' }}>Enviaremos uma nova senha para seu e-mail</p>
              </div>
              <button
                onClick={closeForgot}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: '#F4F7FB', color: '#7AAACB' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EBF4FF')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F4F7FB')}
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {forgotStatus === 'success' ? (
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                    <CheckCircle size={24} style={{ color: '#16A34A' }} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#4A6E8A' }}>{forgotMsg}</p>
                  <button
                    onClick={closeForgot}
                    className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)' }}
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: '#0D2238' }}>
                        Seu e-mail de acesso
                      </label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7AAACB' }} />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          placeholder="seu@email.com"
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleForgot(); } }}
                          style={{
                            width: '100%', padding: '10px 12px 10px 40px',
                            border: `1px solid ${forgotStatus === 'error' ? '#FECDD3' : '#C3DCFC'}`,
                            borderRadius: '10px', fontSize: '14px', color: '#0D2238',
                            background: '#fff', outline: 'none',
                          }}
                          onFocus={e => { e.target.style.borderColor = '#4B8EC8'; e.target.style.boxShadow = '0 0 0 3px rgba(75,142,200,0.15)'; }}
                          onBlur={e => { e.target.style.borderColor = '#C3DCFC'; e.target.style.boxShadow = 'none'; }}
                          autoFocus
                        />
                      </div>
                      {forgotStatus === 'error' && (
                        <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#BE123C' }}>
                          <AlertCircle size={12} /> {forgotMsg}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleForgot}
                      disabled={forgotLoading}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)', boxShadow: '0 4px 12px rgba(75,142,200,0.25)' }}
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
                      style={{ color: '#7AAACB' }}
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
