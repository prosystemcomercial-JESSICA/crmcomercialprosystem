'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

// LP PÚBLICA de pesquisa de satisfação — sem login. Visual ProSystem,
// mobile-first, UX cuidada (progresso, feedback de nota, selo de confiança).
// Slogan oficial: "Transformando a gestão do varejo".

// Paleta ProSystem
const C = {
  navy: '#0D2238', blue: '#1A4E82', blue2: '#2E6EAB', blue3: '#4B8EC8',
  light: '#90BEF0', sky: '#A8C8E8', text: '#0D2238', sub: '#4A6E8A',
  muted: '#7AAACB', border: '#D8E8F5', bg: '#F4F7FB', star: '#FBBF24',
};

const LABEL_NOTA: Record<number, string> = {
  1: 'Muito insatisfeito', 2: 'Insatisfeito', 3: 'Neutro', 4: 'Satisfeito', 5: 'Muito satisfeito',
};

function Estrelas({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const ativo = hover || value;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
              fontSize: 42, lineHeight: 1, color: ativo >= n ? C.star : '#E2E8F0',
              transition: 'transform .12s, color .12s', transform: ativo >= n ? 'scale(1.08)' : 'scale(1)',
            }}>★</button>
        ))}
      </div>
      <p style={{ height: 18, margin: '6px 0 0', fontSize: 13, fontWeight: 600, color: ativo ? (ativo <= 2 ? '#DC2626' : ativo === 3 ? '#D97706' : '#16A34A') : 'transparent' }}>
        {ativo ? LABEL_NOTA[ativo] : '—'}
      </p>
    </div>
  );
}

export default function PesquisaPublicaPage() {
  const [identificacao, setIdentificacao] = useState('');
  const [respondente, setRespondente] = useState('');
  const [email, setEmail] = useState('');
  const [notaAtendimento, setNotaAtendimento] = useState(0);
  const [notaEficiencia, setNotaEficiencia] = useState(0);
  const [notaConhecimento, setNotaConhecimento] = useState(0);
  const [notaGeral, setNotaGeral] = useState(0);
  const [recado, setRecado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  // Progresso (5 passos essenciais).
  const passos = [!!identificacao.trim(), !!notaAtendimento, !!notaEficiencia, !!notaConhecimento, !!notaGeral];
  const progresso = Math.round((passos.filter(Boolean).length / passos.length) * 100);

  const enviar = async () => {
    setErro('');
    if (!identificacao.trim()) { setErro('Por favor, informe a razão social da sua empresa.'); return; }
    if (!notaAtendimento || !notaEficiencia || !notaConhecimento || !notaGeral) {
      setErro('Por favor, responda todas as notas (estrelas) antes de enviar.'); return;
    }
    setEnviando(true);
    try {
      await apiClient.responderPesquisa({
        identificacao, respondente_nome: respondente || undefined, email: email || undefined,
        nota_atendimento: notaAtendimento, nota_eficiencia: notaEficiencia,
        nota_conhecimento: notaConhecimento, nota_geral: notaGeral,
        recado: recado || undefined,
      });
      setEnviado(true);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível enviar. Tente novamente.');
    } finally { setEnviando(false); }
  };

  const wrap: React.CSSProperties = {
    minHeight: '100vh', background: `radial-gradient(900px 500px at 50% -10%, ${C.blue2}, ${C.navy})`,
    fontFamily: "'Segoe UI',system-ui,Arial,sans-serif", padding: '24px 16px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 22, maxWidth: 560, width: '100%',
    boxShadow: '0 20px 60px rgba(13,34,56,.35)', overflow: 'hidden',
  };

  if (enviado) {
    return (
      <div style={wrap}>
        <div style={{ ...card, padding: '48px 36px', textAlign: 'center', marginTop: 48 }}>
          <div style={{ width: 76, height: 76, margin: '0 auto 18px', borderRadius: '50%', background: 'linear-gradient(135deg,#22C55E,#16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#fff' }}>✓</div>
          <h1 style={{ color: C.text, fontSize: 26, fontWeight: 800, margin: '0 0 10px' }}>Obrigado pela sua resposta!</h1>
          <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.65, margin: '0 auto', maxWidth: 380 }}>
            Sua opinião acaba de chegar à nossa equipe e é o que nos move a melhorar a cada dia.
            Conte com a <strong style={{ color: C.blue }}>ProSystem</strong> para transformar a gestão do seu varejo.
          </p>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
            ProSystem Sistemas · (27) 3327-6739
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        {/* Barra de progresso */}
        <div style={{ height: 4, background: '#EBF4FF' }}>
          <div style={{ height: '100%', width: `${progresso}%`, background: `linear-gradient(90deg,${C.blue3},${C.light})`, transition: 'width .3s' }} />
        </div>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${C.navy} 0%,${C.blue} 55%,${C.blue2} 100%)`, padding: '30px 34px 26px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'rgba(255,255,255,.14)', borderRadius: 10, padding: '7px 14px', fontSize: 20, fontWeight: 800 }}>
              Pro<span style={{ color: C.light }}>System</span>
            </span>
            <span style={{ fontSize: 11, color: C.sky, letterSpacing: 2, textTransform: 'uppercase' }}>Sistemas para Varejo</span>
          </div>
          <h1 style={{ margin: '20px 0 8px', fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>Como foi sua experiência com a gente?</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.sky, lineHeight: 1.55 }}>
            Sua avaliação leva menos de 1 minuto e nos ajuda a transformar a gestão do seu varejo. 💙
          </p>
        </div>

        <div style={{ padding: '26px 34px 32px' }}>
          {/* Identificação */}
          <label style={lbl}>Razão social <span style={{ color: '#DC2626' }}>*</span></label>
          <input value={identificacao} onChange={e => setIdentificacao(e.target.value)}
            placeholder="Nome da sua empresa (ex.: Farmácia Bom Preço Ltda)" style={inp} />

          <label style={lbl}>Seu nome <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
          <input value={respondente} onChange={e => setRespondente(e.target.value)}
            placeholder="Quem está respondendo" style={inp} />

          <label style={lbl}>E-mail <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com" style={inp} />

          {/* Notas do atendimento técnico */}
          <div style={bloco}>
            <p style={pergunta}>Qual a nota você dá para <strong>esse atendimento</strong>?</p>
            <Estrelas value={notaAtendimento} onChange={setNotaAtendimento} />
          </div>
          <div style={bloco}>
            <p style={pergunta}>Como você avalia a <strong>eficiência e a rapidez</strong> do atendimento técnico ao resolver suas solicitações?</p>
            <Estrelas value={notaEficiencia} onChange={setNotaEficiencia} />
          </div>
          <div style={bloco}>
            <p style={pergunta}>Qual nota você dá para o <strong>conhecimento do técnico</strong>?</p>
            <Estrelas value={notaConhecimento} onChange={setNotaConhecimento} />
          </div>

          {/* Recado */}
          <label style={lbl}>Deixe seu recado, sugestão ou elogio <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none' }}>(para o técnico ou para a ProSystem)</span></label>
          <textarea value={recado} onChange={e => setRecado(e.target.value)} rows={3}
            placeholder="Escreva aqui sua mensagem" style={{ ...inp, resize: 'vertical' }} />

          {/* Nota geral Prosystem (NPS) — destaque */}
          <div style={{ ...bloco, background: '#EBF4FF', borderColor: C.blue3 }}>
            <p style={pergunta}>De modo geral, qual nota você daria para a <strong>ProSystem</strong>?</p>
            <Estrelas value={notaGeral} onChange={setNotaGeral} />
          </div>

          {erro && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginTop: 14 }}>
              <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{erro}</p>
            </div>
          )}

          <button onClick={enviar} disabled={enviando}
            style={{
              width: '100%', marginTop: 22, padding: '16px', borderRadius: 12, border: 'none',
              background: enviando ? '#9CB8D4' : `linear-gradient(135deg,${C.blue3},${C.blue2})`,
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: enviando ? 'default' : 'pointer',
              boxShadow: enviando ? 'none' : '0 8px 24px rgba(46,110,171,.35)', transition: 'all .15s',
            }}>
            {enviando ? 'Enviando…' : 'Enviar minha avaliação'}
          </button>

          {/* Selo de confiança — reduz cara de phishing, reforça legitimidade */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, fontSize: 12, color: C.muted }}>
            <span>🔒</span>
            <span>Pesquisa oficial da <strong style={{ color: C.blue }}>ProSystem Sistemas</strong> · suas respostas são confidenciais</span>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#A8B8C8', margin: '8px 0 0' }}>
            16 anos transformando a gestão do varejo · (27) 3327-6739
          </p>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: .5, margin: '16px 0 6px' };
const inp: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 15, color: C.text, outline: 'none', boxSizing: 'border-box', background: '#FBFDFF' };
const pergunta: React.CSSProperties = { fontSize: 16, color: C.text, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4, textAlign: 'center' };
const bloco: React.CSSProperties = { marginTop: 22, padding: '16px', borderRadius: 14, background: C.bg, border: `1px solid ${C.border}` };
