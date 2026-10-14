'use client';

// Perfil do colaborador (pedido da Jessica, 14/10/2026): foto, nome e telefone.
// Usado na janela do primeiro acesso e em Configurações. A foto é reduzida no navegador (320 px, JPEG).

import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const LADO = 320;

/** Lê a imagem escolhida e devolve um quadrado de 320 px em JPEG (data URL), recortado no centro. */
async function reduzirFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const lado = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = LADO; canvas.height = LADO;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, LADO, LADO);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function AvatarUsuario({ nome, foto, tamanho = 28, raio = 8 }: { nome?: string | null; foto?: string | null; tamanho?: number; raio?: number }) {
  const iniciais = (nome || 'U').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  if (foto) return <img src={foto} alt="" width={tamanho} height={tamanho} style={{ width: tamanho, height: tamanho, borderRadius: raio, objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div aria-hidden className="flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: tamanho, height: tamanho, borderRadius: raio, fontSize: Math.round(tamanho * 0.38), background: 'linear-gradient(135deg, var(--t-avatar-from) 0%, var(--t-avatar-to) 100%)' }}>
      {iniciais}
    </div>
  );
}

export default function PerfilForm({ aoSalvar, textoBotao = 'Salvar perfil' }: { aoSalvar?: () => void; textoBotao?: string }) {
  const { user, atualizarPerfil } = useAuth();
  const [nome, setNome] = useState(user?.nome || '');
  const [telefone, setTelefone] = useState(user?.telefone || '');
  const [foto, setFoto] = useState<string | null>(user?.foto || null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  // Foto e telefone chegam de /usuarios/me depois do login: preenche quando carregar, sem apagar o que já foi digitado.
  const carregou = useRef(false);
  useEffect(() => {
    if (carregou.current || !user || user.perfil_completo_em === undefined) return;
    carregou.current = true;
    setNome(n => n || user.nome || ''); setTelefone(t => t || user.telefone || ''); setFoto(f => f || user.foto || null);
  }, [user]);

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setMsg({ ok: false, texto: 'Escolha uma imagem (JPG, PNG ou WebP).' }); return; }
    try { setFoto(await reduzirFoto(f)); setMsg(null); }
    catch { setMsg({ ok: false, texto: 'Não consegui abrir essa imagem. Tente outra.' }); }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) { setMsg({ ok: false, texto: 'Informe seu nome.' }); return; }
    setSalvando(true); setMsg(null);
    try {
      await apiClient.salvarMeuPerfil({ nome: nome.trim(), telefone: telefone.trim() || null, foto });
      atualizarPerfil({ nome: nome.trim(), telefone: telefone.trim() || null, foto, perfil_completo_em: new Date().toISOString() });
      setMsg({ ok: true, texto: 'Perfil salvo.' });
      aoSalvar?.();
    } catch (err: any) {
      setMsg({ ok: false, texto: err?.response?.data?.message || 'Não deu para salvar. Tente de novo.' });
    } finally { setSalvando(false); }
  };

  const campo: React.CSSProperties = { minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 16, width: '100%' };
  const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', display: 'grid', gap: 6 };

  return (
    <form onSubmit={salvar} style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <AvatarUsuario nome={nome || user?.nome} foto={foto} tamanho={88} raio={44} />
        <div style={{ display: 'grid', gap: 8 }}>
          <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" onClick={() => arquivoRef.current?.click()}
            style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Camera size={15} /> {foto ? 'Trocar foto' : 'Colocar foto'}
          </button>
          {foto && (
            <button type="button" onClick={() => setFoto(null)}
              style={{ minHeight: 32, padding: '0 10px', border: 'none', background: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={13} /> Tirar foto
            </button>
          )}
        </div>
      </div>
      <label style={rotulo}>Nome
        <input value={nome} onChange={e => setNome(e.target.value)} maxLength={255} autoComplete="name" style={campo} />
      </label>
      <label style={rotulo}>Telefone / WhatsApp
        <input value={telefone} onChange={e => setTelefone(e.target.value)} maxLength={50} inputMode="tel" autoComplete="tel" placeholder="(27) 99999-9999" style={campo} />
      </label>
      <label style={rotulo}>E-mail de acesso
        <input value={user?.email || ''} disabled style={{ ...campo, opacity: 0.7 }} />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="submit" disabled={salvando}
          style={{ minHeight: 44, padding: '0 20px', borderRadius: 10, border: 'none', background: 'var(--t-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
          {salvando ? 'Salvando…' : textoBotao}
        </button>
        {msg && <span role="status" style={{ fontSize: 13, color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.texto}</span>}
      </div>
    </form>
  );
}
