'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Paleta ProSystem
const C = {
  navy: '#0D2238', blue: '#1A4E82', blue2: '#2E6EAB', blue3: '#4B8EC8',
  light: '#90BEF0', sky: '#A8C8E8', text: '#0D2238', sub: '#4A6E8A',
  muted: '#7AAACB', border: '#D8E8F5', bg: '#F4F7FB', star: '#FBBF24',
  green: '#16A34A', yellow: '#D97706', red: '#DC2626',
};

// ── Componentes base ──────────────────────────────────────────────────────────
function Estrelas({ value, onChange, size = 44 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const ativo = hover || value;
  const labels: Record<number, { texto: string; cor: string }> = {
    1: { texto: 'Muito ruim',   cor: C.red },
    2: { texto: 'Ruim',         cor: '#EA580C' },
    3: { texto: 'Regular',      cor: C.yellow },
    4: { texto: 'Bom',          cor: '#65A30D' },
    5: { texto: 'Excelente',    cor: C.green },
  };
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
              fontSize: size, lineHeight: 1, color: ativo >= n ? C.star : '#E2E8F0',
              transition: 'transform .12s, color .12s', transform: ativo >= n ? 'scale(1.1)' : 'scale(1)',
            }}>★</button>
        ))}
      </div>
      <div style={{ minHeight: 28, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {ativo > 0 && (
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 20,
            background: labels[ativo].cor + '18', color: labels[ativo].cor, border: `1px solid ${labels[ativo].cor}40`,
          }}>
            {labels[ativo].texto}
          </span>
        )}
      </div>
    </div>
  );
}

function BotaoOpcao({ label, sub, cor, ativo, onClick, emoji }: {
  label: string; sub?: string; cor?: string; ativo: boolean; onClick: () => void; emoji?: string;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '13px 16px', borderRadius: 14, border: '2px solid',
      borderColor: ativo ? (cor || C.blue2) : C.border, background: ativo ? (cor ? cor + '18' : '#EBF4FF') : '#fff',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s',
      marginBottom: 8,
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8, border: '2px solid', flexShrink: 0,
        borderColor: ativo ? (cor || C.blue2) : '#D1D5DB', background: ativo ? (cor || C.blue2) : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', fontWeight: 800,
      }}>{ativo ? '✓' : (emoji || '')}</span>
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: ativo ? (cor || C.blue) : C.text }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: C.muted }}>{sub}</span>}
      </span>
    </button>
  );
}

// ── Tela de conclusão ─────────────────────────────────────────────────────────
function Obrigado({ score, categoria, interesseComercial }: { score: number; categoria: string; interesseComercial?: string }) {
  const config = {
    excelente: { emoji: '🏆', cor: C.green, titulo: 'Uau! Que avaliação incrível!', msg: 'Ficamos muito felizes com sua experiência! Sua resposta nos motiva a continuar entregando o melhor para a sua empresa.' },
    bom:       { emoji: '😊', cor: C.blue2, titulo: 'Obrigado pela sua avaliação!', msg: 'Identificamos alguns pontos que podem ser melhorados e nosso time vai acompanhar para garantir uma experiência ainda melhor.' },
    atencao:   { emoji: '🤝', cor: C.yellow, titulo: 'Obrigado por nos contar!', msg: 'Recebemos sua avaliação e nosso time de Customer Success vai analisar os pontos informados para melhorar sua experiência.' },
    churn:     { emoji: '💙', cor: C.red, titulo: 'Obrigado por nos contar!', msg: 'Sua avaliação será tratada com prioridade. Nosso time irá entrar em contato em até 24 horas para resolver a situação.' },
  }[categoria] ?? { emoji: '✓', cor: C.green, titulo: 'Obrigado!', msg: 'Sua avaliação foi registrada.' };

  return (
    <div style={{ padding: '48px 36px', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, margin: '0 auto 20px', borderRadius: '50%', background: config.cor + '20', border: `3px solid ${config.cor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>
        {config.emoji}
      </div>

      {/* Score visual */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: config.cor + '15', border: `1px solid ${config.cor}40`, borderRadius: 20, padding: '6px 18px', marginBottom: 16 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: config.cor }}>{score}</span>
        <span style={{ fontSize: 13, color: config.cor, fontWeight: 600 }}>/100 pontos</span>
      </div>

      <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>{config.titulo}</h1>
      <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.65, margin: '0 auto 24px', maxWidth: 380 }}>{config.msg}</p>

      {interesseComercial && ['sim', 'talvez'].includes(interesseComercial) && (
        <div style={{ background: 'var(--t-primary-light)', border: `1px solid ${C.blue3}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.blue }}>
            📞 Ótimo! Nosso time vai entrar em contato para apresentar as soluções que podem agregar ainda mais valor ao seu negócio.
          </p>
        </div>
      )}

      {/* Instagram */}
      <a href="https://www.instagram.com/prosystemoficial/" target="_blank" rel="noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, margin: '0 auto 20px', padding: '11px 22px', borderRadius: 50, background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: 14, boxShadow: '0 4px 18px rgba(238,42,123,0.35)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.326 3.608 1.301.975.975 1.24 2.242 1.301 3.608.058 1.265.069 1.645.069 4.849s-.012 3.584-.07 4.849c-.062 1.366-.326 2.633-1.301 3.608-.975.975-2.242 1.24-3.608 1.301-1.265.058-1.645.069-4.849.069s-3.584-.012-4.849-.07c-1.366-.062-2.633-.326-3.608-1.301-.975-.975-1.24-2.242-1.301-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.849c.062-1.366.326-2.633 1.301-3.608.975-.975 2.242-1.24 3.608-1.301C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.197.157 3.355.673 1.924 2.104.493 3.535-.023 5.377.072 7.232.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.095 1.855.611 3.697 2.042 5.128 1.431 1.431 3.273 1.947 5.128 2.042C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.855-.095 3.697-.611 5.128-2.042 1.431-1.431 1.947-3.273 2.042-5.128.058-1.28.072-1.689.072-4.948 0-3.259-.014-3.668-.072-4.948-.095-1.855-.611-3.697-2.042-5.128C20.645.673 18.803.157 16.948.072 15.668.014 15.259 0 12 0z"/><path d="M12 5.838a6.162 6.162 0 1 0 0 12.324A6.162 6.162 0 0 0 12 5.838zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
        Nos siga no Instagram e acompanhe nosso dia a dia!
      </a>

      <div style={{ paddingTop: 20, borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
        ProSystem Sistemas · Transformando a gestão da sua empresa · (27) 3327-6739
      </div>
    </div>
  );
}

// ── Barra de progresso ────────────────────────────────────────────────────────
function BarraProgresso({ etapa, total }: { etapa: number; total: number }) {
  const pct = Math.round((etapa / total) * 100);
  return (
    <div>
      <div style={{ height: 5, background: 'var(--t-primary-light)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${C.blue3},${C.light})`, transition: 'width .4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px 0', fontSize: 11, color: C.muted, fontWeight: 600 }}>
        <span>Etapa {etapa} de {total}</span>
        <span>{pct}% preenchido</span>
      </div>
    </div>
  );
}

// ── Page principal ────────────────────────────────────────────────────────────
export default function PesquisaPublicaPage() {
  const [etapa, setEtapa] = useState(1);
  const TOTAL_ETAPAS = 4;

  // Etapa 1 — Identificação
  const [identificacao, setIdentificacao] = useState('');
  const [respondente, setRespondente] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cargoRespondente, setCargoRespondente] = useState('');

  // Etapa 2 — Atendimento
  const [notaAtendimento, setNotaAtendimento] = useState(0);
  const [resolucao, setResolucao] = useState('');
  const [rapidez, setRapidez] = useState('');
  const [notaConhecimento, setNotaConhecimento] = useState(0);

  // Etapa 3 — ProSystem
  const [notaGeral, setNotaGeral] = useState(0);
  const [ferramentas, setFerramentas] = useState<Record<string, string>>({});
  const [interesseComercial, setInteresseComercial] = useState('');

  // Etapa 4 — Comentário
  const [recado, setRecado] = useState('');
  const SUGESTOES_RAPIDAS = [
    'Atendimento resolveu meu problema',
    'Atendimento foi rápido e eficiente',
    'Técnico foi muito atencioso',
    'Técnico explicou muito bem',
    'Demorou para responder',
    'Meu problema ainda não foi resolvido',
    'Preciso de um novo contato',
    'Tenho dúvidas sobre o sistema',
    'Quero conhecer mais ferramentas',
    'Estou insatisfeito com o suporte',
  ];


  const [resultado, setResultado] = useState<{ score: number; categoria: string; interesseComercial?: string } | null>(null);
  const [erro, setErro] = useState('');

  const FERRAMENTAS_LISTA = [
    { k: 'plus',        l: 'Plano Plus',              d: 'Recursos avançados de gestão', emoji: '⭐' },
    { k: 'dashboard',   l: 'Dashboard Gerencial',     d: 'Indicadores em tempo real',    emoji: '📊' },
    { k: 'mensageria',  l: 'Mensageria de WhatsApp',  d: 'Envio automático de mensagens',emoji: '💬' },
    { k: 'gerencial',   l: 'Gerencial',               d: 'Monitoramento de notas fiscais',emoji: '📈' },
  ];

  const CARGOS = [
    { k: 'dono',        l: 'Sou o dono / responsável', emoji: '👑' },
    { k: 'gerente',     l: 'Sou gerente',               emoji: '🧑‍💼' },
    { k: 'balconista',  l: 'Sou balconista / operador', emoji: '🖥️' },
    { k: 'financeiro',  l: 'Sou financeiro / adm.',     emoji: '📋' },
    { k: 'outro',       l: 'Outro',                     emoji: '👤' },
  ];

  const RESOLUCAO = [
    { k: 'totalmente',   l: 'Sim, resolveu totalmente',  cor: C.green,  emoji: '✅' },
    { k: 'parcialmente', l: 'Resolveu parcialmente',     cor: C.yellow, emoji: '⚠️' },
    { k: 'nao_resolveu', l: 'Ainda não resolveu',        cor: C.red,    emoji: '❌' },
    { k: 'nao_sei',      l: 'Não sei avaliar',           cor: C.muted,  emoji: '🤔' },
  ];

  const RAPIDEZ = [
    { k: 'muito_rapido',   l: 'Muito rápido',           cor: C.green,  emoji: '⚡' },
    { k: 'esperado',       l: 'Dentro do esperado',     cor: C.blue2,  emoji: '👍' },
    { k: 'demorou_pouco',  l: 'Demorou um pouco',       cor: C.yellow, emoji: '⏳' },
    { k: 'demorou_muito',  l: 'Demorou muito',          cor: C.red,    emoji: '😔' },
  ];

  const INTERESSE_COMERCIAL = [
    { k: 'sim',    l: 'Sim, quero conhecer!',         sub: 'Nosso time entra em contato', cor: C.green,  emoji: '🚀' },
    { k: 'talvez', l: 'Talvez, podem me chamar',      sub: 'Sem compromisso',             cor: C.blue2,  emoji: '📞' },
    { k: 'nao',    l: 'Não tenho interesse agora',    sub: '',                            cor: C.muted,  emoji: '—' },
  ];

  // Calcula score localmente (mesma fórmula do backend) para mostrar tela final sem esperar servidor
  const calcScoreLocal = () => {
    const pontoAtend = Math.round(((notaAtendimento - 1) / 4) * 25);
    const pontoConhec = Math.round(((notaConhecimento - 1) / 4) * 15);
    const pontoGeral  = Math.round(((notaGeral - 1) / 4) * 15);
    const pontoResolucao = resolucao === 'totalmente' ? 20 : resolucao === 'parcialmente' ? 12 : resolucao === 'nao_resolveu' ? 3 : resolucao === 'nao_sei' ? 8 : 12;
    const pontoRapidez   = rapidez === 'muito_rapido' ? 15 : rapidez === 'esperado' ? 12 : rapidez === 'demorou_pouco' ? 7 : rapidez === 'demorou_muito' ? 2 : 10;
    const ferrConhecidas = ['plus','dashboard','mensageria','gerencial'].filter(k => ferramentas[k] && ferramentas[k] !== 'nao').length;
    const pontoFerr = ferrConhecidas >= 3 ? 10 : ferrConhecidas >= 1 ? 7 : 3;
    return Math.min(100, pontoAtend + pontoResolucao + pontoRapidez + pontoConhec + pontoGeral + pontoFerr);
  };

  const avancar = () => {
    setErro('');
    if (etapa === 1) {
      if (!identificacao.trim()) { setErro('Por favor, informe a razão social da sua empresa.'); return; }
      if (!whatsapp.trim()) { setErro('Por favor, informe seu WhatsApp/celular para contato.'); return; }
      if (!cargoRespondente) { setErro('Por favor, selecione seu cargo/função.'); return; }
    }
    if (etapa === 2) {
      if (!notaAtendimento) { setErro('Por favor, dê uma nota para esse atendimento.'); return; }
      if (!resolucao) { setErro('Por favor, informe se a solicitação foi resolvida.'); return; }
      if (!rapidez) { setErro('Por favor, avalie a rapidez do atendimento.'); return; }
      if (!notaConhecimento) { setErro('Por favor, avalie o conhecimento do técnico.'); return; }
    }
    if (etapa === 3) {
      if (!notaGeral) { setErro('Por favor, dê uma nota geral para a ProSystem.'); return; }
    }
    setEtapa(e => e + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const voltar = () => { setErro(''); setEtapa(e => e - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const enviar = () => {
    setErro('');

    // Calcula score localmente e mostra tela final IMEDIATAMENTE — zero espera para o cliente
    const scoreLocal = calcScoreLocal();
    const categoriaLocal = scoreLocal >= 90 ? 'excelente' : scoreLocal >= 80 ? 'bom' : scoreLocal >= 70 ? 'atencao' : 'churn';
    setResultado({ score: scoreLocal, categoria: categoriaLocal, interesseComercial });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Envia ao backend em background — cliente já viu a tela de obrigado
    const ferramentasMap: Record<string, boolean | undefined> = {
      plus:      ferramentas.plus      !== undefined ? ferramentas.plus      !== 'nao' : undefined,
      dashboard: ferramentas.dashboard !== undefined ? ferramentas.dashboard !== 'nao' : undefined,
      mensageria:ferramentas.mensageria!== undefined ? ferramentas.mensageria!== 'nao' : undefined,
      gerencial: ferramentas.gerencial !== undefined ? ferramentas.gerencial !== 'nao' : undefined,
    };
    apiClient.responderPesquisa({
      identificacao,
      respondente_nome: respondente || undefined,
      whatsapp: whatsapp || undefined,
      cargo_respondente: (cargoRespondente as any) || undefined,
      nota_atendimento: notaAtendimento,
      nota_eficiencia: notaAtendimento,
      nota_conhecimento: notaConhecimento,
      nota_geral: notaGeral,
      resolucao: (resolucao as any) || undefined,
      rapidez: (rapidez as any) || undefined,
      conhece_plus: ferramentasMap.plus,
      conhece_dashboard: ferramentasMap.dashboard,
      conhece_mensageria: ferramentasMap.mensageria,
      conhece_gerencial: ferramentasMap.gerencial,
      interesse_comercial: (interesseComercial as any) || undefined,
      recado: recado || undefined,
    }).catch((e: any) => console.error('[pesquisa] erro ao enviar background:', e?.message));
  };

  const wrap: React.CSSProperties = {
    minHeight: '100vh',
    background: `radial-gradient(900px 500px at 50% -10%, ${C.blue2}, ${C.navy})`,
    fontFamily: "'Segoe UI',system-ui,Arial,sans-serif",
    padding: '24px 16px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 22, maxWidth: 560, width: '100%',
    boxShadow: '0 20px 60px rgba(13,34,56,.35)', overflow: 'hidden', marginTop: 16,
  };

  if (resultado) {
    return (
      <div style={wrap}>
        <div style={card}>
          <Obrigado score={resultado.score} categoria={resultado.categoria} interesseComercial={resultado.interesseComercial} />
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <BarraProgresso etapa={etapa} total={TOTAL_ETAPAS} />

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${C.navy} 0%,${C.blue} 55%,${C.blue2} 100%)`, padding: '24px 28px 20px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ background: 'rgba(255,255,255,.14)', borderRadius: 10, padding: '6px 14px', fontSize: 19, fontWeight: 800 }}>
              Pro<span style={{ color: C.light }}>System</span>
            </span>
            <span style={{ fontSize: 10, color: C.sky, letterSpacing: 2, textTransform: 'uppercase' }}>Sistemas para Varejo</span>
          </div>
          {etapa === 1 && <>
            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>Como foi sua experiência com a gente? 💙</h1>
            <p style={{ margin: 0, fontSize: 13, color: C.sky }}>Leva menos de 2 minutos e nos ajuda a melhorar cada dia.</p>
          </>}
          {etapa === 2 && <>
            <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>⚡ Sobre o atendimento</h1>
            <p style={{ margin: 0, fontSize: 13, color: C.sky }}>Conte como foi esse atendimento específico.</p>
          </>}
          {etapa === 3 && <>
            <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>🏢 Sua experiência com a ProSystem</h1>
            <p style={{ margin: 0, fontSize: 13, color: C.sky }}>De modo geral, como está sendo o uso do sistema?</p>
          </>}
          {etapa === 4 && <>
            <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>💬 Última etapa</h1>
            <p style={{ margin: 0, fontSize: 13, color: C.sky }}>Deixe um recado, elogio ou sugestão (opcional).</p>
          </>}
        </div>

        <div style={{ padding: '24px 28px 28px' }}>

          {/* ── ETAPA 1 — Identificação ── */}
          {etapa === 1 && (
            <>
              <div style={sBloco}>
                <p style={sTitulo}>Razão social da sua empresa <span style={{ color: C.red }}>*</span></p>
                <input value={identificacao} onChange={e => setIdentificacao(e.target.value)}
                  placeholder="Ex.: Farmácia Bom Preço Ltda" style={sInput} autoFocus />
              </div>

              <div style={sBloco}>
                <p style={sTitulo}>Seu nome <span style={sOpc}>(opcional)</span></p>
                <input value={respondente} onChange={e => setRespondente(e.target.value)}
                  placeholder="Quem está respondendo" style={sInput} />
              </div>

              <div style={sBloco}>
                <p style={sTitulo}>WhatsApp / Celular <span style={{ color: C.red, fontWeight: 700 }}>*</span></p>
                <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  placeholder="(27) 9 9999-0000" style={sInput} inputMode="tel" />
              </div>

              <div style={sBloco}>
                <p style={sTitulo}>Qual é a sua função na empresa? <span style={{ color: C.red }}>*</span></p>
                <p style={sHint}>Isso nos ajuda a entender melhor sua avaliação.</p>
                {CARGOS.map(c => (
                  <BotaoOpcao key={c.k} label={c.l} emoji={c.emoji} ativo={cargoRespondente === c.k} onClick={() => setCargoRespondente(c.k)} />
                ))}
              </div>
            </>
          )}

          {/* ── ETAPA 2 — Atendimento ── */}
          {etapa === 2 && (
            <>
              <div style={sBloco}>
                <p style={{ ...sTitulo, textAlign: 'center' }}>Qual nota você dá para <strong>esse atendimento</strong>? <span style={{ color: C.red }}>*</span></p>
                <Estrelas value={notaAtendimento} onChange={setNotaAtendimento} size={46} />
              </div>

              <div style={sBloco}>
                <p style={sTitulo}>O atendimento <strong>resolveu sua solicitação</strong>? <span style={{ color: C.red }}>*</span></p>
                <p style={sHint}>Essa pergunta tem muito peso — um problema não resolvido precisa de atenção!</p>
                {RESOLUCAO.map(r => (
                  <BotaoOpcao key={r.k} label={r.l} cor={r.cor} emoji={r.emoji} ativo={resolucao === r.k} onClick={() => setResolucao(r.k)} />
                ))}
              </div>

              <div style={sBloco}>
                <p style={sTitulo}>Como você avalia a <strong>rapidez</strong> do atendimento? <span style={{ color: C.red }}>*</span></p>
                {RAPIDEZ.map(r => (
                  <BotaoOpcao key={r.k} label={r.l} cor={r.cor} emoji={r.emoji} ativo={rapidez === r.k} onClick={() => setRapidez(r.k)} />
                ))}
              </div>

              <div style={sBloco}>
                <p style={{ ...sTitulo, textAlign: 'center' }}>Qual nota você dá para o <strong>conhecimento do técnico</strong>? <span style={{ color: C.red }}>*</span></p>
                <Estrelas value={notaConhecimento} onChange={setNotaConhecimento} size={42} />
              </div>
            </>
          )}

          {/* ── ETAPA 3 — ProSystem + Ferramentas ── */}
          {etapa === 3 && (
            <>
              <div style={sBloco}>
                <p style={{ ...sTitulo, textAlign: 'center' }}>De modo geral, qual nota você daria para a <strong>ProSystem</strong>? <span style={{ color: C.red }}>*</span></p>
                <Estrelas value={notaGeral} onChange={setNotaGeral} size={46} />
              </div>

              <div style={sBloco}>
                <p style={sTitulo}>Quais dessas ferramentas você já <strong>conhece ou utiliza</strong>?</p>
                <p style={sHint}>Selecione para cada uma: usa, conhece mas não usa, ou não conhece.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {FERRAMENTAS_LISTA.map(f => (
                    <div key={f.k} style={{ border: '1px solid', borderColor: ferramentas[f.k] ? C.blue3 : C.border, borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', background: ferramentas[f.k] ? '#EBF4FF' : C.bg, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{f.emoji}</span>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{f.l}</span>
                          <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{f.d}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                        {[
                          { k: 'usa',  l: 'Conheço e uso', cor: C.green },
                          { k: 'conhece', l: 'Conheço, não uso', cor: C.yellow },
                          { k: 'nao',  l: 'Não conheço', cor: C.muted },
                        ].map((op, i) => (
                          <button key={op.k} type="button" onClick={() => setFerramentas(prev => ({ ...prev, [f.k]: op.k }))}
                            style={{
                              flex: 1, padding: '9px 4px', border: 'none', borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
                              background: ferramentas[f.k] === op.k ? op.cor + '20' : '#fff',
                              color: ferramentas[f.k] === op.k ? op.cor : C.muted,
                              fontSize: 11, fontWeight: ferramentas[f.k] === op.k ? 800 : 500,
                              cursor: 'pointer', transition: 'all .15s',
                            }}>
                            {op.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Só mostra interesse comercial se há ferramentas desconhecidas */}
              {Object.values(ferramentas).some(v => v === 'nao' || v === 'conhece') && (
                <div style={{ ...sBloco, background: 'var(--t-primary-light)', borderColor: C.blue3 }}>
                  <p style={sTitulo}>📞 Você gostaria que nosso time apresentasse alguma dessas soluções?</p>
                  {INTERESSE_COMERCIAL.map(i => (
                    <BotaoOpcao key={i.k} label={i.l} sub={i.sub} cor={i.cor} emoji={i.emoji} ativo={interesseComercial === i.k} onClick={() => setInteresseComercial(i.k)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ETAPA 4 — Comentário ── */}
          {etapa === 4 && (
            <>
              <div style={sBloco}>
                <p style={sTitulo}>Conte para nós o que aconteceu <span style={sOpc}>(opcional)</span></p>
                <p style={sHint}>Elogio, sugestão, reclamação ou o que precisar resolver — pode falar à vontade.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {SUGESTOES_RAPIDAS.map(s => (
                    <button key={s} type="button"
                      onClick={() => setRecado(prev => prev ? prev + ' ' + s.toLowerCase() : s)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
                        background: '#fff', fontSize: 12, color: C.sub, cursor: 'pointer',
                        fontWeight: 500, transition: 'all .15s',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>

                <textarea value={recado} onChange={e => setRecado(e.target.value)} rows={4}
                  placeholder="Escreva aqui sua mensagem... ou clique nos botões acima para começar."
                  style={{ ...sInput, resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              {/* Resumo rápido antes de enviar */}
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Resumo da sua avaliação</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { l: 'Atendimento', v: '★'.repeat(notaAtendimento) + '☆'.repeat(5 - notaAtendimento) },
                    { l: 'Técnico', v: '★'.repeat(notaConhecimento) + '☆'.repeat(5 - notaConhecimento) },
                    { l: 'ProSystem', v: '★'.repeat(notaGeral) + '☆'.repeat(5 - notaGeral) },
                    resolucao && { l: 'Resolvido?', v: RESOLUCAO.find(r => r.k === resolucao)?.l?.split(',')[0] },
                    rapidez && { l: 'Rapidez', v: RAPIDEZ.find(r => r.k === rapidez)?.l },
                  ].filter(Boolean).map((item: any) => (
                    <span key={item.l} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${C.border}`, color: C.text }}>
                      <strong>{item.l}:</strong> <span style={{ color: C.star }}>{item.v}</span>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Erro */}
          {erro && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <p style={{ color: C.red, fontSize: 13, margin: 0 }}>⚠️ {erro}</p>
            </div>
          )}

          {/* Navegação */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {etapa > 1 && (
              <button onClick={voltar} style={{
                padding: '14px 20px', borderRadius: 12, border: `1px solid ${C.border}`,
                background: '#fff', color: C.sub, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                ← Voltar
              </button>
            )}
            {etapa < TOTAL_ETAPAS ? (
              <button onClick={avancar} style={{
                flex: 1, padding: '16px', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg,${C.blue3},${C.blue2})`,
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(46,110,171,.35)',
              }}>
                Continuar →
              </button>
            ) : (
              <button onClick={enviar} style={{
                flex: 1, padding: '16px', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg,${C.green},#15803D)`,
                color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(22,163,74,.35)',
              }}>
                ✓ Enviar minha avaliação
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, fontSize: 12, color: C.muted }}>
            <span>🔒</span>
            <span>Pesquisa oficial da <strong style={{ color: C.blue }}>ProSystem</strong> · suas respostas são confidenciais</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estilos locais ────────────────────────────────────────────────────────────
const sBloco: React.CSSProperties  = { marginBottom: 22, padding: '18px', borderRadius: 14, background: C.bg, border: `1px solid ${C.border}` };
const sTitulo: React.CSSProperties = { fontSize: 15, color: C.text, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.4 };
const sHint: React.CSSProperties   = { fontSize: 12, color: C.muted, margin: '-4px 0 12px', lineHeight: 1.5 };
const sInput: React.CSSProperties  = { width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 15, color: C.text, outline: 'none', boxSizing: 'border-box', background: '#FBFDFF' };
const sOpc: React.CSSProperties    = { color: C.muted, fontWeight: 400, fontSize: 12 };
