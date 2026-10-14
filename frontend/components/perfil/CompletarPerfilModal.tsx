'use client';

// Primeiro acesso (pedido da Jessica, 14/10/2026): o colaborador coloca a foto e completa o perfil.
// "Agora não" esconde até o próximo login; depois ele completa em Configurações.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import PerfilForm from './PerfilForm';

const CHAVE = 'perfil_depois';

export default function CompletarPerfilModal() {
  const { user } = useAuth();
  const [depois, setDepois] = useState(true);
  useEffect(() => { try { setDepois(sessionStorage.getItem(CHAVE) === '1'); } catch { setDepois(false); } }, []);
  // perfil_completo_em: undefined = ainda carregando /usuarios/me; null = nunca completou.
  if (!user || user.perfil_completo_em !== null || depois) return null;
  const adiar = () => { try { sessionStorage.setItem(CHAVE, '1'); } catch { /* ok */ } setDepois(true); };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="completar-perfil-titulo"
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--t-card-bg)', borderRadius: 16, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <h2 id="completar-perfil-titulo" style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>Bem-vindo(a), {user.nome.split(' ')[0]}!</h2>
        <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', margin: '6px 0 18px' }}>Coloque sua foto e confira seus dados. Assim a equipe reconhece quem está atendendo.</p>
        <PerfilForm textoBotao="Salvar e começar" aoSalvar={() => setDepois(true)} />
        <button onClick={adiar} style={{ marginTop: 10, minHeight: 40, border: 'none', background: 'none', color: 'var(--t-text-muted)', fontSize: 13, cursor: 'pointer' }}>
          Agora não (completo depois em Configurações)
        </button>
      </div>
    </div>
  );
}
