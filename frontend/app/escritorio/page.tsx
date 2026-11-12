'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import SalaViva, { type Chamado } from '@/components/escritorio/SalaViva';
import FeedAoVivo from '@/components/escritorio/painel/FeedAoVivo';
import ChatAgente from '@/components/escritorio/ChatAgente';
import PerfilAgente from '@/components/escritorio/PerfilAgente';
import PesquisasSofia from '@/components/escritorio/PesquisasSofia';
import CadernoLaya from '@/components/escritorio/CadernoLaya';
import PainelCaroline from '@/components/escritorio/PainelCaroline';
import PainelRafael from '@/components/escritorio/PainelRafael';
import PainelMila from '@/components/escritorio/PainelMila';
import PainelJoana from '@/components/escritorio/PainelJoana';
import SalaTreinamento, { type FalaNaSala } from '@/components/escritorio/SalaTreinamento';
import PainelHeitor from '@/components/escritorio/PainelHeitor';
import { ConfigPortalImplantacao } from '@/components/implantacao/Portal';
import { MuralEquipe } from '@/components/escritorio/MuralEquipe';
import PlacarComercial from '@/components/escritorio/PlacarComercial';
import FunilOrigem from '@/components/escritorio/FunilOrigem';
import FaixaSaude from '@/components/escritorio/painel/FaixaSaude';
import MenuSetores, { type Vista } from '@/components/escritorio/painel/MenuSetores';
import QuadroAgente from '@/components/escritorio/painel/QuadroAgente';
import Organograma from '@/components/escritorio/painel/Organograma';
import EsperandoVoce from '@/components/escritorio/painel/EsperandoVoce';
import ConsumoEscritorio from '@/components/escritorio/painel/ConsumoEscritorio';
import EstilosEscritorio from '@/components/escritorio/painel/Estilos';
import { type AgenteTela, type Painel, haQuanto } from '@/components/escritorio/painel/tipos';

// Escritório virtual: os agentes do assistente como uma equipe numa sala, organizados por setor (10/11/2026):
// faixa de saúde no topo, menu por setores, quadro padrão de cada agente, organograma vivo, "Esperando você"
// e consumo de IA com teto. Somente leitura (os painéis de cada agente continuam onde a Jessica decide).

type Agente = AgenteTela;
const PAINEIS = ['rafael', 'mila', 'joana', 'luiz_felipe', 'julio', 'heitor', 'sofia', 'caroline', 'laya', 'otavio'] as const;
const SETORES_VISTA = ['entrada', 'vendas', 'inteligencia', 'clientes'];

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

/** Durante o treinamento, Rafael e o agente aparecem trabalhando e só quem fala mostra o balão. */
function comTreino<T extends { id: string; status: any; ultima: any }>(agentes: T[], f: FalaNaSala): T[] {
  if (!f) return agentes;
  return agentes.map(a => {
    if (a.id !== 'rafael' && a.id !== f.agente) return a;
    const fala = (f.quem === 'rafael') === (a.id === 'rafael');
    return { ...a, status: 'trabalhando', ultima: fala ? { texto: f.texto.length > 110 ? f.texto.slice(0, 107) + '…' : f.texto, em: new Date().toISOString() } : null };
  });
}

export default function EscritorioPage() {
  // Treinamento em andamento na Sala de treinamento: Rafael e o agente conversam na sala (balões).
  const [falaTreino, setFalaTreino] = useState<FalaNaSala>(null);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[] | null>(null);
  const [atualizado, setAtualizado] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [chamados, setChamados] = useState<Record<string, Chamado>>({});
  const [historico, setHistorico] = useState<{ id: string; itens: { texto: string; em: string }[] | null } | null>(null);

  // Clique num agente (sala, organograma, quadro): seleciona e mostra o quadro dele; o painel abre pelo botão.
  const verAgenda = (id: string) => {
    setSel(id); setHistorico({ id, itens: null });
    apiClient.getHistoricoAgente(id).then(r => setHistorico({ id, itens: r.data.data })).catch(() => setHistorico({ id, itens: [] }));
  };
  const abrirPainel = (id: string) => { if ((PAINEIS as readonly string[]).includes(id)) setJanela(id as any); };
  const [vista, setVista] = useState<Vista>('todos');
  const [painel, setPainel] = useState<Painel | null>(null);
  const selecionar = (id: string | null) => {
    if (!id) { setSel(null); return; }
    const setor = painel?.quadros.find(q => q.id === id)?.setor;
    if (vista !== 'todos' && vista !== setor) setVista(setor && SETORES_VISTA.includes(setor) ? setor as Vista : 'todos');
    verAgenda(id);
    setTimeout(() => document.getElementById('esc-detalhe')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
  };
  const [chat, setChat] = useState<string | null>(null);
  const [conversasAgentes, setConversasAgentes] = useState<any[]>([]); // conversas entre agentes (balões redondos)
  const [janela, setJanela] = useState<null | 'treino' | 'rafael' | 'mila' | 'joana' | 'luiz_felipe' | 'julio' | 'heitor' | 'sofia' | 'caroline' | 'laya' | 'otavio'>(null); // painéis dos agentes em janela
  // Link do aviso (?rafael=perguntas) abre direto nas perguntas do Rafael; a contagem fica em "Esperando você".
  const [abaRafael, setAbaRafael] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('rafael') === 'perguntas') { setAbaRafael('PERGUNTAS'); setJanela('rafael'); }
  }, []);
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
      .then(r => { setAgentes(r.data.data.agentes); setConversasAgentes(r.data.data.conversas || []); setAtualizado(r.data.data.gerado_em); setErro(false); })
      .catch(() => setErro(true));
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    carregar();
    const i = setInterval(carregar, 30_000);
    return () => clearInterval(i);
  }, [isAuthenticated, carregar]);
  const carregarPainel = useCallback(() => { apiClient.getEscritorioPainel().then(r => setPainel(r.data.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    carregarPainel();
    const i = setInterval(carregarPainel, 30_000);
    return () => clearInterval(i);
  }, [isAuthenticated, carregarPainel]);

  // Estado de cada agente com o que o painel sabe: erro (pausado ou só falhando) e o que espera a Jessica.
  const comPainel = (lista: Agente[] | null) => lista && lista.map(a => {
    const q = painel?.quadros.find(x => x.id === a.id);
    return q?.erro ? { ...a, status: 'erro' as const, erro: q.erro, precisa: q.precisa_de_voce } : { ...a, erro: null, precisa: q?.precisa_de_voce || null };
  });
  const mostrar = comPainel(simulando && sim ? sim : agentes);
  const setorAtual = painel?.setores.find(s => s.id === vista) || null;
  const doSetor = setorAtual ? (mostrar || []).filter(a => setorAtual.agentes.includes(a.id)) : (mostrar || []);
  const trabalhando = mostrar?.filter(a => a.status === 'trabalhando').length ?? 0;
  const escolhido = mostrar?.find(a => a.id === sel) || null;

  return (
    <DashboardLayout>
      {janela && (
        <div role="dialog" aria-modal="true" aria-label="Painel" style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setJanela(null); }}>
          <div style={{ width: '100%', maxWidth: 1100, background: 'var(--t-content-bg)', borderRadius: 16, padding: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t-text-primary)' }}>
                {({ treino: '🎓 Treinamentos', rafael: '📚 Rafael · vendas', mila: '💚 Mila · Customer Success', joana: '📰 Joana · Informativo Prosystem', laya: '🧠 Laya · o cérebro da equipe', caroline: '💬 Caroline · SDR (primeiro contato)', luiz_felipe: '📄 Luiz Felipe · Propostas não assinadas', julio: '🔁 Julio · Follow-up de leads', heitor: '🧭 Heitor · Prospecção no Google Maps', otavio: '🛠️ Otávio · Implantação e serviços', sofia: '🔎 Pesquisas da Sofia' } as Record<string, string>)[janela]}
              </h2>
              <button onClick={() => setJanela(null)} aria-label="Fechar" style={{ minWidth: 40, minHeight: 40, borderRadius: 10, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            {janela === 'treino' && <SalaTreinamento onFala={setFalaTreino} />}
            {janela === 'rafael' && <PainelRafael abaInicial={abaRafael} />}
            {janela === 'mila' && <PainelMila />}
            {janela === 'joana' && <PainelJoana />}
            {janela === 'laya' && <CadernoLaya />}
            {janela === 'caroline' && <PainelCaroline agente="caroline" />}
            {janela === 'luiz_felipe' && <PainelCaroline agente="luiz_felipe" />}
            {janela === 'julio' && <PainelCaroline agente="julio" />}
            {janela === 'heitor' && <PainelHeitor />}
            {janela === 'otavio' && <ConfigPortalImplantacao />}
            {janela === 'sofia' && <PesquisasSofia />}
          </div>
        </div>
      )}
      <div className="ios-tela esc" style={{ padding: '0 0 24px', display: 'grid', gap: 12 }}>
        <div className="esc-topo">
          <div>
            <h1 className="ios-large-title">Escritório</h1>
            <p>
              {!erro && mostrar && <span className="esc-ao-vivo">{simulando ? 'Simulação' : 'Ao vivo'}</span>}
              {mostrar ? `${mostrar.length} agentes · ${trabalhando} trabalhando agora` : 'Abrindo o escritório…'}{atualizado && !simulando ? ` · atualizado ${haQuanto(atualizado)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="esc-btn" onClick={() => emReuniao ? setChamados({}) : reunir()} disabled={!agentes}>{emReuniao ? 'Encerrar reunião' : 'Reunir a equipe'}</button>
            <button className="esc-btn" onClick={() => setSimulando(s => !s)} disabled={!agentes} aria-pressed={simulando}>{simulando ? 'Parar simulação' : 'Simular atividades'}</button>
          </div>
        </div>

        <FaixaSaude p={painel} onIr={v => setVista(v as Vista)} />

        {simulando && (
          <p style={{ background: '#ede9fe', color: '#5b21b6', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
            Simulação: as ações abaixo são exemplos para ver o escritório funcionando. Nada é enviado nem gravado.
          </p>
        )}
        {erro && <p role="alert" style={{ color: '#dc2626', fontSize: 13 }}>Não foi possível carregar o escritório agora. Tentando de novo em 30 segundos.</p>}

        <div className="esc-grade">
          <MenuSetores vista={vista} onVista={v => { setVista(v); setSel(null); }} painel={painel} agentes={mostrar} />

          <main style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>
            {vista === 'esperando' && painel && <EsperandoVoce itens={painel.esperando} agentes={mostrar || []} onAbrir={(p, tipo) => { setAbaRafael(p === 'rafael' && tipo === 'pergunta' ? 'PERGUNTAS' : undefined); abrirPainel(p); }} />}
            {vista === 'consumo' && painel && <ConsumoEscritorio c={painel.consumo} provedores={painel.saude.ias.provedores} agentes={mostrar || []} onSalvo={carregarPainel} />}
            {vista === 'organograma' && painel && mostrar && <Organograma setores={painel.setores} agentes={mostrar} quadros={painel.quadros} passagens={painel.passagens} onAgente={id => selecionar(id)} />}
            {vista === 'treinos' && (
              <section className="esc-cartao" aria-label="Treinamentos">
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)', marginBottom: 8 }}>Treinamentos</h2>
                <SalaTreinamento onFala={setFalaTreino} />
              </section>
            )}
            {['esperando', 'consumo', 'organograma'].includes(vista) && !painel && <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando…</p>}

            {(vista === 'todos' || SETORES_VISTA.includes(vista)) && (
              <>
                <div className="esc-palco">
                  <div style={{ minWidth: 0 }}>
                    {mostrar
                      ? <SalaViva agentes={comTreino(mostrar, falaTreino)} conversas={conversasAgentes} passagens={painel?.passagens || []} selecionado={sel}
                          onSelecionar={id => selecionar(id || null)} chamados={chamados} destacar={setorAtual ? setorAtual.id : null}
                          onSetor={id => { setVista(id as Vista); setSel(null); }} />
                      : <p style={{ padding: 60, textAlign: 'center', color: 'var(--t-text-muted)' }}>Abrindo o escritório…</p>}
                    <p className="esc-dica">Clique num agente para ver o quadro dele, ou no nome de uma sala para ver só aquele setor. Quem passa trabalho para outro vai até a mesa dele. Use <b>Tela cheia</b> para ver o escritório grande e <b>Visitar</b> para entrar numa sala; na hora livre, a equipe conversa no café.</p>
                  </div>
                  {mostrar && <FeedAoVivo agentes={mostrar} conversas={conversasAgentes} passagens={painel?.passagens || []} esperando={painel?.saude.esperando || 0}
                    onAgente={id => selecionar(id)} onEsperando={() => setVista('esperando')} />}
                </div>

                {escolhido && (
                  <div className="esc-detalhe" id="esc-detalhe">
                    <PerfilAgente a={escolhido} />
                    <QuadroAgente a={escolhido} q={painel?.quadros.find(q => q.id === escolhido.id)} selecionado
                      onAbrir={abrirPainel} onConversar={id => setChat(id)} onAgenda={id => verAgenda(id)} />
                    <section className="esc-cartao" aria-label={`Agenda de ${escolhido.nome}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <b style={{ fontSize: 14, color: 'var(--t-text-primary)' }}>O que {escolhido.nome} fez por último</b>
                        {chamados[escolhido.id]
                          ? <button className="esc-btn" onClick={() => liberar(escolhido.id)}>Liberar</button>
                          : <button className="esc-btn" onClick={() => chamar(escolhido.id)}>Chamar à minha sala</button>}
                        <button className="esc-btn" style={{ marginLeft: 'auto' }} aria-label="Fechar quadro" onClick={() => { setSel(null); setHistorico(null); }}>Fechar</button>
                      </div>
                      {(!historico || historico.id !== escolhido.id || historico.itens === null) && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Carregando…</span>}
                      {historico?.id === escolhido.id && historico.itens?.length === 0 && <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Ainda sem ações registradas.</span>}
                      <ol className="esc-linha-tempo">
                        {historico?.id === escolhido.id && historico.itens?.map((h, k) => (
                          <li key={k}><time>{new Date(h.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><span>{h.texto}</span></li>
                        ))}
                      </ol>
                    </section>
                  </div>
                )}

                {vista === 'vendas' && <><PlacarComercial /><FunilOrigem /></>}

                {chat && (mostrar || []).some(a => a.id === chat) && (() => {
                  const a = (mostrar || []).find(x => x.id === chat)!;
                  return <ChatAgente key={a.id} agente={{ id: a.id, nome: a.nome, cor: a.cor, funcao: a.funcao }} onFechar={() => setChat(null)} />;
                })()}

                <h2 className="esc-sub">{setorAtual ? `Quadros de ${setorAtual.nome}` : 'Quadros da equipe'}</h2>
                <div className="esc-quadros">
                  {[...doSetor].sort((x, y) => Number(y.status === 'erro') - Number(x.status === 'erro')).map(a => (
                    <div key={a.id} id={`quadro-${a.id}`} style={{ display: 'grid' }}>
                      <QuadroAgente a={a} q={painel?.quadros.find(q => q.id === a.id)} selecionado={sel === a.id}
                        onAbrir={abrirPainel} onConversar={id => setChat(id)} onAgenda={id => verAgenda(id)} />
                    </div>
                  ))}
                </div>

                {vista === 'todos' && <MuralEquipe />}
              </>
            )}
          </main>
        </div>
      </div>
      <EstilosEscritorio />
    </DashboardLayout>
  );
}
