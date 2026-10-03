'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, Circle, ClipboardList, Bell, AlertTriangle, Hourglass, Rocket, GraduationCap, Loader2, Send, UserX, Clock, CalendarDays } from 'lucide-react';
import { fmtDur } from './Cronometro';
import { ConfirmarLeitura, RadarLeitura } from './ConfirmarLeitura';

// Início do Portal Técnico: saudação e frase do dia, como está o meu dia, tarefas avulsas,
// recados da gestão e o que pede atenção agora. A gestão também cria tarefas e recados daqui.

const erroDe = (e: any) => e?.response?.data?.message || 'Não foi possível agora. Tente de novo.';
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '');
const cartao: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, display: 'flex', flexDirection: 'column', minWidth: 0 };
const titulo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--t-text-primary)', padding: '14px 16px 10px' };
const ICONE_ATENCAO: Record<string, { Icon: any; cor: string }> = {
  ESTOURADO: { Icon: AlertTriangle, cor: '#dc2626' }, RISCO: { Icon: Clock, cor: '#d97706' }, ESPERA: { Icon: Hourglass, cor: '#a16207' },
  VIRADA: { Icon: Rocket, cor: '#7c3aed' }, TREINO: { Icon: GraduationCap, cor: '#0891b2' }, SEM_TECNICO: { Icon: UserX, cor: '#dc2626' },
};

export function PainelInicio({ gestao, irPara }: { gestao: boolean; irPara: (tab: string, demandaId?: string) => void }) {
  const [d, setD] = useState<any | null>(null);
  const [aberto, setAberto] = useState<any | null>(null);
  const carregar = useCallback(async () => { try { const r = await apiClient.getInicioPortal(); setD(r.data.data); } catch { /* sem login */ } }, []);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    const ev = () => carregar();
    window.addEventListener('cronometro:mudou', ev); window.addEventListener('avisos:mudou', ev);
    return () => { clearInterval(t); window.removeEventListener('cronometro:mudou', ev); window.removeEventListener('avisos:mudou', ev); };
  }, [carregar]);

  if (!d) return <div style={{ padding: 30, color: 'var(--t-text-muted)' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>;

  const abertas = d.tarefas.filter((t: any) => !t.concluida_em);
  const feitas = d.tarefas.filter((t: any) => t.concluida_em);
  const naoLidos = d.recados.filter((r: any) => !r.lido_em);
  const pct = d.hoje.aproveitamento == null ? null : Math.round(d.hoje.aproveitamento * 100);
  const concluir = async (t: any, reabrir = false) => { try { await apiClient.concluirTarefa(t.id, reabrir); window.dispatchEvent(new Event('avisos:mudou')); carregar(); } catch (e) { alert(erroDe(e)); } };

  return (
    <div style={{ display: 'grid', gap: 18, width: '100%' }}>
      {/* Saudação e frase do dia */}
      <style>{`
        .pt-inicio-grade { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        @media (max-width: 1500px) { .pt-inicio-grade { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) { .pt-inicio-grade { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <section style={{ borderRadius: 16, padding: 'clamp(16px, 2.5vw, 28px)', background: 'linear-gradient(135deg,#0D2238 0%,#1A4E82 55%,#2E6EAB 100%)', color: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{d.saudacao}</div>
        <blockquote style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: '#D6E6F7', maxWidth: '64ch', borderLeft: '3px solid #90BEF0', paddingLeft: 12 }}>{d.frase}</blockquote>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: '#A8C8E8', marginTop: 4 }}>
          <span>📋 <b style={{ color: '#fff' }}>{abertas.length}</b> tarefa(s) aberta(s)</span>
          <span>📌 <b style={{ color: '#fff' }}>{naoLidos.length}</b> recado(s) novo(s)</span>
          <span>🛠️ <b style={{ color: '#fff' }}>{d.demandas_ativas}</b> demanda(s) {gestao ? 'em andamento' : 'com você'}</span>
          {d.hoje.virada && <span>🚀 <b style={{ color: '#fff' }}>Dia de virada</b> (jornada desde as 7h)</span>}
        </div>
      </section>

      {/* Agenda: viradas e treinamentos combinados com os clientes (próximos 14 dias) */}
      <section style={cartao}>
        <div style={titulo}><CalendarDays size={16} color="#2E6EAB" /> Agenda {gestao ? 'da equipe' : ''}<span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' }}>próximos 14 dias</span></div>
        <div style={{ padding: '0 16px 14px', display: 'grid' }}>
          {(!d.agenda || d.agenda.length === 0) && <div style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: '6px 0' }}>Nada agendado. Agende a virada na aba Virada do card e marque as fases do treinamento.</div>}
          {(d.agenda || []).map((a: any, k: number) => {
            const dt = new Date(a.quando);
            const ehHoje = new Date(dt.getTime() - 3 * 3600000).toISOString().slice(0, 10) === new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
            return (
              <button key={`${a.implantacao_id}-${k}`} onClick={() => irPara('quadro', a.implantacao_id)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 2px', minHeight: 44, border: 'none', borderTop: k ? '1px solid var(--t-card-border)' : 'none', background: 'transparent', cursor: 'pointer' }}>
                <span style={{ width: 92, flexShrink: 0, fontSize: 13, fontWeight: 600, color: ehHoje ? '#2E6EAB' : 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums', textTransform: 'capitalize' }}>
                  {ehHoje ? 'Hoje' : dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' })}{!a.dia_todo && <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' }}>{dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span>}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)' }}>{a.tipo === 'VIRADA' ? '🚀 ' : '🎓 '}{a.titulo}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--t-text-muted)' }}>{a.cliente}{gestao && a.tecnico ? ` · ${a.tecnico.split(' ')[0]}` : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="pt-inicio-grade" style={{ display: 'grid', gap: 18, alignItems: 'stretch' }}>
        {/* Tarefas */}
        <section style={cartao}>
          <div style={{ ...titulo, justifyContent: 'space-between' }}><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ClipboardList size={16} color="#2E6EAB" /> {gestao ? 'Tarefas avulsas da equipe' : 'Minhas tarefas'}</span></div>
          <div style={{ padding: '0 16px 14px', display: 'grid', gap: 6 }}>
            {abertas.length === 0 && <div style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: '6px 0' }}>Nenhuma tarefa aberta. {gestao ? 'Crie uma abaixo.' : 'Tudo em dia! 🎉'}</div>}
            {abertas.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: t.atrasada ? '#dc26260d' : 'var(--t-content-bg)' }}>
                <button onClick={() => concluir(t)} title="Marcar como concluída" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginTop: 1 }}><Circle size={18} color={t.prioridade === 'URGENTE' ? '#dc2626' : '#2E6EAB'} /></button>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <div style={{ color: 'var(--t-text-primary)', fontWeight: 600 }}>{t.texto}</div>
                  <div style={{ fontSize: 11, color: t.atrasada ? '#dc2626' : 'var(--t-text-muted)', marginTop: 2 }}>
                    {t.prazo ? `${t.atrasada ? 'Atrasada · ' : ''}prazo ${fmtData(t.prazo)}` : 'sem prazo'}{t.prioridade === 'URGENTE' ? ' · urgente' : ''}{t.implantacao ? ` · ${t.implantacao.cliente_razao_social}` : ''}{gestao ? ` · para ${t.para_nome?.split(' ')[0]}` : ` · de ${t.de_nome?.split(' ')[0] || 'Gestão'}`}
                  </div>
                </div>
              </div>
            ))}
            {feitas.length > 0 && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ fontSize: 12, color: 'var(--t-text-muted)', cursor: 'pointer' }}>Concluídas nos últimos 3 dias ({feitas.length})</summary>
                {feitas.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', fontSize: 13, color: 'var(--t-text-muted)' }}>
                    <button onClick={() => concluir(t, true)} title="Reabrir" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}><CheckCircle size={17} color="#16a34a" /></button>
                    <span style={{ textDecoration: 'line-through' }}>{t.texto}</span>
                  </div>
                ))}
              </details>
            )}
          </div>
        </section>

        {/* Meu dia */}
        <section style={cartao}>
          <div style={titulo}><Clock size={16} color="#2E6EAB" /> Meu dia</div>
          <div style={{ padding: '0 16px 16px', display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[['Trabalhado', fmtDur(d.hoje.trabalhado_ms)], ['Na jornada', `${fmtDur(d.hoje.dentro_ms)}`], ['Hora extra', fmtDur(d.hoje.extra_ms)]].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--t-content-bg)', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{l}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 4 }}>
                <span>Aproveitamento da jornada ({fmtDur(d.hoje.jornada_ms)})</span><b style={{ color: 'var(--t-text-primary)' }}>{pct == null ? 'fim de semana' : `${pct}%`}</b>
              </div>
              <div style={{ height: 8, background: 'var(--t-content-bg)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${pct || 0}%`, height: '100%', borderRadius: 99, background: (pct || 0) >= 75 ? '#16a34a' : (pct || 0) >= 50 ? '#d97706' : '#2E6EAB', transition: 'width .4s' }} />
              </div>
            </div>
            <button onClick={() => irPara('meudia')} style={{ justifySelf: 'start', fontSize: 12, fontWeight: 700, color: '#2E6EAB', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>Ver registros do dia →</button>
          </div>
        </section>

        {/* Atenção agora */}
        <section style={cartao}>
          <div style={titulo}><AlertTriangle size={16} color="#d97706" /> Pede atenção agora</div>
          <div style={{ padding: '0 16px 14px', display: 'grid', gap: 6 }}>
            {d.atencao.length === 0 && <div style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: '6px 0' }}>Nada atrasado nem parado. 👍</div>}
            {d.atencao.map((a: any, k: number) => {
              const { Icon, cor } = ICONE_ATENCAO[a.tipo] || ICONE_ATENCAO.RISCO;
              return (
                <button key={k} onClick={() => irPara('quadro', a.implantacao_id)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: 'none', background: 'var(--t-content-bg)', cursor: 'pointer', fontSize: 13, color: 'var(--t-text-primary)' }}>
                  <Icon size={15} color={cor} style={{ flexShrink: 0, marginTop: 2 }} /><span>{a.texto}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recados */}
        <section style={cartao}>
          <div style={titulo}><Bell size={16} color="#2E6EAB" /> Recados</div>
          <div style={{ padding: '0 16px 14px', display: 'grid', gap: 6 }}>
            {d.recados.length === 0 && <div style={{ fontSize: 13, color: 'var(--t-text-muted)', padding: '6px 0' }}>Nenhum recado novo.</div>}
            {d.recados.map((r: any) => (
              <button key={r.id} type="button" onClick={() => setAberto(r)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', minHeight: 44, background: r.lido_em ? 'transparent' : '#2E6EAB0d' }}>
                {r.prioridade === 'URGENTE' ? <AlertTriangle size={15} color="#dc2626" style={{ marginTop: 2 }} /> : <Bell size={15} color="#2E6EAB" style={{ marginTop: 2 }} />}
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <div style={{ color: 'var(--t-text-primary)', fontWeight: r.lido_em ? 400 : 700 }}>{r.texto}</div>
                  <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>de {r.de_nome || 'Gestão'}{r.implantacao ? ` · ${r.implantacao.cliente_razao_social}` : ''} · {fmtData(r.created_at)}</div>
                </div>
                {!r.lido_em && <span style={{ fontSize: 11, fontWeight: 700, color: '#2E6EAB', whiteSpace: 'nowrap' }}>Ler</span>}
              </button>
            ))}
          </div>
        </section>
      </div>

      {gestao && <RadarLeitura />}
      {gestao && <NovaTarefaOuRecado onEnviado={carregar} />}
      <ConfirmarLeitura aviso={aberto} onFechar={() => { setAberto(null); carregar(); }} />
    </div>
  );
}

/** Gestão: cria uma tarefa avulsa (com prazo) ou um recado para o técnico. */
function NovaTarefaOuRecado({ onEnviado }: { onEnviado: () => void }) {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [tipo, setTipo] = useState<'TAREFA' | 'AVISO'>('TAREFA');
  const [para, setPara] = useState('');
  const [texto, setTexto] = useState('');
  const [prazo, setPrazo] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState('');
  useEffect(() => { apiClient.getTecnicosImplantacao().then(r => { const l = r.data.data || []; setTecnicos(l); if (l.length === 1) setPara(l[0].id); }).catch(() => {}); }, []);
  const enviar = async () => {
    if (!para || texto.trim().length < 2) return alert('Escolha o técnico e escreva o texto.');
    setEnviando(true);
    try {
      await apiClient.enviarAvisoTecnico({ para_id: para, texto: texto.trim(), prioridade: urgente ? 'URGENTE' : 'NORMAL', tipo, prazo: tipo === 'TAREFA' && prazo ? prazo : null });
      setTexto(''); setPrazo(''); setUrgente(false); setOk(tipo === 'TAREFA' ? 'Tarefa criada.' : 'Recado enviado.'); setTimeout(() => setOk(''), 2500); onEnviado();
    } catch (e) { alert(erroDe(e)); } finally { setEnviando(false); }
  };
  const aba = (v: 'TAREFA' | 'AVISO', t: string) => (
    <button onClick={() => setTipo(v)} style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${tipo === v ? '#2E6EAB' : 'var(--t-card-border)'}`, background: tipo === v ? '#2E6EAB14' : 'transparent', color: tipo === v ? '#2E6EAB' : 'var(--t-text-secondary)' }}>{t}</button>
  );
  return (
    <section style={{ ...cartao, padding: 16, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14, color: 'var(--t-text-primary)', marginRight: 6 }}>Para o técnico</b>
        {aba('TAREFA', '📋 Tarefa avulsa')}{aba('AVISO', '📌 Recado')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select id="nt-para" value={para} onChange={e => setPara(e.target.value)} className="ps-input" style={{ width: 'auto' }}><option value="">Técnico…</option>{tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
        {tipo === 'TAREFA' && <label style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>Prazo <input id="nt-prazo" type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="ps-input" style={{ width: 'auto' }} /></label>}
        <label style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}><input id="nt-urgente" type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} /> Urgente (avisa também no WhatsApp)</label>
      </div>
      <textarea id="nt-texto" rows={2} value={texto} onChange={e => setTexto(e.target.value)} className="ps-input w-full" placeholder={tipo === 'TAREFA' ? 'Ex.: atualizar o certificado digital da Drogaria X' : 'Ex.: amanhã a reunião da equipe é às 9h'} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button disabled={enviando} onClick={enviar} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', background: '#2E6EAB', border: 'none', borderRadius: 10, padding: '9px 14px', cursor: 'pointer' }}>
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {tipo === 'TAREFA' ? 'Criar tarefa' : 'Enviar recado'}
        </button>
        {ok && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{ok}</span>}
      </div>
    </section>
  );
}
