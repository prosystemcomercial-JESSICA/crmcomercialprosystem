'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        <label
          className="block text-sm font-semibold mb-1.5"
          style={{ color: '#0D2238' }}
        >
          E-mail
        </label>
        <div className="relative">
          <Mail
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#7AAACB' }}
          />
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
        {errors.email && (
          <p className="text-xs mt-1" style={{ color: '#BE123C' }}>
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Senha */}
      <div>
        <label
          className="block text-sm font-semibold mb-1.5"
          style={{ color: '#0D2238' }}
        >
          Senha
        </label>
        <div className="relative">
          <Lock
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#7AAACB' }}
          />
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
        {errors.password && (
          <p className="text-xs mt-1" style={{ color: '#BE123C' }}>
            {errors.password.message}
          </p>
        )}
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
        onMouseEnter={e => {
          if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'none';
        }}
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
  );
}
