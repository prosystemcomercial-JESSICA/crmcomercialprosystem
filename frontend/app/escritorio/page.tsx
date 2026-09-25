'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import SalaIsometrica, { type Chamado } from '@/components/escritorio/SalaIsometrica';
import ChatAgente from '@/components/escritorio/ChatAgente';
import PesquisasSofia from '@/components/escritorio/PesquisasSofia';
import CadernoLaya from '@/components/escritorio/CadernoLaya';
import PainelCaroline from '@/components/escritorio/PainelCaroline';

// Escritório virtual: os agentes do assistente como uma equipe numa sala. Somente
// leitura; atualiza a cada 30 s com o que cada agente fez hoje.

type Agente = {
  id: string; nome: string; funcao: string; cor: string; status: 'trabalhando' | 'parado' | 'desligado';
  ultima: { texto: string; em: string } | null; numeros: { rotulo: string; valor: number | string }[]; observacao?: string;
};
const ROTULO_STATUS = { trabalhando: 'Trabalhando agora', parado: 'Parado', desligado: 'Desligado' } as const;
const COR_STATUS = { trabalhando: '#16a34a', parado: '#ca8a04', desligado: '#64748b' } as const;

// Ações de exemplo da simulação (nomes fictícios).
const ACOES_SIMULADAS: Record<string, string[]> = {
  bia: ['recebeu Padaria Pão Dourado', 'qualificou Drogaria Vida Nova', 'consultou o CNPJ da Farmácia Central', 'enviou o material de padaria'],
  lurdinha: ['marcou demo com Farmácia Bem Estar', 'lembrou Padaria Trigal da demo das 15h', 'remarcou demo da Drogaria Popular'],
  clarice: ['explicou o SNGPC para Drogaria São José', 'transcreveu áudio de Padaria Aurora', 'tirou dúvida sobre balança integrada'],
  luiz_felipe: ['lembrou Farmácia Saúde da proposta', 'enviou conteúdo de padaria para Pão & Cia', 'avisou validade da proposta da Drogaria Real'],
  zequinha: ['enviou campanha para Carlos', 'enviou campanha para Fernanda', 'tirou da lista quem pediu SAIR'],
  helena: ['deu boas-vindas à Farmácia Esperança', 'enviou pesquisa para Padaria Delícia', 'recebeu nota Ótima da Drogaria Luz'],
  laya: ['analisou conversa com Padaria Sol', 'detectou intenção de compra', 'aprendeu com uma etiqueta confirmada'],
  julio: ['retomou a Drogaria Central (lead de março)', 'Farmácia Bem Estar já fechou com outro sistema: anotado', 'passou a Padaria Trigo para a Caroline'],
  caroline: ['descobriu a dor da Farmácia Rangel: o caixa não bate', 'chamou um lead da campanha de farmácia', 'ofereceu demonstração (nota 78)'],
  sofia: ['pesquisou reforma tributária para farmácias', 'achou novidade do Farmácia Popular', 'pesquisou tendências para padarias'],
  marta: ['respondeu "hoje" para Jessica', 'avisou Thiago: proposta aceita', 'lançou tarefa para Ana: ligar para cliente'],
};

const haQuanto = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const botaoZoom = { width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontWeight: 800, fontSize: 16, cursor: 'pointer' } as const;

export default function EscritorioPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[] | null>(null);
  const [atualizado, setAtualizado] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [chamados, setChamados] = useState<Record<string, Chamado>>({});
  const [zoom, setZoom] = useState(1);
  const [historico, setHistorico] = useState<{ id: string; itens: { texto: string; em: string }[] | null } | null>(null);

  const verTrabalho = (id: string) => {
    setSel(id); setHistorico({ id, itens: null });
    apiClient.getHistoricoAgente(id).then(r => setHistorico({ id, itens: r.data.data })).catch(() => setHistorico({ id, itens: [] }));
  };
  const [chat, setChat] = useState<string | null>(null);
  const chamar = (id: string) => { setChamados(c => ({ ...c, [id]: 'sala' })); setSel(id); setChat(id); };
  const liberar = (id: string) => setChamados(c => { const n = { ...c }; delete n[id]; return n; });
  const reunir = () => setChamados(Object.fromEntries((agentes || []).map(a => [a.id, 'reuniao' as Chamado])));
  const emReuniao = Object.values(chamados).some(c => c === 'reuniao');
  const [erro, setErro] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [sim, setSim] = useState<Agente[] | null>(null);

  // Simulação só na tela: nada é enviado nem gravado. A cada 2,5 s um ou dois
  // agentes "fazem" uma ação de exemplo; depois de ~8 s voltam a ficar parados.
  useEffect(() => {
    if (!simulando || !agentes) { setSim(null); return; }
    const inicio = agentes.map(a => ({ ...a, status: 'parado' as const, numeros: a.numeros.map(n => ({ ...n, valor: 0 })) }));
    setSim(inicio);
    const ate: Record<string, number> = {};
    const i = setInterval(() => {
      const agora = Date.now();
      setSim(atual => {
        if (!atual) return atual;
        const sorteados = new Set<string>();
        const qtd = Math.random() < 0.4 ? 2 : 1;
        while (sorteados.size < qtd) sorteados.add(atual[Math.floor(Math.random() * atual.length)].id);
        return atual.map(a => {
          if (sorteados.has(a.id)) {
            const opcoes = ACOES_SIMULADAS[a.id] || ['trabalhou em uma tarefa'];
            ate[a.id] = agora + 8000;
            return {
              ...a, status: 'trabalhando' as const,
              ultima: { texto: opcoes[Math.floor(Math.random() * opcoes.length)], em: new Date(agora).toISOString() },
              numeros: a.numeros.map((n, k) => (k === 0 && typeof n.valor === 'number' ? { ...n, valor: n.valor + 1 } : n)),
            };
          }
          return ate[a.id] && ate[a.id] < agora && a.status === 'trabalhando' ? { ...a, status: 'parado' as const } : a;
        });
      });
    }, 2500);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulando]);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const carregar = useCallback(() => {
    apiClient.getEscritorio()
      .then(r => { setAgentes(r.data.data.agentes); setAtualizado(r.data.data.gerado_em); setErro(false); })
      .catch(() => setErro(true));
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    carregar();
    const i = setInterval(carregar, 30_000);
    return () => clearInterval(i);
  }, [isAuthenticated, carregar]);

  const mostrar = simulando && sim ? sim : agentes;
  const trabalhando = mostrar?.filter(a => a.status === 'trabalhando').length ?? 0;
  const escolhido = mostrar?.find(a => a.id === sel) || null;

  return (
    <DashboardLayout>
      <div style={{ padding: '0 0 24px', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Escritório virtual</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Ande com as setas do teclado ou clicando no chão. Chegue perto de um agente para ver o trabalho dele ou chamá-lo à sua sala.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>
              👥 {agentes?.length ?? 8} agentes · <span style={{ color: '#16a34a' }}>{trabalhando} trabalhando</span>
            </span>
            {atualizado && !simulando && <span style={{ padding: '6px 12px', fontSize: 12, color: 'var(--t-text-muted)' }}>atualizado {haQuanto(atualizado)}</span>}
            <button onClick={() => emReuniao ? setChamados({}) : reunir()} disabled={!agentes}
              style={{ padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: emReuniao ? '#0f766e' : '#b45309' }}>
              {emReuniao ? '✅ Encerrar reunião' : '🤝 Reunir a equipe'}
            </button>
            <button onClick={() => setSimulando(s => !s)} disabled={!agentes}
              style={{ padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: simulando ? '#dc2626' : '#7c3aed' }}>
              {simulando ? '■ Parar simulação' : '▶ Simular atividades'}
            </button>
          </div>
        </div>

        {simulando && (
          <p style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
            Simulação: as ações abaixo são exemplos para ver o escritório funcionando. Nada é enviado nem gravado.
          </p>
        )}
        {erro && <p style={{ color: '#dc2626', fontSize: 13 }}>Não foi possível carregar o escritório agora. Tentando de novo em 30 segundos.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
          {/* Sala com zoom: botões +/−, Ctrl+roda do mouse; com zoom, arraste a barra para andar pela sala. */}
          <div style={{ position: 'relative', background: 'linear-gradient(180deg, #dbe7f3 0%, #eef3f8 100%)', borderRadius: 12, border: '1px solid var(--t-card-border)', padding: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', gap: 4, background: 'rgba(255,255,255,.9)', borderRadius: 8, padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>
              <button aria-label="Diminuir zoom" onClick={() => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2)))} style={botaoZoom}>−</button>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', minWidth: 42, textAlign: 'center', alignSelf: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button aria-label="Aumentar zoom" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} style={botaoZoom}>+</button>
              {zoom > 1 && <button aria-label="Voltar ao tamanho normal" onClick={() => setZoom(1)} style={{ ...botaoZoom, width: 'auto', padding: '0 8px', fontSize: 11 }}>ajustar</button>}
            </div>
            <div onWheel={e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(z => Math.min(3, Math.max(1, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)))); }}
              style={{ overflow: zoom > 1 ? 'auto' : 'hidden', maxHeight: zoom > 1 ? '80vh' : undefined }}>
              <div style={{ width: `${zoom * 100}%`, transition: 'width .2s ease' }}>
                {mostrar ? <SalaIsometrica agentes={mostrar} selecionado={sel} onSelecionar={id => (id ? verTrabalho(id) : setSel(null))} chamados={chamados} onVerTrabalho={verTrabalho} onChamar={chamar} onLiberar={liberar} /> : <p style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Abrindo o escritório…</p>}
              </div>
            </div>
          </div>

          {escolhido && (
            <div style={{ background: 'var(--t-card-bg)', border: `2px solid ${escolhido.cor}`, borderRadius: 14, padding: 18, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>{escolhido.nome}</h2>
                <span style={{ fontSize: 12, fontWeight: 700, color: COR_STATUS[escolhido.status] }}>● {ROTULO_STATUS[escolhido.status]}</span>
                <button onClick={() => setSel(null)} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Fechar</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{escolhido.funcao}</p>
              <p style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>
                {escolhido.ultima ? <>Última ação: <b>{escolhido.ultima.texto}</b> <span style={{ color: 'var(--t-text-muted)' }}>({haQuanto(escolhido.ultima.em)})</span></> : 'Ainda não trabalhou.'}
              </p>
              {escolhido.observacao && <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{escolhido.observacao}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setChat(escolhido.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>💬 Conversar</button>
                <button onClick={() => verTrabalho(escolhido.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: escolhido.cor, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>📅 Agenda</button>
                {chamados[escolhido.id]
                  ? <button onClick={() => liberar(escolhido.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✅ Liberar</button>
                  : <button onClick={() => chamar(escolhido.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>📞 Chamar à minha sala</button>}
              </div>
              {historico?.id === escolhido.id && (
                <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 10, display: 'grid', gap: 6 }}>
                  <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>📅 Agenda de {escolhido.nome}: com quem está falando e o que vem a seguir</b>
                  {historico.itens === null && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Carregando…</span>}
                  {historico.itens?.length === 0 && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Ainda sem ações registradas.</span>}
                  {historico.itens?.map((h, k) => (
                    <div key={k} style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--t-text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{h.texto}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {chat && (mostrar || []).some(a => a.id === chat) && (() => {
            const a = (mostrar || []).find(x => x.id === chat)!;
            return <ChatAgente key={a.id} agente={{ id: a.id, nome: a.nome, cor: a.cor, funcao: a.funcao }} onFechar={() => setChat(null)} />;
          })()}
          <PainelCaroline agente="caroline" />
          <PainelCaroline agente="luiz_felipe" />
          <PainelCaroline agente="julio" />
          <CadernoLaya />
          <PesquisasSofia />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {mostrar?.map(a => (
              <button key={a.id} onClick={() => verTrabalho(a.id)} style={{
                textAlign: 'left', background: 'var(--t-card-bg)', border: `1px solid ${sel === a.id ? a.cor : 'var(--t-card-border)'}`, borderRadius: 12, padding: 14,
                display: 'grid', gap: 6, cursor: 'pointer', color: 'var(--t-text-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: a.cor }} />
                  <b style={{ fontSize: 14 }}>{a.nome}</b>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: COR_STATUS[a.status] }}>● {ROTULO_STATUS[a.status]}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{a.funcao}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  {a.numeros.map(n => (
                    <span key={n.rotulo} style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
                      <b style={{ fontSize: 15, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{n.valor}</b> {n.rotulo}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.ultima ? `${a.ultima.texto} · ${haQuanto(a.ultima.em)}` : a.observacao || 'Aguardando a primeira tarefa'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
