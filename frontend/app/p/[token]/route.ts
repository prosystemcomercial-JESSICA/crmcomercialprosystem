import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Cache em memória das imagens convertidas para base64 (sobrevive até o restart)
const imageCache: Record<string, string> = {};

async function loadImageAsDataUrl(filename: string): Promise<string> {
  if (imageCache[filename]) return imageCache[filename];
  try {
    const filePath = path.join(process.cwd(), 'public', filename);
    const buf = await fs.readFile(filePath);
    const ext = filename.toLowerCase().endsWith('.png') ? 'png'
      : filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') ? 'jpeg'
      : 'png';
    const dataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;
    imageCache[filename] = dataUrl;
    return dataUrl;
  } catch (err) {
    return ''; // se falhar, retorna vazio (img source ficará vazio)
  }
}

function buildProposalData(p: any) {
  const plano = p.plano_selecionado || 'Plano Plus';
  const monthly = plano.toLowerCase().includes('plus')
    ? (p.mensalidade_plus ?? 0)
    : (p.mensalidade_pro ?? 0);

  const originalValue = (p.valor_implantacao ?? 0) + (p.valor_conversao ?? 0);
  const finalValue = p.valor_final ?? originalValue;

  const validUntil = p.validade
    ? new Date(p.validade).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const modulos: string[] = Array.isArray(p.modulos_inclusos) ? p.modulos_inclusos : [];
  const servicos: string[] = Array.isArray(p.servicos_adicionais) ? p.servicos_adicionais : [];
  const allFeatures = [...modulos, ...servicos];
  const plusFeatures = allFeatures.length > 0 ? allFeatures : [
    'Dashboard e visão gerencial da operação',
    'Ferramentas para análise de desempenho e resultados',
    'Mais recursos para controle e tomada de decisão',
    'Maior apoio para crescimento da operação',
    'Experiência mais robusta para clientes que querem mais gestão',
  ];

  const rawPhone = (p.responsavel_telefone || '').replace(/\D/g, '');
  const clientPhone = rawPhone.startsWith('55') ? rawPhone : '55' + rawPhone;

  return {
    companyName: p.razao_social || '',
    tradeName: p.nome_fantasia || '',
    cnpj: p.cnpj || '',
    segment: p.segmento || '',
    city: p.cidade || '',
    state: p.estado || '',
    clientName: p.responsavel_nome || '',
    clientPhone,
    clientEmail: p.responsavel_email || '',
    sellerName: p.vendedor_nome || '',
    sellerPhone: p.vendedor_telefone || '',
    selectedPlan: plano,
    monthlyValue: monthly,
    setupOriginal: originalValue,
    setupFinal: finalValue,
    entryValue: p.entrada ?? 0,
    installments: p.parcelas ?? 0,
    installmentValue: p.valor_parcela ?? 0,
    validUntil,
    plusFeatures,
    planComparison: [
      { feature: 'PDV / Vendas',               lite: 'Sim',  pro: 'Sim',           plus: 'Sim' },
      { feature: 'Estoque',                     lite: 'Sim',  pro: 'Sim',           plus: 'Sim' },
      { feature: 'Compras',                     lite: 'Sim',  pro: 'Sim',           plus: 'Sim' },
      { feature: 'Financeiro',                  lite: 'Não',  pro: 'Sim',           plus: 'Sim' },
      { feature: 'Dashboard',                   lite: 'Não',  pro: 'Não',           plus: 'Sim' },
      { feature: 'Rentabilidade',               lite: 'Não',  pro: 'Não',           plus: 'Sim' },
      { feature: 'Indicador de perda de vendas',lite: 'Não',  pro: 'Não',           plus: 'Sim' },
      { feature: 'Análises gerenciais',         lite: 'Básico', pro: 'Intermediário', plus: 'Avançado' },
      { feature: 'Suporte ativo',               lite: 'Sim',  pro: 'Sim',           plus: 'Sim' },
      { feature: 'Treinamento 5 meses',         lite: 'Sim',  pro: 'Sim',           plus: 'Sim' },
      { feature: 'Destaque recomendado',        lite: 'Não',  pro: 'Não',           plus: 'Sim' },
    ],
  };
}

function generateHTML(data: any, images: Record<string, string> = {}): string {
  const imgSrc = (key: string, fallbackPath: string) => images[key] || fallbackPath;
  const dataJson = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposta ProSystem — ${data.companyName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    :root {
      --primary: #0D2238;
      --primary-light: #1a3a5c;
      --primary-dark: #061422;
      --secondary: #4B8EC8;
      --secondary-light: #7AAACB;
      --accent: #FF6B35;
      --accent-glow: rgba(255,107,53,0.3);
      --green: #27C97F;
      --bg-deep: #061a2b;
      --bg-mid: #0c2741;
      --bg-surface: rgba(255,255,255,0.05);
      --bg-card: rgba(255,255,255,0.08);
      --text-primary: rgba(255,255,255,0.92);
      --text-secondary: rgba(255,255,255,0.62);
      --text-accent: #4B8EC8;
      --border: rgba(255,255,255,0.08);
      --border-accent: rgba(75,142,200,0.25);
      --shadow-lg: 0 24px 60px rgba(0,0,0,0.35);
      --shadow-glow: 0 0 40px rgba(75,142,200,0.15);
      --radius: 16px;
      --radius-lg: 24px;
      --font: 'Inter', sans-serif;
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: var(--font); background: var(--bg-deep); color: var(--text-primary); }
    a { text-decoration: none; color: inherit; }

    /* ── CANVAS ── */
    #three-canvas {
      position: fixed; inset: 0; z-index: 0;
      pointer-events: none;
    }

    /* ── DECK ── */
    #deck {
      position: fixed; inset: 0; z-index: 1;
      overflow: hidden;
    }
    .slide {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: none;
      padding: 24px;
    }
    .slide.active { opacity: 1; pointer-events: all; }

    /* ── TOP NAV ── */
    #top-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      height: 60px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 32px;
      background: rgba(6,26,43,0.75);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; letter-spacing: -0.02em; }
    .nav-brand img { width: 34px; height: 34px; object-fit: contain; }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .nav-pill {
      font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
      padding: 6px 14px; border-radius: 999px;
      border: 1px solid var(--border-accent); color: var(--secondary-light);
      cursor: pointer; transition: .2s;
    }
    .nav-pill:hover { background: var(--bg-card); }
    .mode-btn {
      font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
      padding: 6px 14px; border-radius: 999px;
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-secondary); cursor: pointer; transition: .2s;
    }
    .mode-btn:hover { color: var(--text-primary); }

    /* ── PROGRESS ── */
    #progress-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
      height: 3px; background: rgba(255,255,255,0.06);
    }
    #progress-fill {
      height: 100%; background: linear-gradient(90deg, var(--secondary), var(--accent));
      transition: width .4s ease;
    }
    #slide-counter {
      position: fixed; bottom: 12px; right: 20px; z-index: 100;
      font-size: 11px; font-weight: 600; color: var(--text-secondary); letter-spacing: .06em;
    }
    #nav-hint {
      position: fixed; bottom: 12px; left: 20px; z-index: 100;
      font-size: 11px; color: var(--text-secondary); letter-spacing: .04em;
    }

    /* ── GLASS CARD ── */
    .glass {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(20px);
    }
    .glass-accent {
      background: var(--bg-card);
      border: 1px solid var(--border-accent);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(20px);
    }

    /* ── EYEBROW ── */
    .eyebrow {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
      color: var(--secondary); margin-bottom: 16px;
    }
    .eyebrow::before { content: ''; width: 24px; height: 2px; background: var(--secondary); border-radius: 2px; }

    /* ── TYPOGRAPHY ── */
    .display-xl { font-size: clamp(38px, 5.5vw, 80px); font-weight: 900; line-height: 1.0; letter-spacing: -0.05em; }
    .display-lg { font-size: clamp(30px, 4vw, 58px); font-weight: 900; line-height: 1.05; letter-spacing: -0.04em; }
    .display-md { font-size: clamp(22px, 3vw, 40px); font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; }
    .body-lg { font-size: clamp(15px, 1.5vw, 18px); color: var(--text-secondary); line-height: 1.65; }
    .body-md { font-size: clamp(13px, 1.2vw, 15px); color: var(--text-secondary); line-height: 1.6; }

    /* ── ACCENT TEXT ── */
    .text-accent { color: var(--secondary); }
    .text-orange { color: var(--accent); }
    .text-green { color: var(--green); }
    .gradient-text {
      background: linear-gradient(135deg, var(--secondary-light) 0%, var(--secondary) 50%, var(--accent) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    /* ── BUTTONS ── */
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 13px 24px; border-radius: 999px;
      font-family: var(--font); font-size: 13px; font-weight: 700; letter-spacing: .02em;
      border: none; cursor: pointer; transition: .25s ease;
      white-space: nowrap;
    }
    .btn:hover { transform: translateY(-2px); }
    .btn-primary {
      background: linear-gradient(135deg, var(--secondary) 0%, #2a6eaf 100%);
      color: #fff; box-shadow: 0 12px 30px rgba(75,142,200,0.3);
    }
    .btn-accent {
      background: linear-gradient(135deg, var(--accent) 0%, #e85a25 100%);
      color: #fff; box-shadow: 0 12px 30px var(--accent-glow);
    }
    .btn-green {
      background: linear-gradient(135deg, var(--green) 0%, #1aaa68 100%);
      color: #fff; box-shadow: 0 12px 30px rgba(39,201,127,0.3);
    }
    .btn-ghost {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .btn-ghost:hover { color: var(--text-primary); border-color: var(--border-accent); }

    /* ── METRIC PILL ── */
    .metric-pill {
      display: flex; flex-direction: column; gap: 2px;
      padding: 16px 22px; border-radius: var(--radius);
      background: var(--bg-card); border: 1px solid var(--border-accent);
    }
    .metric-pill .val { font-size: 26px; font-weight: 900; letter-spacing: -0.04em; color: var(--text-primary); }
    .metric-pill .lbl { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-secondary); }

    /* ── CHECK LIST ── */
    .check-list { display: grid; gap: 10px; }
    .check-item { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text-secondary); }
    .check-icon { width: 18px; height: 18px; flex-shrink: 0; border-radius: 50%; background: rgba(39,201,127,0.15); display: flex; align-items: center; justify-content: center; margin-top: 1px; }
    .check-icon svg { width: 10px; height: 10px; stroke: var(--green); fill: none; stroke-width: 2.5; }

    /* ── MODULE HUB ── */
    #module-hub .hub-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
      width: min(860px, 100%);
    }
    .module-card {
      padding: 28px; border-radius: var(--radius-lg);
      background: var(--bg-card); border: 1px solid var(--border);
      cursor: pointer; transition: .3s ease;
      position: relative; overflow: hidden;
    }
    .module-card::before {
      content: ''; position: absolute; inset: 0; opacity: 0;
      transition: opacity .3s;
    }
    .module-card:hover { border-color: var(--border-accent); transform: translateY(-4px); box-shadow: var(--shadow-glow); }
    .module-card:hover::before { opacity: 1; }
    .module-card .mc-icon { font-size: 32px; margin-bottom: 14px; }
    .module-card .mc-num { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px; }
    .module-card .mc-name { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 6px; }
    .module-card .mc-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.55; }
    .module-card .mc-arrow { position: absolute; top: 20px; right: 20px; width: 28px; height: 28px; border-radius: 50%; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; transition: .3s; }
    .module-card:hover .mc-arrow { background: var(--border-accent); }

    /* ── PLAN TABLE ── */
    .plan-table { width: 100%; border-collapse: collapse; }
    .plan-table th, .plan-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); font-size: 13px; text-align: center; }
    .plan-table th:first-child, .plan-table td:first-child { text-align: left; font-weight: 600; color: var(--text-primary); min-width: 200px; }
    .plan-table th { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--text-secondary); padding-bottom: 14px; }
    .plan-table .plus-col { background: rgba(75,142,200,0.06); }
    .cell-yes { color: var(--green); font-weight: 800; }
    .cell-no { color: rgba(255,255,255,0.25); font-weight: 600; }
    .cell-plus { color: var(--secondary); font-weight: 800; }
    .plan-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .badge-lite { background: rgba(255,255,255,0.06); color: var(--text-secondary); }
    .badge-pro  { background: rgba(75,142,200,0.12); color: var(--secondary-light); }
    .badge-plus { background: rgba(75,142,200,0.2); color: #9ecfff; border: 1px solid var(--border-accent); }

    /* ── PRICE CARD ── */
    .price-card {
      padding: 24px; border-radius: var(--radius);
      background: var(--bg-card); border: 1px solid var(--border);
    }
    .price-card .pc-label { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px; }
    .price-card .pc-old { font-size: 20px; font-weight: 800; color: rgba(255,255,255,0.2); text-decoration: line-through; }
    .price-card .pc-val { font-size: 32px; font-weight: 900; letter-spacing: -0.05em; color: var(--text-primary); line-height: 1.1; }
    .price-card.featured { border-color: var(--border-accent); background: rgba(75,142,200,0.08); }
    .price-card.featured .pc-val { color: var(--secondary-light); font-size: 42px; }

    /* ── WHATSAPP BOX ── */
    .whats-box { padding: 24px; border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border); }
    .whats-text {
      width: 100%; min-height: 140px; border: 1px solid var(--border);
      border-radius: var(--radius); padding: 14px; resize: vertical;
      font-family: var(--font); font-size: 13px; line-height: 1.6;
      color: var(--text-primary); background: rgba(0,0,0,0.2);
    }
    .whats-text:focus { outline: none; border-color: var(--border-accent); }
    .action-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }

    /* ── BACK BTN ── */
    #back-btn {
      position: fixed; top: 70px; left: 20px; z-index: 99;
      display: none;
      align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 999px;
      background: var(--bg-card); border: 1px solid var(--border);
      font-size: 12px; font-weight: 700; color: var(--text-secondary);
      cursor: pointer; transition: .2s;
    }
    #back-btn:hover { color: var(--text-primary); border-color: var(--border-accent); }
    #back-btn.visible { display: flex; }

    /* ── SOCIAL PROOF ── */
    .proof-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-top: 32px; width: min(900px,100%); }
    .proof-card { padding: 24px; border-radius: var(--radius); background: var(--bg-card); border: 1px solid var(--border); text-align: center; }
    .proof-card .pv { font-size: 36px; font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
    .proof-card .pl { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-top: 6px; line-height: 1.4; }

    /* ── MODULE CONTENT LAYOUT ── */
    .mod-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; max-width: 1100px; width: 100%; }
    .mod-layout.full { grid-template-columns: 1fr; max-width: 800px; }
    .mod-img-wrap {
      border-radius: var(--radius-lg); overflow: hidden;
      border: 1px solid var(--border-accent);
      box-shadow: var(--shadow-lg);
      aspect-ratio: 16/10;
      background: var(--bg-mid);
      display: flex; align-items: center; justify-content: center;
    }
    .mod-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .mod-placeholder {
      width: 100%; height: 100%;
      background: linear-gradient(135deg, rgba(75,142,200,0.12), rgba(255,107,53,0.06));
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
    }
    .mod-placeholder .ph-icon { font-size: 48px; opacity: 0.5; }
    .mod-placeholder .ph-text { font-size: 13px; color: var(--text-secondary); font-weight: 600; letter-spacing: .06em; }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      #three-canvas { display: none; }
      #module-hub .hub-grid { grid-template-columns: 1fr; }
      .mod-layout { grid-template-columns: 1fr; }
      .proof-grid { grid-template-columns: repeat(2,1fr); }
      .display-xl { font-size: clamp(28px, 7vw, 44px); }
    }
    @media (max-width: 480px) {
      .proof-grid { grid-template-columns: 1fr 1fr; }
      #top-nav { padding: 0 16px; }
    }

    /* ── UTIL ── */
    .w100 { width: 100%; }
    .mt8 { margin-top: 8px; }
    .mt12 { margin-top: 12px; }
    .mt16 { margin-top: 16px; }
    .mt24 { margin-top: 24px; }
    .mt32 { margin-top: 32px; }
    .gap12 { gap: 12px; }
    .flex { display: flex; }
    .flex-col { display: flex; flex-direction: column; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .text-center { text-align: center; }
    .scroll-x { overflow-x: auto; }
    .max900 { max-width: 900px; width: 100%; }
    .max700 { max-width: 700px; width: 100%; }
  </style>
</head>
<body>

<canvas id="three-canvas"></canvas>

<!-- TOP NAV -->
<nav id="top-nav">
  <div class="nav-brand">
    <img src="${imgSrc('logo', '/logo-prosystem.png')}" alt="ProSystem" onerror="this.style.display='none'">
    <span>ProSystem Sistemas</span>
  </div>
  <div class="nav-right">
    <span class="nav-pill" id="slide-info-nav">Apresentação Comercial</span>
    <button class="mode-btn" onclick="toggleMode()" id="mode-btn-top">Modo: Apresentador</button>
  </div>
</nav>

<!-- BACK BUTTON (inside modules) -->
<button id="back-btn" onclick="returnToHub()">
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2L4 6l4 4"/></svg>
  Módulos
</button>

<!-- PROGRESS -->
<div id="progress-bar"><div id="progress-fill"></div></div>
<div id="slide-counter"></div>
<div id="nav-hint">← → Navegar &nbsp;|&nbsp; ESC Módulos</div>

<!-- DECK -->
<div id="deck">

  <!-- ═══════════════════════════════════════════════════════
       SLIDE 0 — COVER
  ═══════════════════════════════════════════════════════ -->
  <div class="slide" id="slide-0" data-slide="0">
    <div class="flex-col items-center text-center max700" style="gap:28px;">
      <div>
        <div class="eyebrow" style="justify-content:center;">Proposta Comercial &nbsp;•&nbsp; <span id="s0-company">${data.companyName}</span></div>
        <h1 class="display-xl mt8">
          Mais controle, agilidade e<br>
          <span class="gradient-text">inteligência para a sua operação</span>
        </h1>
        <p class="body-lg mt16" style="max-width:560px;margin-left:auto;margin-right:auto;">
          A ProSystem foi criada para resolver exatamente isso — 16 anos construindo soluções que fazem a operação trabalhar por você.
        </p>
      </div>
      <div class="flex gap12 flex-wrap justify-center mt8">
        <div class="metric-pill">
          <span class="val" data-counter="16" data-suffix=" anos">0</span>
          <span class="lbl">No mercado</span>
        </div>
        <div class="metric-pill">
          <span class="val" data-counter-text="24/7">—</span>
          <span class="lbl">Suporte ativo</span>
        </div>
        <div class="metric-pill">
          <span class="val" data-counter="3" data-suffix=" segmentos">0</span>
          <span class="lbl">Atendidos</span>
        </div>
      </div>
      <div class="flex gap12 flex-wrap justify-center mt8">
        <button class="btn btn-primary" onclick="goToSlide(1)">Conheça a ProSystem</button>
        <button class="btn btn-accent" onclick="goToModule(4)">Ver proposta comercial</button>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       SLIDE 1 — QUEM SOMOS
  ═══════════════════════════════════════════════════════ -->
  <div class="slide" id="slide-1" data-slide="1">
    <div class="flex-col max900" style="gap:32px;">
      <div>
        <div class="eyebrow">Nossa história</div>
        <h2 class="display-lg">16 anos transformando<br>o varejo brasileiro</h2>
        <p class="body-lg mt12 max700">
          A ProSystem nasceu da necessidade real do varejo: um sistema que entende a operação, resolve problemas do dia a dia e cresce junto com o negócio. Hoje atendemos farmácias, padarias e varejo com a mesma dedicação desde o início.
        </p>
      </div>
      <div class="flex gap12 flex-wrap">
        <div class="glass-accent" style="padding:20px 24px;flex:1;min-width:180px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--secondary);margin-bottom:8px;">Farmácias</div>
          <div style="font-size:14px;color:var(--text-secondary);">PBMs, NF-e, controle de receituário e compliance farmacêutico integrado</div>
        </div>
        <div class="glass-accent" style="padding:20px 24px;flex:1;min-width:180px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;">Padarias</div>
          <div style="font-size:14px;color:var(--text-secondary);">PDV ágil, produção, perdas e controle de validade com operação em tempo real</div>
        </div>
        <div class="glass-accent" style="padding:20px 24px;flex:1;min-width:180px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--green);margin-bottom:8px;">Varejo geral</div>
          <div style="font-size:14px;color:var(--text-secondary);">ERP completo com estoque, compras, financeiro e análises gerenciais avançadas</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       SLIDE 2 — O DESAFIO
  ═══════════════════════════════════════════════════════ -->
  <div class="slide" id="slide-2" data-slide="2">
    <div class="flex-col max900" style="gap:32px;">
      <div>
        <div class="eyebrow">O cenário do varejo</div>
        <h2 class="display-lg">Gerir varejo no Brasil é<br><span class="text-orange">lidar com complexidade real</span></h2>
        <p class="body-lg mt12 max700">
          Compliance fiscal, margens apertadas e tecnologia que não conversa. Cada dia sem visibilidade é um dia perdendo dinheiro.
        </p>
      </div>
      <div class="flex gap12 flex-wrap">
        <div style="flex:1;min-width:220px;padding:24px;border-radius:var(--radius);background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.2);">
          <div style="font-size:24px;margin-bottom:12px;">⚖️</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;">Compliance fiscal</div>
          <div class="body-md">Medo de multas, NF-e incorreta, SPED desatualizado. O risco tributário pesa sobre cada operação.</div>
        </div>
        <div style="flex:1;min-width:220px;padding:24px;border-radius:var(--radius);background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.2);">
          <div style="font-size:24px;margin-bottom:12px;">📉</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;">Falta de visibilidade</div>
          <div class="body-md">Não saber o que está acontecendo em tempo real é tomar decisões no escuro — e perder margem.</div>
        </div>
        <div style="flex:1;min-width:220px;padding:24px;border-radius:var(--radius);background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.2);">
          <div style="font-size:24px;margin-bottom:12px;">🔁</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;">Retrabalho constante</div>
          <div class="body-md">Processos manuais consomem tempo, geram erros e impedem o crescimento da operação.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       SLIDE 3 — A SOLUÇÃO
  ═══════════════════════════════════════════════════════ -->
  <div class="slide" id="slide-3" data-slide="3">
    <div class="flex-col max900" style="gap:32px;">
      <div>
        <div class="eyebrow">A resposta certa</div>
        <h2 class="display-lg">A ProSystem foi criada para<br><span class="gradient-text">resolver exatamente isso</span></h2>
        <p class="body-lg mt12 max700">
          Um ERP que faz a operação trabalhar por você — integrando vendas, estoque, financeiro e compliance em uma plataforma única, com suporte humano de verdade.
        </p>
      </div>
      <div class="flex gap12 flex-wrap">
        <div class="glass-accent" style="padding:24px;flex:1;min-width:220px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(75,142,200,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;">🔗</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;color:var(--text-primary);">ERP Integrado</div>
          <div class="body-md">Vendas, estoque, financeiro em um só sistema. Sem planilhas, sem retrabalho, sem informação perdida.</div>
        </div>
        <div class="glass-accent" style="padding:24px;flex:1;min-width:220px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(39,201,127,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;">✅</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;color:var(--text-primary);">Compliance Total</div>
          <div class="body-md">NF-e, NFC-e, SPED, PBMs — tudo incluído e atualizado automaticamente para manter sua operação segura.</div>
        </div>
        <div class="glass-accent" style="padding:24px;flex:1;min-width:220px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(255,107,53,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;">🤝</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;color:var(--text-primary);">Suporte Ativo</div>
          <div class="body-md">Atendimento humanizado das 7h às 22h, com técnicos preparados para resolver e orientar de verdade.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       SLIDE 4 — MODULE HUB
  ═══════════════════════════════════════════════════════ -->
  <div class="slide" id="slide-4" data-slide="4" id="module-hub">
    <div class="flex-col items-center" style="gap:28px;width:100%;">
      <div class="text-center">
        <div class="eyebrow" style="justify-content:center;">Explore a proposta</div>
        <h2 class="display-md">Escolha um módulo para aprofundar</h2>
        <p class="body-md mt8" style="max-width:500px;margin:8px auto 0;">Use as teclas 1–4 ou clique nos cards para navegar pelos módulos</p>
      </div>
      <div class="hub-grid" id="hub-grid"></div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       MÓDULO 1 — GESTÃO DO NEGÓCIO (slides 5–8)
  ═══════════════════════════════════════════════════════ -->
  <!-- SLIDE 5: Contexto -->
  <div class="slide" id="slide-5" data-slide="5" data-module="1">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#4B8EC8;">Módulo 1 — Gestão do Negócio</div>
        <h2 class="display-lg">Sua operação<br><span class="text-accent">em um só lugar</span></h2>
        <p class="body-lg mt12">PDV, Estoque e Compras integrados — sem gaps de informação, sem retrabalho, sem surpresa no fechamento.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>PDV ágil com NFC-e integrado</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Estoque em tempo real, por produto e localização</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Compras e sugestão automática de reposição</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Fechamento de caixa simplificado</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <img src="${imgSrc('hero', '/imagem-hero.png')}" alt="Gestão do Negócio" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="mod-placeholder" style="display:none"><div class="ph-icon">🏪</div><div class="ph-text">PDV & Estoque</div></div>
      </div>
    </div>
  </div>

  <!-- SLIDE 6: PDV/Estoque -->
  <div class="slide" id="slide-6" data-slide="6" data-module="1">
    <div class="mod-layout">
      <div class="mod-img-wrap">
        <div class="mod-placeholder"><div class="ph-icon">🖥️</div><div class="ph-text">Tela PDV</div></div>
      </div>
      <div>
        <div class="eyebrow" style="color:#4B8EC8;">PDV & Estoque</div>
        <h2 class="display-lg">Velocidade na<br>frente de caixa</h2>
        <p class="body-lg mt12">O PDV da ProSystem foi projetado para fluxo intenso — emissão de NFC-e em menos de 2 segundos, integrado direto com o estoque e o financeiro.</p>
        <div class="flex gap12 flex-wrap mt24">
          <div class="metric-pill"><span class="val">&lt;2s</span><span class="lbl">Emissão NFC-e</span></div>
          <div class="metric-pill"><span class="val">100%</span><span class="lbl">Compliance fiscal</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- SLIDE 7: Integração -->
  <div class="slide" id="slide-7" data-slide="7" data-module="1">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#4B8EC8;">Integração</div>
        <h2 class="display-lg">Compras que<br><span class="text-accent">se reposicionam sozinhas</span></h2>
        <p class="body-lg mt12">O módulo de compras analisa histórico de vendas, estoque mínimo e curva ABC para gerar sugestões automáticas — reduzindo ruptura e excesso.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Sugestão automática de pedido de compra</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Curva ABC de produtos integrada</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Indicador de perda e ruptura de estoque</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="mod-placeholder"><div class="ph-icon">📦</div><div class="ph-text">Módulo Compras</div></div>
      </div>
    </div>
  </div>

  <!-- SLIDE 8: Resultado -->
  <div class="slide" id="slide-8" data-slide="8" data-module="1">
    <div class="flex-col items-center text-center max700" style="gap:24px;">
      <div class="eyebrow" style="justify-content:center;color:#4B8EC8;">Resultado esperado</div>
      <h2 class="display-lg">Operação integrada,<br><span class="gradient-text">resultado visível</span></h2>
      <p class="body-lg">Com PDV, Estoque e Compras no mesmo sistema, sua equipe trabalha menos e entrega mais — com menos erros e mais visibilidade para o gestor.</p>
      <button class="btn btn-primary" onclick="returnToHub()">Ver outros módulos</button>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       MÓDULO 2 — CONTROLE FINANCEIRO (slides 9–12)
  ═══════════════════════════════════════════════════════ -->
  <!-- SLIDE 9: Contexto -->
  <div class="slide" id="slide-9" data-slide="9" data-module="2">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#27C97F;">Módulo 2 — Controle Financeiro</div>
        <h2 class="display-lg">Saiba exatamente<br><span class="text-green">onde está o dinheiro</span></h2>
        <p class="body-lg mt12">Dashboard gerencial, análise de rentabilidade e relatórios estratégicos — tudo para que o gestor tome decisões com dados, não com intuição.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Contas a pagar e receber integradas</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Fluxo de caixa em tempo real</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Conciliação bancária automática</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>DRE gerencial por período</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <img src="${imgSrc('relatorios', '/tela-relatorios.png')}" alt="Controle Financeiro" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="mod-placeholder" style="display:none"><div class="ph-icon">📊</div><div class="ph-text">Painel Financeiro</div></div>
      </div>
    </div>
  </div>

  <!-- SLIDE 10: Dashboard -->
  <div class="slide" id="slide-10" data-slide="10" data-module="2">
    <div class="mod-layout">
      <div class="mod-img-wrap">
        <img src="${imgSrc('dashboard', '/tela-dashboard.png')}" alt="Dashboard" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="mod-placeholder" style="display:none"><div class="ph-icon">📈</div><div class="ph-text">Dashboard Gerencial</div></div>
      </div>
      <div>
        <div class="eyebrow" style="color:#27C97F;">Dashboard</div>
        <h2 class="display-lg">O negócio inteiro<br>em uma tela</h2>
        <p class="body-lg mt12">O dashboard do Plano Plus consolida vendas, margem, inadimplência e estoque — atualizado em tempo real, disponível de qualquer dispositivo.</p>
        <div class="flex gap12 flex-wrap mt24">
          <div class="metric-pill"><span class="val">Tempo real</span><span class="lbl">Atualização</span></div>
          <div class="metric-pill"><span class="val">Plano Plus</span><span class="lbl">Exclusivo</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- SLIDE 11: Rentabilidade -->
  <div class="slide" id="slide-11" data-slide="11" data-module="2">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#27C97F;">Rentabilidade</div>
        <h2 class="display-lg">Margem real,<br><span class="text-green">produto por produto</span></h2>
        <p class="body-lg mt12">Identifique quais produtos realmente lucram, quais apenas giram e onde está a perda de margem — com análise de rentabilidade detalhada e comparativa.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Margem bruta por produto e categoria</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Indicador de perda de vendas</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Comparativo por período e por vendedor</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="mod-placeholder"><div class="ph-icon">💹</div><div class="ph-text">Análise de Rentabilidade</div></div>
      </div>
    </div>
  </div>

  <!-- SLIDE 12: Decisões -->
  <div class="slide" id="slide-12" data-slide="12" data-module="2">
    <div class="flex-col items-center text-center max700" style="gap:24px;">
      <div class="eyebrow" style="justify-content:center;color:#27C97F;">Resultado esperado</div>
      <h2 class="display-lg">Decisões baseadas<br><span class="gradient-text">em dados reais</span></h2>
      <p class="body-lg">Com o Controle Financeiro da ProSystem, o gestor sai da intuição e passa a gerir com indicadores — reduzindo perdas e aumentando a margem real da operação.</p>
      <button class="btn btn-green" onclick="returnToHub()">Ver outros módulos</button>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       MÓDULO 3 — SUPORTE & TREINAMENTO (slides 13–16)
  ═══════════════════════════════════════════════════════ -->
  <!-- SLIDE 13: Contexto -->
  <div class="slide" id="slide-13" data-slide="13" data-module="3">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#FF6B35;">Módulo 3 — Suporte & Treinamento</div>
        <h2 class="display-lg">Suporte que<br><span class="text-orange">resolve de verdade</span></h2>
        <p class="body-lg mt12">Não é um chatbot. Não é uma fila de e-mail. É atendimento humano, ativo e especializado — das 7h às 22h, todos os dias úteis.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Atendimento humanizado por técnicos especializados</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Canal direto — sem fila, sem ticket perdido</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Resposta ágil dentro da janela operacional</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Suporte assistido durante os 5 meses de treinamento</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <img src="${imgSrc('whatsapp', '/tela-whatsapp.png')}" alt="Suporte ProSystem" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="mod-placeholder" style="display:none"><div class="ph-icon">🤝</div><div class="ph-text">Canal de Suporte</div></div>
      </div>
    </div>
  </div>

  <!-- SLIDE 14: Horários -->
  <div class="slide" id="slide-14" data-slide="14" data-module="3">
    <div class="flex-col items-center text-center max700" style="gap:28px;">
      <div>
        <div class="eyebrow" style="justify-content:center;color:#FF6B35;">Disponibilidade</div>
        <h2 class="display-lg">7h às 22h — <span class="text-orange">todos os dias úteis</span></h2>
        <p class="body-lg mt12">A janela de suporte da ProSystem cobre toda a operação do varejo, do recebimento matutino ao fechamento noturno.</p>
      </div>
      <div class="flex gap12 flex-wrap justify-center">
        <div style="padding:24px 32px;border-radius:var(--radius);background:rgba(255,107,53,0.1);border:1px solid rgba(255,107,53,0.25);text-align:center;">
          <div style="font-size:42px;font-weight:900;letter-spacing:-0.05em;color:var(--accent);">7h–22h</div>
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-top:6px;">Janela de atendimento</div>
        </div>
        <div style="padding:24px 32px;border-radius:var(--radius);background:rgba(75,142,200,0.1);border:1px solid var(--border-accent);text-align:center;">
          <div style="font-size:42px;font-weight:900;letter-spacing:-0.05em;color:var(--secondary);">5 meses</div>
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-top:6px;">Treinamento incluso</div>
        </div>
        <div style="padding:24px 32px;border-radius:var(--radius);background:rgba(39,201,127,0.1);border:1px solid rgba(39,201,127,0.25);text-align:center;">
          <div style="font-size:42px;font-weight:900;letter-spacing:-0.05em;color:var(--green);">Humano</div>
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-top:6px;">Técnico real, não bot</div>
        </div>
      </div>
    </div>
  </div>

  <!-- SLIDE 15: Treinamento -->
  <div class="slide" id="slide-15" data-slide="15" data-module="3">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#FF6B35;">Treinamento</div>
        <h2 class="display-lg">5 meses para<br><span class="text-orange">dominar o sistema</span></h2>
        <p class="body-lg mt12">O programa de treinamento da ProSystem acompanha o cliente desde a implantação até a operação autônoma — com suporte assistido em cada etapa.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Mês 1–2: Implantação e configuração assistida</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Mês 3: Treinamento da equipe operacional</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Mês 4–5: Uso avançado e gestão gerencial</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Suporte técnico ativo durante todo o período</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="mod-placeholder"><div class="ph-icon">🎓</div><div class="ph-text">Programa de Treinamento</div></div>
      </div>
    </div>
  </div>

  <!-- SLIDE 16: Compromisso -->
  <div class="slide" id="slide-16" data-slide="16" data-module="3">
    <div class="flex-col items-center text-center max700" style="gap:24px;">
      <div class="eyebrow" style="justify-content:center;color:#FF6B35;">Compromisso ProSystem</div>
      <h2 class="display-lg">Não vendemos software.<br><span class="text-orange">Vendemos resultado.</span></h2>
      <p class="body-lg">Nosso compromisso começa na implantação e não termina nunca. O suporte ativo é um diferencial que mantemos há 16 anos — e é o que nossos clientes mais valorizam.</p>
      <button class="btn btn-accent" onclick="returnToHub()">Ver outros módulos</button>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       MÓDULO 4 — PROPOSTA COMERCIAL (slides 17–20)
  ═══════════════════════════════════════════════════════ -->
  <!-- SLIDE 17: Comparativo Planos -->
  <div class="slide" id="slide-17" data-slide="17" data-module="4">
    <div class="flex-col max900" style="gap:24px;">
      <div>
        <div class="eyebrow" style="color:#F59E0B;">Módulo 4 — Proposta Comercial</div>
        <h2 class="display-md">Comparativo de planos</h2>
        <p class="body-md mt8">Veja o que cada plano inclui e por que o <span id="s17-plan" style="color:#9ecfff;font-weight:800;">${data.selectedPlan}</span> é a recomendação para sua operação.</p>
      </div>
      <div class="glass scroll-x" style="padding:20px;">
        <table class="plan-table" id="plan-table-main"></table>
      </div>
    </div>
  </div>

  <!-- SLIDE 18: Valores Especiais -->
  <div class="slide" id="slide-18" data-slide="18" data-module="4">
    <div class="flex-col max900" style="gap:24px;">
      <div>
        <div class="eyebrow" style="color:#F59E0B;">Condição especial</div>
        <h2 class="display-lg">Proposta exclusiva para<br><span id="s18-company" style="color:#F59E0B;">${data.companyName || 'sua empresa'}</span></h2>
        <p class="body-md mt8">Esta proposta foi preparada especialmente para sua operação, com condições que refletem o volume e o perfil do seu negócio.</p>
      </div>
      <div class="flex gap12 flex-wrap">
        <div class="price-card" style="flex:1;min-width:160px;">
          <div class="pc-label">Implantação original</div>
          <div class="pc-old" id="s18-original">R$ 0,00</div>
        </div>
        <div class="price-card featured" style="flex:1;min-width:160px;">
          <div class="pc-label">Valor especial negociado</div>
          <div class="pc-val" id="s18-final">R$ 0,00</div>
        </div>
        <div class="price-card" style="flex:1;min-width:160px;">
          <div class="pc-label">Mensalidade do plano</div>
          <div class="pc-val" style="color:var(--green);" id="s18-monthly">R$ 0,00</div>
        </div>
      </div>
      <div class="glass" style="padding:16px 20px;">
        <div class="flex gap12 flex-wrap items-center">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);">Plano recomendado:</div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary);" id="s18-plan">${data.selectedPlan}</div>
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-left:auto;">Válida até:</div>
          <div style="font-size:15px;font-weight:800;color:var(--accent);" id="s18-valid">${data.validUntil || '—'}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- SLIDE 19: Formas de Pagamento -->
  <div class="slide" id="slide-19" data-slide="19" data-module="4">
    <div class="flex-col max900" style="gap:24px;">
      <div>
        <div class="eyebrow" style="color:#F59E0B;">Condições de pagamento</div>
        <h2 class="display-md">Formas de pagamento<br>para a implantação</h2>
      </div>
      <div class="flex gap12 flex-wrap">
        <div class="price-card" style="flex:1;min-width:200px;">
          <div class="pc-label">Entrada</div>
          <div class="pc-val" id="s19-entry">—</div>
        </div>
        <div class="price-card" style="flex:1;min-width:200px;">
          <div class="pc-label">Parcelamento</div>
          <div class="pc-val" id="s19-installments">—</div>
        </div>
        <div class="price-card featured" style="flex:2;min-width:220px;">
          <div class="pc-label">Total implantação</div>
          <div class="pc-val" id="s19-total">—</div>
        </div>
      </div>
      <div class="glass" style="padding:16px 20px;">
        <div class="check-list">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Implantação inclui configuração completa do sistema</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Conversão de dados do sistema anterior (se aplicável)</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>5 meses de treinamento e suporte assistido inclusos</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- SLIDE 20: Validade + WhatsApp -->
  <div class="slide" id="slide-20" data-slide="20" data-module="4">
    <div class="flex-col max900" style="gap:20px;">
      <div>
        <div class="eyebrow" style="color:#F59E0B;">Aceite a proposta</div>
        <h2 class="display-md">Esta proposta é válida até <span class="text-orange" id="s20-valid">${data.validUntil || '—'}</span></h2>
        <p class="body-md mt8">Entre em contato com <strong style="color:var(--text-primary);" id="s20-seller">${data.sellerName}</strong> para confirmar e dar início à implantação.</p>
      </div>
      <div class="flex gap12 flex-wrap">
        <button class="btn btn-green" id="accept-whatsapp-btn">Aceitar via WhatsApp</button>
        <button class="btn btn-ghost" onclick="window.print()">Salvar em PDF</button>
      </div>
      <div class="whats-box">
        <div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:14px;">Resumo para enviar no WhatsApp</div>
        <textarea class="whats-text" id="whats-text-area" readonly></textarea>
        <div class="action-row">
          <button class="btn btn-green" onclick="copyWhatsAppText()">Copiar resumo WhatsApp</button>
          <button class="btn btn-primary" onclick="openWhatsApp()">Abrir no WhatsApp</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       SLIDE 21 — PROVA SOCIAL
  ═══════════════════════════════════════════════════════ -->
  <div class="slide" id="slide-21" data-slide="21">
    <div class="flex-col items-center text-center" style="gap:28px;width:100%;">
      <div>
        <div class="eyebrow" style="justify-content:center;">16 anos de confiança</div>
        <h2 class="display-lg">O varejo escolhe<br><span class="gradient-text">a ProSystem há 16 anos</span></h2>
        <p class="body-lg mt12" style="max-width:560px;margin-left:auto;margin-right:auto;">
          Não somos uma startup prometendo transformação digital. Somos um parceiro operacional testado pelo tempo — com suporte real e resultados mensuráveis.
        </p>
      </div>
      <div class="proof-grid">
        <div class="proof-card">
          <div class="pv" style="color:var(--secondary);" data-counter="16" data-suffix=" anos">0</div>
          <div class="pl">No mercado varejista</div>
        </div>
        <div class="proof-card">
          <div class="pv" style="color:var(--accent);" data-counter="3" data-suffix=" segmentos">0</div>
          <div class="pl">Farmácias, padarias e varejo</div>
        </div>
        <div class="proof-card">
          <div class="pv" style="color:var(--green);">7h–22h</div>
          <div class="pl">Janela de suporte ativo</div>
        </div>
        <div class="proof-card">
          <div class="pv" style="color:#F59E0B);" data-counter="5" data-suffix=" meses">0</div>
          <div class="pl">Treinamento para novos clientes</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       SLIDE 22 — CTA FINAL
  ═══════════════════════════════════════════════════════ -->
  <div class="slide" id="slide-22" data-slide="22">
    <div class="flex-col items-center text-center max700" style="gap:28px;">
      <div>
        <div class="eyebrow" style="justify-content:center;">Próximo passo</div>
        <h1 class="display-xl">Vamos começar?</h1>
        <p class="body-lg mt16">
          A proposta é válida até <strong class="text-accent" id="cta-valid">${data.validUntil || '—'}</strong>.<br>
          Responda no WhatsApp agora e comece a transformar sua operação.
        </p>
      </div>
      <div class="flex gap12 flex-wrap justify-center">
        <button class="btn btn-green" id="cta-whatsapp-btn" style="font-size:15px;padding:16px 32px;">Aceitar via WhatsApp</button>
        <button class="btn btn-ghost" onclick="goToModule(4)" style="font-size:15px;padding:16px 24px;">Rever proposta comercial</button>
      </div>
      <div style="font-size:13px;color:var(--text-secondary);">
        Vendedor: <strong style="color:var(--text-primary);" id="cta-seller">${data.sellerName}</strong> &nbsp;|&nbsp;
        <span id="cta-phone">${data.sellerPhone}</span>
      </div>
    </div>
  </div>

</div><!-- /deck -->

<script>
  // ── DATA ────────────────────────────────────────────────
  const proposalData = ${dataJson};

  // ── SLIDES CONFIG ───────────────────────────────────────
  const TOTAL_SLIDES = 23;
  const HUB_SLIDE = 4;
  const modules = [
    { id:1, name:'Gestão do Negócio',   desc:'PDV, Estoque e Compras integrados para sua operação', icon:'🏪', color:'#4B8EC8', slides:[5,6,7,8] },
    { id:2, name:'Controle Financeiro', desc:'Dashboard, Rentabilidade e Análises gerenciais',        icon:'📊', color:'#27C97F', slides:[9,10,11,12] },
    { id:3, name:'Suporte & Treinamento',desc:'7h–22h, atendimento humano, 5 meses de treinamento',  icon:'🤝', color:'#FF6B35', slides:[13,14,15,16] },
    { id:4, name:'Proposta Comercial',  desc:'Condições especiais personalizadas para o seu negócio', icon:'📋', color:'#F59E0B', slides:[17,18,19,20] },
  ];

  let currentSlide = 0;
  let presenterMode = true;
  let selfServiceTimer = null;
  let hasKeyboard = false;
  let inModule = false;
  let currentModuleId = null;
  const slideEls = Array.from(document.querySelectorAll('.slide'));

  // ── UTILS ───────────────────────────────────────────────
  function formatMoney(v) {
    return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }
  function onlyNumbers(v) { return String(v||'').replace(/\\D/g,''); }

  // ── THREE.JS PARTICLES ──────────────────────────────────
  (function initThree() {
    if (window.innerWidth < 769) return;
    const canvas = document.getElementById('three-canvas');
    if (!window.THREE) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const count = 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color('#4B8EC8');
    const c2 = new THREE.Color('#FF6B35');
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 14;
      positions[i*3+1] = (Math.random() - 0.5) * 14;
      positions[i*3+2] = (Math.random() - 0.5) * 8;
      const mix = Math.random();
      const col = c1.clone().lerp(c2, mix);
      colors[i*3]   = col.r;
      colors[i*3+1] = col.g;
      colors[i*3+2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.55 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let lastTime = 0;
    const FPS_CAP = 30;
    function animate(time) {
      requestAnimationFrame(animate);
      if (time - lastTime < 1000/FPS_CAP) return;
      lastTime = time;
      if (document.hidden) return;
      points.rotation.y += 0.0008;
      points.rotation.x += 0.0003;
      renderer.render(scene, camera);
    }
    animate(0);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  })();

  // ── BUILD HUB GRID ──────────────────────────────────────
  function buildHubGrid() {
    const grid = document.getElementById('hub-grid');
    grid.innerHTML = modules.map((m,i) => \`
      <div class="module-card" onclick="goToModule(\${m.id})" style="--mc:#\${m.color.replace('#','')}">
        <div class="mc-num">Módulo \${m.id} &nbsp; <kbd style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.08);font-family:monospace;">\${m.id}</kbd></div>
        <div class="mc-icon">\${m.icon}</div>
        <div class="mc-name" style="color:\${m.color}">\${m.name}</div>
        <div class="mc-desc">\${m.desc}</div>
        <div class="mc-arrow">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2l4 3-4 3"/></svg>
        </div>
      </div>
    \`).join('');
  }

  // ── BUILD PLAN TABLE ────────────────────────────────────
  function buildPlanTable() {
    const tbl = document.getElementById('plan-table-main');
    if (!tbl) return;
    const rows = proposalData.planComparison.map(row => {
      const fmtCell = (v, col) => {
        if (v === 'Sim') return \`<span class="cell-yes">✓ Sim</span>\`;
        if (v === 'Não') return \`<span class="cell-no">— Não</span>\`;
        return \`<span class="cell-\${col}">\${v}</span>\`;
      };
      return \`<tr>
        <td>\${row.feature}</td>
        <td>\${fmtCell(row.lite,'lite')}</td>
        <td>\${fmtCell(row.pro,'pro')}</td>
        <td class="plus-col">\${fmtCell(row.plus,'plus')}</td>
      </tr>\`;
    }).join('');
    tbl.innerHTML = \`<thead><tr>
      <th>Funcionalidade</th>
      <th><span class="plan-badge badge-lite">Lite</span></th>
      <th><span class="plan-badge badge-pro">Pro</span></th>
      <th class="plus-col"><span class="plan-badge badge-plus">Plus ★</span></th>
    </tr></thead><tbody>\${rows}</tbody>\`;
  }

  // ── PROPOSAL DATA INJECTION ─────────────────────────────
  function injectProposalData() {
    const $ = id => document.getElementById(id);
    const set = (id, txt) => { const el=$(id); if(el) el.textContent = txt; };

    set('s18-original', formatMoney(proposalData.setupOriginal));
    set('s18-final',    formatMoney(proposalData.setupFinal));
    set('s18-monthly',  formatMoney(proposalData.monthlyValue));
    set('s18-plan',     proposalData.selectedPlan);
    set('s18-valid',    proposalData.validUntil || '—');
    set('s17-plan',     proposalData.selectedPlan);
    set('s18-company',  proposalData.companyName || 'sua empresa');

    set('s19-entry', proposalData.entryValue > 0 ? formatMoney(proposalData.entryValue) : 'A combinar');
    set('s19-installments', proposalData.installments > 0
      ? \`\${proposalData.installments}x de \${formatMoney(proposalData.installmentValue)}\`
      : 'À vista');
    set('s19-total', formatMoney(proposalData.setupFinal));

    set('s20-valid',  proposalData.validUntil || '—');
    set('s20-seller', proposalData.sellerName  || '—');
    set('cta-valid',  proposalData.validUntil  || '—');
    set('cta-seller', proposalData.sellerName  || '—');
    set('cta-phone',  proposalData.sellerPhone || '—');

    // CTA accept links
    const acceptMsg = encodeURIComponent(
      'Olá, quero aceitar a proposta da ProSystem para ' + proposalData.companyName + '. Podemos dar sequência.'
    );
    const sellerNum = '55' + onlyNumbers(proposalData.sellerPhone);
    const setHref = (id, url) => { const el=$(id); if(el) el.onclick = () => window.open(url,'_blank'); };
    setHref('accept-whatsapp-btn', \`https://wa.me/\${sellerNum}?text=\${acceptMsg}\`);
    setHref('cta-whatsapp-btn',    \`https://wa.me/\${sellerNum}?text=\${acceptMsg}\`);
  }

  // ── WHATSAPP SUMMARY ────────────────────────────────────
  function buildWhatsAppSummary() {
    const p = proposalData;
    const lines = [
      \`Olá, \${p.clientName}! Tudo bem?\`,
      '',
      \`Segue a proposta comercial da ProSystem para \${p.companyName}.\`,
      '',
      'Resumo da proposta:',
      \`• Plano recomendado: \${p.selectedPlan}\`,
      \`• Mensalidade: \${formatMoney(p.monthlyValue)}\`,
      \`• Valor original da implantação: \${formatMoney(p.setupOriginal)}\`,
      \`• Valor especial da implantação: \${formatMoney(p.setupFinal)}\`,
      p.entryValue > 0 ? \`• Entrada: \${formatMoney(p.entryValue)}\` : null,
      p.installments > 0 ? \`• Parcelamento: \${p.installments}x de \${formatMoney(p.installmentValue)}\` : null,
      \`• Validade da proposta: \${p.validUntil || 'A combinar'}\`,
      '',
      'Destaques inclusos:',
      ...p.plusFeatures.slice(0,4).map(f => '• ' + f),
      '',
      'Diferenciais ProSystem:',
      '• Suporte ativo e humanizado das 7h às 22h',
      '• Técnicos prontos para auxiliar no dia a dia',
      '• Treinamento de 5 meses para novos clientes',
      '• 16 anos de experiência no varejo',
      '',
      'Fico à disposição para dar sequência.',
      '',
      'Atenciosamente,',
      p.sellerName,
      p.sellerPhone,
    ].filter(l => l !== null);
    const ta = document.getElementById('whats-text-area');
    if (ta) ta.value = lines.join('\\n');
  }

  function copyWhatsAppText() {
    const ta = document.getElementById('whats-text-area');
    if (!ta) return;
    ta.select(); ta.setSelectionRange(0,99999);
    try { document.execCommand('copy'); } catch(e) { navigator.clipboard && navigator.clipboard.writeText(ta.value); }
    alert('Resumo copiado com sucesso!');
  }
  function openWhatsApp() {
    const ta = document.getElementById('whats-text-area');
    const text = ta ? ta.value : '';
    const phone = onlyNumbers(proposalData.clientPhone);
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank');
  }

  // ── SLIDE NAVIGATION ────────────────────────────────────
  function showSlide(index, direction) {
    if (index < 0 || index >= TOTAL_SLIDES) return;
    const prev = slideEls[currentSlide];
    const next = slideEls[index];
    if (!next) return;

    const dir = direction || (index > currentSlide ? 1 : -1);

    // Hide current
    if (prev && prev !== next) {
      gsap.to(prev, {
        opacity: 0, x: dir * -60, duration: 0.4, ease: 'power2.in',
        onComplete: () => { prev.classList.remove('active'); prev.style.pointerEvents='none'; gsap.set(prev,{x:0}); }
      });
    }

    currentSlide = index;
    updateUI();

    // Prepare next
    gsap.set(next, { opacity: 0, x: dir * 80 });
    next.classList.add('active');
    next.style.pointerEvents = 'all';

    // Animate in
    gsap.to(next, { opacity: 1, x: 0, duration: 0.55, ease: 'power3.out' });

    // Stagger children
    const children = Array.from(next.children);
    if (children.length) {
      gsap.fromTo(children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', stagger: 0.08, delay: 0.12 }
      );
    }

    // Counters
    next.querySelectorAll('[data-counter]').forEach(el => {
      const target = parseInt(el.dataset.counter, 10);
      const suffix = el.dataset.suffix || '';
      gsap.to({v:0}, {
        v: target, duration: 1.8, ease: 'power2.out', delay: 0.3,
        onUpdate: function() { el.textContent = Math.round(this.targets()[0].v) + suffix; }
      });
    });
    next.querySelectorAll('[data-counter-text]').forEach(el => {
      setTimeout(() => { el.textContent = el.dataset.counterText; }, 400);
    });

    // Module state
    const modId = next.dataset.module ? parseInt(next.dataset.module) : null;
    inModule = !!modId;
    currentModuleId = modId;
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.classList.toggle('visible', inModule);
  }

  function goToSlide(index) { showSlide(index); }

  function goToModule(modId) {
    const m = modules.find(x => x.id === modId);
    if (!m) return;
    showSlide(m.slides[0]);
  }

  function returnToHub() {
    showSlide(HUB_SLIDE, -1);
  }

  function nextSlide() {
    if (currentSlide >= TOTAL_SLIDES - 1) return;
    // If in module, clamp to module boundary then go back to hub
    if (inModule && currentModuleId) {
      const m = modules.find(x => x.id === currentModuleId);
      if (m) {
        const lastModSlide = m.slides[m.slides.length - 1];
        if (currentSlide === lastModSlide) { returnToHub(); return; }
      }
    }
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    if (currentSlide <= 0) return;
    showSlide(currentSlide - 1, -1);
  }

  // ── UPDATE UI ───────────────────────────────────────────
  function updateUI() {
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = ((currentSlide / (TOTAL_SLIDES-1)) * 100) + '%';
    const counter = document.getElementById('slide-counter');
    if (counter) counter.textContent = (currentSlide+1) + ' / ' + TOTAL_SLIDES;
  }

  // ── MODE TOGGLE ─────────────────────────────────────────
  function toggleMode() {
    presenterMode = !presenterMode;
    const btn = document.getElementById('mode-btn-top');
    if (btn) btn.textContent = 'Modo: ' + (presenterMode ? 'Apresentador' : 'Auto-serviço');
    document.body.classList.toggle('self-service', !presenterMode);
  }

  // ── KEYBOARD ────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (!hasKeyboard) {
      hasKeyboard = true;
      clearTimeout(selfServiceTimer);
    }
    switch(e.key) {
      case 'ArrowRight': case ' ': e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft':  e.preventDefault(); prevSlide(); break;
      case 'Escape': if (inModule) { e.preventDefault(); returnToHub(); } break;
      case '1': if (currentSlide === HUB_SLIDE) goToModule(1); break;
      case '2': if (currentSlide === HUB_SLIDE) goToModule(2); break;
      case '3': if (currentSlide === HUB_SLIDE) goToModule(3); break;
      case '4': if (currentSlide === HUB_SLIDE) goToModule(4); break;
    }
  });

  // ── TOUCH SWIPE ─────────────────────────────────────────
  let touchStartX = 0;
  document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, {passive:true});
  document.addEventListener('touchend', e => {
    const dx = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 50) { dx > 0 ? nextSlide() : prevSlide(); }
  }, {passive:true});

  // ── SELF-SERVICE TIMER ──────────────────────────────────
  function startSelfServiceTimer() {
    selfServiceTimer = setTimeout(() => {
      if (!hasKeyboard) {
        presenterMode = false;
        document.body.classList.add('self-service');
        const btn = document.getElementById('mode-btn-top');
        if (btn) btn.textContent = 'Modo: Auto-serviço';
      }
    }, 8000);
  }

  // ── INIT ─────────────────────────────────────────────────
  function init() {
    buildHubGrid();
    buildPlanTable();
    injectProposalData();
    buildWhatsAppSummary();
    showSlide(0);
    startSelfServiceTimer();
    updateUI();
  }
  init();
</script>
</body>
</html>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const res = await fetch(`${API_URL}/p/${token}`, { cache: 'no-store' });
    if (!res.ok) {
      return new NextResponse(
        '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#061a2b;color:#fff"><h2>Proposta não encontrada ou expirada.</h2></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const json = await res.json();
    if (json.status !== 'success' || !json.data) {
      return new NextResponse(
        '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#061a2b;color:#fff"><h2>Proposta não encontrada.</h2></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const data = buildProposalData(json.data);

    // Carrega TODAS as imagens como base64 inline — assim a proposta
    // funciona perfeitamente tanto na web quanto em downloads offline
    const [logo, hero, dashboard, whatsapp, relatorios] = await Promise.all([
      loadImageAsDataUrl('logo-prosystem.png'),
      loadImageAsDataUrl('imagem-hero.png'),
      loadImageAsDataUrl('tela-dashboard.png'),
      loadImageAsDataUrl('tela-whatsapp.png'),
      loadImageAsDataUrl('tela-relatorios.png'),
    ]);
    const images = { logo, hero, dashboard, whatsapp, relatorios };

    const html = generateHTML(data, images);
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch {
    return new NextResponse(
      '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#061a2b;color:#fff"><h2>Erro ao carregar proposta.</h2></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
