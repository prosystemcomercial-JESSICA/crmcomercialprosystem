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
  // Helper para imagem inline com fallback
  const imgSrc = (key: string, fallbackPath: string) => images[key] || fallbackPath;
  const dataJson = JSON.stringify(data);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposta Comercial Prosystem — ${data.companyName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root{
      --bg:#061a2b;--bg-soft:#0b2740;--bg-card:#0d3150;
      --primary:#123e67;--primary-2:#1f5f99;
      --accent:#00bfd1;--accent-2:#27d17f;--accent-3:#78e0ea;
      --orange:#ff8b2b;--white:#ffffff;--text:#10283f;--muted:#69809a;
      --line:#dce9f5;--light:#f4f9fc;
      --shadow:0 18px 45px rgba(5,25,46,0.12);
      --radius:24px;--radius-lg:34px;--max:1180px;
    }
    *{margin:0;padding:0;box-sizing:border-box;}
    html{scroll-behavior:smooth;}
    body{font-family:'Inter',sans-serif;background:linear-gradient(180deg,#eef5fb 0%,#f7fbfe 100%);color:var(--text);line-height:1.55;}
    img{max-width:100%;display:block;}
    a{text-decoration:none;color:inherit;}
    .container{width:min(var(--max),calc(100% - 32px));margin:0 auto;}
    .section{padding:82px 0;}
    .section-title{font-size:clamp(28px,4vw,48px);line-height:1.08;letter-spacing:-0.04em;font-weight:900;color:#08223b;margin-bottom:14px;}
    .section-subtitle{font-size:18px;color:var(--muted);max-width:760px;}
    .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:var(--accent);margin-bottom:18px;}
    .nav{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(10,45,76,.08);}
    .nav-inner{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:20px;}
    .brand{display:flex;align-items:center;gap:12px;font-weight:900;color:#123e67;font-size:18px;}
    .brand img{width:42px;height:42px;object-fit:contain;}
    .nav-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;border:none;cursor:pointer;font-family:inherit;padding:14px 20px;border-radius:999px;font-weight:800;transition:.25s ease;white-space:nowrap;}
    .btn:hover{transform:translateY(-2px);}
    .btn-primary{color:#fff;background:linear-gradient(135deg,#123e67 0%,#1f5f99 60%,#00bfd1 100%);box-shadow:0 16px 35px rgba(18,62,103,.24);}
    .btn-secondary{color:#123e67;background:#fff;border:1px solid #cfe2f2;}
    .btn-green{color:#fff;background:linear-gradient(135deg,#1dbf73 0%,#27d17f 100%);box-shadow:0 16px 35px rgba(39,209,127,.20);}
    .btn-orange{color:#fff;background:linear-gradient(135deg,#ff8b2b 0%,#ffad63 100%);box-shadow:0 16px 35px rgba(255,139,43,.22);}
    .hero{position:relative;overflow:hidden;background:radial-gradient(circle at 12% 20%,rgba(0,191,209,.20),transparent 28%),radial-gradient(circle at 85% 18%,rgba(39,209,127,.14),transparent 22%),linear-gradient(135deg,#061a2b 0%,#0c2741 55%,#123e67 100%);color:#fff;}
    .hero::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,black 65%,transparent 100%);}
    .hero-inner{position:relative;z-index:2;display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:center;min-height:calc(100vh - 78px);padding:46px 0 70px;}
    .hero h1{font-size:clamp(38px,5.6vw,72px);line-height:1.02;letter-spacing:-0.06em;font-weight:900;margin-bottom:18px;}
    .hero h1 span{color:#8ff6ff;}
    .hero p{color:rgba(255,255,255,.78);font-size:18px;max-width:700px;margin-bottom:28px;}
    .hero-badges{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px;}
    .hero-badge{padding:10px 14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#d8fbff;}
    .hero-actions{display:flex;flex-wrap:wrap;gap:14px;}
    .hero-panel{position:relative;min-height:560px;}
    .panel-shell{position:absolute;inset:0;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 60px rgba(0,0,0,.25);overflow:hidden;padding:26px;}
    .panel-shell::before{content:"";position:absolute;inset:18px;border-radius:24px;border:1px solid rgba(255,255,255,.10);}
    .screen-stack{position:relative;display:grid;gap:16px;z-index:2;}
    .screen-card{background:rgba(255,255,255,.96);border-radius:20px;padding:10px;box-shadow:0 18px 30px rgba(0,0,0,.16);}
    .screen-card img{border-radius:14px;width:100%;object-fit:cover;}
    .screen-placeholder{border-radius:14px;width:100%;height:120px;background:linear-gradient(135deg,rgba(0,191,209,.15),rgba(39,209,127,.10));display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(255,255,255,.5);font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
    @keyframes heroFloat{0%,100%{transform:translateY(0px);}50%{transform:translateY(-14px);}}
    @keyframes heroGlow{0%,100%{box-shadow:0 24px 60px rgba(0,191,209,.18),0 0 0 0 rgba(0,191,209,0);}60%{box-shadow:0 32px 80px rgba(0,191,209,.32),0 0 40px 8px rgba(0,191,209,.10);}}
    @keyframes fadeSlideUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
    .hero-image-wrap{position:relative;z-index:2;animation:heroFloat 5.5s ease-in-out infinite;}
    .hero-image-frame{border-radius:24px;overflow:hidden;animation:heroGlow 5.5s ease-in-out infinite;border:1.5px solid rgba(0,191,209,.28);}
    .hero-image-frame img{display:block;width:100%;height:auto;border-radius:22px;}
    .hero-image-overlay{position:absolute;inset:0;border-radius:24px;background:linear-gradient(180deg,transparent 55%,rgba(6,26,43,.55) 100%);pointer-events:none;}
    .pill-animated{animation:fadeSlideUp .7s ease both;}.pill-a{animation-delay:.2s;}.pill-b{animation-delay:.45s;}.pill-c{animation-delay:.65s;}
    .float-pill{position:absolute;display:flex;flex-direction:column;gap:4px;min-width:160px;padding:14px 16px;border-radius:20px;background:rgba(255,255,255,.95);color:#123e67;box-shadow:0 18px 40px rgba(0,0,0,.14);z-index:3;}
    .float-pill small{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#69809a;font-weight:800;}
    .float-pill strong{font-size:18px;line-height:1.1;letter-spacing:-0.04em;}
    .pill-a{top:18px;right:-10px;}.pill-b{bottom:84px;left:-18px;}.pill-c{bottom:18px;right:22px;}
    .cards-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:32px;}
    .feature-card{background:#fff;border:1px solid #e1ecf5;border-radius:26px;padding:28px;box-shadow:var(--shadow);}
    .feature-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#e8f6fb 0%,#eaf5ff 100%);font-size:26px;margin-bottom:16px;}
    .feature-card h3{font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#123e67;margin-bottom:10px;}
    .feature-card p{color:#68819a;font-size:15px;}
    .plus-highlight{background:linear-gradient(135deg,#0b2740 0%,#123e67 55%,#17688a 100%);color:#fff;overflow:hidden;position:relative;}
    .plus-highlight::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 10% 10%,rgba(0,191,209,.14),transparent 25%),radial-gradient(circle at 90% 80%,rgba(39,209,127,.14),transparent 22%);}
    .plus-grid{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;margin-top:34px;}
    .glass-card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:28px;backdrop-filter:blur(12px);}
    .glass-card h3{font-size:30px;line-height:1.05;letter-spacing:-0.04em;font-weight:900;margin-bottom:14px;}
    .glass-card p{color:rgba(255,255,255,.82);}
    .check-list{display:grid;gap:12px;margin-top:22px;}
    .check-item{display:flex;align-items:flex-start;gap:10px;color:rgba(255,255,255,.9);font-size:15px;}
    .check-item span:first-child{color:#8effc9;font-weight:900;}
    .screen-box{border-radius:28px;background:#fff;padding:16px;box-shadow:0 18px 45px rgba(0,0,0,.18);}
    .screen-box img{border-radius:18px;width:100%;height:auto;object-fit:cover;}
    .comparison-wrap{margin-top:30px;background:#fff;border:1px solid #e1ecf5;border-radius:28px;overflow:hidden;box-shadow:var(--shadow);}
    .comparison-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid #e8f0f7;background:#f7fbfe;}
    .comparison-head h3{font-size:24px;color:#123e67;letter-spacing:-0.03em;font-weight:900;}
    .comparison-head p{color:#6a829d;font-size:14px;max-width:640px;}
    .plan-table{width:100%;border-collapse:collapse;min-width:850px;}
    .plan-table th,.plan-table td{padding:15px 16px;border-bottom:1px solid #edf3f8;text-align:center;font-size:14px;}
    .plan-table th:first-child,.plan-table td:first-child{text-align:left;font-weight:700;color:#153e67;min-width:240px;}
    .plan-table th{background:#fff;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#6e869f;position:sticky;top:0;}
    .plan-table .plus-col{background:linear-gradient(180deg,rgba(0,191,209,.08),rgba(39,209,127,.08));}
    .plan-tag{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:999px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;}
    .tag-lite{background:#eff5fb;color:#506b87;}.tag-pro{background:#e9f3ff;color:#1f5f99;}.tag-plus{background:#dafaf1;color:#0f8d57;}
    .yes{color:#0a9c5d;font-weight:800;}.no{color:#bf4458;font-weight:800;}
    .screens-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:32px;}
    .screen-gallery-card{background:#fff;border:1px solid #e1ecf5;border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
    .screen-gallery-card .thumb{padding:14px;background:#f5fbff;border-bottom:1px solid #ecf2f8;}
    .screen-gallery-card img{width:100%;border-radius:14px;object-fit:cover;}
    .screen-gallery-card .content{padding:20px;}
    .screen-gallery-card h4{font-size:20px;color:#123e67;margin-bottom:8px;letter-spacing:-0.03em;}
    .screen-gallery-card p{color:#68819a;font-size:14px;}
    .support-section{background:linear-gradient(135deg,#08223b 0%,#123e67 52%,#1a7392 100%);color:#fff;position:relative;overflow:hidden;}
    .support-section::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 15% 20%,rgba(0,191,209,.18),transparent 24%),radial-gradient(circle at 90% 75%,rgba(39,209,127,.16),transparent 22%);}
    .support-grid{position:relative;z-index:2;display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:center;margin-top:34px;}
    .support-card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:28px;backdrop-filter:blur(10px);}
    .support-card h3{font-size:28px;letter-spacing:-0.04em;margin-bottom:12px;font-weight:900;}
    .support-card p{color:rgba(255,255,255,.82);}
    .support-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:22px;}
    .kpi{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.10);border-radius:22px;padding:20px;}
    .kpi strong{display:block;font-size:30px;line-height:1;letter-spacing:-0.05em;margin-bottom:8px;}
    .kpi span{color:#d8f5ff;font-size:14px;display:block;}
    .proposal-box{background:#fff;border:1px solid #e0ebf5;border-radius:30px;box-shadow:var(--shadow);overflow:hidden;margin-top:32px;}
    .proposal-top{display:grid;grid-template-columns:1.05fr .95fr;gap:0;}
    .proposal-left{padding:32px;}.proposal-right{padding:32px;background:linear-gradient(135deg,#0d3150 0%,#123e67 65%,#167997 100%);color:#fff;}
    .client-chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px;}
    .chip{padding:9px 12px;border-radius:999px;background:#eef6fc;color:#123e67;font-size:12px;font-weight:800;}
    .price-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px;}
    .price-card{background:#f8fbfe;border:1px solid #e0ebf5;border-radius:22px;padding:22px;}
    .price-card small{display:block;font-size:12px;font-weight:800;text-transform:uppercase;color:#6e869f;margin-bottom:8px;letter-spacing:.08em;}
    .price-card .old{font-size:24px;font-weight:900;color:#97a8ba;text-decoration:line-through;}
    .price-card .new{font-size:40px;font-weight:900;line-height:1;letter-spacing:-0.06em;color:#123e67;}
    .proposal-right .highlight-price{font-size:52px;font-weight:900;line-height:.98;letter-spacing:-0.06em;margin-top:10px;margin-bottom:14px;color:#9af7ff;}
    .proposal-right p{color:rgba(255,255,255,.84);}
    .summary-list{display:grid;gap:12px;margin-top:18px;}
    .summary-list div{display:flex;justify-content:space-between;gap:20px;border-bottom:1px dashed rgba(255,255,255,.18);padding-bottom:10px;font-size:15px;}
    .summary-list span:last-child{font-weight:800;color:#fff;}
    .whats-box{margin-top:30px;background:#fff;border:1px solid #e1ecf5;border-radius:24px;overflow:hidden;box-shadow:var(--shadow);}
    .whats-box-head{padding:18px 22px;background:#f7fbfe;border-bottom:1px solid #e8f0f7;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
    .whats-box-head h3{color:#123e67;font-size:22px;font-weight:900;letter-spacing:-0.03em;}
    .whats-box-body{padding:22px;}
    .whats-text{width:100%;min-height:220px;border:1px solid #dce9f5;border-radius:18px;padding:18px;resize:vertical;font-family:inherit;font-size:15px;line-height:1.6;color:#1c3550;background:#fbfdff;}
    .action-row{margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;}
    .footer{padding:24px 0;background:#071a2d;color:rgba(255,255,255,.72);margin-top:40px;}
    .footer-inner{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;}
    .scroll-x{overflow-x:auto;}
    @media(max-width:1100px){.hero-inner,.plus-grid,.support-grid,.proposal-top{grid-template-columns:1fr;}.hero-panel{min-height:auto;}.panel-shell{position:relative;inset:auto;}.cards-3,.screens-grid{grid-template-columns:1fr 1fr;}}
    @media(max-width:760px){.nav-inner{flex-direction:column;align-items:flex-start;justify-content:center;padding:12px 0;}.nav-actions{width:100%;}.nav-actions .btn{width:100%;}.cards-3,.screens-grid,.price-grid,.support-kpis{grid-template-columns:1fr;}.hero-actions{flex-direction:column;}.hero-actions .btn{width:100%;}.pill-a,.pill-b,.pill-c{position:relative;inset:auto;margin-top:12px;}.float-pill{width:100%;}.proposal-left,.proposal-right{padding:24px;}.section{padding:64px 0;}.section-subtitle{font-size:16px;}}
  </style>
</head>
<body>

  <nav class="nav">
    <div class="container nav-inner">
      <div class="brand">
        <img src="${imgSrc('logo', '/logo-prosystem.png')}" alt="Prosystem" onerror="this.style.display='none'">
        <span>Prosystem Sistemas</span>
      </div>
      <div class="nav-actions">
        <a class="btn btn-primary" href="#proposta">Ver proposta</a>
      </div>
    </div>
  </nav>

  <header class="hero">
    <div class="container hero-inner">
      <div>
        <div class="hero-badges">
          <span class="hero-badge">Proposta Comercial</span>
          <span class="hero-badge" id="planBadge">Plano em destaque</span>
          <span class="hero-badge">Suporte ativo das 7h às 22h</span>
        </div>
        <h1>Mais controle, agilidade e <span>inteligência para a sua operação</span></h1>
        <p>A Prosystem entrega uma proposta comercial moderna, com foco em produtividade, gestão em tempo real, automação, suporte especializado e uma operação mais segura para o cliente.</p>
        <div class="hero-actions">
          <a class="btn btn-orange" href="#proposta">Ver condições comerciais</a>
          <a class="btn btn-primary" href="#comparativo">Comparar planos</a>
        </div>
      </div>
      <div class="hero-panel">
        <div class="hero-image-wrap">
          <div class="hero-image-frame">
            <img src="${imgSrc('hero', '/imagem-hero.png')}" alt="Prosystem — Sistema de gestão" />
            <div class="hero-image-overlay"></div>
          </div>
        </div>
        <div class="float-pill pill-a pill-animated">
          <small>Plano em destaque</small>
          <strong id="pillPlan">Plus com visão gerencial</strong>
        </div>
        <div class="float-pill pill-b pill-animated">
          <small>Suporte Prosystem</small>
          <strong>Ativo, imediato e acessível</strong>
        </div>
        <div class="float-pill pill-c pill-animated">
          <small>Treinamento</small>
          <strong>5 meses para novos clientes</strong>
        </div>
      </div>
    </div>
  </header>

  <section class="section">
    <div class="container">
      <div class="eyebrow">Proposta de valor</div>
      <h2 class="section-title">Uma proposta pensada para vender mais, reduzir retrabalho e melhorar a gestão.</h2>
      <p class="section-subtitle">O objetivo desta proposta é apresentar de forma clara os diferenciais da Prosystem, destacando a força do Plano Plus, as diferenças entre os planos e os recursos que tornam a operação do cliente mais eficiente e segura.</p>
      <div class="cards-3">
        <article class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Gestão em tempo real</h3>
          <p>Indicadores, relatórios, acompanhamento de vendas, análise de desempenho e visão mais clara do negócio para decisões rápidas.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">⚙️</div>
          <h3>Operação integrada</h3>
          <p>ERP com integração entre vendas, estoque, compras, financeiro e rotinas operacionais, reduzindo falhas e processos manuais.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">🤝</div>
          <h3>Suporte que resolve</h3>
          <p>Suporte humanizado, de fácil acesso, com técnicos preparados para atender o cliente com agilidade no dia a dia.</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section plus-highlight">
    <div class="container">
      <div class="eyebrow">Plano Plus</div>
      <h2 class="section-title" style="color:#fff;">O Plano Plus foi pensado para quem quer mais controle, mais inteligência e mais apoio na operação.</h2>
      <p class="section-subtitle" style="color:rgba(255,255,255,.78);">Nesta proposta, o Plano Plus é o grande destaque por entregar recursos mais avançados para acompanhamento da operação, gestão gerencial e mais valor estratégico no dia a dia do cliente.</p>
      <div class="plus-grid">
        <div class="glass-card">
          <h3>Por que destacar o Plus?</h3>
          <p>Porque ele reúne funcionalidades e módulos que ampliam a capacidade de gestão da empresa, oferecendo uma experiência mais completa e preparada para crescimento.</p>
          <div class="check-list" id="plusFeaturesList"></div>
        </div>
        <div class="screen-box">
          <img src="${imgSrc('dashboard', '/tela-dashboard.png')}" alt="Dashboard Prosystem" style="border-radius:18px;width:100%;height:auto;" />
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="comparativo">
    <div class="container">
      <div class="eyebrow">Diferenças entre planos</div>
      <h2 class="section-title">Comparativo de planos com destaque para o Plus</h2>
      <p class="section-subtitle">Aqui o cliente consegue visualizar, de forma simples, como o Plano Plus se diferencia, especialmente em recursos de análise, operação e apoio gerencial.</p>
      <div class="comparison-wrap">
        <div class="comparison-head">
          <div>
            <h3>Comparativo simplificado</h3>
            <p>Tabela resumida para apresentação comercial com os principais recursos de cada plano.</p>
          </div>
        </div>
        <div class="scroll-x">
          <table class="plan-table" id="planTable"></table>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="eyebrow">Telas do sistema</div>
      <h2 class="section-title">Ferramentas que mostram valor na prática</h2>
      <p class="section-subtitle">Conheça as principais telas do sistema e veja como a Prosystem apoia a operação no dia a dia.</p>
      <div class="screens-grid">
        <article class="screen-gallery-card">
          <div class="thumb"><img src="${imgSrc('dashboard', '/tela-dashboard.png')}" alt="Dashboard Prosystem"></div>
          <div class="content"><h4>Dashboard gerencial</h4><p>Visão de indicadores, desempenho e acompanhamento do negócio em tempo real.</p></div>
        </article>
        <article class="screen-gallery-card">
          <div class="thumb"><img src="${imgSrc('whatsapp', '/tela-whatsapp.png')}" alt="Mensageria e WhatsApp"></div>
          <div class="content"><h4>Mensageria e relacionamento</h4><p>Recurso importante para agilizar o contato com o cliente e organizar a comunicação.</p></div>
        </article>
        <article class="screen-gallery-card">
          <div class="thumb"><img src="${imgSrc('relatorios', '/tela-relatorios.png')}" alt="Relatórios e análises"></div>
          <div class="content"><h4>Relatórios e análises</h4><p>Ferramentas que ajudam a entender vendas, perdas, rentabilidade e comportamento da operação.</p></div>
        </article>
      </div>
    </div>
  </section>

  <section class="section support-section">
    <div class="container">
      <div class="eyebrow" style="color:#8ff6ff;">Suporte Prosystem</div>
      <h2 class="section-title" style="color:#fff;">Suporte ativo, imediato e de fácil acesso para o cliente</h2>
      <p class="section-subtitle" style="color:rgba(255,255,255,.78);">Um dos grandes diferenciais da Prosystem é a atuação do suporte: atendimento rápido, humano, acessível e com técnicos preparados para auxiliar o cliente quando ele precisa.</p>
      <div class="support-grid">
        <div class="support-card">
          <h3>Atendimento preparado para a rotina do cliente</h3>
          <p>O suporte da Prosystem foi pensado para oferecer segurança operacional, agilidade no contato e apoio real no uso do sistema.</p>
          <div class="check-list">
            <div class="check-item"><span>✓</span><span>Suporte ativo e fácil de acessar</span></div>
            <div class="check-item"><span>✓</span><span>Atendimento imediato dentro da rotina operacional</span></div>
            <div class="check-item"><span>✓</span><span>Técnicos prontos e preparados para auxiliar</span></div>
            <div class="check-item"><span>✓</span><span>Atendimento das <strong>7h às 22h</strong></span></div>
            <div class="check-item"><span>✓</span><span>Treinamento de <strong>5 meses</strong> para novos clientes com suporte assistido</span></div>
          </div>
        </div>
        <div class="support-card">
          <h3>Números que geram confiança</h3>
          <div class="support-kpis">
            <div class="kpi"><strong>7h–22h</strong><span>Janela de atendimento e apoio operacional</span></div>
            <div class="kpi"><strong>5 meses</strong><span>Treinamento para novos clientes</span></div>
            <div class="kpi"><strong>Ativo</strong><span>Suporte de fácil acesso e acompanhamento próximo</span></div>
            <div class="kpi"><strong>Humano</strong><span>Técnicos preparados para resolver e orientar</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="proposta">
    <div class="container">
      <div class="eyebrow">Condição comercial</div>
      <h2 class="section-title">Resumo da proposta comercial</h2>
      <p class="section-subtitle">Abaixo estão as condições comerciais desta proposta, formatadas para apresentação ao cliente.</p>
      <div class="proposal-box">
        <div class="proposal-top">
          <div class="proposal-left">
            <div class="client-chips" id="clientChips"></div>
            <h3 style="font-size:30px;color:#123e67;font-weight:900;letter-spacing:-0.04em;">Proposta personalizada para <span id="companyNameText"></span></h3>
            <p style="color:#68819a;margin-top:12px;">Estruturamos esta proposta para entregar ao cliente uma solução mais completa, com destaque ao <strong>Plano Plus</strong>, recursos gerenciais, suporte especializado e uma jornada de implantação mais segura.</p>
            <div class="price-grid">
              <div class="price-card">
                <small>Valor original</small>
                <div class="old" id="setupOriginalText">R$ 0,00</div>
              </div>
              <div class="price-card">
                <small>Valor especial</small>
                <div class="new" id="setupFinalText">R$ 0,00</div>
              </div>
              <div class="price-card">
                <small>Entrada</small>
                <div class="new" style="font-size:28px;" id="entryText">R$ 0,00</div>
              </div>
              <div class="price-card">
                <small>Parcelamento</small>
                <div class="new" style="font-size:28px;" id="installmentsText">—</div>
              </div>
            </div>
          </div>
          <div class="proposal-right">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#bdeeff;">Plano recomendado</div>
            <div style="font-size:34px;font-weight:900;letter-spacing:-0.05em;margin-top:8px;" id="selectedPlanText">Plano Plus</div>
            <div class="highlight-price" id="monthlyText">R$ 0,00</div>
            <p>Mensalidade estimada da solução recomendada para a operação do cliente.</p>
            <div class="summary-list">
              <div><span>Vendedor responsável</span><span id="sellerNameText"></span></div>
              <div><span>Contato comercial</span><span id="sellerPhoneText"></span></div>
              <div><span>Responsável do cliente</span><span id="clientNameText"></span></div>
              <div><span>Validade da proposta</span><span id="validityText"></span></div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;">
              <a class="btn btn-green" id="acceptBtn" href="#" target="_blank">Aceitar via WhatsApp</a>
              <button class="btn btn-secondary" onclick="window.print()">Salvar em PDF</button>
            </div>
          </div>
        </div>
      </div>

      <div class="whats-box">
        <div class="whats-box-head">
          <h3>Resumo da proposta para enviar no WhatsApp</h3>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-green" onclick="copyWhatsAppText()">Copiar texto</button>
            <button class="btn btn-primary" onclick="openWhatsApp()">Abrir no WhatsApp</button>
          </div>
        </div>
        <div class="whats-box-body">
          <textarea class="whats-text" id="whatsText" readonly></textarea>
          </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container footer-inner">
      <div>Prosystem Sistemas • Proposta comercial</div>
      <div id="footerValidity"></div>
    </div>
  </footer>

  <script>
    const proposalData = ${dataJson};

    function formatMoney(value){
      return Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    }
    function onlyNumbers(value){
      return String(value||"").replace(/\\D/g,"");
    }
    function buildPlanTable(){
      const table=document.getElementById("planTable");
      const rows=proposalData.planComparison.map(item=>\`
        <tr>
          <td>\${item.feature}</td>
          <td>\${formatPlanCell(item.lite,"lite")}</td>
          <td>\${formatPlanCell(item.pro,"pro")}</td>
          <td class="plus-col">\${formatPlanCell(item.plus,"plus")}</td>
        </tr>\`).join("");
      table.innerHTML=\`<thead><tr>
        <th>Funcionalidade</th>
        <th><span class="plan-tag tag-lite">Lite / Básico</span></th>
        <th><span class="plan-tag tag-pro">Pro</span></th>
        <th class="plus-col"><span class="plan-tag tag-plus">Plus</span></th>
      </tr></thead><tbody>\${rows}</tbody>\`;
    }
    function formatPlanCell(value,plan){
      if(value==="Sim") return \`<span class="yes">Sim</span>\`;
      if(value==="Não") return \`<span class="no">Não</span>\`;
      return \`<strong style="color:\${plan==="plus"?"#0f8d57":"#123e67"}">\${value}</strong>\`;
    }
    function buildPlusFeatures(){
      const target=document.getElementById("plusFeaturesList");
      target.innerHTML=proposalData.plusFeatures.map(item=>\`
        <div class="check-item"><span>✓</span><span>\${item}</span></div>\`).join("");
    }
    function buildClientChips(){
      const chips=[
        proposalData.companyName,
        proposalData.cnpj?("CNPJ: "+proposalData.cnpj):null,
        proposalData.segment||null,
        (proposalData.city&&proposalData.state)?(proposalData.city+"/"+proposalData.state):null,
        proposalData.clientName?("Responsável: "+proposalData.clientName):null,
      ].filter(Boolean);
      document.getElementById("clientChips").innerHTML=chips.map(item=>\`<span class="chip">\${item}</span>\`).join("");
    }
    function renderProposalSummary(){
      document.getElementById("companyNameText").textContent=proposalData.companyName;
      document.getElementById("setupOriginalText").textContent=formatMoney(proposalData.setupOriginal);
      document.getElementById("setupFinalText").textContent=formatMoney(proposalData.setupFinal);
      document.getElementById("entryText").textContent=formatMoney(proposalData.entryValue);
      document.getElementById("installmentsText").textContent=proposalData.installments>0?(\`\${proposalData.installments}x de \${formatMoney(proposalData.installmentValue)}\`):"À vista";
      document.getElementById("selectedPlanText").textContent=proposalData.selectedPlan;
      document.getElementById("monthlyText").textContent=formatMoney(proposalData.monthlyValue);
      document.getElementById("sellerNameText").textContent=proposalData.sellerName;
      document.getElementById("sellerPhoneText").textContent=proposalData.sellerPhone;
      document.getElementById("clientNameText").textContent=proposalData.clientName;
      document.getElementById("validityText").textContent=proposalData.validUntil||"—";
      if(document.getElementById("planBadge")) document.getElementById("planBadge").textContent=proposalData.selectedPlan+" em destaque";
      if(document.getElementById("pillPlan")) document.getElementById("pillPlan").textContent=proposalData.selectedPlan+" com visão gerencial";
      if(document.getElementById("footerValidity")) document.getElementById("footerValidity").textContent=proposalData.validUntil?"Válida até "+proposalData.validUntil:"";
    }
    function buildAcceptLink(){
      const msg="Olá, quero aceitar a proposta da Prosystem para "+proposalData.companyName+". Podemos dar sequência. Seguem meus dados: Nome completo, CPF e e-mail.";
      const phone=onlyNumbers(proposalData.sellerPhone);
      document.getElementById("acceptBtn").href="https://wa.me/55"+phone+"?text="+encodeURIComponent(msg);
    }
    function buildWhatsAppSummary(){
      const text="Olá, "+proposalData.clientName+"! Tudo bem?\\n\\nSegue a proposta comercial da Prosystem para a "+proposalData.companyName+".\\n\\nResumo da proposta:\\n• Plano recomendado: "+proposalData.selectedPlan+"\\n• Mensalidade: "+formatMoney(proposalData.monthlyValue)+"\\n• Valor original da implantação: "+formatMoney(proposalData.setupOriginal)+"\\n• Valor especial da implantação: "+formatMoney(proposalData.setupFinal)+(proposalData.entryValue>0?"\\n• Entrada: "+formatMoney(proposalData.entryValue):"")+(proposalData.installments>0?"\\n• Parcelamento: "+proposalData.installments+"x de "+formatMoney(proposalData.installmentValue):"")+("\\n• Validade da proposta: "+(proposalData.validUntil||"A combinar"))+"\\n\\nDestaques:\\n"+proposalData.plusFeatures.slice(0,4).map(f=>"• "+f).join("\\n")+"\\n\\nDiferenciais Prosystem:\\n• Suporte ativo, imediato e de fácil acesso\\n• Técnicos prontos e preparados para auxiliar\\n• Atendimento das 7h às 22h\\n• Treinamento de 5 meses para novos clientes\\n\\nFico à disposição para dar sequência.\\n\\nAtenciosamente,\\n"+proposalData.sellerName+"\\n"+proposalData.sellerPhone;
      document.getElementById("whatsText").value=text;
    }
    function copyWhatsAppText(){
      const ta=document.getElementById("whatsText");ta.select();ta.setSelectionRange(0,99999);document.execCommand("copy");alert("Resumo copiado com sucesso.");
    }
    function openWhatsApp(){
      const phone=onlyNumbers(proposalData.clientPhone);
      const text=document.getElementById("whatsText").value;
      window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text),"_blank");
    }
    function escapeXML(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
    function generateXML(){
      return '<?xml version="1.0" encoding="UTF-8"?>\\n<proposal>\\n'+
        '  <companyName>'+escapeXML(proposalData.companyName)+'</companyName>\\n'+
        '  <tradeName>'+escapeXML(proposalData.tradeName)+'</tradeName>\\n'+
        '  <cnpj>'+escapeXML(proposalData.cnpj)+'</cnpj>\\n'+
        '  <segment>'+escapeXML(proposalData.segment)+'</segment>\\n'+
        '  <selectedPlan>'+escapeXML(proposalData.selectedPlan)+'</selectedPlan>\\n'+
        '  <monthlyValue>'+escapeXML(proposalData.monthlyValue)+'</monthlyValue>\\n'+
        '  <setupFinal>'+escapeXML(proposalData.setupFinal)+'</setupFinal>\\n'+
        '  <installments>'+escapeXML(proposalData.installments)+'</installments>\\n'+
        '  <installmentValue>'+escapeXML(proposalData.installmentValue)+'</installmentValue>\\n'+
        '  <validUntil>'+escapeXML(proposalData.validUntil)+'</validUntil>\\n'+
        '  <sellerName>'+escapeXML(proposalData.sellerName)+'</sellerName>\\n'+
        '  <sellerPhone>'+escapeXML(proposalData.sellerPhone)+'</sellerPhone>\\n'+
        '  <clientName>'+escapeXML(proposalData.clientName)+'</clientName>\\n'+
        '</proposal>';
    }
    function downloadFile(filename,content,type){
      const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
    }
    function downloadXML(){downloadFile("proposta-prosystem.xml",generateXML(),"application/xml");}
    // Imagens já vêm embutidas em base64 do servidor — basta clonar e salvar
    function downloadHTML(){
      const conteudo = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
      downloadFile("proposta-prosystem.html", conteudo, "text/html");
    }
    function init(){
      buildPlanTable();buildPlusFeatures();buildClientChips();
      renderProposalSummary();buildAcceptLink();buildWhatsAppSummary();
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
        '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#eef5fb"><h2 style="color:#123e67">Proposta não encontrada ou expirada.</h2></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const json = await res.json();
    if (json.status !== 'success' || !json.data) {
      return new NextResponse(
        '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#eef5fb"><h2 style="color:#123e67">Proposta não encontrada.</h2></body></html>',
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
      '<html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#eef5fb"><h2 style="color:#123e67">Erro ao carregar proposta.</h2></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
