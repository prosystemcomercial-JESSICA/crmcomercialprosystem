'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

// LP PÚBLICA de pesquisa de satisfação — sem login. O técnico envia o link
// (/pesquisa) ao cliente no fim do atendimento. Mobile-first, visual ProSystem.

function Estrelas({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            fontSize: 40, lineHeight: 1, color: (hover || value) >= n ? '#FBBF24' : '#D1D5DB',
            transition: 'transform .1s', transform: (hover || value) >= n ? 'scale(1.1)' : 'scale(1)',
          }}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function PesquisaPublicaPage() {
  const [identificacao, setIdentificacao] = useState('');
  const [respondente, setRespondente] = useState('');
  const [notaSuporte, setNotaSuporte] = useState(0);
  const [notaSistema, setNotaSistema] = useState(0);
  const [conhecePlano, setConhecePlano] = useState<boolean | null>(null);
  const [observacao, setObservacao] = useState('');
  const [sugestoes, setSugestoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async () => {
    setErro('');
    if (!identificacao.trim()) { setErro('Por favor, informe o nome da sua empresa.'); return; }
    if (!notaSuporte || !notaSistema) { setErro('Por favor, dê sua nota para o suporte e para o sistema.'); return; }
    setEnviando(true);
    try {
      await apiClient.responderPesquisa({
        identificacao, respondente_nome: respondente || undefined,
        nota_suporte: notaSuporte, nota_sistema: notaSistema,
        conhece_plano: conhecePlano === true,
        observacao: observacao || undefined, sugestoes: sugestoes || undefined,
      });
      setEnviado(true);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível enviar. Tente novamente.');
    } finally { setEnviando(false); }
  };

  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: 'linear-gradient(160deg,#0D2238,#1A4E82)',
    fontFamily: "'Segoe UI',Arial,sans-serif", padding: '24px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 20, maxWidth: 540, width: '100%',
    boxShadow: '0 10px 50px rgba(0,0,0,.25)', overflow: 'hidden',
  };

  if (enviado) {
    return (
      <div style={wrap}>
        <div style={{ ...card, padding: 40, textAlign: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>💙</div>
          <h1 style={{ color: '#0D2238', fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>Obrigado!</h1>
          <p style={{ color: '#4A6E8A', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Sua opinião foi registrada e é muito importante para a ProSystem continuar melhorando.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0D2238,#1A4E82,#2E6EAB)', padding: '32px 32px 28px', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Pro<span style={{ color: '#90BEF0' }}>System</span></p>
          <h1 style={{ margin: '14px 0 6px', fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>Como foi sua experiência?</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#A8C8E8', lineHeight: 1.5 }}>
            Leva menos de 1 minuto. Sua resposta nos ajuda a te atender cada vez melhor.
          </p>
        </div>

        <div style={{ padding: '28px 32px 32px' }}>
          {/* Identificação */}
          <label style={lbl}>Nome da sua empresa (razão social ou nome fantasia) *</label>
          <input value={identificacao} onChange={e => setIdentificacao(e.target.value)}
            placeholder="Ex.: Farmácia Bom Preço" style={inp} />

          <label style={lbl}>Seu nome (opcional)</label>
          <input value={respondente} onChange={e => setRespondente(e.target.value)}
            placeholder="Quem está respondendo" style={inp} />

          {/* Notas */}
          <div style={{ margin: '24px 0 8px', textAlign: 'center' }}>
            <p style={pergunta}>Qual sua satisfação com o nosso <strong>suporte</strong>?</p>
            <Estrelas value={notaSuporte} onChange={setNotaSuporte} />
          </div>
          <div style={{ margin: '20px 0 8px', textAlign: 'center' }}>
            <p style={pergunta}>E com o <strong>sistema no geral</strong>?</p>
            <Estrelas value={notaSistema} onChange={setNotaSistema} />
          </div>

          {/* Conhece o plano */}
          <div style={{ margin: '24px 0 8px' }}>
            <p style={pergunta}>Você conhece os <strong>diferenciais do seu plano</strong> (dashboard, mensageria, gerencial, atenção farmacêutica)?</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              {[{ v: true, l: 'Sim, conheço' }, { v: false, l: 'Não conheço' }].map(o => (
                <button key={String(o.v)} type="button" onClick={() => setConhecePlano(o.v)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${conhecePlano === o.v ? '#2E6EAB' : '#D8E8F5'}`,
                    background: conhecePlano === o.v ? '#EBF4FF' : '#fff',
                    color: conhecePlano === o.v ? '#1A4E82' : '#4A6E8A',
                  }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Texto livre */}
          <label style={lbl}>Observações (opcional)</label>
          <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
            placeholder="Conte como foi sua experiência" style={{ ...inp, resize: 'vertical' }} />

          <label style={lbl}>Sugestões — sistema ou ferramentas (opcional)</label>
          <textarea value={sugestoes} onChange={e => setSugestoes(e.target.value)} rows={2}
            placeholder="O que poderíamos melhorar ou criar para você?" style={{ ...inp, resize: 'vertical' }} />

          {erro && <p style={{ color: '#DC2626', fontSize: 13, margin: '8px 0 0' }}>{erro}</p>}

          <button onClick={enviar} disabled={enviando}
            style={{
              width: '100%', marginTop: 20, padding: '15px', borderRadius: 12, border: 'none',
              background: enviando ? '#9CB8D4' : 'linear-gradient(135deg,#4B8EC8,#2E6EAB)',
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: enviando ? 'default' : 'pointer',
            }}>
            {enviando ? 'Enviando…' : 'Enviar avaliação'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#9CB8D4', margin: '14px 0 0' }}>
            ProSystem Sistemas · Sua opinião é confidencial
          </p>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#7AAACB', textTransform: 'uppercase', letterSpacing: .5, margin: '16px 0 6px' };
const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #D8E8F5', fontSize: 15, color: '#0D2238', outline: 'none', boxSizing: 'border-box' };
const pergunta: React.CSSProperties = { fontSize: 15, color: '#0D2238', fontWeight: 600, margin: '0 0 4px', lineHeight: 1.4 };
