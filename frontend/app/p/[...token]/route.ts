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
  const monthlyPro  = p.mensalidade_pro  ?? 0;
  const monthlyPlus = p.mensalidade_plus ?? 0;
  // Plus é sempre o plano recomendado → a mensalidade-destaque é a do Plus
  // (fallback para a lógica do plano selecionado se a do Plus não foi preenchida)
  const monthly = monthlyPlus > 0
    ? monthlyPlus
    : (plano.toLowerCase().includes('plus') ? monthlyPlus : monthlyPro);

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
    plano_selecionado: p.plano_selecionado || '',
    recommendedPlan: 'Plus',
    monthlyValue: monthly,
    monthlyPro,
    monthlyPlus,
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

function generateHTML(data: any, images: Record<string, string> = {}, token = '', apiUrl = ''): string {
  const imgSrc = (key: string, fallbackPath: string) => images[key] || fallbackPath;
  const dataJson = JSON.stringify(data);
  const tokenJson = JSON.stringify(token);
  const apiUrlJson = JSON.stringify(apiUrl);

  // Tema do accent por segmento/plano: farmácia = ciano; varejo/padaria/MEI = laranja
  const themeKey = `${data.selectedPlan || ''} ${data.segment || ''}`
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isFarmaTheme = /farma|farmacia|manipula/.test(themeKey);
  const ACC = isFarmaTheme ? '#00BFD1' : '#FF8103';      // ciano farma / laranja varejo
  const ACC_INK = isFarmaTheme ? '#0B7384' : '#C2540A';  // versão escura legível
  const ACC_RGB = isFarmaTheme ? '0,191,209' : '255,129,3';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposta ProSystem — ${data.companyName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    :root {
      /* ── Tema CLARO — paleta real Prosystem (prosystemnet.com) ── */
      --primary: #081330;          /* navy hero da marca */
      --primary-light: #16264a;
      --primary-dark: #050d22;
      --secondary: #417ABC;        /* azul Prosystem (cor principal da marca) */
      --secondary-light: #356AA6;  /* azul legível sobre branco (usado em texto) */
      --accent: ${ACC};            /* destaque do Plus/Recomendado (ciano farma / laranja varejo) */
      --accent-ink: ${ACC_INK};    /* versão escura legível sobre branco (texto) */
      --accent-rgb: ${ACC_RGB};    /* componentes do accent p/ tints rgba(var(--accent-rgb),x) */
      --accent-glow: rgba(var(--accent-rgb),0.22);
      --gold: #F9A01B;             /* laranja de apoio (módulo Suporte) */
      --green: #1FA45A;            /* verde — apenas para ✓ "Sim"/sucesso e WhatsApp */
      --bg-deep: #FFFFFF;
      --bg-mid: #EAF1F7;
      --bg-soft: #F5F8FB;
      --bg-surface: #F1F5FA;
      --bg-card: #FFFFFF;
      --text-primary: #1B2A3D;
      --text-secondary: #69727D;
      --text-accent: #417ABC;
      --border: #E1E8F0;
      --border-accent: rgba(65,122,188,0.30);
      --border-plus: rgba(var(--accent-rgb),0.40);
      --shadow-lg: 0 16px 44px rgba(8,19,48,0.12);
      --shadow-glow: 0 6px 24px rgba(65,122,188,0.14);
      --shadow-plus: 0 10px 34px rgba(var(--accent-rgb),0.16);
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
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
    }
    .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; letter-spacing: -0.02em; }
    .nav-brand img { width: 46px; height: 46px; object-fit: contain; }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .nav-pill {
      font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
      padding: 6px 14px; border-radius: 999px;
      border: 1px solid var(--border-accent); color: var(--secondary-light);
      cursor: pointer; transition: .2s;
    }
    .nav-pill:hover { background: var(--bg-card); }
    .nav-pill-copy {
      border-color: rgba(39,201,127,0.45); color: var(--green);
      background: rgba(39,201,127,0.1); font-weight: 800;
    }
    .nav-pill-copy:hover { background: rgba(39,201,127,0.2); }
    .nav-pill-copy.copied { background: var(--green); color: #04150d; border-color: var(--green); }
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
      height: 3px; background: rgba(8,19,48,0.08);
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
      box-shadow: var(--shadow-lg);
    }
    .glass-accent {
      background: var(--bg-soft);
      border: 1px solid var(--border-accent);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-glow);
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
    .text-orange { color: var(--accent-ink); }
    .text-green { color: var(--green); }
    .gradient-text {
      background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 45%, var(--accent) 100%);
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
      background: linear-gradient(135deg, var(--primary) 0%, #16385a 100%);
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
    .hub-grid {
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
    /* ── PAINEL VISUAL DO MÓDULO (sem retângulo — só a animação) ── */
    .mod-img-wrap {
      aspect-ratio: 16/11;
      background: transparent; border: none; box-shadow: none;
      display: flex; align-items: center; justify-content: center;
    }
    .mod-visual { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; padding: 26px; }
    .mod-visual .mv-icon {
      width: 92px; height: 92px; border-radius: 24px; background: #fff;
      box-shadow: var(--shadow-lg); display: flex; align-items: center; justify-content: center; font-size: 44px;
    }
    .mod-visual .mv-text { font-size: 15px; font-weight: 800; letter-spacing: .01em; color: var(--primary); }
    .mod-visual .mv-sub { font-size: 12px; color: var(--text-secondary); max-width: 250px; line-height: 1.5; }

    /* ── ECOSSISTEMA FARMA (cinematográfico) ── */
    .eco-wrap { aspect-ratio: 1 / 1; background: transparent; }
    .eco { position: relative; width: min(430px, 100%); aspect-ratio: 1 / 1; margin: auto; }
    .eco-halo { position: absolute; inset: 9%; border-radius: 50%; background: conic-gradient(from 0deg, rgba(var(--accent-rgb),0), rgba(var(--accent-rgb),0.20), rgba(65,122,188,0.20), rgba(var(--accent-rgb),0)); filter: blur(16px); animation: ecoSpin 16s linear infinite; }
    .eco-lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .eco-line { stroke: var(--accent); stroke-width: 1.6; fill: none; opacity: .45; stroke-dasharray: 4 9; animation: ecoFlow 1.6s linear infinite; }
    .eco-ring { stroke: var(--border-accent); stroke-width: 1; fill: none; opacity: .6; stroke-dasharray: 2 7; }
    .eco-hub { position: absolute; top: 50%; left: 50%; width: 84px; height: 84px; transform: translate(-50%,-50%); border-radius: 24px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 42px; z-index: 3; box-shadow: var(--shadow-lg), 0 0 0 8px rgba(var(--accent-rgb),0.08); animation: ecoPulse 2.8s ease-in-out infinite; }
    .eco-node { position: absolute; transform: translate(-50%,-50%); z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .eco-node .chip { width: 48px; height: 48px; border-radius: 15px; background: #fff; border: 1px solid var(--border); box-shadow: var(--shadow-glow); display: flex; align-items: center; justify-content: center; font-size: 23px; animation: ecoFloat 3.6s ease-in-out infinite; }
    .eco-node .lbl { font-size: 10px; font-weight: 700; color: var(--text-secondary); }
    @keyframes ecoSpin  { to { transform: rotate(360deg); } }
    @keyframes ecoFlow  { to { stroke-dashoffset: -39; } }
    @keyframes ecoPulse { 0%,100% { box-shadow: var(--shadow-lg), 0 0 0 8px rgba(var(--accent-rgb),0.08); } 50% { box-shadow: var(--shadow-lg), 0 0 0 15px rgba(var(--accent-rgb),0.15); } }
    @keyframes ecoFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @media (prefers-reduced-motion: reduce) { .eco-halo,.eco-line,.eco-hub,.eco-node .chip { animation: none; } }

    /* ── VISUAIS ANIMADOS DOS MÓDULOS (tecnológico, com movimento) ── */
    .fx-wrap { background: transparent; }
    .fx { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 26px; }
    @keyframes fxPulse { 0%,100% { box-shadow: var(--shadow-glow); } 50% { box-shadow: 0 0 0 8px rgba(var(--accent-rgb),0.14); } }
    @keyframes fxBob   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes fxSpinSlow { to { transform: translateX(-50%) rotate(360deg); } }

    /* FLOW — pipeline vertical com pulso viajando (PDV, Treinamento) */
    .fx-flow { position: relative; display: flex; flex-direction: column; gap: 10px; width: min(290px,100%); }
    .fx-flow .track { position: absolute; left: 24px; top: 26px; bottom: 26px; width: 3px; background: var(--border-accent); border-radius: 3px; overflow: hidden; }
    .fx-flow .track::after { content: ''; position: absolute; left: -1px; width: 5px; height: 30px; border-radius: 5px; background: var(--accent); box-shadow: 0 0 12px var(--accent); animation: fxTravel 2.6s linear infinite; }
    @keyframes fxTravel { 0% { top: -30px; } 100% { top: 100%; } }
    .fx-step { display: flex; align-items: center; gap: 14px; position: relative; z-index: 2; }
    .fx-step .d { width: 50px; height: 50px; border-radius: 15px; background: #fff; border: 1px solid var(--border); box-shadow: var(--shadow-glow); display: flex; align-items: center; justify-content: center; font-size: 23px; flex-shrink: 0; animation: fxPulse 4s ease-in-out infinite; }
    .fx-step .t { font-size: 13px; font-weight: 800; color: var(--primary); line-height: 1.2; }
    .fx-step .t small { display: block; font-size: 11px; font-weight: 500; color: var(--text-secondary); }

    /* FUNNEL — funil de compras */
    .fx-funnel { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .fx-funnel .top { display: flex; gap: 8px; }
    .fx-funnel .top span { width: 30px; height: 30px; border-radius: 9px; background: #fff; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: var(--shadow-glow); animation: fxBob 2.4s ease-in-out infinite; }
    .fx-funnel .top span:nth-child(2){ animation-delay:.3s } .fx-funnel .top span:nth-child(3){ animation-delay:.6s } .fx-funnel .top span:nth-child(4){ animation-delay:.9s }
    .fx-funnel .cone { position: relative; width: 0; height: 0; border-left: 78px solid transparent; border-right: 78px solid transparent; border-top: 64px solid rgba(var(--accent-rgb),0.20); }
    .fx-funnel .cone .gear { position: absolute; top: -54px; left: 50%; transform: translateX(-50%); font-size: 26px; animation: fxSpinSlow 6s linear infinite; }
    .fx-funnel .cone .drop { position: absolute; top: -64px; left: 50%; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: fxDrop 1.8s ease-in infinite; }
    .fx-funnel .cone .drop:nth-child(3){ animation-delay:.6s } .fx-funnel .cone .drop:nth-child(4){ animation-delay:1.2s }
    @keyframes fxDrop { 0% { top:-64px; opacity:0; } 20% { opacity:1; } 100% { top:6px; opacity:0; } }
    .fx-funnel .out { margin-top: 4px; width: 56px; height: 56px; border-radius: 16px; background: #fff; border: 1px solid var(--accent); box-shadow: var(--shadow-plus); display: flex; align-items: center; justify-content: center; font-size: 27px; animation: fxPulse 2.4s ease-in-out infinite; }
    .fx-cap { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-align: center; margin-top: 6px; }

    /* BARS — gráfico de barras (Dashboard, Financeiro) */
    .fx-bars { display: flex; align-items: flex-end; gap: 13px; height: 150px; }
    .fx-bars i { display: block; width: 26px; border-radius: 7px 7px 0 0; background: linear-gradient(var(--accent), rgba(var(--accent-rgb),0.45)); animation: fxBar 2.8s ease-in-out infinite; }
    @keyframes fxBar { 0%,100% { height: 26%; } 50% { height: var(--h,80%); } }

    /* LINE — linha de margem subindo (Rentabilidade) */
    .fx-line { position: relative; }
    .fx-line svg { width: 240px; height: 150px; overflow: visible; }
    .fx-line .area { fill: rgba(var(--accent-rgb),0.14); opacity: 0; animation: fxArea 3.4s ease-in-out infinite; }
    .fx-line .ln { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 360; stroke-dashoffset: 360; animation: fxDraw 3.4s ease-in-out infinite; }
    .fx-line .pt { fill: var(--accent); animation: fxPt 3.4s ease-in-out infinite; opacity: 0; }
    @keyframes fxDraw { 0% { stroke-dashoffset: 360; } 55%,100% { stroke-dashoffset: 0; } }
    @keyframes fxArea { 0%,40% { opacity: 0; } 75%,100% { opacity: 1; } }
    @keyframes fxPt   { 0%,55% { opacity: 0; } 70%,100% { opacity: 1; } }

    /* WAVES — ondas de sinal (Suporte) */
    .fx-waves { position: relative; width: 170px; height: 170px; display: flex; align-items: center; justify-content: center; }
    .fx-waves .core { width: 86px; height: 86px; border-radius: 26px; background: #fff; box-shadow: var(--shadow-lg); display: flex; align-items: center; justify-content: center; font-size: 40px; z-index: 2; }
    .fx-waves b { position: absolute; inset: 0; margin: auto; width: 86px; height: 86px; border-radius: 50%; border: 2px solid var(--accent); opacity: 0; animation: fxRipple 2.6s ease-out infinite; }
    .fx-waves b:nth-child(2){ animation-delay:.9s } .fx-waves b:nth-child(3){ animation-delay:1.8s }
    @keyframes fxRipple { 0% { transform: scale(.55); opacity: .55; } 100% { transform: scale(2.2); opacity: 0; } }

    @media (prefers-reduced-motion: reduce) { .fx-step .d,.fx-flow .track::after,.fx-funnel .top span,.fx-funnel .cone .gear,.fx-funnel .cone .drop,.fx-funnel .out,.fx-bars i,.fx-line .ln,.fx-line .area,.fx-line .pt,.fx-waves b { animation: none; } }

    /* ── PLAN TABLE ── */
    .plan-table { width: 100%; border-collapse: collapse; }
    .plan-table th, .plan-table td { padding: 11px 14px; border-bottom: 1px solid var(--border); font-size: 13px; text-align: center; vertical-align: middle; }
    .plan-table th:first-child, .plan-table td:first-child { text-align: left; font-weight: 600; color: var(--text-primary); min-width: 190px; }
    .plan-table th { font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--text-secondary); padding-bottom: 14px; }
    .col-plus { background: rgba(var(--accent-rgb),0.07); position: relative; }
    .th-plus { background: rgba(var(--accent-rgb),0.1); border-top: 2px solid var(--accent) !important; color: #0B7384 !important; }
    .cell-yes { color: var(--green); font-weight: 800; }
    .cell-no { color: rgba(27,42,61,0.32); font-weight: 600; }
    .cell-adv { color: var(--accent-ink); font-weight: 700; }
    .cell-int { color: var(--secondary-light); font-weight: 700; }
    .cell-bas { color: var(--text-secondary); font-weight: 600; }
    .plan-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .badge-basic { background: rgba(8,19,48,0.06); color: var(--text-secondary); }
    .badge-pro   { background: rgba(75,142,200,0.12); color: var(--secondary-light); }
    .badge-plus  { background: rgba(var(--accent-rgb),0.18); color: #0B7384; border: 1px solid var(--border-plus); }
    .rec-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; background: var(--accent-ink); color: #fff; margin-left: 6px; vertical-align: middle; }

    /* ── PLAN CARDS (mobile) ── */
    .plan-cards { display: none; }
    .plan-mc { padding: 18px; border-radius: var(--radius); background: var(--bg-card); border: 1px solid var(--border); }
    .plan-mc.featured { border-color: var(--border-plus); background: rgba(var(--accent-rgb),0.07); box-shadow: var(--shadow-plus); }
    .plan-mc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .plan-mc-list { display: grid; gap: 9px; }
    .pmc-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-primary); line-height: 1.3; }
    .pmc-row.off { color: rgba(27,42,61,0.4); }
    .pmc-check { color: var(--green); font-weight: 800; flex-shrink: 0; width: 16px; text-align: center; }
    .pmc-x { color: rgba(27,42,61,0.28); font-weight: 700; flex-shrink: 0; width: 16px; text-align: center; }
    .pmc-feat { flex: 1; }
    .pmc-lvl { font-size: 11px; font-weight: 700; color: var(--secondary-light); white-space: nowrap; }
    .plan-mc.featured .pmc-lvl { color: var(--accent-ink); }

    /* ── TOOLS GRID (Ferramentas) ── */
    .tools-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; width: min(940px, 100%); }
    .tool-card { padding: 18px 20px; border-radius: var(--radius); background: var(--bg-card); border: 1px solid var(--border); box-shadow: var(--shadow-glow); display: flex; gap: 14px; align-items: flex-start; transition: .25s ease; }
    .tool-card:hover { transform: translateY(-3px); border-color: var(--border-accent); box-shadow: var(--shadow-lg); }
    .tool-card .tc-icon { font-size: 24px; line-height: 1.1; flex-shrink: 0; }
    .tool-card .tc-name { font-size: 15px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em; margin-bottom: 4px; }
    .tool-card .tc-name .tc-tag { font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-ink); background: rgba(var(--accent-rgb),0.1); padding: 2px 7px; border-radius: 999px; margin-left: 6px; vertical-align: middle; }
    .tool-card .tc-desc { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: min(840px,100%); }
    .chip { font-size: 12px; font-weight: 600; color: var(--secondary-light); background: var(--bg-soft); border: 1px solid var(--border); padding: 7px 13px; border-radius: 999px; }

    /* ── SETAS DE NAVEGAÇÃO (cliente) ── */
    .nav-arrow {
      position: fixed; top: 50%; transform: translateY(-50%); z-index: 95;
      width: 48px; height: 48px; border-radius: 50%;
      background: #fff; border: 1px solid var(--border); color: var(--primary);
      box-shadow: 0 8px 24px rgba(8,19,48,0.16);
      display: flex; align-items: center; justify-content: center; cursor: pointer; transition: .2s;
    }
    .nav-arrow:hover { background: var(--secondary); color: #fff; }
    .nav-arrow svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    #nav-prev { left: 18px; }
    #nav-next { right: 18px; }
    .nav-arrow.disabled { opacity: 0; pointer-events: none; }
    body.self-service .nav-arrow { border-color: var(--border-accent); }
    body.self-service #nav-next:not(.disabled) { animation: pulseArrow 1.8s ease-in-out infinite; }
    @keyframes pulseArrow {
      0%,100% { box-shadow: 0 8px 24px rgba(65,122,188,0.30); }
      50%     { box-shadow: 0 10px 34px rgba(var(--accent-rgb),0.55); }
    }

    /* dica do cliente (modo auto-serviço) */
    #client-hint {
      position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%); z-index: 96;
      display: none; align-items: center; gap: 8px;
      background: var(--primary); color: #fff;
      font-size: 12px; font-weight: 700; padding: 9px 16px; border-radius: 999px;
      box-shadow: var(--shadow-lg); max-width: calc(100% - 120px);
    }
    body.self-service #client-hint { display: inline-flex; }
    body.self-service #nav-hint { display: none; }
    body.self-service #back-btn { display: none !important; }  /* cliente: fluxo linear, sem voltar ao hub */
    /* ferramentas do VENDEDOR — só no modo apresentador, o cliente nunca vê o resumo p/ copiar */
    body.self-service .seller-only { display: none !important; }

    /* ── ESCOLHA DE VERSÃO (overlay) ── */
    #escolha-overlay {
      display: none; position: fixed; inset: 0; z-index: 200;
      align-items: center; justify-content: center; padding: 24px;
      background: linear-gradient(135deg, rgba(13,34,56,.72), rgba(31,111,178,.55));
      backdrop-filter: blur(6px);
    }
    .escolha-card {
      background: #fff; border-radius: 22px; padding: 38px 30px; max-width: 720px; width: 100%;
      text-align: center; box-shadow: 0 24px 70px rgba(8,19,48,.4);
    }
    .escolha-logo { height: 54px; width: auto; object-fit: contain; margin-bottom: 18px; }
    .escolha-titulo { margin: 0 0 6px; font-size: 24px; font-weight: 900; color: var(--text-primary, #0D2238); letter-spacing: -.02em; }
    .escolha-sub { margin: 0 0 26px; font-size: 14px; color: var(--text-secondary, #5A6B7B); }
    .escolha-botoes { display: flex; gap: 16px; }
    .escolha-op {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 26px 18px; border-radius: 16px; cursor: pointer; text-align: center;
      border: 2px solid var(--border, #E3E9F0); background: var(--bg-soft, #F4F7FA);
      transition: transform .15s, border-color .15s, box-shadow .15s;
    }
    .escolha-op:hover { transform: translateY(-3px); border-color: var(--accent, #00BFD1); box-shadow: 0 12px 30px rgba(8,19,48,.14); }
    .escolha-emoji { font-size: 36px; line-height: 1; }
    .escolha-nome { font-size: 17px; font-weight: 800; color: var(--text-primary, #0D2238); }
    .escolha-desc { font-size: 12.5px; color: var(--text-secondary, #5A6B7B); line-height: 1.5; }
    .escolha-simples { border-color: var(--accent, #00BFD1); background: rgba(var(--accent-rgb,0,191,209), .06); }
    @media (max-width: 600px) { .escolha-botoes { flex-direction: column; } .escolha-card { padding: 28px 20px; } }

    /* Botão "ver apresentação completa" — só aparece na versão simplificada */
    #ver-completa-btn { display: none; }
    body.versao-simples #ver-completa-btn { display: inline-flex; }

    /* coach inicial (aponta a seta) */
    #coach {
      position: fixed; z-index: 97; right: 76px; top: 50%; transform: translateY(-50%);
      background: var(--accent); color: #04303a; font-size: 12px; font-weight: 800;
      padding: 8px 13px; border-radius: 10px; box-shadow: var(--shadow-lg);
      opacity: 0; pointer-events: none; transition: opacity .4s; white-space: nowrap;
    }
    #coach.show { opacity: 1; }
    #coach::after { content: ''; position: absolute; right: -6px; top: 50%; transform: translateY(-50%); border: 6px solid transparent; border-left-color: var(--accent); }

    /* ── PRICE CARDS ── */
    .price-card { padding: 24px; border-radius: var(--radius); background: var(--bg-card); border: 1px solid var(--border); }
    .price-card .pc-label { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px; }
    .price-card .pc-old { font-size: 20px; font-weight: 800; color: rgba(27,42,61,0.32); text-decoration: line-through; }
    .price-card .pc-val { font-size: 30px; font-weight: 900; letter-spacing: -0.04em; color: var(--text-primary); line-height: 1.1; }
    .price-card .pc-sub { font-size: 11px; color: var(--text-secondary); margin-top: 4px; }
    .price-card.featured { border-color: var(--border-plus); background: rgba(var(--accent-rgb),0.07); box-shadow: var(--shadow-plus); }
    .price-card.featured .pc-val { color: var(--accent-ink); font-size: 40px; }
    .price-card.monthly { border-color: rgba(39,201,127,0.3); background: rgba(39,201,127,0.06); }
    .price-card.monthly .pc-val { color: var(--green); }

    /* ── PLAN HIGHLIGHT BOX (Plus destaque) ── */
    .plus-highlight-box {
      padding: 20px 24px; border-radius: var(--radius-lg);
      background: linear-gradient(135deg, rgba(var(--accent-rgb),0.12), rgba(var(--accent-rgb),0.04));
      border: 1px solid var(--border-plus);
      box-shadow: var(--shadow-plus);
    }

    /* ── WHATSAPP BOX ── */
    .whats-box { padding: 24px; border-radius: var(--radius-lg); background: var(--bg-card); border: 1px solid var(--border); }
    .whats-text { width: 100%; min-height: 140px; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; resize: vertical; font-family: var(--font); font-size: 13px; line-height: 1.6; color: var(--text-primary); background: var(--bg-soft); }
    .whats-text:focus { outline: none; border-color: var(--border-accent); }
    .action-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }

    /* ── UTIL ── */
    .w100 { width: 100%; }
    .mt8 { margin-top: 8px; }
    .mt12 { margin-top: 12px; }
    .mt16 { margin-top: 16px; }
    .mt24 { margin-top: 24px; }
    .mt32 { margin-top: 32px; }
    .gap12 { gap: 12px; }
    .flex { display: flex; }
    .flex-wrap { flex-wrap: wrap; }
    .flex-col { display: flex; flex-direction: column; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .text-center { text-align: center; }
    .scroll-x { overflow-x: auto; }
    .max900 { max-width: 900px; width: 100%; }
    .max700 { max-width: 700px; width: 100%; }

    /* ── RESPONSIVE ── */
    @media (max-width: 900px) {
      .mod-layout { grid-template-columns: 1fr; gap: 24px; }
      .mod-layout .mod-img-wrap { order: -1; }   /* imagem acima do texto no mobile */
    }
    @media (max-width: 768px) {
      #three-canvas { display: none; }
      .hub-grid { grid-template-columns: 1fr; }
      .tools-grid { grid-template-columns: 1fr; }
      .proof-grid { grid-template-columns: repeat(2,1fr); }
      .display-xl { font-size: clamp(28px, 8vw, 44px); }
      .display-lg { font-size: clamp(26px, 7vw, 40px); }
      .display-md { font-size: clamp(20px, 5.5vw, 32px); }

      /* Slides rolam verticalmente — conteúdo nunca é cortado no celular */
      .slide {
        align-items: flex-start;
        justify-content: flex-start;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 76px 16px 56px;
      }
      .mod-img-wrap { max-height: 230px; }
      .eco-wrap { max-height: none; aspect-ratio: 1 / 1; }
      .eco { width: min(300px, 88%); }
      .metric-pill { padding: 12px 16px; }
      .metric-pill .val { font-size: 22px; }
      .price-card { padding: 18px; }
      .price-card.featured .pc-val { font-size: 32px; }
      .plan-table th, .plan-table td { padding: 9px 8px; font-size: 12px; }
      .plan-table th:first-child, .plan-table td:first-child { min-width: 150px; }
    }
    @media (max-width: 600px) {
      #top-nav { padding: 0 14px; }
      .nav-brand span { display: none; }
      #mode-btn-top { display: none; }
      #nav-hint { display: none; }
      .copy-label { display: none; }
      .nav-pill-copy { padding: 8px 14px; font-size: 14px; }
      .proof-grid { grid-template-columns: 1fr 1fr; }
      /* Setas vão para os cantos inferiores (alcance do polegar) */
      .nav-arrow { top: auto; bottom: 64px; transform: none; width: 44px; height: 44px; }
      .nav-arrow:hover { transform: none; }
      #nav-prev { left: 14px; } #nav-next { right: 14px; }
      body.self-service #nav-next:not(.disabled) { animation: none; }
      #coach { display: none; }
      #client-hint { bottom: 16px; font-size: 11px; padding: 8px 14px; max-width: calc(100% - 130px); }
      /* Cards de preço empilham e ocupam largura total (evita corte de valores) */
      .price-row { flex-direction: column; }
      .price-row .price-card { min-width: 0 !important; width: 100%; }
      /* Comparativo: tabela vira cartões empilhados por plano */
      .plan-table-wrap { display: none; }
      .plan-cards { display: grid; gap: 14px; }
    }
    /* Telas baixas (laptops curtos / landscape): slide rola em vez de cortar */
    @media (min-width: 769px) and (max-height: 760px) {
      .slide { align-items: flex-start; justify-content: center; overflow-y: auto; padding-top: 80px; padding-bottom: 48px; }
    }
    /* Telas muito largas: limita e centraliza o conteúdo */
    @media (min-width: 1500px) {
      .mod-layout { max-width: 1180px; }
      .max900 { max-width: 980px; }
    }
    /* ── PDF COMERCIAL (2 páginas) ── */
    #print-doc { display: none; }
    @media print {
      @page { size: A4; margin: 0; }
      html, body { overflow: visible !important; height: auto !important; background: #fff !important; }
      #top-nav, #progress-bar, #slide-counter, #nav-hint, #back-btn, #three-canvas, #deck, #nav-prev, #nav-next, #client-hint, #coach { display: none !important; }
      #print-doc { display: block !important; }
      .print-page {
        width: 210mm; min-height: 296mm; padding: 15mm 16mm 13mm; box-sizing: border-box;
        position: relative; page-break-after: always; background: #fff; color: #14222E;
        font-family: var(--font);
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .print-page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>

<canvas id="three-canvas"></canvas>

<!-- ESCOLHA DE VERSÃO (cliente) — completa x simplificada -->
<div id="escolha-overlay">
  <div class="escolha-card">
    <img class="escolha-logo" src="${imgSrc('logo', '/logo-prosystem.png')}" alt="ProSystem" onerror="this.style.display='none'">
    <h2 class="escolha-titulo">Como você prefere ver a proposta?</h2>
    <p class="escolha-sub">Escolha a experiência ideal para você agora.</p>
    <div class="escolha-botoes">
      <button class="escolha-op escolha-completa" onclick="escolherVersao('completa')">
        <span class="escolha-emoji">&#127916;</span>
        <span class="escolha-nome">Apresentação completa</span>
        <span class="escolha-desc">Conheça a ProSystem, os módulos e tudo que você ganha — passo a passo.</span>
      </button>
      <button class="escolha-op escolha-simples" onclick="escolherVersao('simples')">
        <span class="escolha-emoji">&#9889;</span>
        <span class="escolha-nome">Ver proposta direto</span>
        <span class="escolha-desc">Vá direto aos planos e valores, de forma rápida e objetiva.</span>
      </button>
    </div>
  </div>
</div>

<!-- TOP NAV -->
<nav id="top-nav">
  <div class="nav-brand">
    <img src="${imgSrc('logo', '/logo-prosystem.png')}" alt="ProSystem" onerror="this.style.display='none'">
    <span>ProSystem Sistemas</span>
  </div>
  <div class="nav-right">
    <button class="nav-pill" id="ver-completa-btn" onclick="escolherVersao('completa')">&#127916;<span class="copy-label">&nbsp; Ver apresentação completa</span></button>
    <button class="nav-pill nav-pill-copy seller-only" id="copy-resumo-nav" onclick="copyWhatsAppText()">&#128203;<span class="copy-label">&nbsp; Copiar resumo p/ WhatsApp</span></button>
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
<div id="nav-hint">&#8592; &#8594; Navegar &nbsp;|&nbsp; ESC Módulos</div>

<!-- SETAS DE NAVEGAÇÃO (essenciais p/ o cliente) -->
<button id="nav-prev" class="nav-arrow" onclick="prevSlide()" aria-label="Anterior">
  <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
</button>
<button id="nav-next" class="nav-arrow" onclick="nextSlide()" aria-label="Próximo">
  <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
</button>
<div id="coach">Toque para avançar &#8594;</div>

<!-- DICA DO CLIENTE (modo auto-serviço) -->
<div id="client-hint">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>
  Deslize ou toque na seta para avançar &mdash; do início ao fim
</div>

<!-- DECK -->
<div id="deck">

  <!-- ===== SLIDE 0 — CAPA ===== -->
  <div class="slide" id="slide-0" data-slide="0">
    <div class="flex-col items-center text-center max700" style="gap:28px;">
      <div>
        <img src="${imgSrc('logo', '/logo-prosystem.png')}" alt="ProSystem" style="height:84px;object-fit:contain;margin-bottom:22px;" onerror="this.style.display='none'">
        <div class="eyebrow" style="justify-content:center;">Proposta Comercial &nbsp;&bull;&nbsp; <span id="s0-company">${data.companyName}</span></div>
        <h1 class="display-xl mt8" id="s0-headline">
          Mais controle, agilidade e<br>
          <span class="gradient-text">inteligência para a sua operação</span>
        </h1>
        <p class="body-lg mt16" id="s0-subtitle" style="max-width:560px;margin-left:auto;margin-right:auto;">
          A ProSystem foi criada para resolver exatamente isso &mdash; 16 anos construindo soluções que fazem a operação trabalhar por você.
        </p>
      </div>
      <div class="flex gap12 flex-wrap justify-center mt8">
        <div class="metric-pill">
          <span class="val" data-counter="16" data-suffix=" anos">0</span>
          <span class="lbl">No mercado</span>
        </div>
        <div class="metric-pill">
          <span class="val" data-counter-text="7h–22h">—</span>
          <span class="lbl">Suporte ativo</span>
        </div>
        <div class="metric-pill">
          <span class="val" data-counter="5" data-suffix=" meses">0</span>
          <span class="lbl">Treinamento</span>
        </div>
      </div>
      <div class="flex gap12 flex-wrap justify-center mt8">
        <button class="btn btn-primary" onclick="goToSlide(1)">Conheça a ProSystem</button>
        <button class="btn btn-accent" onclick="goToModule(5)">Ver proposta comercial</button>
      </div>
    </div>
  </div>

  <!-- ===== SLIDE 1 — QUEM SOMOS ===== -->
  <div class="slide" id="slide-1" data-slide="1">
    <div class="flex-col max900" style="gap:32px;">
      <div>
        <div class="eyebrow">Nossa história</div>
        <h2 class="display-lg">16 anos transformando<br>o varejo brasileiro</h2>
        <p class="body-lg mt12 max700">
          A ProSystem nasceu da necessidade real do varejo: um sistema que entende a operação, resolve problemas do dia a dia e cresce junto com o negócio. Atendemos farmácias, padarias e varejo com a mesma dedicação desde o primeiro dia.
        </p>
      </div>
      <div class="flex gap12 flex-wrap">
        <div class="glass-accent" style="padding:20px 24px;flex:1;min-width:180px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--secondary);margin-bottom:8px;">Farmácias</div>
          <div style="font-size:14px;color:var(--text-secondary);">SNGPC, PBMs, NF-e, controle de receituário e compliance farmacêutico integrado</div>
        </div>
        <div class="glass-accent" style="padding:20px 24px;flex:1;min-width:180px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent-ink);margin-bottom:8px;">Padarias &amp; Lojas</div>
          <div style="font-size:14px;color:var(--text-secondary);">PDV ágil, controle de estoque, encomendas e entrega em domicílio em tempo real</div>
        </div>
        <div class="glass-accent" style="padding:20px 24px;flex:1;min-width:180px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--green);margin-bottom:8px;">Varejo geral</div>
          <div style="font-size:14px;color:var(--text-secondary);">ERP completo com estoque, compras, financeiro e análises gerenciais avançadas</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SLIDE 2 — O DESAFIO ===== -->
  <div class="slide" id="slide-2" data-slide="2">
    <div class="flex-col max900" style="gap:32px;">
      <div>
        <div class="eyebrow" id="s2-eyebrow">O cenário do varejo</div>
        <h2 class="display-lg" id="s2-title">Gerir varejo no Brasil é<br><span class="text-orange">lidar com complexidade real</span></h2>
        <p class="body-lg mt12 max700" id="s2-sub">
          Compliance fiscal, margens apertadas e tecnologia que não conversa. Cada dia sem visibilidade é um dia perdendo dinheiro.
        </p>
      </div>
      <div class="flex gap12 flex-wrap">
        <div style="flex:1;min-width:220px;padding:24px;border-radius:var(--radius);background:rgba(var(--accent-rgb),0.08);border:1px solid rgba(var(--accent-rgb),0.2);">
          <div style="font-size:24px;margin-bottom:12px;" id="s2-c1-ic">&#9878;&#65039;</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;" id="s2-c1-t">Compliance fiscal</div>
          <div class="body-md" id="s2-c1-d">Medo de multas, NF-e incorreta, SPED desatualizado. O risco tributário pesa sobre cada operação.</div>
        </div>
        <div style="flex:1;min-width:220px;padding:24px;border-radius:var(--radius);background:rgba(var(--accent-rgb),0.08);border:1px solid rgba(var(--accent-rgb),0.2);">
          <div style="font-size:24px;margin-bottom:12px;" id="s2-c2-ic">&#128201;</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;" id="s2-c2-t">Falta de visibilidade</div>
          <div class="body-md" id="s2-c2-d">Não saber o que acontece em tempo real é tomar decisões no escuro &mdash; e perder margem.</div>
        </div>
        <div style="flex:1;min-width:220px;padding:24px;border-radius:var(--radius);background:rgba(var(--accent-rgb),0.08);border:1px solid rgba(var(--accent-rgb),0.2);">
          <div style="font-size:24px;margin-bottom:12px;" id="s2-c3-ic">&#128257;</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;" id="s2-c3-t">Retrabalho constante</div>
          <div class="body-md" id="s2-c3-d">Processos manuais consomem tempo, geram erros e impedem o crescimento da operação.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SLIDE 3 — A SOLUÇÃO ===== -->
  <div class="slide" id="slide-3" data-slide="3">
    <div class="flex-col max900" style="gap:32px;">
      <div>
        <div class="eyebrow" id="s3-eyebrow">A resposta certa</div>
        <h2 class="display-lg" id="s3-title">A ProSystem foi criada para<br><span class="gradient-text">resolver exatamente isso</span></h2>
        <p class="body-lg mt12 max700" id="s3-sub">
          Um ERP que faz a operação trabalhar por você &mdash; integrando vendas, estoque, financeiro e compliance em uma plataforma única, com suporte humano de verdade.
        </p>
      </div>
      <div class="flex gap12 flex-wrap">
        <div class="glass-accent" style="padding:24px;flex:1;min-width:220px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(75,142,200,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;">&#128279;</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;color:var(--text-primary);">ERP Integrado</div>
          <div class="body-md">Vendas, estoque, financeiro em um só sistema. Sem planilhas, sem retrabalho, sem informação perdida.</div>
        </div>
        <div class="glass-accent" style="padding:24px;flex:1;min-width:220px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(39,201,127,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;">&#10003;</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;color:var(--text-primary);">Compliance Total</div>
          <div class="body-md">NF-e, NFC-e, SPED, SNGPC, PBMs &mdash; tudo incluso e atualizado para manter sua operação segura.</div>
        </div>
        <div class="glass-accent" style="padding:24px;flex:1;min-width:220px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(var(--accent-rgb),0.15);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;">&#129309;</div>
          <div style="font-weight:800;font-size:15px;margin-bottom:8px;color:var(--text-primary);">Suporte Ativo Humanizado</div>
          <div class="body-md">Atendimento humano das 7h às 22h, com técnicos prontos para resolver e orientar de verdade.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SLIDE 4 — MODULE HUB ===== -->
  <div class="slide" id="slide-4" data-slide="4">
    <div class="flex-col items-center" style="gap:28px;width:100%;">
      <div class="text-center">
        <div class="eyebrow" style="justify-content:center;">Explore a proposta</div>
        <h2 class="display-md">Escolha um módulo para aprofundar</h2>
        <p class="body-md mt8" style="max-width:500px;margin:8px auto 0;">Use as teclas 1&ndash;5 ou clique nos cards para navegar pelos módulos</p>
      </div>
      <div class="hub-grid" id="hub-grid"></div>
    </div>
  </div>

  <!-- ===== MÓDULO 1 — GESTÃO DO NEGÓCIO (slides 5–8) ===== -->
  <div class="slide" id="slide-5" data-slide="5" data-module="1">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#4B8EC8;">Módulo 1 &mdash; Gestão do Negócio</div>
        <h2 class="display-lg">Sua operação<br><span class="text-accent">em um só lugar</span></h2>
        <p class="body-lg mt12">PDV, Estoque e Compras integrados &mdash; sem lacunas de informação, sem retrabalho, sem surpresa no fechamento do dia.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>PDV ágil com NFC-e integrado</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Estoque em tempo real, por produto</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Sugestão automática de reposição</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Entrega em domicílio e encomendas</span></div>
        </div>
      </div>
      <div class="mod-img-wrap eco-wrap">
        <div class="eco">
          <div class="eco-halo"></div>
          <svg class="eco-lines" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet">
            <circle class="eco-ring" cx="160" cy="160" r="125"></circle>
            <line class="eco-line" x1="160" y1="160" x2="160" y2="35"  style="animation-delay:0s"></line>
            <line class="eco-line" x1="160" y1="160" x2="248" y2="72"  style="animation-delay:.2s"></line>
            <line class="eco-line" x1="160" y1="160" x2="285" y2="160" style="animation-delay:.4s"></line>
            <line class="eco-line" x1="160" y1="160" x2="248" y2="248" style="animation-delay:.6s"></line>
            <line class="eco-line" x1="160" y1="160" x2="160" y2="285" style="animation-delay:.8s"></line>
            <line class="eco-line" x1="160" y1="160" x2="72"  y2="248" style="animation-delay:1s"></line>
            <line class="eco-line" x1="160" y1="160" x2="35"  y2="160" style="animation-delay:1.2s"></line>
            <line class="eco-line" x1="160" y1="160" x2="72"  y2="72"  style="animation-delay:1.4s"></line>
          </svg>
          <div class="eco-hub" id="eco-hub">&#128138;</div>
          <div class="eco-node" style="top:11%;left:50%"><div class="chip" style="animation-delay:0s">&#128722;</div><div class="lbl">PDV</div></div>
          <div class="eco-node" style="top:22%;left:78%"><div class="chip" style="animation-delay:.3s">&#128230;</div><div class="lbl">Estoque</div></div>
          <div class="eco-node" style="top:50%;left:89%"><div class="chip" style="animation-delay:.6s">&#128666;</div><div class="lbl">Compras</div></div>
          <div class="eco-node" style="top:78%;left:78%"><div class="chip" style="animation-delay:.9s">&#128176;</div><div class="lbl">Financeiro</div></div>
          <div class="eco-node" style="top:89%;left:50%"><div class="chip" style="animation-delay:1.2s">&#128101;</div><div class="lbl">Clientes</div></div>
          <div class="eco-node" style="top:78%;left:22%"><div class="chip" style="animation-delay:1.5s">&#9877;&#65039;</div><div class="lbl">SNGPC</div></div>
          <div class="eco-node" style="top:50%;left:11%"><div class="chip" style="animation-delay:1.8s">&#128757;</div><div class="lbl">Delivery</div></div>
          <div class="eco-node" style="top:22%;left:22%"><div class="chip" style="animation-delay:2.1s">&#128196;</div><div class="lbl">NF-e</div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-6" data-slide="6" data-module="1">
    <div class="mod-layout">
      <div class="mod-img-wrap">
        <div class="fx">
          <div class="fx-flow">
            <div class="track"></div>
            <div class="fx-step"><div class="d">&#128722;</div><div class="t">Produto<small>Leitura ágil no caixa</small></div></div>
            <div class="fx-step"><div class="d">&#128179;</div><div class="t">Pagamento<small>TEF, Pix e carteira digital</small></div></div>
            <div class="fx-step"><div class="d">&#128196;</div><div class="t">NFC-e<small>Emissão automática</small></div></div>
            <div class="fx-step"><div class="d">&#9989;</div><div class="t">Venda concluída<small>Estoque e caixa atualizados</small></div></div>
          </div>
        </div>
      </div>
      <div>
        <div class="eyebrow" style="color:#4B8EC8;">PDV &amp; Fiscal</div>
        <h2 class="display-lg">Velocidade na<br>frente de caixa</h2>
        <p class="body-lg mt12">Emissão de NFC-e integrada, SPED Fiscal atualizado e cadastro completo de produtos e clientes &mdash; tudo em uma interface projetada para fluxo intenso.</p>
        <div class="flex gap12 flex-wrap mt24">
          <div class="metric-pill"><span class="val">NFC-e</span><span class="lbl">Integrado</span></div>
          <div class="metric-pill"><span class="val">SPED</span><span class="lbl">Automático</span></div>
          <div class="metric-pill"><span class="val">100%</span><span class="lbl">Compliance fiscal</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-7" data-slide="7" data-module="1">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#4B8EC8;">Compras &amp; Estoque</div>
        <h2 class="display-lg">Reposição inteligente,<br><span class="text-accent">zero ruptura</span></h2>
        <p class="body-lg mt12">O módulo de compras analisa histórico de vendas e estoque mínimo para gerar sugestões automáticas &mdash; reduzindo ruptura, excesso e perda.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Sugestão automática de pedido de compra</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Curva ABC de produtos integrada</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Indicador de ruptura de estoque em tempo real</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="fx">
          <div class="fx-funnel">
            <div class="top" id="fx-funnel-top"><span>&#128138;</span><span>&#129657;</span><span>&#129701;</span><span>&#128137;</span></div>
            <div class="cone"><div class="gear">&#9881;&#65039;</div><div class="drop"></div><div class="drop"></div><div class="drop"></div></div>
            <div class="out" id="fx-funnel-out">&#128230;</div>
            <div class="fx-cap">Mix analisado &rarr; pedido certo, sem ruptura</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-8" data-slide="8" data-module="1">
    <div class="flex-col items-center text-center max700" style="gap:24px;">
      <div class="eyebrow" style="justify-content:center;color:#4B8EC8;">Resultado esperado</div>
      <h2 class="display-lg">Operação integrada,<br><span class="gradient-text">resultado visível</span></h2>
      <p class="body-lg">Com PDV, Estoque e Compras no mesmo sistema, sua equipe trabalha menos e entrega mais &mdash; com menos erros e mais visibilidade para o gestor.</p>
      <button class="btn btn-primary js-continue" onclick="returnToHub()">Ver outros módulos</button>
    </div>
  </div>

  <!-- ===== MÓDULO 2 — CONTROLE FINANCEIRO & GERENCIAL (slides 9–12) ===== -->
  <div class="slide" id="slide-9" data-slide="9" data-module="2">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#27C97F;">Módulo 2 &mdash; Controle Financeiro &amp; Gerencial</div>
        <h2 class="display-lg">Saiba exatamente<br><span class="text-green">onde está o dinheiro</span></h2>
        <p class="body-lg mt12">Dashboard gerencial, análise de rentabilidade e relatórios estratégicos &mdash; <strong style="color:#0B7384;">diferenciais exclusivos do Plano Plus</strong> para quem quer crescer com gestão.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Contas a pagar e receber integradas</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Fluxo de caixa e conciliação bancária</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Dashboard gerencial em tempo real</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Análise de rentabilidade por produto</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="fx">
          <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
            <div class="fx-bars"><i style="--h:55%;animation-delay:0s"></i><i style="--h:80%;animation-delay:.2s"></i><i style="--h:46%;animation-delay:.4s"></i><i style="--h:92%;animation-delay:.6s"></i><i style="--h:70%;animation-delay:.8s"></i></div>
            <div class="fx-cap">Contas, fluxo de caixa e DRE no controle</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-10" data-slide="10" data-module="2">
    <div class="mod-layout">
      <div class="mod-img-wrap">
        <div class="fx">
          <div style="display:flex;flex-direction:column;align-items:center;gap:16px;">
            <div class="fx-bars"><i style="--h:50%;animation-delay:0s"></i><i style="--h:72%;animation-delay:.15s"></i><i style="--h:60%;animation-delay:.3s"></i><i style="--h:95%;animation-delay:.45s"></i><i style="--h:78%;animation-delay:.6s"></i><i style="--h:88%;animation-delay:.75s"></i></div>
            <div class="fx-cap">Vendas, margem e metas em tempo real</div>
          </div>
        </div>
      </div>
      <div>
        <div class="eyebrow" style="color:#27C97F;">Dashboard Gerencial</div>
        <h2 class="display-lg">O negócio inteiro<br><span class="text-green">em uma tela</span></h2>
        <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(var(--accent-rgb),0.15);border:1px solid var(--border-plus);margin:12px 0 0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0B7384;">Exclusivo Plano Plus</div>
        <p class="body-lg mt12">Consolida vendas, margem, inadimplência e estoque &mdash; atualizado em tempo real, disponível em qualquer dispositivo. Tomar decisão deixa de ser intuição.</p>
        <div class="flex gap12 flex-wrap mt24">
          <div class="metric-pill"><span class="val">Tempo real</span><span class="lbl">Atualização</span></div>
          <div class="metric-pill"><span class="val">Plano Plus</span><span class="lbl">Exclusivo</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-11" data-slide="11" data-module="2">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#27C97F;">Rentabilidade &amp; Indicadores</div>
        <h2 class="display-lg">Margem real,<br><span class="text-green">produto por produto</span></h2>
        <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(var(--accent-rgb),0.15);border:1px solid var(--border-plus);margin:12px 0 0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0B7384;">Exclusivo Plano Plus</div>
        <p class="body-lg mt12">Identifique quais produtos realmente lucram, quais apenas giram e onde está o indicador de perda de vendas &mdash; análise detalhada e comparativa.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Margem bruta por produto e categoria</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Indicador de perda de vendas integrado</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Relatórios e análises gerenciais avançados</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="fx">
          <div class="fx-line">
            <svg viewBox="0 0 240 150">
              <path class="area" d="M8,120 L60,96 L112,102 L162,56 L232,26 L232,150 L8,150 Z"></path>
              <path class="ln" d="M8,120 L60,96 L112,102 L162,56 L232,26"></path>
              <circle class="pt" cx="232" cy="26" r="5"></circle>
            </svg>
            <div class="fx-cap">Margem real subindo, produto a produto</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-12" data-slide="12" data-module="2">
    <div class="flex-col items-center text-center max700" style="gap:24px;">
      <div class="eyebrow" style="justify-content:center;color:#27C97F;">Resultado esperado</div>
      <h2 class="display-lg">Decisões baseadas<br><span class="gradient-text">em dados reais</span></h2>
      <p class="body-lg">Com o Controle Financeiro &amp; Gerencial do Plano Plus, o gestor sai da intuição e passa a gerir com indicadores &mdash; reduzindo perdas e aumentando a margem real.</p>
      <div style="padding:16px 24px;border-radius:var(--radius);background:rgba(var(--accent-rgb),0.1);border:1px solid var(--border-plus);font-size:13px;color:#0B7384;font-weight:600;max-width:480px;">
        Dashboard, Rentabilidade e Indicador de Perda são recursos exclusivos do Plano Plus &mdash; a escolha de quem quer crescer com gestão.
      </div>
      <button class="btn btn-green js-continue" onclick="returnToHub()">Ver outros módulos</button>
    </div>
  </div>

  <!-- ===== MÓDULO 3 — SUPORTE & TREINAMENTO (slides 13–16) ===== -->
  <div class="slide" id="slide-13" data-slide="13" data-module="3">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#F9A01B;">Módulo 3 &mdash; Suporte &amp; Treinamento</div>
        <h2 class="display-lg">Suporte que<br><span class="text-orange">resolve de verdade</span></h2>
        <p class="body-lg mt12">Não é um chatbot. Não é uma fila de e-mail. É atendimento humano, ativo e especializado &mdash; das 7h às 22h, todos os dias úteis.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Atendimento humanizado por técnicos especializados</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Canal direto &mdash; sem fila, sem ticket perdido</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Resposta ágil dentro da janela operacional</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Suporte assistido durante os 5 meses de treinamento</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="fx">
          <div style="display:flex;flex-direction:column;align-items:center;gap:18px;">
            <div class="fx-waves"><b></b><b></b><b></b><div class="core">&#127911;</div></div>
            <div class="fx-cap">Atendimento humano das 7h às 22h, sem robô</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-14" data-slide="14" data-module="3">
    <div class="flex-col items-center text-center max700" style="gap:28px;">
      <div>
        <div class="eyebrow" style="justify-content:center;color:#F9A01B;">Disponibilidade</div>
        <h2 class="display-lg">7h às 22h &mdash; <span class="text-orange">todos os dias úteis</span></h2>
        <p class="body-lg mt12">A janela de suporte da ProSystem cobre toda a operação do varejo, do recebimento matutino ao fechamento noturno.</p>
      </div>
      <div class="flex gap12 flex-wrap justify-center">
        <div style="padding:24px 32px;border-radius:var(--radius);background:rgba(var(--accent-rgb),0.1);border:1px solid rgba(var(--accent-rgb),0.25);text-align:center;">
          <div style="font-size:40px;font-weight:900;letter-spacing:-0.05em;color:var(--accent-ink);">7h&ndash;22h</div>
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-top:6px;">Janela de atendimento</div>
        </div>
        <div style="padding:24px 32px;border-radius:var(--radius);background:rgba(75,142,200,0.1);border:1px solid var(--border-accent);text-align:center;">
          <div style="font-size:40px;font-weight:900;letter-spacing:-0.05em;color:var(--secondary);">5 meses</div>
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-top:6px;">Treinamento incluso</div>
        </div>
        <div style="padding:24px 32px;border-radius:var(--radius);background:rgba(39,201,127,0.1);border:1px solid rgba(39,201,127,0.25);text-align:center;">
          <div style="font-size:40px;font-weight:900;letter-spacing:-0.05em;color:var(--green);">Humano</div>
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-top:6px;">Técnico real, não bot</div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-15" data-slide="15" data-module="3">
    <div class="mod-layout">
      <div>
        <div class="eyebrow" style="color:#F9A01B;">Treinamento</div>
        <h2 class="display-lg">5 meses para<br><span class="text-orange">dominar o sistema</span></h2>
        <p class="body-lg mt12">O programa acompanha o cliente desde a implantação até a operação autônoma &mdash; com suporte assistido em cada etapa do processo.</p>
        <div class="check-list mt24">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Mês 1&ndash;2: Implantação e configuração assistida</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Mês 3: Treinamento da equipe operacional</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Mês 4&ndash;5: Uso avançado e gestão gerencial</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Suporte técnico ativo durante todo o período</span></div>
        </div>
      </div>
      <div class="mod-img-wrap">
        <div class="fx">
          <div class="fx-flow">
            <div class="track"></div>
            <div class="fx-step"><div class="d" style="font-size:15px;font-weight:900;color:var(--accent-ink);">1&ndash;2</div><div class="t">Implantação<small>Configuração assistida</small></div></div>
            <div class="fx-step"><div class="d" style="font-size:16px;font-weight:900;color:var(--accent-ink);">3</div><div class="t">Treinamento<small>Equipe operacional</small></div></div>
            <div class="fx-step"><div class="d" style="font-size:15px;font-weight:900;color:var(--accent-ink);">4&ndash;5</div><div class="t">Gestão avançada<small>Uso pleno do sistema</small></div></div>
            <div class="fx-step"><div class="d">&#127881;</div><div class="t">Autonomia total<small>Operação no controle</small></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="slide" id="slide-16" data-slide="16" data-module="3">
    <div class="flex-col items-center text-center max700" style="gap:24px;">
      <div class="eyebrow" style="justify-content:center;color:#F9A01B;">Compromisso ProSystem</div>
      <h2 class="display-lg">Não vendemos software.<br><span class="text-orange">Vendemos resultado.</span></h2>
      <p class="body-lg">Nosso compromisso começa na implantação e não termina nunca. O suporte ativo é um diferencial que mantemos há 16 anos &mdash; e é o que nossos clientes mais valorizam.</p>
      <button class="btn btn-accent js-continue" onclick="returnToHub()">Ver outros módulos</button>
    </div>
  </div>

  <!-- ===== MÓDULO 4 — PROPOSTA COMERCIAL (slides 17–20) ===== -->

  <!-- SLIDE 17: Comparativo Planos -->
  <div class="slide" id="slide-17" data-slide="17" data-module="5">
    <div class="flex-col max900" style="gap:20px;">
      <div>
        <div class="eyebrow" style="color:#0B7384;">Módulo 5 &mdash; Proposta Comercial</div>
        <h2 class="display-md" id="s17-title">Comparativo de planos</h2>
        <p class="body-md mt8" id="s17-sub">Veja o que cada plano inclui e por que o <span id="s17-plus-name" style="color:var(--accent-ink);font-weight:800;">Plus</span> é a recomendação para sua operação.</p>
      </div>
      <div class="glass scroll-x plan-table-wrap" style="padding:20px;">
        <table class="plan-table" id="plan-table-main"></table>
      </div>
      <div class="plan-cards" id="plan-cards"></div>
    </div>
  </div>

  <!-- SLIDE 18: Valores -->
  <div class="slide" id="slide-18" data-slide="18" data-module="5">
    <div class="flex-col max900" style="gap:22px;">
      <div>
        <div class="eyebrow" style="color:#0B7384;">Condição especial</div>
        <h2 class="display-lg">Proposta exclusiva para<br><span id="s18-company" style="color:#0B7384;">${data.companyName || 'sua empresa'}</span></h2>
        <p class="body-md mt8">Preparada especialmente para sua operação, com condições que refletem o perfil do seu negócio.</p>
      </div>
      <!-- Implantação -->
      <div class="flex gap12 flex-wrap price-row">
        <div class="price-card" style="flex:1;min-width:200px;">
          <div class="pc-label">Implantação original</div>
          <div class="pc-old" id="s18-original">R$ 0,00</div>
          <div class="pc-sub">Valor de tabela</div>
        </div>
        <div class="price-card featured" style="flex:1;min-width:200px;">
          <div class="pc-label">Valor especial negociado</div>
          <div class="pc-val" id="s18-final">R$ 0,00</div>
          <div class="pc-sub" style="color:#0B7384;">Condição exclusiva</div>
        </div>
      </div>

      <!-- Mensalidade: Pro x Plus (Plus dominante) -->
      <div>
        <div id="s18-monthly-label" style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:10px;">Mensalidade recorrente &mdash; compare e escolha</div>
        <div class="flex gap12 flex-wrap price-row" id="s18-monthly-row" style="align-items:stretch;">
          <div class="price-card" id="s18-pro-card" style="flex:0.8;min-width:170px;opacity:.92;">
            <div class="pc-label">Mensalidade <span id="s18-pro-name">Pro</span></div>
            <div class="pc-val" id="s18-monthly-pro" style="font-size:28px;">R$ 0,00</div>
            <div class="pc-sub">Plano intermediário</div>
          </div>
          <div class="price-card featured" id="s18-plus-card" style="flex:1.3;min-width:230px;border-width:2px;">
            <span class="rec-badge" style="margin:0 0 10px;">&#9733; Recomendado &middot; mais escolhido</span>
            <div class="pc-label">Mensalidade <span id="s18-plus-name2">Plus</span></div>
            <div class="pc-val" id="s18-monthly-plus" style="color:var(--accent-ink);font-size:46px;">R$ 0,00</div>
            <div class="pc-sub" style="color:var(--accent-ink);font-weight:800;">A escolha mais completa</div>
            <div id="s18-plus-benefits" style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;">
              <span style="font-size:11.5px;color:var(--text-secondary);"><b style="color:var(--green);">&#10003;</b> Tudo incluso</span>
              <span style="font-size:11.5px;color:var(--text-secondary);"><b style="color:var(--green);">&#10003;</b> Dashboard gerencial</span>
              <span style="font-size:11.5px;color:var(--text-secondary);"><b style="color:var(--green);">&#10003;</b> Gestão completa</span>
            </div>
          </div>
        </div>
      </div>
      <div class="plus-highlight-box" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <span class="rec-badge" style="font-size:11px;padding:5px 12px;">&#9733; Recomendado</span>
        <div style="flex:1;min-width:220px;">
          <div style="font-size:16px;font-weight:900;color:var(--accent-ink);" id="s18-plan-line">O Plano <span id="s18-plan">Plus</span> é a escolha mais completa para o seu negócio</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Tudo incluso, gestão completa e suporte humano das 7h às 22h.</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);">Válida até</div>
          <div style="font-size:18px;font-weight:900;color:var(--accent-ink);" id="s18-valid">${data.validUntil || '&mdash;'}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- SLIDE 19: Condições de pagamento -->
  <div class="slide" id="slide-19" data-slide="19" data-module="5">
    <div class="flex-col max900" style="gap:22px;">
      <div>
        <div class="eyebrow" style="color:#0B7384;">Condições de pagamento</div>
        <h2 class="display-md">Formas de pagamento<br>para a implantação</h2>
      </div>
      <div class="flex gap12 flex-wrap price-row">
        <div class="price-card" style="flex:1;min-width:200px;">
          <div class="pc-label">Entrada</div>
          <div class="pc-val" id="s19-entry">&mdash;</div>
        </div>
        <div class="price-card" style="flex:1;min-width:200px;">
          <div class="pc-label">Parcelamento</div>
          <div class="pc-val" id="s19-installments">&mdash;</div>
        </div>
        <div class="price-card featured" style="flex:2;min-width:220px;">
          <div class="pc-label">Total implantação</div>
          <div class="pc-val" id="s19-total">&mdash;</div>
        </div>
      </div>
      <div class="glass" style="padding:16px 20px;">
        <div class="check-list">
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Implantação inclui configuração completa do sistema</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>Conversão de dados do sistema anterior (se aplicável)</span></div>
          <div class="check-item"><div class="check-icon"><svg viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3"/></svg></div><span>5 meses de treinamento e suporte assistido inclusos</span></div>
        </div>
      </div>
      <div class="glass" style="padding:14px 20px;">
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.55;">Vendedor: <strong style="color:var(--text-primary);" id="s19-seller">${data.sellerName || '&mdash;'}</strong> &nbsp;|&nbsp; <span id="s19-seller-phone">${data.sellerPhone || ''}</span></div>
      </div>
    </div>
  </div>

  <!-- SLIDE 20: Aceite + WhatsApp -->
  <div class="slide" id="slide-20" data-slide="20" data-module="5">
    <div class="flex-col max900" style="gap:18px;">
      <div>
        <div class="eyebrow" style="color:#0B7384;">Aceite a proposta</div>
        <h2 class="display-md">Válida até <span class="text-orange" id="s20-valid">${data.validUntil || '&mdash;'}</span></h2>
        <p class="body-md mt8">Entre em contato com <strong style="color:var(--text-primary);" id="s20-seller">${data.sellerName || '&mdash;'}</strong> para confirmar e dar início à implantação.</p>
      </div>
      <div class="flex gap12 flex-wrap">
        <button class="btn btn-green" id="accept-whatsapp-btn">&#10003; Aceitar proposta</button>
        <button class="btn btn-ghost" onclick="window.print()">&#128196; Baixar proposta em PDF</button>
      </div>
      <div class="whats-box seller-only">
        <div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:14px;">Resumo para enviar no WhatsApp <span style="font-weight:600;text-transform:none;letter-spacing:0;color:var(--text-secondary);opacity:.8;">(ferramenta do vendedor)</span></div>
        <textarea class="whats-text" id="whats-text-area" readonly></textarea>
        <div class="action-row">
          <button class="btn btn-green" onclick="copyWhatsAppText()">Copiar resumo WhatsApp</button>
          <button class="btn btn-primary" onclick="openWhatsApp()">Abrir no WhatsApp</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== MÓDULO 4 — FERRAMENTAS (slides 21–22) ===== -->
  <div class="slide" id="slide-21" data-slide="21" data-module="4">
    <div class="flex-col items-center" style="gap:24px;width:100%;">
      <div class="text-center">
        <div class="eyebrow" style="justify-content:center;color:#00A6B8;">Módulo 4 &mdash; Ferramentas</div>
        <h2 class="display-md">Ferramentas que <span class="text-accent">geram resultado</span></h2>
        <p class="body-md mt8" style="max-width:580px;margin:8px auto 0;" id="tools-intro">Recursos do Prosystem que ajudam sua operação a vender melhor, reduzir perdas e decidir com base em dados reais.</p>
      </div>
      <div class="tools-grid" id="tools-grid"></div>
    </div>
  </div>

  <div class="slide" id="slide-22" data-slide="22" data-module="4">
    <div class="flex-col items-center text-center max900" style="gap:22px;">
      <div>
        <div class="eyebrow" style="justify-content:center;color:#00A6B8;">E o sistema ainda conta com</div>
        <h2 class="display-md">Um ecossistema completo<br>para a sua operação</h2>
      </div>
      <div class="chips" id="tools-chips"></div>
      <p class="body-lg" id="tools-closing" style="max-width:700px;">A Prosystem oferece ferramentas avançadas para gestão comercial, estoque, compras, vendas, equipe e atendimento &mdash; ajudando sua empresa a vender melhor, reduzir perdas e tomar decisões com base em dados reais da operação.</p>
      <button class="btn btn-primary" onclick="goToModule(5)">Ver a proposta comercial</button>
    </div>
  </div>

  <!-- ===== SLIDE 23 — PROVA SOCIAL ===== -->
  <div class="slide" id="slide-23" data-slide="23">
    <div class="flex-col items-center text-center" style="gap:28px;width:100%;">
      <div>
        <div class="eyebrow" style="justify-content:center;">16 anos de confiança</div>
        <h2 class="display-lg">O varejo escolhe<br><span class="gradient-text">a ProSystem há 16 anos</span></h2>
        <p class="body-lg mt12" style="max-width:560px;margin-left:auto;margin-right:auto;">
          Não somos uma startup prometendo transformação digital. Somos um parceiro operacional testado pelo tempo &mdash; especialistas em farmácias, padarias e varejo.
        </p>
      </div>
      <div class="proof-grid">
        <div class="proof-card">
          <div class="pv" style="color:var(--secondary);" data-counter="16" data-suffix=" anos">0</div>
          <div class="pl">No mercado varejista</div>
        </div>
        <div class="proof-card">
          <div class="pv" style="color:var(--accent-ink);">Farma</div>
          <div class="pl">Farmácias e Manipulação</div>
        </div>
        <div class="proof-card">
          <div class="pv" style="color:var(--green);">7h&ndash;22h</div>
          <div class="pl">Janela de suporte ativo</div>
        </div>
        <div class="proof-card">
          <div class="pv" style="color:var(--gold);" data-counter="5" data-suffix=" meses">0</div>
          <div class="pl">Treinamento para novos clientes</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SLIDE 24 — CTA FINAL ===== -->
  <div class="slide" id="slide-24" data-slide="24">
    <div class="flex-col items-center text-center max700" style="gap:28px;">
      <div>
        <div class="eyebrow" style="justify-content:center;">Próximo passo</div>
        <h1 class="display-xl">Vamos começar?</h1>
        <p class="body-lg mt16">
          A proposta é válida até <strong class="text-accent" id="cta-valid">${data.validUntil || '&mdash;'}</strong>.<br>
          Responda no WhatsApp agora e comece a transformar sua operação.
        </p>
      </div>
      <div class="flex gap12 flex-wrap justify-center">
        <button class="btn btn-green" id="cta-whatsapp-btn" style="font-size:15px;padding:16px 32px;">&#10003; Aceitar proposta</button>
        <button class="btn btn-ghost" onclick="goToModule(5)" style="font-size:15px;padding:16px 24px;">Rever proposta comercial</button>
      </div>
      <div style="font-size:13px;color:var(--text-secondary);">
        Vendedor: <strong style="color:var(--text-primary);" id="cta-seller">${data.sellerName}</strong> &nbsp;|&nbsp;
        <span id="cta-phone">${data.sellerPhone}</span>
      </div>
    </div>
  </div>

</div><!-- /deck -->

<!-- DOCUMENTO PDF COMERCIAL (2 páginas) — preenchido por buildPrintDoc() -->
<div id="print-doc"></div>

<script>
  // ── DATA ────────────────────────────────────────────────
  const proposalData = ${dataJson};
  const PROPOSAL_TOKEN = ${tokenJson};
  const API_BASE = ${apiUrlJson};

  // ── PLAN FAMILY ─────────────────────────────────────────
  function getPlanFamily(segment, plano) {
    const s = ((plano || '') + ' ' + (segment || '')).toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    if (/farma|farmacia|manipula/i.test(s)) {
      return { familia: 'FARMA', nomes: { basic: 'Farma Basic', pro: 'Farma Pro', plus: 'Farma Plus' } };
    }
    if (/\\bmei\\b/i.test(s)) {
      return { familia: 'MEI', nomes: { basic: 'MEI', pro: 'MEI', plus: 'Prosystem MEI' } };
    }
    return { familia: 'LOJA', nomes: { basic: 'Loja Basic', pro: 'Loja Pro', plus: 'Loja Plus' } };
  }

  const planFamily = getPlanFamily(proposalData.segment, proposalData.selectedPlan);

  // Perfil do segmento (personalização): farmácia / padaria / varejo
  function getSegInfo(segment, plano) {
    const s = ((plano || '') + ' ' + (segment || '')).toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    if (/farma|farmacia|manipula/.test(s)) return { noun: 'farmácia', hub: '&#128138;' };       // 💊
    if (/padar|panific/.test(s))           return { noun: 'padaria',  hub: '&#129366;' };        // 🥖
    return { noun: 'operação', hub: '&#127978;' };                                               // 🏪
  }
  const segInfo = getSegInfo(proposalData.segment, proposalData.selectedPlan);

  // ── MATRIZ OFICIAL DE PLANOS (Prosystem 2025) ────────────
  // Loja (varejo geral / padaria) — Basic / Pro / Plus
  const LOJA_ROWS = [
    { feature: 'Frente de Caixa (PDV)',          basic: 'Sim', pro: 'Sim', plus: 'Sim' },
    { feature: 'NF-e / NFC-e',                   basic: 'Sim', pro: 'Sim', plus: 'Sim' },
    { feature: 'ECF / Fiscal',                   basic: 'Sim', pro: 'Sim', plus: 'Sim' },
    { feature: 'Entregas em Domicílio',          basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Conferência Cega',               basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Pesquisa Analítica',             basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Financeiro Completo',            basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Transporte',                     basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Integrações Extras',             basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Atendimento de Plantão',         basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Banco',                          basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Fluxo de Caixa',                 basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Boletos',                        basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Extintor',                       basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Dashboard Gerencial',            basic: 'Não', pro: 'Não', plus: 'Sim' },
  ];
  // Farmácia — Basic / Pro / Plus
  const FARMA_ROWS = [
    { feature: 'Frente de Caixa (PDV)',          basic: 'Sim', pro: 'Sim', plus: 'Sim' },
    { feature: 'NF-e / NFC-e',                   basic: 'Sim', pro: 'Sim', plus: 'Sim' },
    { feature: 'ECF / Fiscal',                   basic: 'Sim', pro: 'Sim', plus: 'Sim' },
    { feature: 'Cadastros Farmacêuticos',        basic: 'Sim', pro: 'Sim', plus: 'Sim' },
    { feature: 'Entregas em Domicílio',          basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Conferência Cega',               basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Pesquisa Analítica',             basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Financeiro Completo',            basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'PBM (e-Pharma, Vidalink)',       basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Transporte',                     basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Integrações Extras',             basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Atendimento de Plantão',         basic: 'Não', pro: 'Sim', plus: 'Sim' },
    { feature: 'Banco',                          basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Fluxo de Caixa',                 basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Boletos',                        basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Dashboard Gerencial',            basic: 'Não', pro: 'Não', plus: 'Sim' },
    { feature: 'Manipulação',                    basic: 'Não', pro: 'Não', plus: 'Sim' },
  ];

  function getComparisonRows() {
    return planFamily.familia === 'FARMA' ? FARMA_ROWS : LOJA_ROWS;
  }

  // ── FERRAMENTAS (biblioteca comercial) ──────────────────
  const isFarmaSegment = planFamily.familia === 'FARMA';
  const isPadaria = /padar|panific/.test(((proposalData.selectedPlan||'') + ' ' + (proposalData.segment||'')).toLowerCase());
  // mix do segmento p/ deixar as descrições no contexto certo
  const mixSeg = isFarmaSegment ? 'mix da farmácia' : (isPadaria ? 'mix da padaria (produção + revenda)' : 'mix da loja');
  const TOOLS = [
    { icon:'&#128202;',          nome:'Dashboard Gerencial',          desc:'Vendas, produção e estoque em tempo real numa só tela — decisões rápidas, sem depender de relatórios manuais.' },
    { icon:'&#128201;',          nome:'Indicador de Perda de Vendas', desc:'Descubra por que vendas não se concretizam e aja para recuperar a receita que hoje escapa do caixa.' },
    { icon:'&#127991;&#65039;',  nome:'Análise de Descontos',         desc:'Desconto médio e rentabilidade por produto, grupo e subgrupo — proteja a sua margem de lucro.' },
    { icon:'&#128200;',          nome:'Rentabilidade do Negócio',     desc:'Saiba o lucro real sobre o investimento e enxergue onde a operação realmente ganha dinheiro.' },
    { icon:'&#128722;',          nome:'Sugestão de Compras',          desc:'Pedidos de compra automáticos para o ' + mixSeg + ' — compre certo, sem ruptura nem esquecimento.' },
    { icon:'&#128230;',          nome:'Estoque Mínimo e Máximo',      desc:'Quantidades ideais calculadas pelo histórico de vendas: menos falta de produto e menos capital parado.' },
    { icon:'&#128290;',          nome:'Curva ABC XYZ',                desc:'Classifique o estoque por importância e foque energia no que realmente gira e lucra.' },
    { icon:'&#9851;&#65039;',    nome:'Produtos sem Giro e Excesso',  desc:'Identifique itens parados e compras em excesso antes de virarem perda e prejuízo.' },
    { icon:'&#128197;',          nome:'Vendas Semestrais',            desc:'Analise os últimos 6 meses por produto, grupo e fabricante para planejar compras com segurança.' },
    { icon:'&#128241;',          nome:'Avisos via WhatsApp',          desc:'Relatórios e avisos automáticos pelo WhatsApp — gestor e equipe sempre informados, sem esforço.' },
    { icon:'&#127919;',          nome:'Metas de Funcionários',        desc:'Metas por colaborador acompanhadas em tempo real — mais produtividade e foco no resultado.' },
    { icon:'&#128179;',          nome:'Cartão Fidelidade / Fidelimax',desc:'Fidelize com pontos e marketing automatizado: o cliente compra mais e volta mais vezes.' },
    // ── Padaria ──
    { icon:'&#127838;',          nome:'Ficha Técnica & Produção',     desc:'Controle as receitas e o custo real de cada produto produzido — saiba quanto custa e quanto rende cada fornada.', padaria:true },
    { icon:'&#9878;&#65039;',    nome:'Balança & Pesáveis',           desc:'Integração com balança para pães, frios e produtos a granel — venda rápida no balcão, sem erro de peso.', padaria:true },
    { icon:'&#9203;',            nome:'Controle de Validade',         desc:'Acompanhe a validade dos produtos perecíveis e reduza o desperdício do que não vendeu a tempo.', padaria:true },
    { icon:'&#128666;',          nome:'Delivery & Encomendas',        desc:'Gerencie encomendas (bolos, salgados, festas) e entregas com agilidade — não perca pedido por desorganização.', padaria:true },
    // ── Farmácia ──
    { icon:'&#128138;',          nome:'Uso Contínuo Ativo',           desc:'Gerencie clientes de medicação contínua e faça um pós-venda recorrente que aumenta o tíquete.', farma:true },
    { icon:'&#129658;',          nome:'Atenção Farmacêutica',         desc:'Registre o atendimento farmacêutico e o histórico do paciente com mais profissionalismo e segurança.', farma:true },
    { icon:'&#129534;',          nome:'Inteligência Tributária',      desc:'Revisão tributária (Avant / Imendes) que pode reduzir os impostos do seu negócio.', farma:true },
  ];
  const EXTRA_TOOLS = [
    'Cadastro de produtos','Precificação','Curva ABC XYZ','Contagem de estoque','Produtos sem giro','Estoque em excesso',
    'Controle financeiro','Plano de contas','Centro de custos','Contas bancárias','Cartões de crédito e débito',
    'Entrada de notas via XML','Entrada automática pela SEFAZ','Controle de clientes','Cartão fidelidade',
    { t:'Ficha técnica de produção', padaria:true }, { t:'Balança / pesáveis', padaria:true }, { t:'Controle de validade', padaria:true }, { t:'Encomendas e festas', padaria:true },
    { t:'Uso contínuo', farma:true }, { t:'SNGPC', farma:true }, { t:'Farmácia Popular', farma:true }, { t:'PBM e-Pharma', farma:true },
    'Entregas em domicílio','Registro de encomendas','Fechamento de caixa','Sangria e suprimento','Controle de acessos',
    'Auditoria de usuários','Backup em nuvem','Integrações com e-commerce','Prosystem Fiscal','Suporte remoto',
  ];

  // mostra a ferramenta se: for genérica, OU bater com o segmento atual
  function ferramentaVisivel(t) {
    if (t && t.farma) return isFarmaSegment;
    if (t && t.padaria) return isPadaria;
    return true;
  }

  function buildToolsGrid() {
    const grid = document.getElementById('tools-grid');
    if (grid) {
      const tools = TOOLS.filter(ferramentaVisivel);
      grid.innerHTML = tools.map(function(t) {
        const tag = t.farma ? '<span class="tc-tag">Farma</span>' : (t.padaria ? '<span class="tc-tag">Padaria</span>' : '');
        return '<div class="tool-card">' +
          '<div class="tc-icon">' + t.icon + '</div>' +
          '<div><div class="tc-name">' + t.nome + tag + '</div>' +
          '<div class="tc-desc">' + t.desc + '</div></div>' +
        '</div>';
      }).join('');
    }
    const chips = document.getElementById('tools-chips');
    if (chips) {
      const extras = EXTRA_TOOLS
        .filter(ferramentaVisivel)
        .map(function(x) { return (typeof x === 'string') ? x : x.t; });
      chips.innerHTML = extras.map(function(x) { return '<span class="chip">' + x + '</span>'; }).join('');
    }
  }

  // ── DOCUMENTO PDF COMERCIAL (2 páginas: capa azul + detalhes) ──
  function buildPrintDoc() {
    const el = document.getElementById('print-doc');
    if (!el) return;
    const p = proposalData;
    const nomes = planFamily.nomes;
    const segNoun = segInfo.noun;
    const isMEI = planFamily.familia === 'MEI';
    const logoEl = document.querySelector('.nav-brand img');
    const logo = (logoEl && logoEl.src) ? logoEl.src : '/logo-prosystem.png';

    // paleta: azul #417ABC base; accent segue o tema (ciano farma / laranja varejo)
    const NAVY = '#0B2740', BLUE = '#417ABC', CYAN = 'var(--accent)', INK = 'var(--accent-ink)',
          TXT = '#14222E', MUT = '#69727D', BD = '#E1E8F0', GR = '#1FA45A';

    const eyebrow = function(t, color) {
      return '<div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:' + (color || MUT) + ';margin-bottom:6px;">' + t + '</div>';
    };
    const check = function(t) {
      return '<div style="display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:' + TXT + ';margin-bottom:7px;line-height:1.4;"><span style="color:' + GR + ';font-weight:800;flex-shrink:0;">&#10003;</span><span>' + t + '</span></div>';
    };

    // ===================== PÁGINA 1 — CAPA AZUL =====================
    const pill = function(val, lbl) {
      return '<div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.28);border-radius:14px;padding:11px 18px;text-align:center;min-width:90px;">' +
        '<div style="font-size:17px;font-weight:900;color:#fff;letter-spacing:-0.02em;">' + val + '</div>' +
        '<div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-top:2px;">' + lbl + '</div></div>';
    };
    const page1 =
      '<section class="print-page" style="background:linear-gradient(165deg, #0B2740 0%, ' + BLUE + ' 58%, #356AA6 100%);color:#fff;display:flex;flex-direction:column;align-items:center;text-align:center;">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.32em;text-transform:uppercase;color:' + CYAN + ';">Proposta Comercial</div>' +
        '<div style="width:46px;height:3px;background:' + CYAN + ';border-radius:3px;margin:10px auto 0;"></div>' +

        '<div style="margin:auto 0;display:flex;flex-direction:column;align-items:center;">' +
          '<div style="background:#fff;border-radius:22px;padding:22px 34px;box-shadow:0 18px 50px rgba(0,0,0,0.28);margin-bottom:26px;">' +
            '<img src="' + logo + '" style="height:62px;object-fit:contain;display:block;" onerror="this.style.display=\\'none\\'">' +
          '</div>' +
          '<div style="font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,0.75);margin-bottom:10px;">Preparada com dedicação para</div>' +
          '<div style="font-size:36px;font-weight:900;letter-spacing:-0.03em;line-height:1.05;color:#fff;max-width:170mm;">' + (p.companyName || 'sua empresa') + '</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:10px;">' + [p.cnpj, [p.city, p.state].filter(Boolean).join('/')].filter(Boolean).join('&nbsp;&bull;&nbsp;') + '</div>' +
          '<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.9);max-width:150mm;margin:22px auto 0;">Mais controle, agilidade e <b style="color:' + CYAN + ';">inteligência</b> para a sua ' + segNoun + ' &mdash; com 16 anos de especialização no varejo e suporte humano de verdade.</p>' +
          '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px;">' +
            pill('16 anos', 'de mercado') + pill('7h&ndash;22h', 'suporte ativo') + pill(nomes.plus, 'plano recomendado') +
          '</div>' +
        '</div>' +

        // CTA forte
        '<div style="width:100%;background:' + CYAN + ';border-radius:18px;padding:20px 24px;color:' + NAVY + ';box-shadow:0 16px 40px rgba(0,0,0,0.25);">' +
          '<div style="font-size:21px;font-weight:900;letter-spacing:-0.02em;">Vamos começar? Aceite sua proposta hoje mesmo.</div>' +
          '<div style="font-size:13px;font-weight:600;margin-top:6px;color:#0B3a44;">Fale com ' + (p.sellerName || 'seu consultor') + (p.sellerPhone ? ' no WhatsApp <b>' + p.sellerPhone + '</b>' : '') + ' &nbsp;&bull;&nbsp; Condições válidas até <b>' + (p.validUntil || 'a combinar') + '</b></div>' +
        '</div>' +
        '<div style="font-size:10px;letter-spacing:.08em;color:rgba(255,255,255,0.6);margin-top:14px;">ProSystem Sistemas &bull; 16 anos transformando o varejo brasileiro</div>' +
      '</section>';

    // ===================== PÁGINA 2 — DETALHES =====================
    const header2 =
      '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ' + BLUE + ';padding-bottom:12px;margin-bottom:18px;">' +
        '<img src="' + logo + '" style="height:34px;object-fit:contain;" onerror="this.style.display=\\'none\\'">' +
        '<div style="text-align:right;"><div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:' + BLUE + ';">Sua proposta em detalhes</div>' +
        '<div style="font-size:11px;color:' + MUT + ';">' + (p.companyName || '') + '</div></div></div>';

    // Comparativo compacto = matriz oficial (curada para caber em 1 página)
    const cmp = isFarmaSegment
      ? [
          ['Frente de Caixa (PDV) e NF-e', 1, 1, 1],
          ['Entregas em Domicílio', 0, 1, 1],
          ['Financeiro Completo', 0, 1, 1],
          ['PBM (e-Pharma, Vidalink)', 0, 1, 1],
          ['Conferência Cega', 0, 1, 1],
          ['Atendimento de Plantão', 0, 1, 1],
          ['Banco, Fluxo de Caixa e Boletos', 0, 0, 1],
          ['Dashboard Gerencial', 0, 0, 1],
          ['Manipulação', 0, 0, 1],
        ]
      : [
          ['Frente de Caixa (PDV) e NF-e', 1, 1, 1],
          ['Entregas em Domicílio', 0, 1, 1],
          ['Financeiro Completo', 0, 1, 1],
          ['Conferência Cega e Pesquisa Analítica', 0, 1, 1],
          ['Transporte e Integrações', 0, 1, 1],
          ['Atendimento de Plantão', 0, 1, 1],
          ['Banco, Fluxo de Caixa e Boletos', 0, 0, 1],
          ['Dashboard Gerencial', 0, 0, 1],
          ['Extintor', 0, 0, 1],
        ];
    const mark = function(v, plus) {
      const inner = v ? '<span style="color:' + GR + ';font-weight:800;">&#10003;</span>' : '<span style="color:' + MUT + ';">&ndash;</span>';
      return '<td style="text-align:center;padding:6px 6px;border-bottom:1px solid ' + BD + ';font-size:11px;' + (plus ? 'background:rgba(var(--accent-rgb),0.09);' : '') + '">' + inner + '</td>';
    };
    const cmpRows = cmp.map(function(r) {
      return '<tr><td style="padding:6px 8px;border-bottom:1px solid ' + BD + ';font-size:11px;font-weight:600;color:' + TXT + ';">' + r[0] + '</td>' +
        mark(r[1], false) + mark(r[2], false) + mark(r[3], true) + '</tr>';
    }).join('');
    const cmpTable =
      '<table style="width:100%;border-collapse:collapse;margin:6px 0 16px;">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:' + MUT + ';">Funcionalidade</th>' +
          '<th style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + MUT + ';">' + nomes.basic + '</th>' +
          '<th style="padding:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:' + BLUE + ';">' + nomes.pro + '</th>' +
          '<th style="padding:6px;font-size:10px;font-weight:900;text-transform:uppercase;color:' + INK + ';background:rgba(var(--accent-rgb),0.12);border-top:2px solid ' + CYAN + ';">' + nomes.plus + ' &#9733;</th>' +
        '</tr></thead><tbody>' + cmpRows + '</tbody></table>';

    // Valores (linha compacta)
    const valBox = function(label, value, sub, accent, old) {
      return '<div style="flex:1;border:1px solid ' + (accent ? CYAN : BD) + ';border-radius:12px;padding:13px 15px;' + (accent ? 'background:rgba(var(--accent-rgb),0.08);' : '') + '">' +
        eyebrow(label, accent ? INK : MUT) +
        (old ? '<div style="font-size:13px;font-weight:800;color:' + MUT + ';text-decoration:line-through;line-height:1;">' + old + '</div>' : '') +
        '<div style="font-size:' + (accent ? '23px' : '19px') + ';font-weight:900;letter-spacing:-0.02em;color:' + (accent ? INK : NAVY) + ';line-height:1.15;">' + value + '</div>' +
        (sub ? '<div style="font-size:10.5px;color:' + MUT + ';margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    };
    const proBox = (p.monthlyPro > 0) ? valBox('Mensalidade ' + nomes.pro, formatMoney(p.monthlyPro), 'Plano intermediário', false) : '';

    // Dicas comerciais (persuasão)
    const tip = function(t) {
      return '<div style="display:flex;gap:8px;align-items:flex-start;font-size:11px;color:' + TXT + ';margin-bottom:6px;line-height:1.4;"><span style="color:' + CYAN + ';font-weight:900;flex-shrink:0;">&#9733;</span><span>' + t + '</span></div>';
    };

    // Bloco de planos: comparativo (Basic/Pro/Plus) ou plano único MEI
    const MEI_FEATS = ['Frente de Caixa (PDV)', 'Cadastros básicos de produtos e clientes', 'Contas a receber', 'Controle simples da operação', 'Suporte e treinamento Prosystem'];
    const meiList =
      '<div style="border:1px solid ' + CYAN + ';border-radius:12px;padding:14px 16px;background:rgba(var(--accent-rgb),0.06);margin:6px 0 16px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:15px;font-weight:900;color:' + INK + ';">Plano MEI</span><span style="font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;background:rgba(var(--accent-rgb),0.16);color:' + INK + ';padding:3px 9px;border-radius:999px;">Plano único</span></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;">' + MEI_FEATS.map(check).join('') + '</div>' +
      '</div>';
    const compBlock = isMEI
      ? eyebrow('O que o plano MEI inclui', NAVY) + meiList
      : eyebrow('Comparativo de planos &mdash; por que o ' + nomes.plus, NAVY) + cmpTable;
    const valuesBlock = isMEI
      ? '<div style="display:flex;gap:12px;margin-bottom:14px;">' +
          valBox('Implantação', formatMoney(p.setupFinal), 'Condição exclusiva', true, p.setupOriginal > p.setupFinal ? formatMoney(p.setupOriginal) : '') +
          valBox('Mensalidade MEI', formatMoney(p.monthlyValue), 'Plano único', true) +
        '</div>'
      : '<div style="display:flex;gap:12px;margin-bottom:14px;">' +
          valBox('Implantação', formatMoney(p.setupFinal), 'Condição exclusiva', true, p.setupOriginal > p.setupFinal ? formatMoney(p.setupOriginal) : '') +
          proBox +
          valBox('Mensalidade ' + nomes.plus + ' &#9733;', formatMoney(p.monthlyPlus > 0 ? p.monthlyPlus : p.monthlyValue), 'Plano recomendado', true) +
        '</div>';
    const tipsBlock = isMEI
      ? eyebrow('Por que começar com o plano MEI', NAVY) +
        tip('Simples de usar: ideal para quem está organizando a pequena empresa.') +
        tip('Tudo num só lugar: PDV, estoque e emissão fiscal integrados.') +
        tip('Suporte humano de verdade das 7h às 22h, sem fila.') +
        tip('Cresceu? Migre para Loja Basic, Pro ou Plus quando precisar.')
      : eyebrow('Por que decidir pelo ' + nomes.plus, NAVY) +
        tip('Decisões com base em dados reais: Dashboard e rentabilidade em tempo real.') +
        tip('Menos perdas: indicador de perda de vendas e reposição inteligente.') +
        tip('Mais margem: análise de descontos protege o seu lucro.') +
        tip('Equipe produtiva: metas por colaborador e avisos via WhatsApp.');

    const page2 =
      '<section class="print-page" style="background:#fff;color:' + TXT + ';">' +
        header2 +
        compBlock +
        valuesBlock +
        '<div style="font-size:11.5px;color:' + TXT + ';margin-bottom:16px;padding:10px 14px;border:1px solid ' + BD + ';border-radius:10px;">' +
          '<b style="color:' + NAVY + ';">Pagamento:</b> ' +
          'Entrada ' + (p.entryValue > 0 ? formatMoney(p.entryValue) : 'a combinar') + ' &nbsp;&bull;&nbsp; ' +
          (p.installments > 0 ? p.installments + 'x de ' + formatMoney(p.installmentValue) : 'à vista') + ' &nbsp;&bull;&nbsp; Total ' + formatMoney(p.setupFinal) +
          ' &nbsp;|&nbsp; <span style="color:' + MUT + ';">Implantação + conversão de dados + 5 meses de treinamento inclusos.</span>' +
        '</div>' +

        '<div style="display:flex;gap:14px;margin-bottom:16px;">' +
          '<div style="flex:1;border:1px solid ' + BD + ';border-radius:12px;padding:14px 16px;">' +
            tipsBlock +
          '</div>' +
        '</div>' +

        '<div style="position:absolute;left:16mm;right:16mm;bottom:13mm;">' +
          '<div style="background:linear-gradient(135deg, ' + NAVY + ' 0%, ' + BLUE + ' 100%);border-radius:16px;padding:18px 22px;color:#fff;box-shadow:0 14px 36px rgba(11,39,64,0.25);">' +
            '<div style="font-size:18px;font-weight:900;letter-spacing:-0.02em;">Aceite agora e comece a transformar sua ' + segNoun + '.</div>' +
            '<div style="font-size:12.5px;margin-top:5px;color:rgba(255,255,255,0.9);">Fale com <b>' + (p.sellerName || 'seu consultor') + '</b>' + (p.sellerPhone ? ' no WhatsApp <b style="color:' + CYAN + ';">' + p.sellerPhone + '</b>' : '') + ' &nbsp;&bull;&nbsp; Proposta válida até <b style="color:' + CYAN + ';">' + (p.validUntil || 'a combinar') + '</b></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    el.innerHTML = page1 + page2;
  }

  // ── SLIDES CONFIG ───────────────────────────────────────
  const TOTAL_SLIDES = 25;
  const HUB_SLIDE = 4;
  const modules = [
    { id:1, name:'Gestão do Negócio',              desc:'PDV, Estoque, Compras e Fiscal integrados',           icon:'&#127978;', color:'#417ABC', slides:[5,6,7,8]   },
    { id:2, name:'Controle Financeiro &amp; Gerencial', desc:'Dashboard, Rentabilidade e Análises — exclusivo Plus', icon:'&#128202;', color:'#1FA45A', slides:[9,10,11,12] },
    { id:3, name:'Suporte &amp; Treinamento',           desc:'7h–22h, atendimento humano, 5 meses de treinamento',  icon:'&#129309;', color:'#F9A01B', slides:[13,14,15,16] },
    { id:4, name:'Ferramentas que geram resultado', desc:'Dashboard, Indicador de Perdas, Sugestão de Compras e mais', icon:'&#128736;&#65039;', color:'#00A6B8', slides:[21,22] },
    { id:5, name:'Proposta Comercial',              desc:'Condições especiais personalizadas para você',         icon:'&#128203;', color:'#0B7384', slides:[17,18,19,20] },
  ];

  let currentSlide = 0;
  let presenterMode = true;
  let modeLocked = false;   // true = modo travado pela URL (link do cliente)
  let selfServiceTimer = null;
  let coachTimer = null;
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
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:false, alpha:true, premultipliedAlpha:false });
    renderer.setClearColor(0x000000, 0); // fundo transparente — tema claro por baixo
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const count = 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color('#417ABC');
    const c2 = new THREE.Color('#081330');
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
    const mat = new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true, opacity: 0.22 });
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
    if (!grid) return;
    grid.innerHTML = modules.map(m => \`
      <div class="module-card" onclick="goToModule(\${m.id})">
        <div class="mc-num">Módulo \${m.id} &nbsp;<kbd style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(8,19,48,0.08);font-family:monospace;">\${m.id}</kbd></div>
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
    const nomes = planFamily.nomes;

    // ── MEI: plano ÚNICO (pequena empresa do varejo) — sem comparativo ──
    if (planFamily.familia === 'MEI') {
      const meiFeatures = [
        'Frente de Caixa (PDV)',
        'Cadastros básicos de produtos e clientes',
        'Contas a receber',
        'Controle simples da operação',
        'Suporte e treinamento Prosystem',
      ];
      const titleEl = document.getElementById('s17-title');
      if (titleEl) titleEl.textContent = 'Plano MEI';
      const subEl = document.getElementById('s17-sub');
      if (subEl) subEl.innerHTML = 'O plano ideal para a <b style="color:var(--accent-ink);">pequena empresa do varejo</b> &mdash; simples, completo e com tudo o que você precisa para começar com organização.';
      const headBadge = '<span class="plan-badge badge-plus">' + nomes.plus + ' &#9733;</span> <span class="rec-badge">Plano único</span>';
      tbl.innerHTML = '<thead><tr><th colspan="2" style="text-align:left;min-width:0;padding-bottom:14px;">' + headBadge + '</th></tr></thead><tbody>' +
        meiFeatures.map(function(f) {
          return '<tr><td style="width:30px;min-width:30px;text-align:center;"><span class="cell-yes">&#10003;</span></td>' +
                 '<td style="text-align:left;min-width:0;">' + f + '</td></tr>';
        }).join('') + '</tbody>';
      const cardsEl = document.getElementById('plan-cards');
      if (cardsEl) {
        cardsEl.innerHTML = '<div class="plan-mc featured"><div class="plan-mc-head">' + headBadge + '</div><div class="plan-mc-list">' +
          meiFeatures.map(function(f) { return '<div class="pmc-row"><span class="pmc-check">&#10003;</span><span class="pmc-feat">' + f + '</span></div>'; }).join('') +
          '</div></div>';
      }
      const plusNameEl = document.getElementById('s17-plus-name');
      if (plusNameEl) plusNameEl.textContent = nomes.plus;
      return;
    }

    // Comparativo = matriz oficial de planos (Prosystem 2025), por família
    const sourceRows = getComparisonRows();

    const fmtCell = (v, isPlus) => {
      if (v === 'Sim')           return \`<span class="cell-yes">&#10003; Sim</span>\`;
      if (v === 'Não')           return \`<span class="cell-no">&mdash; Não</span>\`;
      if (v === 'Avançado')      return \`<span class="cell-adv">Avançado</span>\`;
      if (v === 'Intermediário') return \`<span class="cell-int">Intermediário</span>\`;
      if (v === 'Básico')        return \`<span class="cell-bas">Básico</span>\`;
      return \`<span style="color:\${isPlus ? '#0B7384' : 'var(--text-secondary)'}">\${v}</span>\`;
    };

    const rows = sourceRows.map(row => \`<tr>
      <td>\${row.feature}</td>
      <td>\${fmtCell(row.basic, false)}</td>
      <td>\${fmtCell(row.pro, false)}</td>
      <td class="col-plus">\${fmtCell(row.plus, true)}</td>
    </tr>\`).join('');

    tbl.innerHTML = \`<thead><tr>
      <th>Funcionalidade</th>
      <th><span class="plan-badge badge-basic">\${nomes.basic}</span></th>
      <th><span class="plan-badge badge-pro">\${nomes.pro}</span></th>
      <th class="col-plus th-plus"><span class="plan-badge badge-plus">\${nomes.plus} &#9733;</span><span class="rec-badge">Recomendado</span></th>
    </tr></thead><tbody>\${rows}</tbody>\`;

    // Update plus name references
    const plusNameEl = document.getElementById('s17-plus-name');
    if (plusNameEl) plusNameEl.textContent = nomes.plus;

    // ── Versão em cartões empilhados (celular) — mesma fonte de dados ──
    const cardsEl = document.getElementById('plan-cards');
    if (cardsEl) {
      const planDefs = [
        { key: 'plus',  name: nomes.plus,  cls: 'badge-plus',  featured: true  },
        { key: 'pro',   name: nomes.pro,   cls: 'badge-pro',   featured: false },
        { key: 'basic', name: nomes.basic, cls: 'badge-basic', featured: false },
      ];
      cardsEl.innerHTML = planDefs.map(function(pd) {
        const items = sourceRows.map(function(row) {
          const v = row[pd.key];
          const isNo = (v === 'Não');
          const isYes = (v === 'Sim');
          const lvl = (!isNo && !isYes) ? v : '';
          const icon = isNo
            ? '<span class="pmc-x">&#10005;</span>'
            : '<span class="pmc-check">&#10003;</span>';
          return '<div class="pmc-row' + (isNo ? ' off' : '') + '">' + icon +
                 '<span class="pmc-feat">' + row.feature + '</span>' +
                 (lvl ? '<span class="pmc-lvl">' + lvl + '</span>' : '') + '</div>';
        }).join('');
        return '<div class="plan-mc' + (pd.featured ? ' featured' : '') + '">' +
                 '<div class="plan-mc-head">' +
                   '<span class="plan-badge ' + pd.cls + '">' + pd.name + (pd.featured ? ' &#9733;' : '') + '</span>' +
                   (pd.featured ? '<span class="rec-badge">Recomendado</span>' : '') +
                 '</div>' +
                 '<div class="plan-mc-list">' + items + '</div>' +
               '</div>';
      }).join('');
    }
  }

  // ── PROPOSAL DATA INJECTION ─────────────────────────────
  function injectProposalData() {
    const getEl = id => document.getElementById(id);
    const set = (id, txt) => { const el = getEl(id); if (el) el.textContent = txt; };
    const setHTML = (id, html) => { const el = getEl(id); if (el) el.innerHTML = html; };
    const nomes = planFamily.nomes;

    // Cover
    set('s0-company', proposalData.companyName || '');

    // Personalização por segmento: ícone do hub do ecossistema (💊 / 🥖 / 🏪)
    setHTML('eco-hub', segInfo.hub);

    // ── COPY POR SEGMENTO (alta conversão) — sobrescreve os textos-chave ──
    // Padaria: baseada no material comercial (Dor → Consequência → Solução).
    if (isPadaria) {
      setHTML('s0-headline', 'Sua padaria pode estar <span class="gradient-text">perdendo dinheiro todos os dias</span>');
      set('s0-subtitle', 'E você nem percebe. A falta de controle é o maior custo invisível do seu negócio — a ProSystem devolve esse controle às suas mãos.');

      set('s2-eyebrow', 'Para onde vai o seu lucro?');
      setHTML('s2-title', 'O lucro da sua padaria está<br><span class="text-orange">escapando todos os dias</span>');
      set('s2-sub', 'Quebra de caixa, perda de insumos, peso no balcão e o dono preso no operacional. Se você se identifica, sua margem já está comprometida.');
      setHTML('s2-c1-ic', '&#128176;'); set('s2-c1-t', 'Quebra de caixa');
      set('s2-c1-d', 'Dinheiro que some sem explicação no fim do expediente — turno após turno.');
      setHTML('s2-c2-ic', '&#127857;'); set('s2-c2-t', 'Perda de insumos');
      set('s2-c2-d', 'Estoque que não bate e perecíveis que vencem na prateleira viram prejuízo direto.');
      setHTML('s2-c3-ic', '&#9878;&#65039;'); set('s2-c3-t', 'Peso e fila no balcão');
      set('s2-c3-d', 'Pesagem lenta e manual trava o atendimento justamente na hora do pico de vendas.');

      set('s3-eyebrow', 'A virada de chave');
      setHTML('s3-title', 'Padaria sem sistema integrado é como<br><span class="gradient-text">forno sem controle de temperatura</span>');
      set('s3-sub', 'Você trabalha no escuro, torcendo para dar certo. A ProSystem integra Frente de Loja, Estoque, Produção (ficha técnica) e Financeiro — e devolve o controle absoluto da sua padaria.');

      // Reposição inteligente: trocar os ícones de medicamento por INSUMOS de padaria
      setHTML('fx-funnel-top', '<span>&#129370;</span><span>&#127806;</span><span>&#129472;</span><span>&#129371;</span>'); // 🥚 ovos · 🌾 trigo · 🧀 queijo · 🥛 leite
    } else if (!isFarmaSegment) {
      // Varejo geral: ícones neutros de produtos (sem cara de farmácia)
      setHTML('fx-funnel-top', '<span>&#128722;</span><span>&#128230;</span><span>&#127991;&#65039;</span><span>&#128181;</span>'); // 🛒 · 📦 · 🏷️ · 💵
    }

    // Slide 17
    set('s17-plus-name', nomes.plus);

    // Slide 18
    set('s18-company',  proposalData.companyName || 'sua empresa');
    set('s18-original', formatMoney(proposalData.setupOriginal));
    set('s18-final',    formatMoney(proposalData.setupFinal));
    set('s18-pro-name',   nomes.pro);
    set('s18-plus-name2', nomes.plus);
    set('s18-monthly-pro',  formatMoney(proposalData.monthlyPro));
    set('s18-monthly-plus', formatMoney(proposalData.monthlyPlus > 0 ? proposalData.monthlyPlus : proposalData.monthlyValue));
    const isMEI = planFamily.familia === 'MEI';
    // Esconde o card Pro se a mensalidade Pro não foi preenchida (ou se for MEI = plano único)
    if (isMEI || !(proposalData.monthlyPro > 0)) {
      const proCard = getEl('s18-pro-card');
      if (proCard) proCard.style.display = 'none';
    }
    if (isMEI) {
      // MEI: mensalidade única — sem comparação, sem badge "Recomendado"
      set('s18-monthly-label', 'Mensalidade do plano MEI');
      set('s18-plus-name2', 'MEI');
      const plusCard = getEl('s18-plus-card');
      if (plusCard) {
        const badge = plusCard.querySelector('.rec-badge');
        if (badge) badge.style.display = 'none';
        const sub = plusCard.querySelector('.pc-sub');
        if (sub) sub.textContent = 'Plano único para pequenas empresas';
      }
      const benefits = getEl('s18-plus-benefits');
      if (benefits) benefits.style.display = 'none';
      setHTML('s18-plan-line', 'O Plano <b style="color:var(--accent-ink);">MEI</b> é ideal para a sua pequena empresa do varejo');
    }
    set('s18-plan',     nomes.plus);
    set('s18-valid',    proposalData.validUntil || '—');

    // Slide 19
    set('s19-entry', proposalData.entryValue > 0
      ? formatMoney(proposalData.entryValue) : 'A combinar');
    set('s19-installments', proposalData.installments > 0
      ? \`\${proposalData.installments}x de \${formatMoney(proposalData.installmentValue)}\`
      : 'À vista');
    set('s19-total',         formatMoney(proposalData.setupFinal));
    set('s19-seller',        proposalData.sellerName  || '—');
    set('s19-seller-phone',  proposalData.sellerPhone || '');

    // Slide 20
    set('s20-valid',  proposalData.validUntil || '—');
    set('s20-seller', proposalData.sellerName  || '—');

    // CTA
    set('cta-valid',  proposalData.validUntil  || '—');
    set('cta-seller', proposalData.sellerName  || '—');
    set('cta-phone',  proposalData.sellerPhone || '—');

    // ACEITE: registra no sistema (move funil/contrato/dashboard) e parabeniza o cliente.
    const wireAccept = (id) => { const el = getEl(id); if (el) el.onclick = aceitarProposta; };
    wireAccept('accept-whatsapp-btn');
    wireAccept('cta-whatsapp-btn');
  }

  let aceiteEnviado = false;

  // Ao aceitar: se a proposta tem AMBOS os planos (Pro e Plus), o cliente escolhe
  // qual antes do parabéns. Se só houver um (ou MEI), aceita direto.
  function aceitarProposta() {
    if (aceiteEnviado) { mostrarParabens(); return; }
    const p = proposalData || {};
    const temDois = (p.monthlyPro > 0) && (p.monthlyPlus > 0) && planFamily.familia !== 'MEI';
    if (temDois) {
      mostrarEscolhaPlano();
    } else {
      const planoUnico = (p.monthlyPlus > 0) ? 'PLUS' : (p.monthlyPro > 0 ? 'PRO' : (p.plano_selecionado || ''));
      enviarAceite(planoUnico);
    }
  }

  async function enviarAceite(plano) {
    if (aceiteEnviado) { mostrarParabens(); return; }
    aceiteEnviado = true;
    try {
      if (PROPOSAL_TOKEN) {
        await fetch(API_BASE + '/p/' + PROPOSAL_TOKEN + '/aceitar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano_selecionado: plano || undefined }),
        });
      }
    } catch (e) { /* mesmo se falhar a rede, parabeniza — o vendedor é avisado */ }
    mostrarParabens();
  }

  // Overlay de escolha de plano (Pro x Plus) antes do parabéns.
  function mostrarEscolhaPlano() {
    const p = proposalData || {};
    const nomes = planFamily.nomes;
    const proVal  = formatMoney(p.monthlyPro);
    const plusVal = formatMoney(p.monthlyPlus > 0 ? p.monthlyPlus : p.monthlyValue);
    const ov = document.createElement('div');
    ov.id = 'plano-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,19,48,0.55);backdrop-filter:blur(4px);';
    ov.innerHTML =
      '<div style="max-width:560px;width:100%;background:#fff;border-radius:22px;padding:34px 28px;text-align:center;box-shadow:0 24px 70px rgba(8,19,48,0.35);">' +
        '<h2 style="font-size:22px;font-weight:900;color:#0D2238;margin:0 0 6px;">Escolha o seu plano</h2>' +
        '<p style="font-size:14px;color:#5A6B7B;margin:0 0 22px;">Selecione o plano que deseja contratar para concluir.</p>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;">' +
          '<button id="pick-pro" style="flex:1;min-width:200px;background:#fff;border:2px solid #D8E8F5;border-radius:16px;padding:20px 16px;cursor:pointer;text-align:left;">' +
            '<div style="font-size:13px;font-weight:700;color:#417ABC;text-transform:uppercase;letter-spacing:.04em;">' + nomes.pro + '</div>' +
            '<div style="font-size:22px;font-weight:900;color:#0D2238;margin-top:6px;">' + proVal + '<span style="font-size:12px;font-weight:600;color:#7AAACB;">/mês</span></div>' +
            '<div style="font-size:12px;color:#5A6B7B;margin-top:6px;">Plano intermediário</div>' +
          '</button>' +
          '<button id="pick-plus" style="flex:1;min-width:200px;background:#F0FBFF;border:2px solid var(--accent);border-radius:16px;padding:20px 16px;cursor:pointer;text-align:left;position:relative;">' +
            '<div style="position:absolute;top:-11px;left:16px;background:var(--accent);color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;">RECOMENDADO</div>' +
            '<div style="font-size:13px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;">' + nomes.plus + '</div>' +
            '<div style="font-size:22px;font-weight:900;color:#0D2238;margin-top:6px;">' + plusVal + '<span style="font-size:12px;font-weight:600;color:#7AAACB;">/mês</span></div>' +
            '<div style="font-size:12px;color:#5A6B7B;margin-top:6px;">Plano completo</div>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    const pick = (plano) => { const el = document.getElementById('plano-overlay'); if (el) el.remove(); enviarAceite(plano); };
    const bPro = document.getElementById('pick-pro');
    const bPlus = document.getElementById('pick-plus');
    if (bPro)  bPro.onclick  = () => pick('PRO');
    if (bPlus) bPlus.onclick = () => pick('PLUS');
  }

  function mostrarParabens() {
    const nome = (proposalData && proposalData.companyName) ? proposalData.companyName : '';
    const ov = document.createElement('div');
    ov.id = 'aceite-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,19,48,0.55);backdrop-filter:blur(4px);';
    ov.innerHTML =
      '<div style="max-width:460px;width:100%;background:#fff;border-radius:22px;padding:40px 32px;text-align:center;box-shadow:0 24px 70px rgba(8,19,48,0.35);">' +
        '<div style="font-size:54px;line-height:1;margin-bottom:14px;">&#127881;</div>' +
        '<h2 style="font-size:24px;font-weight:900;color:#0D2238;margin:0 0 10px;">Proposta aceita!</h2>' +
        '<p style="font-size:15px;color:#41506b;line-height:1.6;margin:0 0 8px;">' +
          (nome ? '<b>' + nome + '</b>, ' : '') + 'parabéns pela excelente escolha! &#128175;</p>' +
        '<p style="font-size:14px;color:#5A6B7B;line-height:1.6;margin:0 0 22px;">' +
          'Você acaba de dar um passo importante para transformar a gestão do seu negócio com a ProSystem. ' +
          'Seu consultor já foi avisado e entrará em contato para iniciar a implantação. Seja muito bem-vindo(a)! &#128075;</p>' +
        '<button onclick="document.getElementById(\\'aceite-overlay\\').remove()" ' +
          'style="background:#1FA45A;color:#fff;border:none;border-radius:999px;padding:13px 30px;font-size:15px;font-weight:800;cursor:pointer;">Fechar</button>' +
      '</div>';
    document.body.appendChild(ov);
  }

  // ── WHATSAPP SUMMARY ────────────────────────────────────
  function buildWhatsAppSummary() {
    const p = proposalData;
    const nomes = planFamily.nomes;
    const isMEI = planFamily.familia === 'MEI';
    const lines = [
      'Olá, ' + (p.clientName || 'tudo bem?') + '!',
      '',
      'Segue o resumo da proposta comercial da ProSystem para ' + p.companyName + ':',
      '',
      '--- PROPOSTA ---',
      isMEI ? '• Plano: MEI (plano único para pequenas empresas)'
            : '• Plano recomendado: ' + nomes.plus + ' (mais indicado)',
      isMEI ? '• Mensalidade MEI: ' + formatMoney(p.monthlyValue)
            : '• Mensalidade ' + nomes.plus + ': ' + formatMoney(p.monthlyPlus > 0 ? p.monthlyPlus : p.monthlyValue),
      (!isMEI && p.monthlyPro > 0) ? '• Mensalidade ' + nomes.pro + ' (alternativa): ' + formatMoney(p.monthlyPro) : null,
      '• Implantação (valor especial): ' + formatMoney(p.setupFinal),
      p.setupOriginal > p.setupFinal ? '  (Tabela original: ' + formatMoney(p.setupOriginal) + ')' : null,
      p.entryValue > 0 ? '• Entrada: ' + formatMoney(p.entryValue) : null,
      p.installments > 0 ? '• Parcelamento: ' + p.installments + 'x de ' + formatMoney(p.installmentValue) : null,
      '• Validade: ' + (p.validUntil || 'A combinar'),
      '',
      '--- DESTAQUES DO PLANO ---',
      ...(isMEI ? [
        '• Frente de Caixa (PDV)',
        '• Cadastros básicos de produtos e clientes',
        '• Contas a receber e controle simples',
      ] : [
        '• Frente de Caixa, NF-e e gestão fiscal',
        '• Financeiro Completo e Entregas em Domicílio',
        '• Banco, Fluxo de Caixa, Boletos e Dashboard Gerencial',
        '• Conferência cega, transporte e integrações extras',
        isFarmaSegment ? '• PBM (e-Pharma, Vidalink) e Manipulação' : null,
        isPadaria ? '• Produção, balança/pesáveis, validade e encomendas' : null,
      ]),
      '• Suporte ativo e humanizado das 7h às 22h',
      '• Treinamento de 5 meses incluso',
      ...(p.plusFeatures && p.plusFeatures.length > 0
        ? p.plusFeatures.slice(0, 3).map(f => '• ' + f)
        : []),
      '',
      '16 anos de especialização no varejo.',
      'Fico à disposição para qualquer dúvida!',
      '',
      p.sellerName || '',
      p.sellerPhone || '',
    ].filter(l => l !== null && l !== undefined);

    const ta = document.getElementById('whats-text-area');
    if (ta) ta.value = lines.join('\\n');
  }

  function flashCopyFeedback() {
    // Botão fixo no topo
    const nav = document.getElementById('copy-resumo-nav');
    if (nav) {
      const original = nav.innerHTML;
      nav.classList.add('copied');
      nav.innerHTML = '&#10003;&nbsp; Resumo copiado!';
      setTimeout(() => { nav.classList.remove('copied'); nav.innerHTML = original; }, 2200);
    }
  }

  function copyWhatsAppText() {
    const ta = document.getElementById('whats-text-area');
    const text = ta ? ta.value : '';
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(flashCopyFeedback).catch(() => {
        if (ta) { ta.select(); ta.setSelectionRange(0, 99999); try { document.execCommand('copy'); } catch(e) {} }
        flashCopyFeedback();
      });
    } else if (ta) {
      ta.select();
      ta.setSelectionRange(0, 99999);
      try { document.execCommand('copy'); } catch(e) {}
      flashCopyFeedback();
    }
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
    hideCoach();
    const prev = slideEls[currentSlide];
    const next = slideEls[index];
    if (!next) return;

    const dir = direction !== undefined ? direction : (index > currentSlide ? 1 : -1);

    if (prev && prev !== next) {
      gsap.to(prev, {
        opacity: 0, x: dir * -60, duration: 0.4, ease: 'power2.in',
        onComplete: () => { prev.classList.remove('active'); prev.style.pointerEvents = 'none'; gsap.set(prev, {x:0}); }
      });
    }

    currentSlide = index;
    updateUI();

    gsap.set(next, { opacity: 0, x: dir * 80 });
    next.classList.add('active');
    next.style.pointerEvents = 'all';
    gsap.to(next, { opacity: 1, x: 0, duration: 0.55, ease: 'power3.out' });

    const children = Array.from(next.children);
    if (children.length) {
      gsap.fromTo(children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', stagger: 0.08, delay: 0.12 }
      );
    }

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

  // Fluxo linear guiado para o CLIENTE (auto-serviço): sem hub, sem vai-e-volta.
  // Ordem narrativa COMPLETA: capa → quem somos/desafio/solução → módulos 1-3 →
  // Ferramentas (21-22) → Proposta (17-20) → prova social → CTA. (pula o hub 4)
  const ORDEM_COMPLETA = [0,1,2,3, 5,6,7,8, 9,10,11,12, 13,14,15,16, 21,22, 17,18,19,20, 23,24];
  // Ordem SIMPLIFICADA: vai direto à proposta/planos → prova social → CTA.
  const ORDEM_SIMPLES  = [17,18,19,20, 23,24];
  let clientOrder = ORDEM_COMPLETA;   // trocado p/ ORDEM_SIMPLES se o cliente escolher "simplificada"
  function clientPos(slide) {
    let i = clientOrder.indexOf(slide);
    if (i !== -1) return i;
    for (let k = 0; k < clientOrder.length; k++) if (clientOrder[k] > slide) return k - 1;
    return clientOrder.length - 1;
  }

  function returnToHub() {
    if (!presenterMode) { nextSlide(); return; }   // cliente: botões de fim de módulo avançam
    showSlide(HUB_SLIDE, -1);
  }

  function nextSlide() {
    if (!presenterMode) {                            // CLIENTE — linear guiado
      const i = clientPos(currentSlide);
      if (i < clientOrder.length - 1) showSlide(clientOrder[i + 1], 1);
      return;
    }
    // APRESENTADOR — comportamento original (hub + módulos)
    if (currentSlide >= TOTAL_SLIDES - 1) return;
    if (inModule && currentModuleId) {
      const m = modules.find(x => x.id === currentModuleId);
      if (m && currentSlide === m.slides[m.slides.length - 1]) { returnToHub(); return; }
    }
    showSlide(currentSlide + 1);
  }

  function prevSlide() {
    if (!presenterMode) {                            // CLIENTE — linear guiado
      const i = clientPos(currentSlide);
      if (i > 0) showSlide(clientOrder[i - 1], -1);
      return;
    }
    if (currentSlide <= 0) return;
    showSlide(currentSlide - 1, -1);
  }

  // ── UPDATE UI ───────────────────────────────────────────
  function updateUI() {
    // No modo cliente, posição/progresso seguem o fluxo linear (clientOrder)
    const pos = presenterMode ? currentSlide : clientPos(currentSlide);
    const total = presenterMode ? TOTAL_SLIDES : clientOrder.length;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = ((pos / (total - 1)) * 100) + '%';
    const counter = document.getElementById('slide-counter');
    if (counter) counter.textContent = (pos + 1) + ' / ' + total;
    // Setas: esconde a "anterior" no início e a "próxima" no fim (de cada fluxo)
    const prev = document.getElementById('nav-prev');
    const next = document.getElementById('nav-next');
    if (prev) prev.classList.toggle('disabled', pos === 0);
    if (next) next.classList.toggle('disabled', pos >= total - 1);
  }

  function hideCoach() {
    const c = document.getElementById('coach');
    if (c) c.classList.remove('show');
  }

  // ── MODE ────────────────────────────────────────────────
  // Apresentador: vendedor conduz (teclado/atalhos visíveis).
  // Auto-serviço (cliente): foco em navegação intuitiva — setas em destaque,
  // dica "deslize ou use as setas", atalhos de teclado ocultos.
  function setMode(presenter) {
    presenterMode = presenter;
    const btn = document.getElementById('mode-btn-top');
    if (btn) btn.textContent = 'Modo: ' + (presenter ? 'Apresentador' : 'Auto-serviço (cliente)');
    document.body.classList.toggle('self-service', !presenter);
    // Botões de fim de módulo: no cliente avançam ("Continuar"), no apresentador voltam ao hub
    document.querySelectorAll('.js-continue').forEach(function(el) {
      el.textContent = presenter ? 'Ver outros módulos' : 'Continuar →';
    });
    if (presenter) {
      hideCoach();
    } else {
      const c = document.getElementById('coach');
      if (c) { c.classList.add('show'); clearTimeout(coachTimer); coachTimer = setTimeout(hideCoach, 4800); }
    }
    updateUI();
  }
  function toggleMode() { if (modeLocked) return; setMode(!presenterMode); }

  // ── KEYBOARD ────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (!hasKeyboard) { hasKeyboard = true; clearTimeout(selfServiceTimer); }
    switch (e.key) {
      case 'ArrowRight': case ' ': e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft':             e.preventDefault(); prevSlide(); break;
      case 'Escape': if (inModule) { e.preventDefault(); returnToHub(); } break;
      case '1': if (currentSlide === HUB_SLIDE) goToModule(1); break;
      case '2': if (currentSlide === HUB_SLIDE) goToModule(2); break;
      case '3': if (currentSlide === HUB_SLIDE) goToModule(3); break;
      case '4': if (currentSlide === HUB_SLIDE) goToModule(4); break;
      case '5': if (currentSlide === HUB_SLIDE) goToModule(5); break;
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
      if (!hasKeyboard) setMode(false);
    }, 8000);
  }

  // ── VERSÃO DA APRESENTAÇÃO (cliente): completa x simplificada ──
  function aplicarVersao(v) {
    if (v === 'simples' || v === 'simplificada') {
      clientOrder = ORDEM_SIMPLES;
      document.body.classList.add('versao-simples');
    } else {
      clientOrder = ORDEM_COMPLETA;
      document.body.classList.remove('versao-simples');
    }
    const ov = document.getElementById('escolha-overlay');
    if (ov) ov.style.display = 'none';
    showSlide(clientOrder[0], 1);
    updateUI();
  }
  // exposto p/ os botões do overlay e do simplificado
  window.escolherVersao = function (v) { aplicarVersao(v); };

  // ── INIT ────────────────────────────────────────────────
  function init() {
    buildHubGrid();
    buildPlanTable();
    buildToolsGrid();
    buildPrintDoc();
    injectProposalData();
    buildWhatsAppSummary();
    showSlide(0);
    updateUI();

    // Modo via URL (?modo=cliente | ?modo=apresentador). Aceita também ?mode=.
    var params = new URLSearchParams(window.location.search);
    var modoParam = (params.get('modo') || params.get('mode') || '').toLowerCase();

    var versaoParam = (params.get('v') || params.get('versao') || '').toLowerCase();
    var ehCliente = (modoParam === 'cliente' || modoParam === 'client' || modoParam === 'autoatendimento' || modoParam === 'auto');

    if (ehCliente) {
      // LINK DO CLIENTE: força auto-serviço e TRAVA (cliente não pode mudar de modo).
      modeLocked = true;
      setMode(false);
      var mb = document.getElementById('mode-btn-top');
      if (mb) mb.style.display = 'none';   // sem botão de trocar modo
      // Versão: se a URL já define (?v=simples|completa), aplica direto; senão mostra a escolha.
      if (versaoParam === 'simples' || versaoParam === 'simplificada') { aplicarVersao('simples'); }
      else if (versaoParam === 'completa' || versaoParam === 'full') { aplicarVersao('completa'); }
      else { var ov = document.getElementById('escolha-overlay'); if (ov) ov.style.display = 'flex'; }
    } else if (modoParam === 'apresentador' || modoParam === 'presenter' || modoParam === 'vendedor') {
      // LINK DO APRESENTADOR: começa no modo apresentador (vendedor pode alternar).
      setMode(true);
    } else {
      // Sem parâmetro: comportamento automático (toque = cliente; desktop = apresentador→8s).
      var isTouch = ('ontouchstart' in window) ||
        (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches);
      if (isTouch) { setMode(false); }
      else { startSelfServiceTimer(); }
    }
  }
  init();
</script>
</body>
</html>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string | string[] }> }
) {
  const raw = (await params).token;
  // Rota catch-all: /p/<token> ou /p/<token>/<slug-do-nome>. O 1º segmento é o token real.
  const token = Array.isArray(raw) ? raw[0] : raw;

  try {
    const res = await fetch(`${API_URL}/p/${token}`, { cache: 'no-store' });
    if (!res.ok) {
      return new NextResponse(
        '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#fff;color:#081330"><h2>Proposta não encontrada ou expirada.</h2></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const json = await res.json();
    if (json.status !== 'success' || !json.data) {
      return new NextResponse(
        '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#fff;color:#081330"><h2>Proposta não encontrada.</h2></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const data = buildProposalData(json.data);

    // Apenas a logo é embutida (base64). Os screenshots foram removidos da
    // apresentação — os módulos usam painéis visuais (ícone + benefício).
    const logo = await loadImageAsDataUrl('logo-prosystem.png');
    const images = { logo };

    const html = generateHTML(data, images, token, API_URL);
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch {
    return new NextResponse(
      '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#fff;color:#081330"><h2>Erro ao carregar proposta.</h2></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
