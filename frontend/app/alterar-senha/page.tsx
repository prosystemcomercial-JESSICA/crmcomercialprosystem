'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, Shield } from 'lucide-react';

function strengthScore(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[@#$!%^&*]/.test(pwd)) score++;
  if (score <= 2) return { score, label: 'Fraca', color: '#dc2626' };
  if (score <= 4) return { score, label: 'Média', color: '#f59e0b' };
  return { score, label: 'Forte', color: '#16a34a' };
}

export default function AlterarSenhaPage() {
  const router = useRouter();
  const [form, setForm] = useState({ senha_atual: '', nova_senha: '', confirmar: '' });
  const [show, setShow] = useState({ atual: false, nova: false, confirmar: false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [trocarObrigatorio, setTrocarObrigatorio] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTrocarObrigatorio(new URLSearchParams(window.location.search).get('trocar') === '1');
    }
  }, []);

  const strength = strengthScore(form.nova_senha);
  const match = form.confirmar && form.nova_senha === form.confirmar;
  const mismatch = form.confirmar && form.nova_senha !== form.confirmar;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.nova_senha !== form.confirmar) {
      setError('As senhas não coincidem.');
      return;
    }
    if (form.nova_senha.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.alterarSenha(form.senha_atual, form.nova_senha);
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao alterar senha. Tente novamente.');
    }
    setLoading(false);
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '11px 14px', paddingRight: 44, border: '1.5px solid #C3DCFC',
    borderRadius: 9, fontSize: 14, color: 'var(--t-text-primary)', background: '#fff',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 2
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--t-content-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 48, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(13,34,56,0.10)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={36} color="#16a34a" />
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: 'var(--t-text-primary)' }}>Senha alterada!</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#4A6E8A', lineHeight: 1.7 }}>
            Sua nova senha foi salva com sucesso. Redirecionando para o dashboard...
          </p>
          <div style={{ height: 4, background: 'var(--t-primary-light)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#16a34a', borderRadius: 4, animation: 'progress 2.5s linear forwards' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--t-content-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', maxWidth: 460, width: '100%', boxShadow: '0 8px 40px rgba(13,34,56,0.12)' }}>

        {/* Header ProSystem */}
        <div style={{ background: 'linear-gradient(135deg, #0D2238 0%, #1A4E82 100%)', padding: '32px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#A8C8E8', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <ArrowLeft size={14} /> Voltar
            </button>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Pro<span style={{ color: '#90BEF0' }}>System</span>
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6AAAE5', letterSpacing: 2, textTransform: 'uppercase' }}>
            CRM Comercial · Segurança de Acesso
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(75,142,200,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="#90BEF0" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>Alterar Senha</p>
              <p style={{ margin: 0, fontSize: 12, color: '#A8C8E8' }}>{trocarObrigatorio ? 'Defina uma nova senha para continuar' : 'Crie uma senha pessoal e segura'}</p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ padding: '32px 40px' }}>

          {/* Senha atual */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Senha atual (temporária)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={show.atual ? 'text' : 'password'}
                value={form.senha_atual}
                onChange={e => setForm(p => ({ ...p, senha_atual: e.target.value }))}
                placeholder="Digite sua senha atual"
                required
                style={{ ...input, letterSpacing: form.senha_atual ? 4 : 0 }}
              />
              <button type="button" onClick={() => setShow(p => ({ ...p, atual: !p.atual }))}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-secondary)', padding: 0 }}>
                {show.atual ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Nova senha */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Nova senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={show.nova ? 'text' : 'password'}
                value={form.nova_senha}
                onChange={e => setForm(p => ({ ...p, nova_senha: e.target.value }))}
                placeholder="Crie uma senha segura"
                required
                style={{ ...input, letterSpacing: form.nova_senha ? 4 : 0 }}
              />
              <button type="button" onClick={() => setShow(p => ({ ...p, nova: !p.nova }))}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-secondary)', padding: 0 }}>
                {show.nova ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Barra de força */}
          {form.nova_senha.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength.score ? strength.color : '#E8F0F8', transition: 'background 0.3s' }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 11, color: strength.color, fontWeight: 600 }}>
                Força: {strength.label}
                {strength.score < 4 && <span style={{ color: 'var(--t-text-secondary)', fontWeight: 400 }}> · Adicione maiúsculas, números ou símbolos (@#$!)</span>}
              </p>
            </div>
          )}

          {/* Confirmar senha */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Confirmar nova senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={show.confirmar ? 'text' : 'password'}
                value={form.confirmar}
                onChange={e => setForm(p => ({ ...p, confirmar: e.target.value }))}
                placeholder="Repita a nova senha"
                required
                style={{
                  ...input,
                  letterSpacing: form.confirmar ? 4 : 0,
                  borderColor: match ? '#86efac' : mismatch ? '#fca5a5' : '#C3DCFC'
                }}
              />
              <button type="button" onClick={() => setShow(p => ({ ...p, confirmar: !p.confirmar }))}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-secondary)', padding: 0 }}>
                {show.confirmar ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {match && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ As senhas coincidem</p>}
            {mismatch && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626', fontWeight: 600 }}>✗ As senhas não coincidem</p>}
          </div>

          {/* Dicas rápidas */}
          <div style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Shield size={13} color="#4B8EC8" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A4E82' }}>Requisitos de segurança</span>
            </div>
            {[
              ['Mínimo de 6 caracteres', form.nova_senha.length >= 6],
              ['Pelo menos uma letra maiúscula', /[A-Z]/.test(form.nova_senha)],
              ['Pelo menos um número', /[0-9]/.test(form.nova_senha)],
              ['Diferente da senha anterior', !!form.nova_senha && form.nova_senha !== form.senha_atual],
            ].map(([txt, ok]) => (
              <p key={txt as string} style={{ margin: '3px 0', fontSize: 12, color: ok ? '#16a34a' : '#7AAACB' }}>
                {ok ? '✅' : '○'} {txt}
              </p>
            ))}
          </div>

          {/* Erro */}
          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#FEF2F2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <AlertCircle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{error}</p>
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading || mismatch as boolean || form.nova_senha.length < 6}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 700, color: '#fff',
              background: loading || mismatch || form.nova_senha.length < 6
                ? '#9DB8CC'
                : 'linear-gradient(135deg, #4B8EC8, #1A4E82)',
              transition: 'all 0.2s', letterSpacing: 0.3
            }}
          >
            {loading ? 'Salvando...' : '🔒 Salvar Nova Senha'}
          </button>

          <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--t-text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
            Após salvar, use sua nova senha em todos os próximos acessos.
          </p>
        </form>
      </div>
    </div>
  );
}
