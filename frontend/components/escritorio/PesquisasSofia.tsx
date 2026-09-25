'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Pesquisas da Sofia: assuntos do setor com fontes e sugestões de mensagem para
// os clientes. No painel ficam as 3 últimas; o Caderno guarda todas (nada é
// apagado), por mês e dia, com busca, filtro por segmento e download.

type Item = { segmento: string; titulo: string; resumo: string; por_que_importa: string; sugestao_mensagem_cliente: string };
type Pesquisa = { id: string; tema: string | null; titulo: string; resumo: string; itens: Item[]; fontes: { titulo: string; url: string }[] | null; created_at: string };

const NO_PAINEL = 3;
const SEGMENTOS = ['Farmácia', 'Manipulação', 'Padaria', 'Varejo', 'Gestão'];
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dia = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

function Itens({ p, copiado, copiar, filtro }: { p: Pesquisa; copiado: string | null; copiar: (t: string, k: string) => void; filtro?: (i: Item) => boolean }) {
  const itens = (p.itens || []).filter(i => !filtro || filtro(i));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        {itens.map((i, k) => (
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
  );
}

export default function PesquisasSofia() {
  const [lista, setLista] = useState<Pesquisa[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [tema, setTema] = useState('');
  const [pesquisando, setPesquisando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [caderno, setCaderno] = useState(false);
  const [busca, setBusca] = useState('');
  const [segmento, setSegmento] = useState<string | null>(null);

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

  const baixar = async () => {
    try {
      const r = await apiClient.baixarCadernoSofia();
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `caderno-sofia-${new Date().toISOString().slice(0, 10)}.md`; a.click();
      URL.revokeObjectURL(url);
    } catch { setMsg({ ok: false, texto: 'Não foi possível baixar. Só a gestão pode baixar o Caderno.' }); }
  };

  // Caderno: filtra assuntos por segmento e palavra; agrupa por mês.
  const filtroItem = useCallback((i: Item) => {
    if (segmento && semAcento(i.segmento || '') !== semAcento(segmento)) return false;
    if (busca.trim()) {
      const q = semAcento(busca.trim());
      return semAcento(`${i.titulo} ${i.resumo} ${i.por_que_importa} ${i.sugestao_mensagem_cliente}`).includes(q);
    }
    return true;
  }, [busca, segmento]);
  const porMes = useMemo(() => {
    const grupos: { mes: string; ps: Pesquisa[] }[] = [];
    for (const p of lista) {
      if ((busca.trim() || segmento) && !(p.itens || []).some(filtroItem)) continue;
      const m = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const g = grupos.find(x => x.mes === m);
      if (g) g.ps.push(p); else grupos.push({ mes: m, ps: [p] });
    }
    return grupos;
  }, [lista, busca, segmento, filtroItem]);

  const recentes = lista.slice(0, NO_PAINEL);
  const p = recentes.find(x => x.id === aberta) || null;
  const chip = (ativo: boolean) => ({ padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: `1px solid ${ativo ? '#ea580c' : 'var(--t-card-border)'}`, background: ativo ? '#ffedd5' : 'transparent', color: '#9a3412' }) as const;
  return (
    <div style={{ background: 'var(--t-card-bg)', border: '2px solid #ea580c', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: '1 1 260px' }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>🔎 Pesquisas da Sofia</b>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Assuntos de negócio para farmácias, padarias, varejo e gestão. Toda segunda às 8h, ou quando você pedir. Todas ficam guardadas no Caderno.</div>
        </div>
        <input id="tema-sofia" value={tema} onChange={e => setTema(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') pesquisar(); }}
          placeholder="Tema (opcional): ex. impostos para farmácias"
          style={{ flex: '1 1 260px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }} />
        <button onClick={pesquisar} disabled={pesquisando}
          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: pesquisando ? 0.6 : 1 }}>
          {pesquisando ? 'Pesquisando… (até 1 min)' : 'Pesquisar agora'}
        </button>
        <button onClick={() => setCaderno(v => !v)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #ea580c', background: caderno ? '#ffedd5' : 'transparent', color: '#9a3412', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          📓 Caderno da Sofia ({lista.length})
        </button>
      </div>
      {msg && <span style={{ fontSize: 12, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</span>}
      {lista.length === 0 && <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma pesquisa ainda. A primeira sai na segunda às 8h, ou clique em &quot;Pesquisar agora&quot;.</p>}

      {!caderno && recentes.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {recentes.map(x => (
              <button key={x.id} onClick={() => setAberta(x.id)} style={chip(aberta === x.id)}>{dia(x.created_at)} · {x.titulo.slice(0, 40)}</button>
            ))}
          </div>
          {p && (
            <div style={{ display: 'grid', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{p.resumo}</p>
              <Itens p={p} copiado={copiado} copiar={copiar} />
            </div>
          )}
        </>
      )}

      {caderno && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar no Caderno: Simples, NFC-e, PIX…"
              style={{ flex: '1 1 240px', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }} />
            <button onClick={() => setSegmento(null)} style={chip(!segmento)}>Todos</button>
            {SEGMENTOS.map(s => <button key={s} onClick={() => setSegmento(s)} style={chip(segmento === s)}>{s}</button>)}
            <button onClick={baixar} style={{ ...chip(false), fontWeight: 700 }}>⬇ Baixar Caderno</button>
          </div>
          {porMes.length === 0 && <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada encontrado com esse filtro.</span>}
          {porMes.map(g => (
            <div key={g.mes} style={{ display: 'grid', gap: 10 }}>
              <b style={{ fontSize: 14, color: '#9a3412', textTransform: 'capitalize', borderBottom: '1px solid #fed7aa', paddingBottom: 4 }}>📅 {g.mes}</b>
              {g.ps.map(x => (
                <details key={x.id} open={!!(busca.trim() || segmento)} style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 10 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--t-text-primary)' }}>
                    <b>{dia(x.created_at)}</b> · {x.titulo}{x.tema ? <span style={{ color: 'var(--t-text-muted)' }}> (tema: {x.tema})</span> : null}
                  </summary>
                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                    <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{x.resumo}</p>
                    <Itens p={x} copiado={copiado} copiar={copiar} filtro={busca.trim() || segmento ? filtroItem : undefined} />
                  </div>
                </details>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
