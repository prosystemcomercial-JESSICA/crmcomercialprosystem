'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Play, Pause, Hourglass, X, Loader2, CheckCircle, Clock, Coffee } from 'lucide-react';

// Cronômetro do técnico: só um play por vez. Os componentes conversam pelo evento
// "cronometro:mudou" (play/pausa/espera em qualquer lugar atualiza a barra e os botões).

export const ETAPAS: { key: string; label: string }[] = [
  { key: 'ONBOARDING', label: 'Onboarding técnico' },
  { key: 'INSTALACAO', label: 'Instalação' },
  { key: 'CONVERSAO', label: 'Conversão' },
  { key: 'TREINAMENTO', label: 'Treinamento' },
  { key: 'ASSISTIDA', label: 'Operação assistida' },
  { key: 'CORRECAO', label: 'Correção pós-virada' },
];
const NOME_ETAPA = Object.fromEntries(ETAPAS.map(e => [e.key, e.label]));
const OUTRAS = [{ key: 'SUPORTE', label: 'Suporte' }, { key: 'REUNIAO', label: 'Reunião' }, { key: 'INTERNO', label: 'Tarefa interna' }];
const NOME_TIPO: Record<string, string> = Object.fromEntries(OUTRAS.map(o => [o.key, o.label]));
// Esperas (30/10/2026): repasse ao desenvolvimento (Sinval) ou ao N3, cliente e processamento. O tempo até voltar é medido.
const ESPERAS = [
  { key: 'PROGRAMACAO', label: 'Repassado ao desenvolvimento (Sinval)', dica: 'Algo que o desenvolvimento precisa resolver' },
  { key: 'N3', label: 'Repassado ao N3', dica: 'Algo fora do seu escopo que o N3 precisa fazer' },
  { key: 'CLIENTE', label: 'Aguardando cliente', dica: 'Dados, acesso ou resposta do cliente: o prazo para de contar' },
  { key: 'PROCESSAMENTO', label: 'Processamento rodando', dica: 'Ex.: importação; não conta como seu trabalho' },
];
export const NOME_ESPERA: Record<string, string> = { ...Object.fromEntries(ESPERAS.map(e => [e.key, e.label])), PRE_REQUISITO: 'Aguardando pré-requisitos do cliente' };

const avisar = () => window.dispatchEvent(new Event('cronometro:mudou'));
export const fmtDur = (ms: number) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
const fmtRelogio = (ms: number) => { const s = Math.floor(ms / 1000); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':'); };
const erroDe = (e: any) => e?.response?.data?.message || 'Não foi possível agora. Tente de novo.';

/** Sessão aberta do usuário + resumo do dia; atualiza a cada 30 s e a cada mudança. */
export function useCronometro() {
  const [sessao, setSessao] = useState<any | null>(null);
  const [resumo, setResumo] = useState<any | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const carregar = useCallback(async () => {
    try { const r = await apiClient.getCronometroAtual(); setSessao(r.data.data.sessao); setResumo(r.data.data.resumo); } catch { /* sem login ou offline */ }
  }, []);
  useEffect(() => {
    carregar();
    const t1 = setInterval(carregar, 30000), t2 = setInterval(() => setAgora(Date.now()), 1000);
    window.addEventListener('cronometro:mudou', carregar);
    return () => { clearInterval(t1); clearInterval(t2); window.removeEventListener('cronometro:mudou', carregar); };
  }, [carregar]);
  const decorrido = sessao ? agora - new Date(sessao.inicio).getTime() : 0;
  return { sessao, resumo, decorrido, carregar };
}

const btn = (cor: string, cheio = true): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '6px 11px', cursor: 'pointer',
  border: cheio ? 'none' : `1px solid ${cor}55`, background: cheio ? cor : 'transparent', color: cheio ? '#fff' : cor,
});

// Motivo da pausa (06/10/2026): um toque nos mais comuns ou escrito; vai para o histórico do card.
// Repasse (30/10/2026): se a demanda saiu do técnico (desenvolvimento, N3 ou cliente), a pausa vira espera com motivo
// obrigatório, e o tempo até voltar é medido.
const MOTIVOS_PAUSA = ['Intervalo / almoço', 'Fim do expediente', 'Reunião', 'Sem acesso ao cliente', 'Problema técnico'];
const REPASSES = [
  { key: 'PROGRAMACAO', label: 'Desenvolvimento (Sinval)' },
  { key: 'N3', label: 'N3' },
  { key: 'CLIENTE', label: 'Aguardando o cliente' },
];
export function ModalPausa({ onClose }: { onClose: () => void }) {
  const { sessao } = useCronometro();
  const demanda: { id: string } | null = sessao?.tipo === 'DEMANDA' && sessao?.implantacao_id ? { id: sessao.implantacao_id } : null;
  const [outro, setOutro] = useState('');
  const [repasse, setRepasse] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [precisa, setPrecisa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const pausar = async (m: string) => {
    if (!m.trim()) return;
    setOcupado(true);
    try { await apiClient.pausarCronometro(m.trim()); avisar(); onClose(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); }
  };
  const repassar = async () => {
    if (!demanda || !repasse) return;
    if (motivo.trim().length < 3) return alert('Escreva o motivo: o que foi repassado e por quê.');
    setOcupado(true);
    try {
      await apiClient.abrirEspera(demanda.id, { tipo: repasse, motivo: motivo.trim(), o_que_resolver: precisa.trim() || undefined, responsavel_nome: repasse === 'PROGRAMACAO' ? 'Sinval' : repasse === 'N3' ? 'N3' : undefined });
      avisar(); onClose();
    } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); }
  };
  const nomeRepasse = REPASSES.find(r => r.key === repasse)?.label;
  const semMotivo = motivo.trim().length < 3;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Motivo da pausa" style={{ background: 'var(--t-card-bg)', borderRadius: 6, padding: 18, width: 'min(460px, 100%)', display: 'grid', gap: 12, boxShadow: '0 20px 50px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>Por que vai pausar?</b>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--t-text-muted)' }}><X size={18} /></button>
        </div>
        {demanda && (
          <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 6, border: '1px solid #d9770655', background: '#d977060a' }}>
            <b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>A demanda saiu de você? Repassei para:</b>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {REPASSES.map(r => (
                <button key={r.key} disabled={ocupado} onClick={() => setRepasse(r.key)} aria-pressed={repasse === r.key}
                  style={{ ...btn('#d97706', repasse === r.key), fontSize: 13, minHeight: 40, padding: '8px 12px' }}><Hourglass size={12} /> {r.label}</button>
              ))}
            </div>
            {repasse && (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>Motivo (obrigatório)
                  <textarea autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={2000} className="ps-input w-full"
                    placeholder={repasse === 'CLIENTE' ? 'Ex.: cliente ainda não instalou o computador do caixa' : 'Ex.: ajuste na importação do estoque, fora do meu escopo'} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>O que precisa ser feito
                  <textarea value={precisa} onChange={e => setPrecisa(e.target.value)} rows={2} maxLength={2000} className="ps-input w-full" />
                </label>
                <button disabled={ocupado || semMotivo} onClick={repassar} style={{ ...btn('#d97706'), justifyContent: 'center', minHeight: 40, opacity: semMotivo ? 0.5 : 1 }}>
                  {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Pause size={12} />} Pausar e registrar ({nomeRepasse})
                </button>
                <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{repasse === 'CLIENTE' ? 'O prazo para de contar até o cliente responder.' : 'O tempo até voltar fica registrado. Quando voltar, clique em Resolvido na demanda.'}</span>
                <button onClick={() => setRepasse(null)} style={{ ...btn('#64748b', false), justifyContent: 'center' }}>Não repassei: é uma pausa minha</button>
              </>
            )}
          </div>
        )}
        {!repasse && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MOTIVOS_PAUSA.map(m => <button key={m} disabled={ocupado} onClick={() => pausar(m)} style={{ ...btn('#dc2626', false), fontSize: 13, minHeight: 40, padding: '8px 12px' }}>{m}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={outro} onChange={e => setOutro(e.target.value)} onKeyDown={e => e.key === 'Enter' && pausar(outro)} placeholder="Outro motivo" maxLength={300} className="ps-input" style={{ flex: 1, minHeight: 40 }} />
              <button disabled={ocupado || !outro.trim()} onClick={() => pausar(outro)} style={{ ...btn('#dc2626'), minHeight: 40, opacity: !outro.trim() ? 0.5 : 1 }}><Pause size={12} /> Pausar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Barra do topo: o que está rodando, pausar, outra atividade e o total do dia. */
export function CronometroBarra() {
  const { sessao, resumo, decorrido } = useCronometro();
  const [menu, setMenu] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pausa, setPausa] = useState(false);
  const acao = async (f: () => Promise<any>) => { setOcupado(true); try { await f(); avisar(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); setMenu(false); } };
  const trabalhadoHoje = (resumo?.trabalhado_ms || 0);
  const rotulo = sessao ? (sessao.tipo === 'DEMANDA' ? `${NOME_ETAPA[sessao.etapa] || ''} · ${sessao.implantacao?.cliente_razao_social || ''}` : NOME_TIPO[sessao.tipo]) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
      {sessao ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#16a34a14', border: '1px solid #16a34a40', borderRadius: 6, padding: '4px 6px 4px 10px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#16a34a', animation: 'pulse 1.6s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rotulo || ''}>{rotulo}</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#15803d' }}>{fmtRelogio(decorrido)}</span>
          <button disabled={ocupado} onClick={() => setPausa(true)} style={btn('#dc2626')}><Pause size={12} /> Pausar</button>
        </div>
      ) : (
        <span className="pt-sem-celular" style={{ fontSize: 12, color: 'var(--t-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Coffee size={13} /> Cronômetro parado</span>
      )}
      <button onClick={() => setMenu(m => !m)} style={btn('#286397', false)}>Outra atividade</button>
      {menu && (
        <div style={{ position: 'absolute', top: 36, right: 90, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 60, minWidth: 170 }}>
          {OUTRAS.map(o => (
            <button key={o.key} disabled={ocupado} onClick={() => acao(() => apiClient.playCronometro({ tipo: o.key }))}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '9px 12px', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t-text-primary)' }}>
              <Play size={12} /> {o.label}
            </button>
          ))}
        </div>
      )}
      {pausa && <ModalPausa onClose={() => setPausa(false)} />}
      <span className="pt-sem-celular" title="Trabalhado hoje (sem contar em dobro)" style={{ fontSize: 12, color: 'var(--t-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Clock size={12} /> Hoje {fmtDur(trabalhadoHoje)}
        {resumo?.aproveitamento != null && <b style={{ color: 'var(--t-text-primary)' }}> · {Math.round(resumo.aproveitamento * 100)}%</b>}
      </span>
    </div>
  );
}

/** Play/pausa e espera na linha de uma demanda. */
export function BotoesDemanda({ implantacao }: { implantacao: { id: string; cliente_razao_social: string; tipo_base?: string | null; onboarding_ok?: boolean } }) {
  const { sessao } = useCronometro();
  const rodandoAqui = sessao?.implantacao_id === implantacao.id;
  const [etapa, setEtapa] = useState(implantacao.onboarding_ok === false ? 'ONBOARDING' : implantacao.tipo_base === 'CONVERSAO' ? 'CONVERSAO' : 'INSTALACAO');
  const [espera, setEspera] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pausa, setPausa] = useState(false);
  useEffect(() => { if (rodandoAqui && sessao?.etapa) setEtapa(sessao.etapa); }, [rodandoAqui, sessao?.etapa]);
  const acao = async (f: () => Promise<any>) => { setOcupado(true); try { await f(); avisar(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); } };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <select value={etapa} onChange={e => { setEtapa(e.target.value); if (rodandoAqui) acao(() => apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: implantacao.id, etapa: e.target.value })); }}
        className="ps-input" style={{ fontSize: 12, padding: '4px 6px', width: 'auto' }} title="Etapa em que você está trabalhando">
        {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
      </select>
      {rodandoAqui ? (
        <button disabled={ocupado} onClick={() => setPausa(true)} style={btn('#dc2626')}><Pause size={12} /> Pausar</button>
      ) : (
        <button disabled={ocupado} onClick={() => acao(() => apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: implantacao.id, etapa }))} style={btn('#16a34a')}
          title={sessao ? 'Pausa o que está rodando e começa aqui' : 'Começar a trabalhar nesta demanda'}><Play size={12} /> Play</button>
      )}
      <button onClick={() => setEspera(true)} style={btn('#d97706', false)} title="A demanda ficou parada esperando algo"><Hourglass size={12} /> Espera</button>
      {espera && <ModalEspera implantacao={implantacao} onClose={() => setEspera(false)} />}
      {pausa && <ModalPausa onClose={() => setPausa(false)} />}
    </span>
  );
}

function ModalEspera({ implantacao, onClose }: { implantacao: { id: string; cliente_razao_social: string }; onClose: () => void }) {
  const [tipo, setTipo] = useState('PROGRAMACAO');
  const [motivo, setMotivo] = useState('');
  const [resolver, setResolver] = useState('');
  const [com, setCom] = useState('Sinval');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (motivo.trim().length < 3) return alert('Escreva o motivo: o que foi repassado e por quê.');
    setSalvando(true);
    try {
      await apiClient.abrirEspera(implantacao.id, { tipo, motivo: motivo.trim(), o_que_resolver: resolver.trim() || undefined, responsavel_nome: tipo === 'PROGRAMACAO' ? com.trim() || undefined : tipo === 'N3' ? 'N3' : undefined });
      avisar(); onClose();
    } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'left' }} onClick={onClose}>
      <div style={{ background: 'var(--t-card-bg)', borderRadius: 6, width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--t-text-primary)' }}>Demanda em espera</div>
            <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{implantacao.cliente_razao_social}</div>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--t-text-muted)' }} /></button>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {ESPERAS.map(e => (
              <label key={e.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${tipo === e.key ? '#d97706' : 'var(--t-card-border)'}`, background: tipo === e.key ? '#d9770610' : 'transparent' }}>
                <input type="radio" checked={tipo === e.key} onChange={() => setTipo(e.key)} style={{ marginTop: 3 }} />
                <span><b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{e.label}</b><br /><span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{e.dica}</span></span>
              </label>
            ))}
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>Motivo (obrigatório)
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} className="ps-input w-full" placeholder="Ex.: erro ao importar o estoque do sistema anterior" />
          </label>
          {tipo !== 'PROCESSAMENTO' && (
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>O que precisa ser resolvido
              <textarea value={resolver} onChange={e => setResolver(e.target.value)} rows={2} className="ps-input w-full" />
            </label>
          )}
          {tipo === 'PROGRAMACAO' && (
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>Com quem
              <input value={com} onChange={e => setCom(e.target.value)} className="ps-input w-full" />
            </label>
          )}
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Se o cronômetro estiver nesta demanda, ele pausa. O tempo parado conta à parte, até alguém marcar a espera como resolvida.</div>
          <button disabled={salvando} onClick={salvar} style={{ ...btn('#d97706'), justifyContent: 'center', padding: '10px 12px', fontSize: 13 }}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Hourglass size={14} />} Registrar espera
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chamado interno voltou (30/10/2026): "Voltou e funcionou" fecha; "Voltou com problema" devolve ao mesmo setor
 * com o motivo (obrigatório), abrindo nova rodada. Serve tanto com o chamado no setor quanto já em teste.
 */
export function BotoesChamado({ chamadoId, onFeito }: { chamadoId: string; onFeito?: () => void }) {
  const [problema, setProblema] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (funcionou: boolean) => {
    if (!funcionou && motivo.trim().length < 3) return alert('Escreva o motivo: o que ainda não funcionou.');
    setOcupado(true);
    try { await apiClient.chamadoVoltou(chamadoId, { funcionou, motivo: funcionou ? undefined : motivo.trim() }); setProblema(false); setMotivo(''); avisar(); onFeito?.(); }
    catch (e) { alert(erroDe(e)); } finally { setOcupado(false); }
  };
  if (problema) return (
    <span style={{ display: 'grid', gap: 6, width: '100%' }}>
      <textarea autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={2000} className="ps-input w-full" placeholder="Motivo (obrigatório): o que ainda não funcionou" />
      <span style={{ display: 'flex', gap: 6 }}>
        <button disabled={ocupado || motivo.trim().length < 3} onClick={() => enviar(false)} style={{ ...btn('#b45309'), opacity: motivo.trim().length < 3 ? 0.5 : 1 }}>Devolver ao setor</button>
        <button onClick={() => setProblema(false)} style={btn('#64748b', false)}>Cancelar</button>
      </span>
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      <button disabled={ocupado} onClick={() => enviar(true)} style={btn('#16a34a')}><CheckCircle size={12} /> Voltou e funcionou</button>
      <button disabled={ocupado} onClick={() => setProblema(true)} style={btn('#b45309', false)}>Voltou com problema</button>
    </span>
  );
}

/** Aba "Meu dia": tempo do dia, sessões e esperas abertas (gestão escolhe o técnico). */
export function PainelMeuDia({ gestao }: { gestao: boolean }) {
  const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [tecnicoId, setTecnicoId] = useState('');
  const [dia, setDia] = useState<any | null>(null);
  const [esperas, setEsperas] = useState<any[]>([]);
  const [emTeste, setEmTeste] = useState<any[]>([]);
  const carregar = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([apiClient.getDiaTecnico({ data, tecnico_id: tecnicoId || undefined }), apiClient.getEsperasAbertas()]);
      setDia(d.data.data); setEsperas(e.data.data || []); setEmTeste(e.data.em_teste || []);
    } catch { /* ignore */ }
  }, [data, tecnicoId]);
  useEffect(() => { carregar(); window.addEventListener('cronometro:mudou', carregar); return () => window.removeEventListener('cronometro:mudou', carregar); }, [carregar]);
  useEffect(() => { if (gestao) apiClient.getTecnicosImplantacao().then(r => setTecnicos(r.data.data || [])).catch(() => {}); }, [gestao]);
  const resolver = async (id: string) => {
    const resposta = prompt('O que foi feito para resolver? (opcional)') ?? null;
    if (resposta === null) return;
    try { await apiClient.resolverEspera(id, resposta || undefined); avisar(); } catch (e) { alert(erroDe(e)); }
  };
  const r = dia?.resumo;
  const card = (label: string, valor: string, cor: string, dica?: string) => (
    <div className="ps-card rounded-xl" style={{ padding: 14, border: '1px solid var(--t-card-border)' }} title={dica}>
      <div style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  );
  const hora = (s?: string | null) => s ? new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : 'agora';
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={data} max={hoje} onChange={e => setData(e.target.value)} className="ps-input" style={{ width: 'auto' }} />
        {gestao && (
          <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} className="ps-input" style={{ width: 'auto' }}>
            <option value="">Meu tempo</option>
            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        )}
      </div>
      {r && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {card('Trabalhado', fmtDur(r.trabalhado_ms), 'var(--t-text-primary)', 'Duas demandas ao mesmo tempo contam uma vez só')}
          {card('Na jornada', `${fmtDur(r.dentro_ms)} de ${fmtDur(r.jornada_ms)}`, '#286397', r.virada ? 'Dia de virada: jornada a partir das 7h' : 'Jornada 8h às 18h, 1h de almoço')}
          {card('Aproveitamento', r.aproveitamento == null ? '—' : `${Math.round(r.aproveitamento * 100)}%`, r.aproveitamento == null ? 'var(--t-text-muted)' : r.aproveitamento >= 0.75 ? '#16a34a' : r.aproveitamento >= 0.5 ? '#d97706' : '#dc2626', 'Tempo registrado dentro da jornada ÷ horas da jornada')}
          {card('Hora extra', fmtDur(r.extra_ms), r.extra_ms ? '#7c3aed' : 'var(--t-text-muted)', 'Fora do horário (noite, madrugada, fim de semana)')}
        </div>
      )}
      <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
        <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--t-text-primary)', borderBottom: '1px solid var(--t-card-border)' }}>Registros do dia</div>
        {(dia?.sessoes || []).length === 0 && <div style={{ padding: 18, color: 'var(--t-text-muted)', fontSize: 13 }}>Nenhum play neste dia.</div>}
        {(dia?.sessoes || []).map((s: any) => (
          <div key={s.id} style={{ display: 'flex', gap: 12, padding: '9px 14px', borderTop: '1px solid var(--t-card-border)', fontSize: 13, alignItems: 'center' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--t-text-muted)', width: 110 }}>{hora(s.inicio)} – {hora(s.fim)}</span>
            <span style={{ flex: 1, color: 'var(--t-text-primary)' }}>{s.tipo === 'DEMANDA' ? <><b>{NOME_ETAPA[s.etapa]}</b> · {s.implantacao?.cliente_razao_social}</> : <b>{NOME_TIPO[s.tipo]}</b>}{s.descricao ? ` · ${s.descricao}` : ''}</span>
            {s.origem_fim === 'AUTO_23H59' && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>fechado sozinho</span>}
            {s.corrigido_por && <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>corrigido por {s.corrigido_por}</span>}
          </div>
        ))}
      </div>
      <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
        <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--t-text-primary)', borderBottom: '1px solid var(--t-card-border)' }}>Esperas abertas</div>
        {esperas.length === 0 && <div style={{ padding: 18, color: 'var(--t-text-muted)', fontSize: 13 }}>Nenhuma demanda parada.</div>}
        {esperas.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--t-card-border)', fontSize: 13, alignItems: 'center' }}>
            <Hourglass size={14} color="#d97706" />
            <span style={{ flex: 1 }}>
              <b style={{ color: 'var(--t-text-primary)' }}>{e.implantacao?.cliente_razao_social}</b> · {NOME_ESPERA[e.tipo]}{e.responsavel_nome ? ` (${e.responsavel_nome})` : ''}
              <br /><span style={{ color: 'var(--t-text-muted)' }}>{e.motivo}{e.o_que_resolver ? ` · Precisa: ${e.o_que_resolver}` : ''}</span>
            </span>
            <span style={{ color: '#d97706', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(Date.now() - new Date(e.inicio).getTime())}</span>
            {e.chamado_id ? <BotoesChamado chamadoId={e.chamado_id} /> : e.tipo !== 'PRE_REQUISITO' && <button onClick={() => resolver(e.id)} style={btn('#16a34a')}><CheckCircle size={12} /> Resolvido</button>}
          </div>
        ))}
      </div>
      {emTeste.length > 0 && (
        <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid #28639755' }}>
          <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--t-text-primary)', borderBottom: '1px solid var(--t-card-border)' }}>🧪 Chamados que voltaram: teste e responda</div>
          {emTeste.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--t-card-border)', fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, minWidth: 220 }}>
                <b style={{ color: 'var(--t-text-primary)' }}>{t.implantacao?.cliente_razao_social}</b> · {t.setor}{t.devolucoes ? ` · ${t.devolucoes} devolução(ões)` : ''}
                <br /><span style={{ color: 'var(--t-text-muted)' }}>{t.motivo}{t.rodadas.at(-1)?.resposta ? ` · Resposta: ${t.rodadas.at(-1).resposta}` : ''}</span>
              </span>
              <BotoesChamado chamadoId={t.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
