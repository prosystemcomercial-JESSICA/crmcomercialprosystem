'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// Configurações → Assistente no WhatsApp: quais avisos a pessoa logada recebe no
// celular (pelo WhatsApp da empresa) e a chave PIX usada após o aceite da proposta.

type Ia = { laya_triagem: boolean; laya_confianca: number; risco_limite: number; risco_so_clientes: boolean };
type IaTexto = { tira_duvidas: 'desligado' | 'fora_do_horario' | 'sempre'; transcrever_auto: boolean; tem_chave: boolean };
type Cfg = { avisos: string[]; tipos: { id: string; nome: string }[]; telefone: string | null; recebe: boolean; pix_chave: string; ia: Ia; ia_texto: IaTexto };
const PCT = [0.6, 0.7, 0.8, 0.9];

const card: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, overflow: 'hidden' };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 };

export default function AssistenteWhatsapp() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [novaChave, setNovaChave] = useState('');

  useEffect(() => {
    apiClient.getAssistenteConfig().then(r => setCfg(r.data.data)).catch(() => setMsg({ ok: false, texto: 'Não foi possível carregar.' }));
  }, []);

  if (!cfg) return null;

  const alternar = (id: string) => setCfg(c => c && ({ ...c, avisos: c.avisos.includes(id) ? c.avisos.filter(a => a !== id) : [...c.avisos, id] }));
  const salvar = async () => {
    setSalvando(true); setMsg(null);
    try {
      await apiClient.salvarAssistenteConfig({
        avisos: cfg.avisos, pix_chave: cfg.pix_chave, ia: cfg.ia,
        ia_texto: { tira_duvidas: cfg.ia_texto.tira_duvidas, transcrever_auto: cfg.ia_texto.transcrever_auto, ...(novaChave.trim() ? { gemini_chave: novaChave.trim() } : {}) },
      });
      if (novaChave.trim()) { setCfg(c => c && ({ ...c, ia_texto: { ...c.ia_texto, tem_chave: true } })); setNovaChave(''); }
      setMsg({ ok: true, texto: 'Salvo.' });
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.response?.data?.message || 'Não foi possível salvar.' });
    } finally { setSalvando(false); }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={16} color="#15803d" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Assistente no WhatsApp</h2>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
            Mande <b>hoje</b>, <b>semana</b>, <b>propostas paradas</b> ou <b>cliente 381</b> do seu celular para o WhatsApp da empresa e o CRM responde.
          </p>
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!cfg.recebe && (
          <p style={{ fontSize: 12, color: '#b45309' }}>
            Seu telefone {cfg.telefone ? `(${cfg.telefone})` : ''} não está cadastrado ou incompleto no seu usuário. Ajuste em Usuários para usar os comandos e receber avisos.
          </p>
        )}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)', marginBottom: 8 }}>Avisos que eu quero receber no celular</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {cfg.tipos.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)' }}>
                <input id={`aviso-${t.id}`} type="checkbox" checked={cfg.avisos.includes(t.id)} onChange={() => alternar(t.id)} /> {t.nome}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="pix-chave" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)', marginBottom: 6 }}>Chave PIX da empresa</label>
          <input id="pix-chave" style={input} value={cfg.pix_chave} placeholder="CNPJ, e-mail, telefone ou chave aleatória"
            onChange={e => setCfg(c => c && ({ ...c, pix_chave: e.target.value }))} />
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
            Enviada ao cliente depois que ele aceita a proposta pelo WhatsApp. Sem chave, ele recebe &quot;o financeiro vai te enviar a cobrança da entrada&quot;.
          </p>
        </div>
        <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 14, display: 'grid', gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>IA de texto (Gemini)</p>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
            Resumo da conversa, sugestão de resposta, transcrição de áudio e tira-dúvidas automático. Crie a chave gratuita em aistudio.google.com/apikey.
          </p>
          <label htmlFor="gemini-chave" style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>
            Chave da IA {cfg.ia_texto.tem_chave ? <span style={{ color: '#15803d', fontWeight: 600 }}>✓ configurada</span> : <span style={{ color: '#b45309', fontWeight: 600 }}>não configurada</span>}
          </label>
          <input id="gemini-chave" type="password" autoComplete="off" style={input} value={novaChave}
            placeholder={cfg.ia_texto.tem_chave ? 'Deixe vazio para manter a chave atual' : 'Cole aqui a chave do Gemini'}
            onChange={e => setNovaChave(e.target.value)} />
          <label htmlFor="tira-duvidas" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--t-text-primary)' }}>
            Tira-dúvidas automático para leads:
            <select id="tira-duvidas" value={cfg.ia_texto.tira_duvidas} style={{ ...input, width: 'auto' }}
              onChange={e => setCfg(c => c && ({ ...c, ia_texto: { ...c.ia_texto, tira_duvidas: e.target.value as IaTexto['tira_duvidas'] } }))}>
              <option value="fora_do_horario">Só fora do horário (seg–sex 8h–18h é da equipe)</option>
              <option value="sempre">Sempre (quando ninguém respondeu nas últimas 2h)</option>
              <option value="desligado">Desligado</option>
            </select>
          </label>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
            Responde só dúvidas sobre o sistema com o guia comercial, no máximo 3 vezes por dia por conversa. Nunca fala de preço ou desconto.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)' }}>
            <input id="transcrever-auto" type="checkbox" checked={cfg.ia_texto.transcrever_auto}
              onChange={e => setCfg(c => c && ({ ...c, ia_texto: { ...c.ia_texto, transcrever_auto: e.target.checked } }))} />
            Transcrever automaticamente os áudios recebidos
          </label>
        </div>
        <div style={{ borderTop: '1px solid var(--t-card-border)', paddingTop: 14, display: 'grid', gap: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>IA Laya</p>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
            A Laya está aprendendo até 14/10 com as etiquetas que vocês confirmam nas conversas. Ligue estas opções depois do treino.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)' }}>
            <input id="ia-triagem" type="checkbox" checked={cfg.ia.laya_triagem}
              onChange={e => setCfg(c => c && ({ ...c, ia: { ...c.ia, laya_triagem: e.target.checked } }))} />
            Usar a Laya na triagem (entender resposta escrita livre antes de repetir a pergunta)
          </label>
          <label htmlFor="ia-confianca" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)' }}>
            Aceitar a resposta da Laya na triagem só com confiança de
            <select id="ia-confianca" value={cfg.ia.laya_confianca} style={{ ...input, width: 'auto' }}
              onChange={e => setCfg(c => c && ({ ...c, ia: { ...c.ia, laya_confianca: Number(e.target.value) } }))}>
              {PCT.map(p => <option key={p} value={p}>{Math.round(p * 100)}%</option>)}
            </select>
          </label>
          <label htmlFor="ia-risco" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)' }}>
            Avisar risco de cancelamento a partir de
            <select id="ia-risco" value={cfg.ia.risco_limite} style={{ ...input, width: 'auto' }}
              onChange={e => setCfg(c => c && ({ ...c, ia: { ...c.ia, risco_limite: Number(e.target.value) } }))}>
              {PCT.map(p => <option key={p} value={p}>{Math.round(p * 100)}%</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t-text-primary)' }}>
            <input id="ia-risco-clientes" type="checkbox" checked={cfg.ia.risco_so_clientes}
              onChange={e => setCfg(c => c && ({ ...c, ia: { ...c.ia, risco_so_clientes: e.target.checked } }))} />
            Risco de cancelamento só para clientes da base (desmarque para incluir leads)
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={salvar} disabled={salvando}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--t-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</span>}
        </div>
      </div>
    </div>
  );
}
