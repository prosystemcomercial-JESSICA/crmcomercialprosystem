'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { CalendarCheck, Plus, X, Loader2, CheckCircle, Bell, Phone, Link2, ExternalLink } from 'lucide-react';

/**
 * Agenda do técnico (12/11/2026, pedido da Jessica): o técnico marca reuniões, ligações, acessos remotos e visitas com o
 * cliente (pelo menu Agenda ou dentro do card) e recebe o alerta no WhatsApp dele na hora escolhida.
 * O alerta é só para o técnico: nada é enviado ao cliente.
 */

const erroDe = (e: any) => e?.response?.data?.message || 'Não foi possível agora. Tente de novo.';
const cartao: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10 };
const btn = (cor: string, cheio = true): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, borderRadius: 8, padding: '8px 14px', minHeight: 38, cursor: 'pointer',
  border: cheio ? 'none' : `1px solid ${cor}55`, background: cheio ? cor : 'transparent', color: cheio ? '#fff' : cor,
});
const rotuloCampo: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--t-text-secondary)' };

const TIPOS: Record<string, { label: string; emoji: string }> = {
  REUNIAO: { label: 'Reunião', emoji: '🤝' }, LIGACAO: { label: 'Ligação', emoji: '📞' }, ACESSO_REMOTO: { label: 'Acesso remoto', emoji: '💻' },
  VISITA: { label: 'Visita', emoji: '🚗' }, TREINAMENTO: { label: 'Treinamento', emoji: '🎓' }, OUTRO: { label: 'Outro', emoji: '📌' },
};
const AVISOS: [number, string][] = [[0, 'Na hora'], [5, '5 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [120, '2 horas antes'], [1440, '1 dia antes']];
const DURACOES: [number, string][] = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas'], [180, '3 horas'], [240, '4 horas']];

const TZ = 'America/Sao_Paulo';
const diaSP = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // AAAA-MM-DD
const horaSP = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const soDigitos = (s?: string | null) => String(s || '').replace(/\D/g, '');
const linkWhats = (fone?: string | null) => { const n = soDigitos(fone); return n.length >= 10 ? `https://wa.me/${n.length <= 11 ? `55${n}` : n}` : null; };

function rotuloDia(dia: string, hoje: string, amanha: string) {
  if (dia === hoje) return 'Hoje';
  if (dia === amanha) return 'Amanhã';
  const d = new Date(`${dia}T12:00:00-03:00`);
  const t = d.toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function situacaoAlerta(c: any): { txt: string; cor: string } | null {
  if (c.status !== 'AGENDADO') return null;
  if (c.alerta_status === 'ENVIADO') return { txt: 'Alerta enviado no WhatsApp', cor: '#16a34a' };
  if (c.alerta_status === 'SEM_TELEFONE') return { txt: 'Alerta só no portal: cadastro do técnico sem celular', cor: '#b45309' };
  if (c.alerta_status === 'FALHOU') return { txt: 'O WhatsApp não saiu (alerta ficou no portal)', cor: '#dc2626' };
  return { txt: `Alerta no WhatsApp: ${(AVISOS.find(a => a[0] === c.avisar_antes_min)?.[1] || 'na hora').toLowerCase()}`, cor: 'var(--t-text-muted)' };
}

// ─── Um compromisso na lista ──────────────────────────────────────────────────
function ItemCompromisso({ c, mostrarCliente, mostrarTecnico, onEditar, onMudou, onAbrirDemanda }: {
  c: any; mostrarCliente: boolean; mostrarTecnico: boolean; onEditar: (c: any) => void; onMudou: () => void; onAbrirDemanda?: (id: string) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const inicio = new Date(c.inicio);
  const fim = new Date(inicio.getTime() + (c.duracao_min || 60) * 60000);
  const tipo = TIPOS[c.tipo] || TIPOS.OUTRO;
  const atrasado = c.status === 'AGENDADO' && fim.getTime() < Date.now();
  const alerta = situacaoAlerta(c);
  const whats = linkWhats(c.contato_fone);
  const mudar = async (status: 'REALIZADO' | 'CANCELADO' | 'AGENDADO') => {
    let resultado: string | undefined;
    if (status === 'REALIZADO') {
      const r = window.prompt('O que ficou combinado? (opcional, vai para o histórico do card)', '');
      if (r === null) return;
      resultado = r.trim() || undefined;
    }
    if (status === 'CANCELADO') {
      const r = window.prompt('Motivo do cancelamento (opcional)', '');
      if (r === null) return;
      resultado = r.trim() || undefined;
    }
    setSalvando(true);
    try { await apiClient.agendaTecnicoStatus(c.id, status, resultado); onMudou(); } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };
  const encerrado = c.status !== 'AGENDADO';
  return (
    <div className="ag-item" data-status={c.status} style={{ ...cartao, padding: '12px 14px', display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 12, opacity: encerrado ? 0.65 : 1, ...(atrasado ? { borderLeft: '3px solid #d97706' } : {}) }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{horaSP(inicio)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--t-text-muted)', fontVariantNumeric: 'tabular-nums' }}>até {horaSP(fim)}</div>
      </div>
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#286397' }}>{tipo.emoji} {tipo.label}</span>
          {mostrarCliente && c.cliente_nome && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-primary)', overflowWrap: 'anywhere' }}>{c.cliente_nome}</span>}
          {c.status === 'REALIZADO' && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>✓ Realizado</span>}
          {c.status === 'CANCELADO' && <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Cancelado</span>}
          {atrasado && <span style={{ fontSize: 12, fontWeight: 600, color: '#b45309' }}>Passou do horário: marque como foi</span>}
        </div>
        <div style={{ fontSize: 14, color: 'var(--t-text-primary)', overflowWrap: 'anywhere', textDecoration: c.status === 'CANCELADO' ? 'line-through' : 'none' }}>{c.titulo}</div>
        {(c.contato_nome || c.contato_fone || c.link) && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--t-text-secondary)' }}>
            {(c.contato_nome || c.contato_fone) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={13} />{[c.contato_nome, c.contato_fone].filter(Boolean).join(' · ')}
                {whats && <a href={whats} target="_blank" rel="noreferrer" style={{ color: '#16a34a', fontWeight: 600, marginLeft: 4 }}>WhatsApp</a>}
              </span>
            )}
            {c.link && <a href={c.link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#286397', overflowWrap: 'anywhere' }}><Link2 size={13} />Abrir link da reunião</a>}
          </div>
        )}
        {c.descricao && <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.descricao}</div>}
        {c.resultado && <div style={{ fontSize: 13, color: 'var(--t-text-secondary)', whiteSpace: 'pre-wrap' }}><b style={{ fontWeight: 600 }}>{c.status === 'CANCELADO' ? 'Motivo' : 'Combinado'}:</b> {c.resultado}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
          {alerta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: alerta.cor }}><Bell size={12} />{alerta.txt}</span>}
          {mostrarTecnico && c.tecnico_nome && <span style={{ color: 'var(--t-text-muted)' }}>Técnico: {c.tecnico_nome}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {!encerrado ? (
            <>
              <button disabled={salvando} onClick={() => mudar('REALIZADO')} style={{ ...btn('#16a34a', false), minHeight: 34, padding: '6px 12px' }}><CheckCircle size={14} /> Realizado</button>
              <button disabled={salvando} onClick={() => onEditar(c)} style={{ ...btn('#286397', false), minHeight: 34, padding: '6px 12px' }}>Remarcar / editar</button>
              <button disabled={salvando} onClick={() => mudar('CANCELADO')} style={{ ...btn('#64748b', false), minHeight: 34, padding: '6px 12px' }}>Cancelar</button>
            </>
          ) : (
            <button disabled={salvando} onClick={() => mudar('AGENDADO')} style={{ ...btn('#64748b', false), minHeight: 34, padding: '6px 12px' }}>Reabrir</button>
          )}
          {onAbrirDemanda && c.implantacao_id && <button onClick={() => onAbrirDemanda(c.implantacao_id)} style={{ ...btn('#286397', false), minHeight: 34, padding: '6px 12px' }}><ExternalLink size={14} /> Abrir o card</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Formulário (novo ou editar) ──────────────────────────────────────────────
export function FormCompromisso({ inicial, card, contatos, gestao, onSalvo, onFechar }: {
  inicial?: any | null;
  card?: { id: string; cliente: string; tecnico_id?: string | null } | null;
  contatos?: { nome: string | null; fone: string }[];
  gestao: boolean; onSalvo: () => void; onFechar: () => void;
}) {
  const editando = !!inicial?.id;
  const agora = new Date();
  const proximaHora = new Date(Math.ceil(agora.getTime() / 3600000) * 3600000);
  const ini = inicial?.inicio ? new Date(inicial.inicio) : proximaHora;
  const [tipo, setTipo] = useState<string>(inicial?.tipo || 'REUNIAO');
  const [titulo, setTitulo] = useState<string>(inicial?.titulo || '');
  const [dia, setDia] = useState<string>(diaSP(ini));
  const [hora, setHora] = useState<string>(horaSP(ini));
  const [duracao, setDuracao] = useState<number>(inicial?.duracao_min || 60);
  const [aviso, setAviso] = useState<number>(inicial?.avisar_antes_min ?? 15);
  const [contatoNome, setContatoNome] = useState<string>(inicial?.contato_nome ?? (contatos?.[0]?.nome || ''));
  const [contatoFone, setContatoFone] = useState<string>(inicial?.contato_fone ?? (contatos?.[0]?.fone || ''));
  const [link, setLink] = useState<string>(inicial?.link || '');
  const [descricao, setDescricao] = useState<string>(inicial?.descricao || '');
  const [tecnicoId, setTecnicoId] = useState<string>(inicial?.tecnico_id || card?.tecnico_id || '');
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  // Sem card fixo: escolhe um dos cards (do técnico) ou digita o nome do cliente.
  const [cards, setCards] = useState<any[]>([]);
  const [cardId, setCardId] = useState<string>(inicial?.implantacao_id || '');
  const [clienteLivre, setClienteLivre] = useState<string>(!inicial?.implantacao_id ? (inicial?.cliente_nome || '') : '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (gestao) apiClient.getTecnicosImplantacao().then(r => setTecnicos(r.data.data || [])).catch(() => {}); }, [gestao]);
  useEffect(() => {
    if (card || editando) return;
    apiClient.getQuadroImplantacao().then(r => setCards((r.data.data?.cards || []).filter((c: any) => !['FINALIZADO', 'CANCELADOS'].includes(c.coluna)))).catch(() => {});
  }, [card, editando]);

  const salvar = async () => {
    if (!titulo.trim()) return alert('Escreva o assunto do compromisso.');
    if (!dia || !hora) return alert('Escolha a data e a hora.');
    setSalvando(true);
    const dados: any = {
      tipo, titulo: titulo.trim(), inicio: `${dia}T${hora}`, duracao_min: duracao, avisar_antes_min: aviso,
      contato_nome: contatoNome, contato_fone: contatoFone, link, descricao,
      ...(gestao && tecnicoId ? { tecnico_id: tecnicoId } : {}),
    };
    if (!editando) {
      if (card) dados.implantacao_id = card.id;
      else if (cardId) dados.implantacao_id = cardId;
      else dados.cliente_nome = clienteLivre;
    } else if (!inicial.implantacao_id) dados.cliente_nome = clienteLivre;
    try {
      const r = editando ? await apiClient.agendaTecnicoEditar(inicial.id, dados) : await apiClient.agendaTecnicoCriar(dados);
      if (r.data?.sem_telefone) alert('Compromisso salvo. Atenção: o cadastro do técnico está sem celular, então o alerta aparece só no portal. Coloque o celular em Usuários para receber no WhatsApp.');
      onSalvo();
    } catch (e) { alert(erroDe(e)); } finally { setSalvando(false); }
  };

  const quandoAviso = (() => {
    const t = new Date(`${dia}T${hora || '00:00'}:00-03:00`).getTime() - aviso * 60000;
    if (isNaN(t)) return '';
    const d = new Date(t);
    return `Você recebe o alerta no WhatsApp ${aviso === 0 ? 'na hora marcada' : `em ${d.toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')}`}.`;
  })();

  return (
    <div role="dialog" aria-modal="true" aria-label={editando ? 'Editar compromisso' : 'Novo compromisso'} onClick={onFechar}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 12px' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...cartao, width: 'min(600px, 100%)', padding: 20, display: 'grid', gap: 14, boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--t-text-primary)' }}>{editando ? 'Remarcar / editar compromisso' : 'Novo compromisso com o cliente'}</h3>
          <button onClick={onFechar} aria-label="Fechar" style={{ width: 38, height: 38, border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={20} style={{ color: 'var(--t-text-muted)' }} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Tipo">
          {Object.entries(TIPOS).map(([k, v]) => (
            <button key={k} role="radio" aria-checked={tipo === k} onClick={() => setTipo(k)}
              style={{ fontSize: 13, fontWeight: tipo === k ? 600 : 500, padding: '7px 12px', minHeight: 38, borderRadius: 8, cursor: 'pointer', border: `1px solid ${tipo === k ? '#286397' : 'var(--t-card-border)'}`, background: tipo === k ? 'var(--t-primary-light)' : 'transparent', color: tipo === k ? 'var(--t-link)' : 'var(--t-text-secondary)' }}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>

        {card ? (
          <div style={{ fontSize: 14, color: 'var(--t-text-secondary)' }}>Cliente: <b style={{ color: 'var(--t-text-primary)', fontWeight: 600 }}>{card.cliente}</b></div>
        ) : editando && inicial.implantacao_id ? (
          <div style={{ fontSize: 14, color: 'var(--t-text-secondary)' }}>Cliente: <b style={{ color: 'var(--t-text-primary)', fontWeight: 600 }}>{inicial.cliente_nome}</b></div>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {!editando && (
              <label style={rotuloCampo}>Cliente (card)
                <select value={cardId} onChange={e => setCardId(e.target.value)} className="ps-input" style={{ minHeight: 40 }}>
                  <option value="">Sem card / outro cliente</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.cliente_razao_social}</option>)}
                </select>
              </label>
            )}
            {!cardId && <label style={rotuloCampo}>Nome do cliente<input value={clienteLivre} onChange={e => setClienteLivre(e.target.value)} placeholder="Ex.: Farmácia São José" className="ps-input" style={{ minHeight: 40 }} /></label>}
          </div>
        )}

        <label style={rotuloCampo}>Assunto
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Alinhar a data da virada" maxLength={200} className="ps-input" style={{ minHeight: 40 }} autoFocus />
        </label>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <label style={rotuloCampo}>Dia<input type="date" value={dia} onChange={e => setDia(e.target.value)} className="ps-input" style={{ minHeight: 40 }} /></label>
          <label style={rotuloCampo}>Hora<input type="time" value={hora} onChange={e => setHora(e.target.value)} className="ps-input" style={{ minHeight: 40 }} /></label>
          <label style={rotuloCampo}>Duração
            <select value={duracao} onChange={e => setDuracao(Number(e.target.value))} className="ps-input" style={{ minHeight: 40 }}>
              {DURACOES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label style={rotuloCampo}>Alerta no WhatsApp
            <select value={aviso} onChange={e => setAviso(Number(e.target.value))} className="ps-input" style={{ minHeight: 40 }}>
              {AVISOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        {quandoAviso && <div style={{ fontSize: 12.5, color: 'var(--t-text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}><Bell size={13} />{quandoAviso}</div>}

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label style={rotuloCampo}>Falar com
            {contatos && contatos.length > 1 && !editando ? (
              <select value={`${contatoNome}|${contatoFone}`} onChange={e => { const [n, f] = e.target.value.split('|'); setContatoNome(n); setContatoFone(f); }} className="ps-input" style={{ minHeight: 40 }}>
                {contatos.map((c, k) => <option key={k} value={`${c.nome || ''}|${c.fone}`}>{c.nome ? `${c.nome} · ${c.fone}` : c.fone}</option>)}
                <option value="|">Outro contato…</option>
              </select>
            ) : <input value={contatoNome} onChange={e => setContatoNome(e.target.value)} placeholder="Nome do contato" className="ps-input" style={{ minHeight: 40 }} />}
          </label>
          <label style={rotuloCampo}>Telefone do contato<input value={contatoFone} onChange={e => setContatoFone(e.target.value)} placeholder="(27) 99999-9999" inputMode="tel" className="ps-input" style={{ minHeight: 40 }} /></label>
        </div>
        {contatos && contatos.length > 1 && !editando && !contatoFone && (
          <label style={rotuloCampo}>Nome do contato<input value={contatoNome} onChange={e => setContatoNome(e.target.value)} className="ps-input" style={{ minHeight: 40 }} /></label>
        )}

        <label style={rotuloCampo}>Link da reunião (opcional)<input value={link} onChange={e => setLink(e.target.value)} placeholder="Meet, Zoom, AnyDesk…" className="ps-input" style={{ minHeight: 40 }} /></label>
        <label style={rotuloCampo}>Anotação (opcional)<textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} placeholder="O que levar, o que perguntar…" className="ps-input" style={{ resize: 'vertical' }} /></label>

        {gestao && (
          <label style={rotuloCampo}>Técnico que recebe o alerta
            <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} className="ps-input" style={{ minHeight: 40 }}>
              <option value="">{card?.tecnico_id ? 'Técnico do card' : 'Eu mesmo(a)'}</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
        )}

        <div style={{ fontSize: 12.5, color: 'var(--t-text-muted)' }}>O alerta vai só para o WhatsApp do técnico (e para o sino do portal). O cliente não recebe mensagem.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onFechar} style={btn('#64748b', false)}>Voltar</button>
          <button disabled={salvando} onClick={salvar} style={btn('#286397')}>{salvando ? <Loader2 className="animate-spin" size={14} /> : <CalendarCheck size={14} />} {editando ? 'Salvar' : 'Agendar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Lista agrupada por dia ───────────────────────────────────────────────────
function ListaPorDia({ lista, mostrarCliente, mostrarTecnico, onEditar, onMudou, onAbrirDemanda, vazio }: {
  lista: any[]; mostrarCliente: boolean; mostrarTecnico: boolean; onEditar: (c: any) => void; onMudou: () => void; onAbrirDemanda?: (id: string) => void; vazio: string;
}) {
  const hoje = diaSP(new Date());
  const amanha = diaSP(new Date(Date.now() + 864e5));
  const grupos = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of lista) { const k = diaSP(new Date(c.inicio)); m.set(k, [...(m.get(k) || []), c]); }
    return Array.from(m.entries());
  }, [lista]);
  if (!lista.length) return <div style={{ ...cartao, padding: 22, textAlign: 'center', color: 'var(--t-text-secondary)', fontSize: 14 }}>{vazio}</div>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {grupos.map(([dia, itens]) => (
        <section key={dia} style={{ display: 'grid', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: dia === hoje ? '#286397' : 'var(--t-text-muted)' }}>{rotuloDia(dia, hoje, amanha)} <span style={{ fontWeight: 500 }}>· {itens.length}</span></h4>
          {itens.map(c => <ItemCompromisso key={c.id} c={c} mostrarCliente={mostrarCliente} mostrarTecnico={mostrarTecnico} onEditar={onEditar} onMudou={onMudou} onAbrirDemanda={onAbrirDemanda} />)}
        </section>
      ))}
    </div>
  );
}

// ─── Menu Agenda do Portal Técnico ────────────────────────────────────────────
export function PainelAgendaTecnico({ gestao, onAbrirDemanda }: { gestao: boolean; onAbrirDemanda?: (id: string) => void }) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [filtroTec, setFiltroTec] = useState('');
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [form, setForm] = useState<{ inicial: any | null } | null>(null);
  const carregar = useCallback(async () => {
    try { setLista((await apiClient.agendaTecnicoListar(filtroTec ? { tecnico_id: filtroTec } : {})).data.data || []); }
    catch (e) { setLista([]); alert(erroDe(e)); }
  }, [filtroTec]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (gestao) apiClient.getTecnicosImplantacao().then(r => setTecnicos(r.data.data || [])).catch(() => {}); }, [gestao]);

  const agora = Date.now();
  const todos = lista || [];
  const pendentesPassados = todos.filter(c => c.status === 'AGENDADO' && new Date(c.inicio).getTime() + (c.duracao_min || 60) * 60000 < agora);
  const proximos = todos.filter(c => c.status === 'AGENDADO' && !pendentesPassados.includes(c));
  const encerrados = todos.filter(c => c.status !== 'AGENDADO').reverse();
  const hoje = diaSP(new Date());
  const deHoje = proximos.filter(c => diaSP(new Date(c.inicio)) === hoje).length;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text-secondary)' }}>
            {lista === null ? 'Carregando…' : `${deHoje} hoje · ${proximos.length} próximos${pendentesPassados.length ? ` · ${pendentesPassados.length} para marcar como foi` : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {gestao && (
            <select value={filtroTec} onChange={e => setFiltroTec(e.target.value)} className="ps-input" style={{ width: 'auto', minHeight: 38 }} aria-label="Técnico">
              <option value="">Todos os técnicos</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          <button onClick={() => setForm({ inicial: null })} style={btn('#286397')}><Plus size={15} /> Novo compromisso</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
        Marque aqui as reuniões, ligações, acessos e visitas combinados com o cliente. Na hora escolhida você recebe o alerta no seu WhatsApp. Também dá para marcar dentro do card do cliente, na seção <b>Agenda com o cliente</b>.
      </div>
      {lista === null ? <Loader2 className="animate-spin" size={18} /> : (
        <>
          {pendentesPassados.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#b45309' }}>Já passaram: marque como foi</h3>
              {pendentesPassados.map(c => <ItemCompromisso key={c.id} c={c} mostrarCliente mostrarTecnico={gestao} onEditar={x => setForm({ inicial: x })} onMudou={carregar} onAbrirDemanda={onAbrirDemanda} />)}
            </div>
          )}
          <ListaPorDia lista={proximos} mostrarCliente mostrarTecnico={gestao} onEditar={x => setForm({ inicial: x })} onMudou={carregar} onAbrirDemanda={onAbrirDemanda}
            vazio="Nenhum compromisso marcado. Toque em Novo compromisso para agendar uma reunião ou ligação com o cliente." />
          {encerrados.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={() => setVerEncerrados(v => !v)} style={{ ...btn('#64748b', false), justifySelf: 'start' }}>{verEncerrados ? 'Esconder' : 'Ver'} realizados e cancelados ({encerrados.length})</button>
              {verEncerrados && encerrados.map(c => <ItemCompromisso key={c.id} c={c} mostrarCliente mostrarTecnico={gestao} onEditar={x => setForm({ inicial: x })} onMudou={carregar} onAbrirDemanda={onAbrirDemanda} />)}
            </div>
          )}
        </>
      )}
      {form && <FormCompromisso inicial={form.inicial} gestao={gestao} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); carregar(); }} />}
    </div>
  );
}

// ─── Seção "Agenda com o cliente" dentro do card ──────────────────────────────
export function AgendaDoCard({ implantacaoId, cliente, tecnicoId, contatos, gestao, onMudou }: {
  implantacaoId: string; cliente: string; tecnicoId?: string | null; contatos: { nome: string | null; fone: string }[]; gestao: boolean; onMudou?: () => void;
}) {
  const [lista, setLista] = useState<any[] | null>(null);
  const [form, setForm] = useState<{ inicial: any | null } | null>(null);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const carregar = useCallback(async () => {
    try { setLista((await apiClient.agendaTecnicoListar({ implantacao_id: implantacaoId })).data.data || []); }
    catch { setLista([]); }
  }, [implantacaoId]);
  useEffect(() => { carregar(); }, [carregar]);
  const mudou = () => { carregar(); onMudou?.(); };
  const abertos = (lista || []).filter(c => c.status === 'AGENDADO');
  const encerrados = (lista || []).filter(c => c.status !== 'AGENDADO').reverse();
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: 'var(--t-text-secondary)', flex: '1 1 260px' }}>Reuniões, ligações e acessos combinados com este cliente. O técnico recebe o alerta no WhatsApp na hora escolhida.</div>
        <button onClick={() => setForm({ inicial: null })} style={btn('#286397')}><Plus size={15} /> Agendar com o cliente</button>
      </div>
      {lista === null ? <Loader2 className="animate-spin" size={18} /> : (
        <>
          <ListaPorDia lista={abertos} mostrarCliente={false} mostrarTecnico={gestao} onEditar={x => setForm({ inicial: x })} onMudou={mudou} vazio="Nada agendado com este cliente." />
          {encerrados.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <button onClick={() => setVerEncerrados(v => !v)} style={{ ...btn('#64748b', false), justifySelf: 'start' }}>{verEncerrados ? 'Esconder' : 'Ver'} realizados e cancelados ({encerrados.length})</button>
              {verEncerrados && encerrados.map(c => <ItemCompromisso key={c.id} c={c} mostrarCliente={false} mostrarTecnico={gestao} onEditar={x => setForm({ inicial: x })} onMudou={mudou} />)}
            </div>
          )}
        </>
      )}
      {form && <FormCompromisso inicial={form.inicial} card={{ id: implantacaoId, cliente, tecnico_id: tecnicoId }} contatos={contatos} gestao={gestao}
        onFechar={() => setForm(null)} onSalvo={() => { setForm(null); mudou(); }} />}
    </div>
  );
}
