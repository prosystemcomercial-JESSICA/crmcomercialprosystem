'use client';

// Página pública do cliente: passo a passo da implantação/serviço, percentual e tempo dedicado.
// Sem login (link único). Não mostra esperas nem descrições internas.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' }) : null);
const fmtHoras = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`; };

export default function AcompanhamentoPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<any | null>(null);
  const [erro, setErro] = useState(false);
  const [nomeAprova, setNomeAprova] = useState('');
  const [aprovando, setAprovando] = useState(false);
  const aprovar = async () => {
    if (nomeAprova.trim().split(/\s+/).length < 2) return alert('Informe seu nome completo.');
    setAprovando(true);
    try { await axios.post(`${API_URL}/publico/acompanhamento/${token}/aprovar-diagnostico`, { nome: nomeAprova.trim() }); const r = await axios.get(`${API_URL}/publico/acompanhamento/${token}`); setD(r.data.data); }
    catch (e: any) { alert(e?.response?.data?.message || 'Não foi possível aprovar agora.'); } finally { setAprovando(false); }
  };
  useEffect(() => {
    const carregar = () => axios.get(`${API_URL}/publico/acompanhamento/${token}`).then(r => setD(r.data.data)).catch(() => setErro(true));
    carregar();
    const t = setInterval(carregar, 120000);
    return () => clearInterval(t);
  }, [token]);

  const fundo: React.CSSProperties = { minHeight: '100vh', background: '#F4F7FB', fontFamily: "'Segoe UI', Arial, sans-serif", color: '#23384D' };
  if (erro) return <div style={{ ...fundo, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}><div><h1 style={{ fontSize: 20 }}>Página não encontrada</h1><p style={{ color: '#5B7A99' }}>Confira o link recebido ou fale com a Prosystem.</p></div></div>;
  if (!d) return <div style={{ ...fundo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#5B7A99' }}>Carregando…</p></div>;

  const servico = d.modulo === 'SERVICO';
  const linha: { titulo: string; sub?: string | null; estado: 'feito' | 'atual' | 'futuro'; passos?: any[] }[] = [
    { titulo: 'Contrato assinado', sub: fmtData(d.assinatura), estado: 'feito' },
    ...d.etapas.filter((e: any) => e.grupo !== 'TREINAMENTO').map((e: any) => ({
      titulo: e.nome, sub: e.total ? `${e.feitos} de ${e.total} passos` : null, passos: e.passos,
      estado: (e.total && e.feitos === e.total) || d.virada ? 'feito' : e.feitos ? 'atual' : 'futuro',
    })),
    ...(!servico ? [{ titulo: 'Virada da loja', sub: d.virada ? `Sistema em uso desde ${fmtData(d.virada)}` : d.virada_inicio ? 'Em andamento' : d.virada_agendada ? `Marcada para ${new Date(d.virada_agendada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')}` : 'Data combinada com o técnico', estado: (d.virada ? 'feito' : d.virada_inicio ? 'atual' : 'futuro') as any }] : []),
    ...(!servico ? d.fases.map((f: any) => ({ titulo: `Treinamento · Fase ${f.ordem}: ${f.nome}`, sub: f.realizada_em ? `Realizada em ${fmtData(f.realizada_em)}` : f.marcada_em ? `Marcada para ${fmtData(f.marcada_em)}` : null, estado: f.realizada_em ? 'feito' : f.marcada_em ? 'atual' : 'futuro' })) : []),
    ...(servico ? [{ titulo: 'Serviço concluído', sub: null, estado: (d.concluida || d.pct >= 100 ? 'feito' : 'futuro') as any }] : []),
  ];
  const corEstado = { feito: '#16a34a', atual: '#2E6EAB', futuro: '#C9D6E3' };

  return (
    <div style={fundo}>
      <header style={{ background: 'linear-gradient(135deg,#0D2238 0%,#1A4E82 50%,#2E6EAB 100%)', padding: '28px 18px 64px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '7px 14px', fontSize: 18, fontWeight: 800, color: '#fff' }}>Pro<span style={{ color: '#90BEF0' }}>System</span></span>
          <p style={{ margin: '24px 0 6px', fontSize: 12, color: '#6AAAE5', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 }}>{servico ? (d.tipo_servico || 'Serviço') : 'Acompanhamento da implantação'}</p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{d.cliente}</h1>
          {d.tecnico && <p style={{ margin: '8px 0 0', color: '#A8C8E8', fontSize: 14 }}>Técnico responsável: {d.tecnico}</p>}
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: '-44px auto 0', padding: '0 16px 40px', display: 'grid', gap: 16 }}>
        <section style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 4px 30px rgba(13,34,56,.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <b style={{ fontSize: 14, color: '#1A4E82' }}>{d.virada ? 'Loja virada! 🎉' : servico ? 'Andamento do serviço' : 'Andamento até a virada'}</b>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#2E6EAB' }}>{d.pct}%</span>
          </div>
          <div style={{ height: 12, background: '#EBF4FF', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${d.pct}%`, height: '100%', background: d.pct >= 100 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#4B8EC8,#2E6EAB)', borderRadius: 99, transition: 'width .5s' }} />
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, fontSize: 14, color: '#5B7A99' }}>
            <span>⏱️ Tempo dedicado: <b style={{ color: '#1A4E82' }}>{fmtHoras(d.tempo_ms)}</b></span>
            {d.primeiro_vencimento && <span>📅 1º vencimento: <b style={{ color: '#1A4E82' }}>{fmtData(d.primeiro_vencimento)}</b></span>}
          </div>
          {(d.virada_agendada || d.treinos_marcados?.length > 0) && (
            <div style={{ marginTop: 14, padding: 12, background: '#EBF4FF', borderRadius: 10, fontSize: 14, display: 'grid', gap: 4 }}>
              <b style={{ color: '#1A4E82' }}>Datas combinadas</b>
              {d.virada_agendada && <span style={{ color: '#23384D' }}>🚀 Virada do sistema: <b>{new Date(d.virada_agendada).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')}</b></span>}
              {(d.treinos_marcados || []).map((t: any) => <span key={t.ordem} style={{ color: '#23384D' }}>🎓 Treinamento fase {t.ordem} ({t.nome}): <b>{fmtData(t.marcada_em)}</b></span>)}
            </div>
          )}
          {d.proximos?.length > 0 && !d.virada && (
            <div style={{ marginTop: 14, padding: 12, background: '#F4F7FB', borderRadius: 10, fontSize: 14 }}>
              <b style={{ color: '#1A4E82' }}>Próximos passos</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#23384D' }}>{d.proximos.map((p: string) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
        </section>
        {(d.aceite?.assinar_url || d.relatorio_disponivel) && (
          <section style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 4px 30px rgba(13,34,56,.10)', display: 'grid', gap: 10 }}>
            <b style={{ fontSize: 16, color: '#1A4E82' }}>{d.aceite?.status === 'ASSINADO' ? 'Implantação concluída e aceita ✓' : 'Implantação concluída'}</b>
            {d.aceite?.assinar_url && <div style={{ fontSize: 14, color: '#5B7A99' }}>Confira o resumo e assine o termo de aceite. A assinatura é eletrônica, pelo ZapSign.</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {d.aceite?.assinar_url && <a href={d.aceite.assinar_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 10, background: '#2E6EAB', color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Assinar o termo de aceite</a>}
              {d.relatorio_disponivel && <a href={`${API_URL}/publico/acompanhamento/${token}/relatorio.pdf`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 10, border: '1px solid #2E6EAB', color: '#2E6EAB', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Baixar o relatório (PDF)</a>}
            </div>
          </section>
        )}
        {(d.treinos_realizados || []).some((f: any) => !f.confirmado_em) && <ConfirmarTreinamento token={token} fases={d.treinos_realizados.filter((f: any) => !f.confirmado_em)} recarregar={() => axios.get(`${API_URL}/publico/acompanhamento/${token}`).then(r => setD(r.data.data)).catch(() => {})} />}
        {d.tarefas_cliente?.length > 0 && <TarefasDoCliente token={token} tarefas={d.tarefas_cliente} recarregar={() => axios.get(`${API_URL}/publico/acompanhamento/${token}`).then(r => setD(r.data.data)).catch(() => {})} />}
        {d.diagnostico && d.diagnostico.dados.length > 0 && (
          <section style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 4px 30px rgba(13,34,56,.06)', display: 'grid', gap: 10 }}>
            <b style={{ fontSize: 14, color: '#1A4E82' }}>Diagnóstico da sua loja</b>
            <p style={{ margin: 0, fontSize: 13, color: '#5B7A99' }}>Levantado pelo técnico no primeiro contato. Confira: é com base nele que fazemos a instalação.</p>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '8px 18px' }}>
              {d.diagnostico.dados.map((x: any) => (
                <div key={x.rotulo}><dt style={{ fontSize: 12, color: '#7A93AD' }}>{x.rotulo}</dt><dd style={{ margin: 0, fontSize: 14, color: '#1A4E82', fontWeight: 600 }}>{x.valor}</dd></div>
              ))}
            </dl>
            {d.diagnostico.aprovado_em ? (
              <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>✓ Aprovado por {d.diagnostico.aprovado_por} em {fmtData(d.diagnostico.aprovado_em)}</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={nomeAprova} onChange={e => setNomeAprova(e.target.value)} placeholder="Seu nome completo" aria-label="Seu nome completo" style={{ flex: '1 1 220px', borderRadius: 10, border: '1px solid #C9D6E3', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit' }} />
                <button disabled={aprovando} onClick={aprovar} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{aprovando ? 'Enviando…' : 'Os dados estão corretos, aprovo'}</button>
                <span style={{ fontSize: 12, color: '#7A93AD', flexBasis: '100%' }}>Algo errado? Fale com o técnico antes de aprovar.</span>
              </div>
            )}
          </section>
        )}
        <section style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 4px 30px rgba(13,34,56,.06)' }}>
          <b style={{ fontSize: 14, color: '#1A4E82' }}>Passo a passo</b>
          <ol style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
            {linha.map((l, k) => (
              <li key={k} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: k === linha.length - 1 ? 0 : 18 }}>
                {k < linha.length - 1 && <span style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 2, background: l.estado === 'feito' ? '#16a34a55' : '#E3EBF3' }} />}
                <span style={{ width: 24, height: 24, borderRadius: 99, flexShrink: 0, background: l.estado === 'futuro' ? '#fff' : corEstado[l.estado], border: `2px solid ${corEstado[l.estado]}`, color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{l.estado === 'feito' ? '✓' : ''}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: l.estado === 'futuro' ? '#7A93AD' : '#1A4E82' }}>{l.titulo}</div>
                  {l.sub && <div style={{ fontSize: 13, color: '#5B7A99' }}>{l.sub}</div>}
                  {l.passos && l.estado !== 'futuro' && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ fontSize: 12, color: '#2E6EAB', cursor: 'pointer' }}>Ver passos</summary>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'grid', gap: 3 }}>
                        {l.passos.map((p: any) => <li key={p.titulo} style={{ fontSize: 13, color: p.feito ? '#16a34a' : '#5B7A99' }}>{p.feito ? '✓' : '○'} {p.titulo}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#7A93AD' }}>
          Dúvidas? Fale com o suporte: <a href={d.suporte?.link} style={{ color: '#2E6EAB', fontWeight: 700 }}>{d.suporte?.telefone}</a><br />Prosystem Sistemas · Vitória/ES
        </p>
      </main>
    </div>
  );
}

/** O que a implantação precisa do cliente: ele envia o arquivo (até 15 MB) ou escreve a resposta, direto do celular. */
function TarefasDoCliente({ token, tarefas, recarregar }: { token: string; tarefas: any[]; recarregar: () => void }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [texto, setTexto] = useState<Record<string, string>>({});
  const pendentes = tarefas.filter(t => t.status === 'PENDENTE').length;
  const enviar = async (t: any, arquivo?: File) => {
    if (arquivo && arquivo.size > 15 * 1024 * 1024) return alert('O arquivo passa de 15 MB. Envie compactado (.zip) ou em partes.');
    const resposta = (texto[t.id] || '').trim();
    if (!arquivo && !resposta) return alert(t.exige_arquivo ? 'Escolha o arquivo.' : 'Escreva a resposta.');
    setEnviando(t.id);
    try {
      const dataUrl = arquivo ? await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsDataURL(arquivo); }) : undefined;
      await axios.post(`${API_URL}/publico/acompanhamento/${token}/tarefas/${t.id}`, { nome: arquivo?.name, arquivo: dataUrl, texto: resposta || undefined }, { maxBodyLength: Infinity });
      setTexto(p => ({ ...p, [t.id]: '' }));
      recarregar();
    } catch (e: any) { alert(e?.response?.status === 413 ? 'O arquivo é grande demais. Envie compactado (.zip) ou em partes.' : e?.response?.data?.message || 'Não foi possível enviar agora. Tente de novo.'); }
    finally { setEnviando(null); }
  };
  const ROT: Record<string, [string, string]> = { PENDENTE: ['Falta enviar', '#b45309'], ENVIADA: ['Recebido, a equipe vai conferir', '#2E6EAB'], CONCLUIDA: ['Conferido ✓', '#16a34a'] };
  return (
    <section style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 4px 30px rgba(13,34,56,.10)', display: 'grid', gap: 12 }}>
      <div>
        <b style={{ fontSize: 16, color: '#1A4E82' }}>O que precisamos de você</b>
        <div style={{ fontSize: 14, color: '#5B7A99', marginTop: 4 }}>{pendentes ? `${pendentes} item(ns) para enviar. A implantação anda mais rápido quando chegam no prazo.` : 'Tudo enviado. Obrigado!'}</div>
      </div>
      {tarefas.map(t => {
        const [rot, cor] = ROT[t.status] || [t.status, '#5B7A99'];
        const vencida = t.status === 'PENDENTE' && t.prazo && new Date(t.prazo) < new Date();
        return (
          <div key={t.id} style={{ borderTop: '1px solid #EBF4FF', paddingTop: 12, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <b style={{ fontSize: 15, color: '#23384D', flex: '1 1 220px' }}>{t.titulo}</b>
              <span style={{ fontSize: 13, fontWeight: 600, color: vencida ? '#dc2626' : cor }}>{vencida ? 'Prazo vencido' : rot}</span>
            </div>
            {t.descricao && <div style={{ fontSize: 14, color: '#5B7A99' }}>{t.descricao}</div>}
            {t.prazo && t.status === 'PENDENTE' && <div style={{ fontSize: 13, color: '#5B7A99' }}>Prazo: {fmtData(t.prazo)}</div>}
            {t.devolvida_motivo && t.status === 'PENDENTE' && <div style={{ fontSize: 14, color: '#b45309', background: '#fff7ed', borderRadius: 8, padding: '8px 10px' }}>Precisamos que reenvie: {t.devolvida_motivo}</div>}
            {t.status === 'ENVIADA' && t.arquivo_nome && <div style={{ fontSize: 13, color: '#5B7A99' }}>Arquivo: {t.arquivo_nome}</div>}
            {t.status !== 'CONCLUIDA' && (
              <div style={{ display: 'grid', gap: 8 }}>
                {!t.exige_arquivo && <textarea rows={2} value={texto[t.id] || ''} onChange={e => setTexto(p => ({ ...p, [t.id]: e.target.value }))} placeholder="Escreva aqui" style={{ width: '100%', fontSize: 15, padding: 10, borderRadius: 10, border: '1px solid #CFE0F2', fontFamily: 'inherit' }} />}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 18px', borderRadius: 10, background: '#2E6EAB', color: '#fff', fontWeight: 700, fontSize: 15, cursor: enviando ? 'wait' : 'pointer', opacity: enviando === t.id ? 0.6 : 1 }}>
                    {enviando === t.id ? 'Enviando…' : t.status === 'ENVIADA' ? 'Enviar outro arquivo' : 'Escolher arquivo e enviar'}
                    <input type="file" disabled={!!enviando} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) enviar(t, f); }} style={{ display: 'none' }} />
                  </label>
                  {!t.exige_arquivo && <button disabled={!!enviando} onClick={() => enviar(t)} style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, border: '1px solid #2E6EAB', background: '#fff', color: '#2E6EAB', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Enviar resposta</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** O cliente confirma quem participou de cada fase do treinamento (comprovação). */
function ConfirmarTreinamento({ token, fases, recarregar }: { token: string; fases: any[]; recarregar: () => void }) {
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [quem, setQuem] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  const confirmar = async (f: any) => {
    const participantes = (nomes[f.id] || '').split(/[\n,;]+/).map(x => x.trim()).filter(x => x.length >= 2);
    if (!participantes.length) return alert('Escreva o nome de quem participou (um por linha).');
    if (quem.trim().length < 3) return alert('Informe o seu nome.');
    setEnviando(f.id);
    try { await axios.post(`${API_URL}/publico/acompanhamento/${token}/treinamento/${f.id}/confirmar`, { participantes, nome: quem.trim() }); recarregar(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Não foi possível confirmar agora.'); } finally { setEnviando(null); }
  };
  return (
    <section style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 4px 30px rgba(13,34,56,.10)', display: 'grid', gap: 12 }}>
      <div>
        <b style={{ fontSize: 16, color: '#1A4E82' }}>Confirme o treinamento</b>
        <div style={{ fontSize: 14, color: '#5B7A99', marginTop: 4 }}>Diga quem da sua equipe participou. Assim fica registrado quem foi treinado em cada parte do sistema.</div>
      </div>
      <input value={quem} onChange={e => setQuem(e.target.value)} placeholder="Seu nome" style={{ width: '100%', fontSize: 15, padding: 10, minHeight: 44, borderRadius: 10, border: '1px solid #CFE0F2' }} />
      {fases.map(f => (
        <div key={f.id} style={{ borderTop: '1px solid #EBF4FF', paddingTop: 12, display: 'grid', gap: 8 }}>
          <b style={{ fontSize: 15, color: '#23384D' }}>Fase {f.ordem}: {f.nome}</b>
          <textarea rows={3} value={nomes[f.id] || ''} onChange={e => setNomes(p => ({ ...p, [f.id]: e.target.value }))} placeholder="Quem participou (um nome por linha)" style={{ width: '100%', fontSize: 15, padding: 10, borderRadius: 10, border: '1px solid #CFE0F2', fontFamily: 'inherit' }} />
          <button disabled={enviando === f.id} onClick={() => confirmar(f)} style={{ justifySelf: 'start', minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none', background: '#2E6EAB', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: enviando === f.id ? 0.6 : 1 }}>{enviando === f.id ? 'Enviando…' : 'Confirmar participação'}</button>
        </div>
      ))}
    </section>
  );
}
