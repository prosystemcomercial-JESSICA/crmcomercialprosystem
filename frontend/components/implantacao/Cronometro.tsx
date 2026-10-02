'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Play, Pause, Hourglass, X, Loader2, CheckCircle, Clock, Coffee } from 'lucide-react';

// Cronômetro do técnico: só um play por vez. Os componentes conversam pelo evento
// "cronometro:mudou" (play/pausa/espera em qualquer lugar atualiza a barra e os botões).

export const ETAPAS: { key: string; label: string }[] = [
  { key: 'INSTALACAO', label: 'Instalação' },
  { key: 'CONVERSAO', label: 'Conversão' },
  { key: 'TREINAMENTO', label: 'Treinamento' },
  { key: 'CORRECAO', label: 'Correção pós-virada' },
];
const NOME_ETAPA = Object.fromEntries(ETAPAS.map(e => [e.key, e.label]));
const OUTRAS = [{ key: 'SUPORTE', label: 'Suporte' }, { key: 'REUNIAO', label: 'Reunião' }, { key: 'INTERNO', label: 'Tarefa interna' }];
const NOME_TIPO: Record<string, string> = Object.fromEntries(OUTRAS.map(o => [o.key, o.label]));
const ESPERAS = [
  { key: 'PROGRAMACAO', label: 'Aguardando programação', dica: 'Algo que a programação precisa resolver' },
  { key: 'CLIENTE', label: 'Aguardando cliente', dica: 'Dados, acesso ou resposta do cliente' },
  { key: 'PROCESSAMENTO', label: 'Processamento rodando', dica: 'Ex.: importação; não conta como seu trabalho' },
];
export const NOME_ESPERA: Record<string, string> = Object.fromEntries(ESPERAS.map(e => [e.key, e.label]));

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
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '6px 11px', cursor: 'pointer',
  border: cheio ? 'none' : `1px solid ${cor}55`, background: cheio ? cor : 'transparent', color: cheio ? '#fff' : cor,
});

/** Barra do topo: o que está rodando, pausar, outra atividade e o total do dia. */
export function CronometroBarra() {
  const { sessao, resumo, decorrido } = useCronometro();
  const [menu, setMenu] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const acao = async (f: () => Promise<any>) => { setOcupado(true); try { await f(); avisar(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); setMenu(false); } };
  const trabalhadoHoje = (resumo?.trabalhado_ms || 0);
  const rotulo = sessao ? (sessao.tipo === 'DEMANDA' ? `${NOME_ETAPA[sessao.etapa] || ''} · ${sessao.implantacao?.cliente_razao_social || ''}` : NOME_TIPO[sessao.tipo]) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
      {sessao ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#16a34a14', border: '1px solid #16a34a40', borderRadius: 10, padding: '4px 6px 4px 10px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#16a34a', animation: 'pulse 1.6s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rotulo || ''}>{rotulo}</span>
          <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#15803d' }}>{fmtRelogio(decorrido)}</span>
          <button disabled={ocupado} onClick={() => acao(() => apiClient.pausarCronometro())} style={btn('#dc2626')}><Pause size={12} /> Pausar</button>
        </div>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Coffee size={13} /> Cronômetro parado</span>
      )}
      <button onClick={() => setMenu(m => !m)} style={btn('#2E6EAB', false)}>Outra atividade</button>
      {menu && (
        <div style={{ position: 'absolute', top: 36, right: 90, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 60, minWidth: 170 }}>
          {OUTRAS.map(o => (
            <button key={o.key} disabled={ocupado} onClick={() => acao(() => apiClient.playCronometro({ tipo: o.key }))}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '9px 12px', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--t-text-primary)' }}>
              <Play size={12} /> {o.label}
            </button>
          ))}
        </div>
      )}
      <span title="Trabalhado hoje (sem contar em dobro)" style={{ fontSize: 12, color: 'var(--t-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Clock size={12} /> Hoje {fmtDur(trabalhadoHoje)}
        {resumo?.aproveitamento != null && <b style={{ color: 'var(--t-text-primary)' }}> · {Math.round(resumo.aproveitamento * 100)}%</b>}
      </span>
    </div>
  );
}

/** Play/pausa e espera na linha de uma demanda. */
export function BotoesDemanda({ implantacao }: { implantacao: { id: string; cliente_razao_social: string; tipo_base?: string | null } }) {
  const { sessao } = useCronometro();
  const rodandoAqui = sessao?.implantacao_id === implantacao.id;
  const [etapa, setEtapa] = useState(implantacao.tipo_base === 'CONVERSAO' ? 'CONVERSAO' : 'INSTALACAO');
  const [espera, setEspera] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (rodandoAqui && sessao?.etapa) setEtapa(sessao.etapa); }, [rodandoAqui, sessao?.etapa]);
  const acao = async (f: () => Promise<any>) => { setOcupado(true); try { await f(); avisar(); } catch (e) { alert(erroDe(e)); } finally { setOcupado(false); } };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <select value={etapa} onChange={e => { setEtapa(e.target.value); if (rodandoAqui) acao(() => apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: implantacao.id, etapa: e.target.value })); }}
        className="ps-input" style={{ fontSize: 12, padding: '4px 6px', width: 'auto' }} title="Etapa em que você está trabalhando">
        {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
      </select>
      {rodandoAqui ? (
        <button disabled={ocupado} onClick={() => acao(() => apiClient.pausarCronometro())} style={btn('#dc2626')}><Pause size={12} /> Pausar</button>
      ) : (
        <button disabled={ocupado} onClick={() => acao(() => apiClient.playCronometro({ tipo: 'DEMANDA', implantacao_id: implantacao.id, etapa }))} style={btn('#16a34a')}
          title={sessao ? 'Pausa o que está rodando e começa aqui' : 'Começar a trabalhar nesta demanda'}><Play size={12} /> Play</button>
      )}
      <button onClick={() => setEspera(true)} style={btn('#d97706', false)} title="A demanda ficou parada esperando algo"><Hourglass size={12} /> Espera</button>
      {espera && <ModalEspera implantacao={implantacao} onClose={() => setEspera(false)} />}
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
    if (motivo.trim().length < 3) return alert('Conte o motivo da espera.');
    setSalvando(true);
    try {
      await apiClient.abrirEspera(implantacao.id, { tipo, motivo: motivo.trim(), o_que_resolver: resolver.trim() || undefined, responsavel_nome: tipo === 'PROGRAMACAO' ? com.trim() || undefined : undefined });
      avisar(); onClose();
    } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'left' }} onClick={onClose}>
      <div style={{ background: 'var(--t-card-bg)', borderRadius: 16, width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--t-text-primary)' }}>Demanda em espera</div>
            <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{implantacao.cliente_razao_social}</div>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--t-text-muted)' }} /></button>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {ESPERAS.map(e => (
              <label key={e.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${tipo === e.key ? '#d97706' : 'var(--t-card-border)'}`, background: tipo === e.key ? '#d9770610' : 'transparent' }}>
                <input type="radio" checked={tipo === e.key} onChange={() => setTipo(e.key)} style={{ marginTop: 3 }} />
                <span><b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{e.label}</b><br /><span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{e.dica}</span></span>
              </label>
            ))}
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>Motivo
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

/** Aba "Meu dia": tempo do dia, sessões e esperas abertas (gestão escolhe o técnico). */
export function PainelMeuDia({ gestao }: { gestao: boolean }) {
  const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [tecnicoId, setTecnicoId] = useState('');
  const [dia, setDia] = useState<any | null>(null);
  const [esperas, setEsperas] = useState<any[]>([]);
  const carregar = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([apiClient.getDiaTecnico({ data, tecnico_id: tecnicoId || undefined }), apiClient.getEsperasAbertas()]);
      setDia(d.data.data); setEsperas(e.data.data || []);
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
      <div style={{ fontSize: 22, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
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
          {card('Na jornada', `${fmtDur(r.dentro_ms)} de ${fmtDur(r.jornada_ms)}`, '#2E6EAB', r.virada ? 'Dia de virada: jornada a partir das 7h' : 'Jornada 8h às 18h, 1h de almoço')}
          {card('Aproveitamento', r.aproveitamento == null ? '—' : `${Math.round(r.aproveitamento * 100)}%`, r.aproveitamento == null ? 'var(--t-text-muted)' : r.aproveitamento >= 0.75 ? '#16a34a' : r.aproveitamento >= 0.5 ? '#d97706' : '#dc2626', 'Tempo registrado dentro da jornada ÷ horas da jornada')}
          {card('Hora extra', fmtDur(r.extra_ms), r.extra_ms ? '#7c3aed' : 'var(--t-text-muted)', 'Fora do horário (noite, madrugada, fim de semana)')}
        </div>
      )}
      <div className="ps-card rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-card-border)' }}>
        <div style={{ padding: '10px 14px', fontWeight: 800, fontSize: 13, color: 'var(--t-text-primary)', borderBottom: '1px solid var(--t-card-border)' }}>Registros do dia</div>
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
        <div style={{ padding: '10px 14px', fontWeight: 800, fontSize: 13, color: 'var(--t-text-primary)', borderBottom: '1px solid var(--t-card-border)' }}>Esperas abertas</div>
        {esperas.length === 0 && <div style={{ padding: 18, color: 'var(--t-text-muted)', fontSize: 13 }}>Nenhuma demanda parada.</div>}
        {esperas.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--t-card-border)', fontSize: 13, alignItems: 'center' }}>
            <Hourglass size={14} color="#d97706" />
            <span style={{ flex: 1 }}>
              <b style={{ color: 'var(--t-text-primary)' }}>{e.implantacao?.cliente_razao_social}</b> · {NOME_ESPERA[e.tipo]}{e.responsavel_nome ? ` (${e.responsavel_nome})` : ''}
              <br /><span style={{ color: 'var(--t-text-muted)' }}>{e.motivo}{e.o_que_resolver ? ` · Precisa: ${e.o_que_resolver}` : ''}</span>
            </span>
            <span style={{ color: '#d97706', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDur(Date.now() - new Date(e.inicio).getTime())}</span>
            <button onClick={() => resolver(e.id)} style={btn('#16a34a')}><CheckCircle size={12} /> Resolvido</button>
          </div>
        ))}
      </div>
    </div>
  );
}
