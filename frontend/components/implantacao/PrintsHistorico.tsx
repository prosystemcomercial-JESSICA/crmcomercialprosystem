'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { ImagePlus, Clipboard, Pencil, Trash2, X, Loader2, Play, Pause, Hourglass, MessageSquare, Bell, Settings, Image as ImageIcon, Check } from 'lucide-react';

// Prints e Histórico do card do Portal Técnico (pedido da Jessica, 06/10/2026).
// Prints: cola com Ctrl+V (ou pelo botão), ou escolhe imagens; cada print tem categoria e observação.
// Histórico: linha do tempo do card (execução, pausas com motivo, esperas, recados, observações e prints)
// com um campo de observação que também aceita print. Editar e excluir vão para a auditoria.

const erroDe = (e: any) => e?.response?.data?.message || 'Não foi possível agora. Tente de novo.';
const cartao: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12 };
const rotulo: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 };
const btn = (cor: string, cheio = true): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, borderRadius: 8, padding: '8px 12px', minHeight: 40, cursor: 'pointer',
  border: cheio ? 'none' : `1px solid ${cor}40`, background: cheio ? cor : 'transparent', color: cheio ? '#fff' : cor,
});
const fmtHora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const fmtDataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDia = (s: string) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' });

export const CATEGORIAS: { k: string; l: string; cor: string }[] = [
  { k: 'SUPORTE', l: 'Print do suporte', cor: '#2E6EAB' },
  { k: 'CONVERSA', l: 'Conversa', cor: '#16a34a' },
  { k: 'AVISO', l: 'Aviso', cor: '#d97706' },
  { k: 'OUTRO', l: 'Outro', cor: '#64748b' },
];
const NOME_CAT = Object.fromEntries(CATEGORIAS.map(c => [c.k, c.l]));

/** Reduz o print antes de enviar: no máximo 1920 px de largura, JPEG 85% (texto da tela continua legível). */
export async function prepararImagem(f: Blob): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const escala = Math.min(1, 1920 / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala); c.height = Math.round(img.naturalHeight * escala);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

/** Ctrl+V em qualquer lugar da aba: pega as imagens coladas (texto colado segue normal). */
function useColarImagens(onImagens: (fs: File[]) => void) {
  const ref = useRef(onImagens); ref.current = onImagens;
  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const fs = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
      if (!fs.length) return;
      e.preventDefault();
      ref.current(fs);
    };
    document.addEventListener('paste', colar);
    return () => document.removeEventListener('paste', colar);
  }, []);
}

/** Botão "Colar print" (sem teclado, ex.: celular): lê a área de transferência quando o navegador permite. */
async function lerAreaDeTransferencia(): Promise<File[]> {
  const nav: any = navigator;
  if (!nav.clipboard?.read) throw new Error('Este navegador não deixa ler a área de transferência pelo botão. Use Ctrl+V ou "Escolher imagens".');
  const itens = await nav.clipboard.read();
  const fs: File[] = [];
  for (const it of itens) for (const t of it.types) if (t.startsWith('image/')) fs.push(new File([await it.getType(t)], 'print.png', { type: t }));
  if (!fs.length) throw new Error('Não há imagem copiada. Tire o print (ou copie a imagem) e tente de novo.');
  return fs;
}

/** Imagem protegida (precisa do login): baixa como blob e mostra; toque abre em tela cheia. */
function ImagemRegistro({ rid, altura = 120, onAbrir }: { rid: string; altura?: number; onAbrir: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true, u: string | null = null;
    apiClient.imagemRegistroImplantacao(rid).then(r => { u = URL.createObjectURL(r.data); if (vivo) setUrl(u); }).catch(() => vivo && setFalhou(true));
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [rid]);
  if (falhou) return <div style={{ height: altura, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--t-text-muted)', background: 'var(--t-bg-subtle, #f1f5f9)', borderRadius: 8 }}>Imagem indisponível</div>;
  if (!url) return <div style={{ height: altura, display: 'grid', placeItems: 'center', background: 'var(--t-bg-subtle, #f1f5f9)', borderRadius: 8 }}><Loader2 size={16} className="animate-spin" /></div>;
  return (
    <button onClick={() => onAbrir(url)} aria-label="Ver print em tela cheia" style={{ padding: 0, border: '1px solid var(--t-card-border)', borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: '#fff', display: 'block', width: '100%' }}>
      <img src={url} alt="" style={{ width: '100%', height: altura, objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
    </button>
  );
}

function TelaCheia({ url, onClose }: { url: string | null; onClose: () => void }) {
  useEffect(() => { if (!url) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [url, onClose]);
  if (!url) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(8,15,30,.88)', display: 'grid', placeItems: 'center', padding: 16, cursor: 'zoom-out' }}>
      <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }} />
      <button onClick={onClose} aria-label="Fechar" style={{ position: 'fixed', top: 14, right: 14, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={20} /></button>
    </div>
  );
}

/** Editar a observação ou excluir (os dois vão para a auditoria). */
function AcoesRegistro({ r, recarregar, editando, setEditando }: { r: { id: string; texto?: string | null }; recarregar: () => void; editando: boolean; setEditando: (v: boolean) => void }) {
  const excluir = async () => {
    if (!confirm('Excluir este registro do card? Ele some daqui, mas fica guardado na auditoria.')) return;
    const motivo = prompt('Motivo da exclusão (opcional):') || '';
    try { await apiClient.excluirRegistroImplantacao(r.id, motivo); recarregar(); } catch (e) { alert(erroDe(e)); }
  };
  if (editando) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <button onClick={() => setEditando(true)} aria-label="Editar comentário" title="Editar comentário" style={{ ...btn('#2E6EAB', false), minHeight: 32, padding: '4px 8px', border: 'none' }}><Pencil size={13} /></button>
      <button onClick={excluir} aria-label="Excluir" title="Excluir (fica na auditoria)" style={{ ...btn('#dc2626', false), minHeight: 32, padding: '4px 8px', border: 'none' }}><Trash2 size={13} /></button>
    </span>
  );
}

function EditarTexto({ r, onFim }: { r: { id: string; texto?: string | null }; onFim: (salvou: boolean) => void }) {
  const [t, setT] = useState(r.texto || '');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => { setSalvando(true); try { await apiClient.editarRegistroImplantacao(r.id, t.trim()); onFim(true); } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); } };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <textarea value={t} onChange={e => setT(e.target.value)} rows={3} autoFocus className="ps-input" style={{ width: '100%', resize: 'vertical' }} placeholder="Observação" />
      <div style={{ display: 'flex', gap: 6 }}>
        <button disabled={salvando} onClick={salvar} style={btn('#2E6EAB')}><Check size={14} /> {salvando ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={() => onFim(false)} style={btn('#64748b', false)}>Cancelar</button>
      </div>
      <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>O texto anterior fica guardado na auditoria.</span>
    </div>
  );
}

type Rascunho = { chave: string; dataUrl: string; nome: string; texto: string; categoria: string };

// ─── Aba Prints ───────────────────────────────────────────────────────────────

export function AbaPrints({ id, gestao }: { id: string; gestao: boolean }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [excluidos, setExcluidos] = useState<any[] | null>(null);
  const [verExcluidos, setVerExcluidos] = useState(false);
  const [categoria, setCategoria] = useState('SUPORTE');
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>('');
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try { setLista((await apiClient.getRegistrosImplantacao(id)).data.data.filter((r: any) => r.tipo === 'PRINT')); } catch (e) { alert(erroDe(e)); }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (verExcluidos && gestao) apiClient.getRegistrosImplantacao(id, true).then(r => setExcluidos(r.data.data)).catch(() => setExcluidos([])); }, [verExcluidos, gestao, id, lista]);

  const adicionar = async (fs: File[]) => {
    const novos: Rascunho[] = [];
    for (const f of fs.slice(0, 10)) {
      if (f.size > 25 * 1024 * 1024) { alert(`${f.name || 'Imagem'} passa de 25 MB.`); continue; }
      try { novos.push({ chave: `${Date.now()}-${Math.random()}`, dataUrl: await prepararImagem(f), nome: f.name && f.name !== 'image.png' ? f.name : '', texto: '', categoria }); }
      catch { alert('Não consegui ler essa imagem.'); }
    }
    setRascunhos(r => [...r, ...novos]);
  };
  useColarImagens(adicionar);

  const salvarTodos = async () => {
    setSalvando(true);
    try {
      for (const r of rascunhos) await apiClient.criarRegistroImplantacao(id, { tipo: 'PRINT', categoria: r.categoria, texto: r.texto.trim() || null, imagem: r.dataUrl, nome: r.nome || null });
      setRascunhos([]); carregar();
    } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };

  const contagem = useMemo(() => Object.fromEntries(CATEGORIAS.map(c => [c.k, (lista || []).filter(r => r.categoria === c.k).length])), [lista]);
  const visiveis = (lista || []).filter(r => !filtro || r.categoria === filtro);

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 960 }}>
      {/* Área de colar: o foco da aba */}
      <div style={{ ...cartao, padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...rotulo, marginRight: 4 }}>Novo print em</span>
          {CATEGORIAS.map(c => (
            <button key={c.k} onClick={() => setCategoria(c.k)} aria-pressed={categoria === c.k}
              style={{ fontSize: 13, fontWeight: categoria === c.k ? 600 : 500, padding: '6px 12px', minHeight: 36, borderRadius: 999, cursor: 'pointer', border: `1px solid ${categoria === c.k ? c.cor : 'var(--t-card-border)'}`, background: categoria === c.k ? `${c.cor}12` : 'transparent', color: categoria === c.k ? c.cor : 'var(--t-text-secondary)' }}>
              {c.l}
            </button>
          ))}
        </div>
        <div onClick={() => arquivo.current?.click()} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && arquivo.current?.click()}
          style={{ border: '1.5px dashed #2E6EAB66', borderRadius: 12, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', background: '#2E6EAB06', display: 'grid', gap: 6, justifyItems: 'center' }}>
          <ImagePlus size={26} color="#2E6EAB" />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text-primary)' }}>Cole o print aqui com <kbd style={{ fontFamily: 'inherit', fontSize: 12, padding: '1px 6px', border: '1px solid var(--t-card-border)', borderRadius: 4 }}>Ctrl</kbd> + <kbd style={{ fontFamily: 'inherit', fontSize: 12, padding: '1px 6px', border: '1px solid var(--t-card-border)', borderRadius: 4 }}>V</kbd></div>
          <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Ou toque para escolher imagens do computador ou do celular. Vai como <b style={{ color: CATEGORIAS.find(c => c.k === categoria)?.cor }}>{NOME_CAT[categoria]}</b>.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={async () => { try { await adicionar(await lerAreaDeTransferencia()); } catch (e: any) { alert(e?.message || 'Não foi possível colar.'); } }} style={btn('#2E6EAB', false)}><Clipboard size={15} /> Colar print</button>
          <button onClick={() => arquivo.current?.click()} style={btn('#2E6EAB', false)}><ImagePlus size={15} /> Escolher imagens</button>
          <input ref={arquivo} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) adicionar(fs); }} />
        </div>

        {rascunhos.length > 0 && (
          <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--t-card-border)', paddingTop: 12 }}>
            <div style={rotulo}>Antes de salvar: escreva a observação de cada print</div>
            {rascunhos.map(r => (
              <div key={r.chave} style={{ display: 'grid', gridTemplateColumns: 'minmax(96px, 160px) 1fr', gap: 12, alignItems: 'start' }}>
                <img src={r.dataUrl} alt="" onClick={() => setAberta(r.dataUrl)} style={{ width: '100%', height: 110, objectFit: 'cover', objectPosition: 'top', borderRadius: 8, border: '1px solid var(--t-card-border)', cursor: 'zoom-in' }} />
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select value={r.categoria} onChange={e => setRascunhos(x => x.map(y => y.chave === r.chave ? { ...y, categoria: e.target.value } : y))} className="ps-input" style={{ width: 'auto', minHeight: 36 }}>
                      {CATEGORIAS.map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
                    </select>
                    <button onClick={() => setRascunhos(x => x.filter(y => y.chave !== r.chave))} aria-label="Descartar print" style={{ ...btn('#64748b', false), minHeight: 36, border: 'none', marginLeft: 'auto' }}><X size={15} /></button>
                  </div>
                  <textarea value={r.texto} onChange={e => setRascunhos(x => x.map(y => y.chave === r.chave ? { ...y, texto: e.target.value } : y))} rows={2} className="ps-input" style={{ width: '100%', resize: 'vertical' }} placeholder="Observação deste print (ex.: liberação do suporte, o que o cliente pediu…)" />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={salvando} onClick={salvarTodos} style={btn('#2E6EAB')}>{salvando ? 'Salvando…' : rascunhos.length > 1 ? `Salvar ${rascunhos.length} prints` : 'Salvar print'}</button>
              <button disabled={salvando} onClick={() => setRascunhos([])} style={btn('#64748b', false)}>Descartar</button>
            </div>
          </div>
        )}
      </div>

      {/* Galeria */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setFiltro('')} style={{ fontSize: 12, fontWeight: !filtro ? 600 : 500, padding: '6px 12px', minHeight: 32, borderRadius: 999, cursor: 'pointer', border: `1px solid ${!filtro ? '#2E6EAB55' : 'var(--t-card-border)'}`, background: !filtro ? '#2E6EAB0f' : 'transparent', color: !filtro ? '#2E6EAB' : 'var(--t-text-secondary)' }}>Todos ({(lista || []).length})</button>
        {CATEGORIAS.map(c => (
          <button key={c.k} onClick={() => setFiltro(c.k)} style={{ fontSize: 12, fontWeight: filtro === c.k ? 600 : 500, padding: '6px 12px', minHeight: 32, borderRadius: 999, cursor: 'pointer', border: `1px solid ${filtro === c.k ? `${c.cor}66` : 'var(--t-card-border)'}`, background: filtro === c.k ? `${c.cor}10` : 'transparent', color: filtro === c.k ? c.cor : 'var(--t-text-secondary)' }}>{c.l} ({contagem[c.k] || 0})</button>
        ))}
        {gestao && <label style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-text-muted)', display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={verExcluidos} onChange={e => setVerExcluidos(e.target.checked)} /> Ver excluídos (auditoria)</label>}
      </div>

      {lista === null ? <Loader2 size={18} className="animate-spin" /> : visiveis.length === 0 ? (
        <div style={{ ...cartao, padding: 18, fontSize: 13, color: 'var(--t-text-muted)' }}>{filtro ? `Nenhum print em "${NOME_CAT[filtro]}".` : 'Nenhum print ainda. Cole o primeiro aqui em cima.'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {visiveis.map(r => {
            const cat = CATEGORIAS.find(c => c.k === r.categoria) || CATEGORIAS[3];
            return (
              <div key={r.id} style={{ ...cartao, padding: 10, display: 'grid', gap: 8, alignContent: 'start' }}>
                <ImagemRegistro rid={r.id} altura={140} onAbrir={setAberta} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cat.cor, background: `${cat.cor}12`, borderRadius: 999, padding: '2px 8px' }}>{cat.l}</span>
                  <span style={{ marginLeft: 'auto' }}>{r.pode_mexer && <AcoesRegistro r={r} recarregar={carregar} editando={editando === r.id} setEditando={v => setEditando(v ? r.id : null)} />}</span>
                </div>
                {editando === r.id ? <EditarTexto r={r} onFim={s => { setEditando(null); if (s) carregar(); }} />
                  : r.texto ? <div style={{ fontSize: 13, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.texto}</div>
                  : r.pode_mexer ? <button onClick={() => setEditando(r.id)} style={{ fontSize: 12, color: '#2E6EAB', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>+ Escrever observação</button> : null}
                <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{(r.autor_nome || '').split(' ')[0]} · {fmtDataHora(r.created_at)}{r.editado_em ? ' · editado' : ''}</div>
              </div>
            );
          })}
        </div>
      )}

      {gestao && verExcluidos && (
        <div style={{ ...cartao, padding: 14, display: 'grid', gap: 10, borderStyle: 'dashed' }}>
          <div style={rotulo}>Excluídos (só a gestão vê; tudo também está na Auditoria)</div>
          {excluidos === null ? <Loader2 size={16} className="animate-spin" /> : excluidos.length === 0 ? <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada excluído neste card.</span> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {excluidos.map(r => (
                <div key={r.id} style={{ display: 'grid', gap: 6, opacity: 0.8 }}>
                  {r.tem_imagem && <ImagemRegistro rid={r.id} altura={110} onAbrir={setAberta} />}
                  <div style={{ fontSize: 12, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap' }}>{r.texto || '(sem texto)'}</div>
                  <div style={{ fontSize: 11, color: '#dc2626' }}>Excluído por {r.excluido_por} · {fmtDataHora(r.excluido_em)}{r.excluido_motivo ? ` · ${r.excluido_motivo}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <TelaCheia url={aberta} onClose={() => setAberta(null)} />
    </div>
  );
}

// ─── Aba Histórico ────────────────────────────────────────────────────────────

const GRUPOS: Record<string, { l: string; cor: string; Icon: any }> = {
  EXECUCAO: { l: 'Execução', cor: '#16a34a', Icon: Play },
  PAUSA: { l: 'Pausa', cor: '#dc2626', Icon: Pause },
  ESPERA: { l: 'Espera', cor: '#d97706', Icon: Hourglass },
  PRINT: { l: 'Print', cor: '#2E6EAB', Icon: ImageIcon },
  OBS: { l: 'Observação', cor: '#7c3aed', Icon: MessageSquare },
  RECADO: { l: 'Recado', cor: '#0891b2', Icon: Bell },
  SISTEMA: { l: 'Sistema', cor: '#64748b', Icon: Settings },
};
const FILTROS: { k: string; l: string; grupos: string[] }[] = [
  { k: 'tudo', l: 'Tudo', grupos: [] },
  { k: 'execucao', l: 'Execução e pausas', grupos: ['EXECUCAO', 'PAUSA'] },
  { k: 'espera', l: 'Esperas', grupos: ['ESPERA'] },
  { k: 'obs', l: 'Observações e prints', grupos: ['OBS', 'PRINT'] },
  { k: 'recado', l: 'Recados', grupos: ['RECADO'] },
  { k: 'sistema', l: 'Sistema', grupos: ['SISTEMA'] },
];

export function AbaHistoricoCard({ id }: { id: string }) {
  const [ev, setEv] = useState<any[] | null>(null);
  const [filtro, setFiltro] = useState('tudo');
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => { try { setEv((await apiClient.getHistoricoImplantacao(id)).data.data); } catch (e) { alert(erroDe(e)); } }, [id]);
  useEffect(() => { carregar(); window.addEventListener('cronometro:mudou', carregar); return () => window.removeEventListener('cronometro:mudou', carregar); }, [carregar]);
  const pegar = async (fs: File[]) => { if (fs[0]) try { setImagem(await prepararImagem(fs[0])); } catch { alert('Não consegui ler essa imagem.'); } };
  useColarImagens(pegar);

  const registrar = async () => {
    if (!texto.trim() && !imagem) return;
    setEnviando(true);
    try { await apiClient.criarRegistroImplantacao(id, { tipo: 'OBS', texto: texto.trim() || null, imagem }); setTexto(''); setImagem(null); carregar(); }
    catch (e) { alert(erroDe(e)); } finally { setEnviando(false); }
  };

  const f = FILTROS.find(x => x.k === filtro)!;
  const visiveis = (ev || []).filter(e => !f.grupos.length || f.grupos.includes(e.grupo));
  const porDia: [string, any[]][] = [];
  for (const e of visiveis) { const d = fmtDia(e.em); const ult = porDia[porDia.length - 1]; if (ult && ult[0] === d) ult[1].push(e); else porDia.push([d, [e]]); }

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 820 }}>
      {/* Campo de OBS (aceita print) */}
      <div style={{ ...cartao, padding: 14, display: 'grid', gap: 10 }}>
        <div style={rotulo}>Observação no histórico</div>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} className="ps-input" style={{ width: '100%', resize: 'vertical' }}
          placeholder="Escreva o que aconteceu. Para juntar um print, cole com Ctrl+V aqui ou use o botão." />
        {imagem && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <img src={imagem} alt="" onClick={() => setAberta(imagem)} style={{ width: 160, height: 100, objectFit: 'cover', objectPosition: 'top', borderRadius: 8, border: '1px solid var(--t-card-border)', cursor: 'zoom-in' }} />
            <button onClick={() => setImagem(null)} aria-label="Tirar print" style={{ ...btn('#64748b', false), border: 'none' }}><X size={15} /> Tirar</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button disabled={enviando || (!texto.trim() && !imagem)} onClick={registrar} style={{ ...btn('#2E6EAB'), opacity: enviando || (!texto.trim() && !imagem) ? 0.5 : 1 }}>{enviando ? 'Registrando…' : 'Registrar no histórico'}</button>
          {!imagem && <button onClick={async () => { try { await pegar(await lerAreaDeTransferencia()); } catch (e: any) { alert(e?.message); } }} style={btn('#2E6EAB', false)}><Clipboard size={15} /> Colar print</button>}
          {!imagem && <button onClick={() => arquivo.current?.click()} style={btn('#2E6EAB', false)}><ImagePlus size={15} /> Imagem</button>}
          <input ref={arquivo} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; pegar(fs); }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTROS.map(x => (
          <button key={x.k} onClick={() => setFiltro(x.k)} style={{ fontSize: 12, fontWeight: filtro === x.k ? 600 : 500, padding: '6px 12px', minHeight: 32, borderRadius: 999, cursor: 'pointer', border: `1px solid ${filtro === x.k ? '#2E6EAB55' : 'var(--t-card-border)'}`, background: filtro === x.k ? '#2E6EAB0f' : 'transparent', color: filtro === x.k ? '#2E6EAB' : 'var(--t-text-secondary)' }}>{x.l}</button>
        ))}
      </div>

      {ev === null ? <Loader2 size={18} className="animate-spin" /> : visiveis.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada registrado aqui ainda.</div>
      ) : porDia.map(([dia, itens]) => (
        <div key={dia} style={{ display: 'grid', gap: 2 }}>
          <div style={{ ...rotulo, textTransform: 'none', fontSize: 12, letterSpacing: 0, color: 'var(--t-text-secondary)', fontWeight: 600, padding: '6px 0' }}>{dia[0].toUpperCase() + dia.slice(1)}</div>
          {itens.map((e, k) => {
            const g = GRUPOS[e.grupo] || GRUPOS.SISTEMA;
            return (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '48px 22px 1fr', gap: 8, alignItems: 'start' }}>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)', fontVariantNumeric: 'tabular-nums', paddingTop: 3 }}>{fmtHora(e.em)}</span>
                <span style={{ display: 'grid', justifyItems: 'center', height: '100%' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: `${g.cor}14`, color: g.cor, display: 'grid', placeItems: 'center' }}><g.Icon size={12} /></span>
                  {k < itens.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 10, background: 'var(--t-card-border)' }} />}
                </span>
                <div style={{ paddingBottom: 12, display: 'grid', gap: 6, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editando === e.registro?.id ? <EditarTexto r={{ id: e.registro.id, texto: e.registro.texto }} onFim={s => { setEditando(null); if (s) carregar(); }} /> : (
                        <div style={{ fontSize: 13, color: 'var(--t-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{e.texto}</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>
                        {g.l}{e.registro?.categoria && e.grupo === 'PRINT' ? ` · ${NOME_CAT[e.registro.categoria] || ''}` : ''}{e.autor ? ` · ${e.autor}` : ''}{e.pessoal ? ' · pessoal (só você vê)' : ''}{e.registro?.editado_em ? ' · editado' : ''}
                      </div>
                    </div>
                    {e.registro?.pode_mexer && <AcoesRegistro r={{ id: e.registro.id, texto: e.registro.texto }} recarregar={carregar} editando={editando === e.registro.id} setEditando={v => setEditando(v ? e.registro.id : null)} />}
                  </div>
                  {e.registro?.tem_imagem && <div style={{ maxWidth: 280 }}><ImagemRegistro rid={e.registro.id} altura={130} onAbrir={setAberta} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <TelaCheia url={aberta} onClose={() => setAberta(null)} />
    </div>
  );
}
