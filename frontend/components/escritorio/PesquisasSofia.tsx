'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Pesquisas da Sofia: assuntos do setor com fontes e sugestões de mensagem para
// os clientes. Pesquisa semanal automática e pesquisa na hora por tema.

type Item = { segmento: string; titulo: string; resumo: string; por_que_importa: string; sugestao_mensagem_cliente: string };
type Pesquisa = { id: string; tema: string | null; titulo: string; resumo: string; itens: Item[]; fontes: { titulo: string; url: string }[] | null; created_at: string };

export default function PesquisasSofia() {
  const [lista, setLista] = useState<Pesquisa[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [tema, setTema] = useState('');
  const [pesquisando, setPesquisando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(() => {
    apiClient.getPesquisasSofia().then(r => { setLista(r.data.data); if (r.data.data[0]) setAberta(a => a ?? r.data.data[0].id); }).catch(() => {});
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const pesquisar = async () => {
    setPesquisando(true); setMsg(null);
    const antes = lista[0]?.id || null;
    try {
      const r = await apiClient.pesquisarSofia(tema.trim() || null);
      setMsg({ ok: true, texto: r.data.message }); setTema('');
      // Confere a cada 6 s, por até 3 min, se a pesquisa nova chegou.
      for (let i = 0; i < 30; i++) {
        await new Promise(res => setTimeout(res, 6000));
        const l = (await apiClient.getPesquisasSofia()).data.data as Pesquisa[];
        if (l[0] && l[0].id !== antes) { setLista(l); setAberta(l[0].id); setMsg({ ok: true, texto: 'Pesquisa pronta!' }); return; }
      }
      setMsg({ ok: false, texto: 'A pesquisa está demorando. Ela aparece aqui quando terminar.' });
    } catch (e: any) { setMsg({ ok: false, texto: e?.response?.data?.message || 'A pesquisa falhou.' }); }
    finally { setPesquisando(false); }
  };

  const copiar = (texto: string, chave: string) => {
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(chave); setTimeout(() => setCopiado(null), 1500); }).catch(() => {});
  };

  const p = lista.find(x => x.id === aberta) || null;
  return (
    <div style={{ background: 'var(--t-card-bg)', border: '2px solid #ea580c', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: '1 1 260px' }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>🔎 Pesquisas da Sofia</b>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Assuntos mais falados para farmácias, padarias, varejo e gestão. Toda segunda às 8h, ou quando você pedir.</div>
        </div>
        <input id="tema-sofia" value={tema} onChange={e => setTema(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') pesquisar(); }}
          placeholder="Tema (opcional): ex. nova regra do Farmácia Popular"
          style={{ flex: '1 1 260px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }} />
        <button onClick={pesquisar} disabled={pesquisando}
          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: pesquisando ? 0.6 : 1 }}>
          {pesquisando ? 'Pesquisando… (até 1 min)' : 'Pesquisar agora'}
        </button>
      </div>
      {msg && <span style={{ fontSize: 12, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</span>}
      {lista.length === 0 && <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma pesquisa ainda. A primeira sai na segunda às 8h, ou clique em &quot;Pesquisar agora&quot; (precisa da chave da IA).</p>}
      {lista.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lista.map(x => (
            <button key={x.id} onClick={() => setAberta(x.id)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${aberta === x.id ? '#ea580c' : 'var(--t-card-border)'}`, background: aberta === x.id ? '#ffedd5' : 'transparent', color: '#9a3412',
            }}>{new Date(x.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {x.titulo.slice(0, 40)}</button>
          ))}
        </div>
      )}
      {p && (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{p.resumo}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {(p.itens || []).map((i, k) => (
              <div key={k} style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 12, display: 'grid', gap: 6, alignContent: 'start' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>{i.segmento}</span>
                <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>{i.titulo}</b>
                <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{i.resumo}</span>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}><b>Por que importa:</b> {i.por_que_importa}</span>
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 8, fontSize: 12, color: '#14532d' }}>
                  💬 {i.sugestao_mensagem_cliente}
                  <button onClick={() => copiar(i.sugestao_mensagem_cliente, `${p.id}-${k}`)} style={{ marginLeft: 8, fontSize: 11, border: 'none', background: 'none', color: '#15803d', fontWeight: 700, cursor: 'pointer' }}>
                    {copiado === `${p.id}-${k}` ? 'copiado!' : 'copiar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {p.fontes && p.fontes.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
              <b>Fontes:</b> {p.fontes.map((f, k) => <a key={k} href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', marginRight: 10 }}>{f.titulo || `fonte ${k + 1}`}</a>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
