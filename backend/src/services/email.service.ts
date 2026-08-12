import nodemailer from 'nodemailer';

// ─── Transporter ──────────────────────────────────────────────────────────────

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'mail.prosystemnet.com.br',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value?: number | null): string {
  if (!value) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// slug do nome do cliente p/ deixar o link legível (apenas cosmético)
function slugCliente(nome?: string | null): string {
  return (nome || 'cliente')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'cliente';
}

function benefitsBySegment(segmento?: string | null): string[] {
  const base = [
    'Sistema ERP completo integrado com PDV',
    'Controle financeiro com fluxo de caixa em tempo real',
    'Emissão de NF-e, NFC-e e compliance fiscal automático',
    'Gestão de estoque multi-unidade com alertas inteligentes',
    'Dashboard gerencial com indicadores em tempo real',
    'Suporte especializado 24 horas por dia, 7 dias por semana',
  ];

  const seg = (segmento || '').toLowerCase();

  if (seg.includes('farm') || seg.includes('drog')) {
    return [
      'Controle de medicamentos vencidos e SNGPC integrado',
      'Integração com PBMs (Farmácias Populares, Funcional, Careplus)',
      'Gestão de medicamentos controlados com receituário digital',
      'Controle de lote e validade com alertas automáticos',
      ...base.slice(3),
    ];
  }

  if (seg.includes('pad') || seg.includes('confeit')) {
    return [
      'Planejamento de produção com controle de desperdício',
      'Ficha técnica de receitas com custo automático',
      'Gestão de insumos e pedidos para fornecedores',
      'Controle de vendas por produto com previsão de demanda',
      ...base.slice(3),
    ];
  }

  return base;
}

function buildBenefitsHtml(benefits: string[]): string {
  return benefits.map(b => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #EBF4FF;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="28" valign="top" style="padding-top: 2px;">
              <div style="width:22px;height:22px;background:linear-gradient(135deg,#4B8EC8,#2E6EAB);
                          border-radius:50%;text-align:center;line-height:22px;
                          font-size:12px;color:#fff;font-weight:bold;">✓</div>
            </td>
            <td style="font-size:14px;color:#1A4E82;padding-left:8px;line-height:1.5;">${b}</td>
          </tr>
        </table>
      </td>
    </tr>`).join('');
}

// ─── Main Template ────────────────────────────────────────────────────────────

function buildPropostaEmail(proposta: {
  razao_social: string;
  nome_fantasia?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  estado?: string | null;
  responsavel_nome?: string | null;
  vendedor_nome?: string | null;
  plano_selecionado?: string | null;
  plano_recomendado?: string | null;
  modulos_inclusos?: string[] | null;
  servicos_adicionais?: string[] | null;
  valor_implantacao?: number | null;
  mensalidade_pro?: number | null;
  mensalidade_plus?: number | null;
  valor_final?: number | null;
  entrada?: number | null;
  parcelas?: number | null;
  valor_parcela?: number | null;
  desconto?: number | null;
  validade?: Date | string | null;
  titulo_proposta?: string | null;
  frase_hero?: string | null;
  texto_valor?: string | null;
  condicao_especial?: string | null;
  public_token?: string | null;
}): string {
  const empresa = proposta.nome_fantasia || proposta.razao_social;
  const nomeCliente = proposta.responsavel_nome || empresa;
  const plano = proposta.plano_selecionado || proposta.plano_recomendado || 'ProSystem';
  const benefits = benefitsBySegment(proposta.segmento);
  const benefitsHtml = buildBenefitsHtml(benefits);

  const validadeStr = proposta.validade
    ? new Date(proposta.validade).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const servHtml = (proposta.servicos_adicionais || []).length > 0
    ? (proposta.servicos_adicionais || []).map(s =>
        `<span style="display:inline-block;background:#F0FDF4;color:#166534;
                      border:1px solid #BBF7D0;border-radius:20px;
                      padding:4px 12px;font-size:12px;margin:3px 3px 3px 0;">
          + ${s}
        </span>`).join('')
    : '';

  // Link da proposta: usa o domínio público (FRONTEND_URL/APP_URL); modo cliente
  // travado + nome do cliente no caminho (igual aos links copiados no CRM).
  const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://frontend-production-3a79.up.railway.app';
  const linkProposta = proposta.public_token
    ? `${baseUrl}/p/${proposta.public_token}/${slugCliente(empresa)}?modo=cliente`
    : null;

  const heroTitulo = proposta.titulo_proposta || `Proposta Comercial — ${empresa}`;
  const heroTexto  = proposta.frase_hero    || `Uma solução sob medida para revolucionar a gestão de ${empresa}.`;
  const textoValor = proposta.texto_valor   || 'Com a ProSystem, você terá controle total, mais lucro e tranquilidade para crescer.';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heroTitulo}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F7FB;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F7FB;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="620"
               style="max-width:620px;width:100%;background:#ffffff;
                      border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 40px rgba(13,34,56,0.12);">

          <!-- ══════════════════════ HEADER HERO ══════════════════════ -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D2238 0%,#1A4E82 50%,#2E6EAB 100%);
                        padding:40px 40px 48px;">
              <!-- Logo area -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:rgba(255,255,255,0.15);border-radius:10px;
                                   padding:10px 18px;display:inline-block;">
                          <span style="font-size:22px;font-weight:800;color:#ffffff;
                                       letter-spacing:-0.5px;">Pro<span style="color:#90BEF0;">System</span></span>
                        </td>
                        <td style="padding-left:12px;">
                          <span style="font-size:11px;color:#A8C8E8;letter-spacing:2px;
                                       text-transform:uppercase;font-weight:500;">Sistemas para Varejo</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right">
                    <span style="background:rgba(75,142,200,0.3);border:1px solid rgba(144,190,240,0.4);
                                 border-radius:20px;padding:6px 16px;
                                 font-size:12px;color:#C3DCFC;font-weight:600;">
                      📋 Proposta Comercial
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Hero text -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:13px;color:#6AAAE5;
                               letter-spacing:3px;text-transform:uppercase;font-weight:600;">
                      Preparada exclusivamente para
                    </p>
                    <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;
                                color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">
                      ${empresa}
                    </h1>
                    <p style="margin:0;font-size:15px;color:#A8C8E8;line-height:1.6;max-width:480px;">
                      ${heroTexto}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════ SAUDAÇÃO ══════════════════════ -->
          <tr>
            <td style="padding:36px 40px 0;">
              <p style="margin:0 0 12px;font-size:16px;color:#0D2238;font-weight:600;">
                Olá, ${nomeCliente}!
              </p>
              <p style="margin:0;font-size:14px;color:#4A6E8A;line-height:1.7;">
                Temos o prazer de apresentar a proposta comercial elaborada especialmente para
                <strong style="color:#1A4E82;">${empresa}</strong>.
                Com base nas suas necessidades, preparamos uma solução completa que vai
                transformar a gestão do seu negócio.
              </p>
              <p style="margin:12px 0 0;font-size:14px;color:#4A6E8A;line-height:1.7;">
                ${textoValor}
              </p>
            </td>
          </tr>

          <!-- ══════════════════════ RESUMO DA PROPOSTA ══════════════════════ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                          color:#0D2238;letter-spacing:-0.3px;">
                📄 Resumo da Proposta
              </h2>

              <!-- Card resumo -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:linear-gradient(135deg,#EBF4FF,#F4F7FB);
                             border:1px solid #C3DCFC;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">

                      <!-- Linha: empresa e plano -->
                      <tr>
                        <td width="50%" style="padding-bottom:16px;vertical-align:top;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                            Empresa
                          </p>
                          <p style="margin:0;font-size:15px;color:#0D2238;font-weight:700;">
                            ${empresa}
                          </p>
                          ${proposta.cidade ? `<p style="margin:4px 0 0;font-size:12px;color:#4A6E8A;">
                            📍 ${proposta.cidade}${proposta.estado ? '/' + proposta.estado : ''}
                          </p>` : ''}
                        </td>
                        <td width="50%" style="padding-bottom:16px;vertical-align:top;padding-left:16px;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                            Plano Selecionado
                          </p>
                          <p style="margin:0;font-size:15px;color:#1A4E82;font-weight:700;">
                            ${plano}
                          </p>
                          ${proposta.segmento ? `<p style="margin:4px 0 0;font-size:12px;color:#4A6E8A;">
                            🏪 ${proposta.segmento}
                          </p>` : ''}
                        </td>
                      </tr>

                      <!-- Separador -->
                      <tr>
                        <td colspan="2" style="border-top:1px solid #C3DCFC;padding-bottom:16px;"></td>
                      </tr>

                      <!-- Valores -->
                      <tr>
                        ${proposta.valor_implantacao ? `
                        <td width="50%" style="padding-bottom:8px;vertical-align:top;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                            Implantação
                          </p>
                          <p style="margin:0;font-size:18px;color:#0D2238;font-weight:800;">
                            ${fmt(proposta.valor_implantacao)}
                          </p>
                        </td>` : '<td></td>'}

                        ${proposta.mensalidade_pro || proposta.mensalidade_plus ? `
                        <td width="50%" style="padding-bottom:8px;vertical-align:top;padding-left:16px;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                            Mensalidade
                          </p>
                          <p style="margin:0;font-size:18px;color:#1A4E82;font-weight:800;">
                            ${fmt(proposta.mensalidade_pro || proposta.mensalidade_plus)}/mês
                          </p>
                        </td>` : '<td></td>'}
                      </tr>

                      <!-- Condições de pagamento -->
                      ${proposta.entrada || proposta.parcelas ? `
                      <tr>
                        <td colspan="2" style="padding-top:8px;">
                          <table cellpadding="0" cellspacing="0" border="0" width="100%"
                                 style="background:#ffffff;border-radius:8px;
                                         border:1px solid #C3DCFC;">
                            <tr>
                              <td style="padding:12px 16px;">
                                <p style="margin:0 0 8px;font-size:11px;color:#7AAACB;
                                           text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                                  💳 Condições de Pagamento
                                </p>
                                <p style="margin:0;font-size:13px;color:#1A4E82;">
                                  ${proposta.entrada ? `Entrada: <strong>${fmt(proposta.entrada)}</strong>` : ''}
                                  ${proposta.entrada && proposta.parcelas ? ' + ' : ''}
                                  ${proposta.parcelas ? `${proposta.parcelas}x de <strong>${fmt(proposta.valor_parcela)}</strong>` : ''}
                                  ${proposta.desconto ? ` — <span style="color:#166534;">Desconto: ${fmt(proposta.desconto)}</span>` : ''}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}

                      <!-- (Módulos seguem o que cada plano libera — não listados aqui) -->

                      <!-- Serviços adicionais -->
                      ${servHtml ? `
                      <tr>
                        <td colspan="2" style="padding-top:12px;">
                          <p style="margin:0 0 8px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                            ⭐ Serviços Adicionais
                          </p>
                          <div>${servHtml}</div>
                        </td>
                      </tr>` : ''}

                      <!-- Condição especial -->
                      ${proposta.condicao_especial ? `
                      <tr>
                        <td colspan="2" style="padding-top:12px;">
                          <div style="background:#FEF9C3;border:1px solid #FDE68A;
                                      border-radius:8px;padding:12px 16px;">
                            <p style="margin:0;font-size:13px;color:#92400E;">
                              🎁 <strong>Condição especial:</strong> ${proposta.condicao_especial}
                            </p>
                          </div>
                        </td>
                      </tr>` : ''}

                      <!-- Validade -->
                      ${validadeStr ? `
                      <tr>
                        <td colspan="2" style="padding-top:12px;">
                          <p style="margin:0;font-size:12px;color:#7AAACB;text-align:right;">
                            ⏰ Proposta válida até <strong style="color:#1A4E82;">${validadeStr}</strong>
                          </p>
                        </td>
                      </tr>` : ''}

                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════ BENEFÍCIOS ══════════════════════ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                          color:#0D2238;letter-spacing:-0.3px;">
                🚀 O que você vai ter com a ProSystem
              </h2>
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="border:1px solid #C3DCFC;border-radius:12px;overflow:hidden;
                             background:#ffffff;">
                <tbody>
                  ${benefitsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════ DIFERENCIAIS ══════════════════════ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <!-- Diferencial 1 -->
                  <td width="33%" style="padding:16px 8px 16px 0;vertical-align:top;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background:#EBF4FF;border-radius:10px;padding:20px;
                                   border:1px solid #C3DCFC;">
                      <tr>
                        <td align="center">
                          <div style="font-size:28px;margin-bottom:8px;">⚡</div>
                          <p style="margin:0 0 6px;font-size:13px;font-weight:700;
                                     color:#1A4E82;text-align:center;">Implantação Rápida</p>
                          <p style="margin:0;font-size:11px;color:#4A6E8A;
                                     text-align:center;line-height:1.5;">
                            Sistema funcionando em até 10 dias úteis
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Diferencial 2 -->
                  <td width="33%" style="padding:16px 4px;vertical-align:top;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background:#EBF4FF;border-radius:10px;padding:20px;
                                   border:1px solid #C3DCFC;">
                      <tr>
                        <td align="center">
                          <div style="font-size:28px;margin-bottom:8px;">🛡️</div>
                          <p style="margin:0 0 6px;font-size:13px;font-weight:700;
                                     color:#1A4E82;text-align:center;">Suporte 24/7</p>
                          <p style="margin:0;font-size:11px;color:#4A6E8A;
                                     text-align:center;line-height:1.5;">
                            Equipe especializada sempre disponível
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Diferencial 3 -->
                  <td width="33%" style="padding:16px 0 16px 8px;vertical-align:top;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background:#EBF4FF;border-radius:10px;padding:20px;
                                   border:1px solid #C3DCFC;">
                      <tr>
                        <td align="center">
                          <div style="font-size:28px;margin-bottom:8px;">📊</div>
                          <p style="margin:0 0 6px;font-size:13px;font-weight:700;
                                     color:#1A4E82;text-align:center;">16 Anos de Mercado</p>
                          <p style="margin:0;font-size:11px;color:#4A6E8A;
                                     text-align:center;line-height:1.5;">
                            Experiência comprovada no varejo brasileiro
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════ CTA ══════════════════════ -->
          ${linkProposta ? `
          <tr>
            <td style="padding:32px 40px 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:linear-gradient(135deg,#0D2238,#1A4E82);
                             border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:32px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:13px;color:#A8C8E8;
                               text-transform:uppercase;letter-spacing:2px;font-weight:600;">
                      Sua proposta completa está pronta
                    </p>
                    <h3 style="margin:0 0 20px;font-size:22px;font-weight:800;
                                color:#ffffff;line-height:1.2;">
                      Acesse todos os detalhes online
                    </h3>
                    <a href="${linkProposta}"
                       style="display:inline-block;background:linear-gradient(135deg,#4B8EC8,#2E6EAB);
                               color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;
                               padding:14px 36px;border-radius:8px;
                               box-shadow:0 4px 16px rgba(0,0,0,0.3);">
                      👁️ Ver Proposta Completa
                    </a>
                    <p style="margin:16px 0 0;font-size:11px;color:#6AAAE5;">
                      Ou copie o link: <span style="color:#90BEF0;">${linkProposta}</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- ══════════════════════ PRÓXIMOS PASSOS ══════════════════════ -->
          <tr>
            <td style="padding:28px 40px 0;">
              <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;
                          color:#0D2238;letter-spacing:-0.3px;">
                📌 Próximos Passos
              </h2>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${[
                  ['1', '#4B8EC8', 'Analise a proposta', 'Revise todos os detalhes, módulos inclusos e condições de pagamento.'],
                  ['2', '#2E6EAB', 'Tire suas dúvidas', 'Nossa equipe está disponível para esclarecer qualquer ponto da proposta.'],
                  ['3', '#1A4E82', 'Aprove e comece', 'Após aprovação, iniciamos a implantação em até 10 dias úteis.'],
                ].map(([num, color, titulo, desc]) => `
                <tr>
                  <td style="padding:0 0 12px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="background:#F4F7FB;border-radius:10px;border:1px solid #D8E8F5;">
                      <tr>
                        <td width="48" style="padding:16px 0 16px 16px;vertical-align:top;">
                          <div style="width:32px;height:32px;background:${color};border-radius:50%;
                                       text-align:center;line-height:32px;font-size:14px;
                                       font-weight:800;color:#fff;">${num}</div>
                        </td>
                        <td style="padding:16px;vertical-align:top;">
                          <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0D2238;">${titulo}</p>
                          <p style="margin:0;font-size:13px;color:#4A6E8A;line-height:1.5;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>
            </td>
          </tr>

          <!-- ══════════════════════ ASSINATURA VENDEDOR ══════════════════════ -->
          ${proposta.vendedor_nome ? `
          <tr>
            <td style="padding:28px 40px 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="border:1px solid #D8E8F5;border-radius:10px;overflow:hidden;">
                <tr>
                  <td style="background:#F4F7FB;padding:20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="48" valign="middle">
                          <div style="width:44px;height:44px;
                                       background:linear-gradient(135deg,#4B8EC8,#1A4E82);
                                       border-radius:50%;text-align:center;line-height:44px;
                                       font-size:18px;font-weight:800;color:#fff;">
                            ${proposta.vendedor_nome.charAt(0).toUpperCase()}
                          </div>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0D2238;">
                            ${proposta.vendedor_nome}
                          </p>
                          <p style="margin:0;font-size:12px;color:#4A6E8A;">
                            Consultor Comercial · ProSystem Sistemas
                          </p>
                        </td>
                        <td align="right" valign="middle" style="padding-left:20px;">
                          <a href="tel:+552733276739"
                             style="display:inline-block;background:#EBF4FF;color:#1A4E82;
                                     text-decoration:none;font-size:12px;font-weight:600;
                                     padding:8px 16px;border-radius:6px;border:1px solid #C3DCFC;">
                            📞 (27) 3327-6739
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- ══════════════════════ FOOTER ══════════════════════ -->
          <tr>
            <td style="padding:32px 40px;margin-top:12px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:#0D2238;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#ffffff;">
                            Pro<span style="color:#90BEF0;">System</span>
                          </p>
                          <p style="margin:0 0 12px;font-size:11px;color:#6AAAE5;
                                     letter-spacing:2px;text-transform:uppercase;">
                            Sistemas para Varejo · 16 anos
                          </p>
                          <p style="margin:0;font-size:12px;color:#4A6E8A;line-height:1.6;">
                            Av. Prof. Fernando Duarte Rabelo, 330 Sala 02<br>
                            Goiabeiras — Vitória/ES · CEP 29.072-335
                          </p>
                        </td>
                        <td align="right" valign="top">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding-bottom:6px;">
                                <a href="tel:+552733276739"
                                   style="color:#A8C8E8;text-decoration:none;font-size:12px;">
                                  📞 (27) 3327-6739
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom:6px;">
                                <a href="https://wa.me/5527997798103"
                                   style="color:#A8C8E8;text-decoration:none;font-size:12px;">
                                  💬 (27) 99779-8103
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <a href="mailto:suporte@prosystemnet.com.br"
                                   style="color:#A8C8E8;text-decoration:none;font-size:12px;">
                                  ✉️ suporte@prosystemnet.com.br
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"
                           style="margin-top:20px;border-top:1px solid #1A3350;padding-top:16px;">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:11px;color:#2D5A7A;text-align:center;">
                            Este e-mail foi enviado automaticamente pelo CRM ProSystem.
                            Esta é uma proposta comercial confidencial destinada exclusivamente ao destinatário.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function enviarEmailProposta(proposta: Parameters<typeof buildPropostaEmail>[0] & {
  responsavel_email: string;
  vendedor_email?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[EMAIL] SMTP_USER não configurado — e-mail não enviado');
    return { ok: false, error: 'SMTP não configurado' };
  }

  const empresa = proposta.nome_fantasia || proposta.razao_social;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  const html = buildPropostaEmail(proposta);

  // CC para o vendedor que gerou (se tiver e-mail e for diferente do cliente)
  const cc = (proposta.vendedor_email && proposta.vendedor_email !== proposta.responsavel_email)
    ? proposta.vendedor_email : undefined;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:       `"${fromName}" <${fromEmail}>`,
      to:         proposta.responsavel_email,
      cc,                            // vendedor recebe cópia
      bcc:        fromEmail,         // cópia oculta para a Prosystem (confirmação + backup)
      replyTo:    fromEmail,
      subject:    `Proposta ProSystem — ${empresa}`,
      html,
      // Headers que melhoram entregabilidade
      headers: {
        'X-Mailer':         'ProSystem CRM 2.0',
        'X-Priority':       '1',
        'Importance':       'high',
        'Precedence':       'bulk',
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
      },
    });
    console.log(`[EMAIL] Proposta enviada para ${proposta.responsavel_email}${cc ? ` (CC: ${cc})` : ''} (BCC: ${fromEmail})`);
    return { ok: true };
  } catch (err: any) {
    console.error('[EMAIL] Erro ao enviar e-mail:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Email de boas-vindas para novo usuário ───────────────────────────────────

export async function enviarEmailBoasVindas(params: {
  nome: string;
  email: string;
  senha: string;
  cargo: string;
  tipo?: 'cadastro' | 'reset';
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[EMAIL] SMTP_USER não configurado — e-mail não enviado');
    return { ok: false, error: 'SMTP não configurado' };
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  const appUrl    = process.env.FRONTEND_URL     || 'https://crmcomercialprosystem-eu96iiiml.vercel.app';

  const cargoLabel: Record<string, string> = {
    CEO: 'CEO / Administrador',
    SUPERVISAO_COMERCIAL: 'Supervisão Comercial',
    SUPERVISAO_TECNICA: 'Supervisão Técnica',
    TECNICO_SUPORTE: 'Técnico de Suporte',
    VENDEDOR: 'Vendedor(a)',
  };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F7FB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                       box-shadow:0 4px 24px rgba(13,34,56,0.10);max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D2238 0%,#1A4E82 100%);padding:40px 40px 36px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                Pro<span style="color:#90BEF0;">System</span>
              </p>
              <p style="margin:0;font-size:12px;color:#6AAAE5;letter-spacing:2px;text-transform:uppercase;">
                CRM Comercial · Acesso Liberado
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 0;">
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0D2238;">
                Bem-vindo(a), ${params.nome}!
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#4A6E8A;line-height:1.7;">
                Sua conta no <strong style="color:#1A4E82;">CRM Comercial ProSystem</strong> foi criada.
                Use as credenciais abaixo para acessar o sistema.
              </p>

              <!-- Credenciais -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:linear-gradient(135deg,#EBF4FF,#F4F7FB);
                             border:1px solid #C3DCFC;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 20px;font-size:13px;font-weight:700;color:#1A4E82;
                               text-transform:uppercase;letter-spacing:1px;">
                      Suas credenciais de acesso
                    </p>

                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">E-mail</p>
                          <p style="margin:0;font-size:16px;color:#0D2238;font-weight:600;
                                     background:#fff;border:1px solid #C3DCFC;border-radius:8px;
                                     padding:10px 14px;font-family:monospace;">
                            ${params.email}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">Senha temporária</p>
                          <p style="margin:0;font-size:22px;color:#1A4E82;font-weight:800;
                                     background:#fff;border:2px solid #4B8EC8;border-radius:8px;
                                     padding:12px 14px;font-family:monospace;letter-spacing:4px;">
                            ${params.senha}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">Perfil de acesso</p>
                          <p style="margin:0;font-size:14px;color:#0D2238;font-weight:600;">
                            ${cargoLabel[params.cargo] || params.cargo}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:linear-gradient(135deg,#0D2238,#1A4E82);border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:28px 32px;text-align:center;">
                    <p style="margin:0 0 16px;font-size:14px;color:#A8C8E8;">
                      Clique no botão abaixo para acessar o CRM
                    </p>
                    <a href="${appUrl}"
                       style="display:inline-block;background:#4B8EC8;color:#ffffff;
                               font-size:15px;font-weight:700;text-decoration:none;
                               padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Acessar o CRM
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#7AAACB;line-height:1.7;">
                Por segurança, guarde esta senha em local seguro. Em caso de problemas de acesso,
                entre em contato com o administrador do sistema.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="border-top:1px solid #E8F0F8;padding-top:24px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#7AAACB;line-height:1.6;">
                      <strong style="color:#1A4E82;">ProSystem Sistemas</strong> · Vitória, ES<br>
                      Este e-mail foi enviado automaticamente. Não responda a este e-mail.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"${fromName}" <${fromEmail}>`,
      to:      params.email,
      bcc:     fromEmail,
      replyTo: fromEmail,
      subject: `Seu acesso ao CRM ProSystem — ${params.nome}`,
      html,
      headers: {
        'X-Mailer':   'ProSystem CRM 2.0',
        'X-Priority': '1',
        'Importance': 'high',
      },
    });
    console.log(`[EMAIL] Boas-vindas enviado para ${params.email}`);
    return { ok: true };
  } catch (err: any) {
    console.error('[EMAIL] Erro ao enviar boas-vindas:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Email de redefinição de senha ───────────────────────────────────────────

export async function enviarEmailRedefinicaoSenha(params: {
  nome: string;
  email: string;
  senha: string;
  cargo: string;
  solicitadoPor?: 'usuario' | 'admin';
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[EMAIL] SMTP_USER não configurado — e-mail não enviado');
    return { ok: false, error: 'SMTP não configurado' };
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  const appUrl    = process.env.FRONTEND_URL     || 'https://crmcomercialprosystem-eu96iiiml.vercel.app';

  const cargoLabel: Record<string, string> = {
    CEO: 'CEO / Administrador',
    SUPERVISAO_COMERCIAL: 'Supervisão Comercial',
    SUPERVISAO_TECNICA: 'Supervisão Técnica',
    TECNICO_SUPORTE: 'Técnico de Suporte',
    VENDEDOR: 'Vendedor(a)',
  };

  const motivoTexto = params.solicitadoPor === 'admin'
    ? 'Um administrador solicitou a redefinição da sua senha de acesso ao CRM ProSystem.'
    : 'Recebemos uma solicitação de redefinição de senha para sua conta no CRM ProSystem.';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F7FB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                       box-shadow:0 4px 24px rgba(13,34,56,0.10);max-width:600px;">

          <!-- Header laranja/alerta -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D2238 0%,#1A4E82 60%,#2E6EAB 100%);padding:40px 40px 36px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                      Pro<span style="color:#90BEF0;">System</span>
                    </p>
                    <p style="margin:0;font-size:12px;color:#6AAAE5;letter-spacing:2px;text-transform:uppercase;">
                      CRM Comercial · Redefinição de Senha
                    </p>
                  </td>
                  <td align="right" valign="middle">
                    <div style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);border-radius:20px;padding:6px 14px;font-size:12px;color:#FCA5A5;font-weight:600;">
                      🔒 Segurança
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alerta de segurança -->
          <tr>
            <td style="padding:0 40px;">
              <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:0 8px 8px 0;padding:14px 18px;margin:24px 0 0;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#991B1B;">🔐 Alerta de segurança</p>
                <p style="margin:0;font-size:13px;color:#7F1D1D;line-height:1.6;">
                  ${motivoTexto} Se não foi você, entre em contato com o administrador imediatamente.
                </p>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 0;">
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0D2238;">
                Olá, ${params.nome}!
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#4A6E8A;line-height:1.7;">
                Sua senha de acesso ao <strong style="color:#1A4E82;">CRM Comercial ProSystem</strong> foi redefinida.
                Utilize a senha temporária abaixo para fazer login e, em seguida, crie uma senha pessoal.
              </p>

              <!-- Nova senha card -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:linear-gradient(135deg,#EBF4FF,#F4F7FB);border:2px solid #4B8EC8;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#1A4E82;
                               text-transform:uppercase;letter-spacing:1px;">
                      🔑 Sua nova senha temporária
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;text-transform:uppercase;letter-spacing:1px;font-weight:600;">E-mail de acesso</p>
                          <p style="margin:0;font-size:15px;color:#0D2238;font-weight:600;background:#fff;border:1px solid #C3DCFC;border-radius:8px;padding:10px 14px;font-family:monospace;">
                            ${params.email}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Senha temporária</p>
                          <p style="margin:0;font-size:28px;color:#1A4E82;font-weight:800;background:#fff;border:2px solid #4B8EC8;border-radius:8px;padding:14px;font-family:monospace;letter-spacing:6px;text-align:center;">
                            ${params.senha}
                          </p>
                          <p style="margin:6px 0 0;font-size:11px;color:#DC2626;font-weight:600;text-align:center;">
                            ⚠️ Esta é uma senha temporária. Troque-a após o login.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:11px;color:#7AAACB;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Perfil de acesso</p>
                          <p style="margin:0;font-size:14px;color:#0D2238;font-weight:600;">${cargoLabel[params.cargo] || params.cargo}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:linear-gradient(135deg,#0D2238,#1A4E82);border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:28px 32px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:13px;color:#A8C8E8;">Clique para acessar o CRM e trocar sua senha</p>
                    <a href="${appUrl}/alterar-senha"
                       style="display:inline-block;background:#4B8EC8;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      🔒 Acessar e Criar Nova Senha
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Dicas de segurança -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="background:#F4F7FB;border:1px solid #D8E8F5;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:22px 26px;">
                    <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#0D2238;">🛡️ Dicas de segurança para sua nova senha</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      ${[
                        ['✅', 'Use no mínimo 8 caracteres com letras e números'],
                        ['✅', 'Evite datas de aniversário ou nomes próprios'],
                        ['✅', 'Não compartilhe sua senha com ninguém, nem com colegas'],
                        ['✅', 'Use uma senha diferente para cada sistema'],
                        ['🚫', 'Nunca responda e-mails pedindo sua senha'],
                      ].map(([icon, tip]) => `
                      <tr>
                        <td width="28" valign="top" style="padding-bottom:8px;">
                          <span style="font-size:14px;">${icon}</span>
                        </td>
                        <td style="font-size:13px;color:#4A6E8A;padding-bottom:8px;line-height:1.5;">${tip}</td>
                      </tr>`).join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;color:#7AAACB;line-height:1.7;">
                Em caso de dúvidas ou se você não solicitou esta redefinição, entre em contato com o administrador
                pelo e-mail <a href="mailto:suporte@prosystemnet.com.br" style="color:#4B8EC8;">suporte@prosystemnet.com.br</a>
                ou pelo WhatsApp <a href="https://wa.me/5527997798103" style="color:#4B8EC8;">(27) 99779-8103</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #E8F0F8;padding-top:20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#7AAACB;line-height:1.6;">
                      <strong style="color:#1A4E82;">ProSystem Sistemas</strong> · Vitória, ES<br>
                      Av. Prof. Fernando Duarte Rabelo, 330 · Goiabeiras · CEP 29.072-335<br>
                      📞 (27) 3327-6739 · 📱 (27) 99779-8103 · ✉ suporte@prosystemnet.com.br<br><br>
                      Este e-mail foi enviado automaticamente pelo CRM ProSystem. Não responda.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"${fromName}" <${fromEmail}>`,
      to:      params.email,
      bcc:     fromEmail,
      replyTo: fromEmail,
      subject: `🔒 Redefinição de senha — CRM ProSystem`,
      html,
      headers: { 'X-Mailer': 'ProSystem CRM 2.0', 'X-Priority': '1', 'Importance': 'high' },
    });
    console.log(`[EMAIL] Redefinição de senha enviada para ${params.email}`);
    return { ok: true };
  } catch (err: any) {
    console.error('[EMAIL] Erro ao enviar redefinição de senha:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Agendamento: confirmação imediata + lembrete 2h antes ──────────────────

type AgendaParams = {
  cliente_nome: string;
  cliente_email: string;
  cliente_empresa?: string;
  responsavel_nome?: string;
  responsavel_telefone?: string;
  titulo: string;
  data_prevista: Date;
  duracao_minutos?: number;
  meet_link?: string;
  descricao?: string;
};

function fmtDataAgenda(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtHoraAgenda(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function buildEmailAgendamentoBase(params: AgendaParams, modo: 'confirmacao' | 'lembrete'): { subject: string; html: string } {
  const data       = fmtDataAgenda(params.data_prevista);
  const hora       = fmtHoraAgenda(params.data_prevista);
  const duracao    = params.duracao_minutos || 60;
  const horaFim    = fmtHoraAgenda(new Date(params.data_prevista.getTime() + duracao * 60_000));
  const empresa    = params.cliente_empresa ? ` da <strong>${params.cliente_empresa}</strong>` : '';
  const meetBlock  = params.meet_link
    ? `<a href="${params.meet_link}" target="_blank" style="display:inline-block;background:#16a34a;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">🎥 Entrar na reunião</a>`
    : `<p style="margin:0;font-size:13px;color:#A8C8E8;">A reunião acontecerá no formato combinado com o seu vendedor responsável.</p>`;

  const eyebrow = modo === 'confirmacao'
    ? 'CRM Comercial · Agenda Confirmada'
    : 'CRM Comercial · Lembrete · Sua apresentação é HOJE';

  const headline = modo === 'confirmacao'
    ? `Sua apresentação ProSystem foi agendada, ${params.cliente_nome.split(' ')[0]}!`
    : `Sua apresentação começa em 2 horas, ${params.cliente_nome.split(' ')[0]} ⏰`;

  const subject = modo === 'confirmacao'
    ? `✅ Confirmação: Apresentação ProSystem em ${data.replace(/^[a-záé-]+, /i, '')} às ${hora}`
    : `⏰ Lembrete: Sua apresentação ProSystem é em 2 horas (hoje às ${hora})`;

  const intro = modo === 'confirmacao'
    ? `É um prazer ter você${empresa} na nossa agenda. Reservamos um espaço dedicado para mostrar como a ProSystem pode transformar a operação do seu negócio.`
    : `Em <strong style="color:#dc2626;">2 horas</strong> começa a sua apresentação personalizada do sistema ProSystem. Este é o momento de descobrir, ao vivo, como a gente pode reduzir perdas, dar mais controle e fazer seu negócio crescer com tecnologia de gente que entende do seu setor.`;

  const valor = modo === 'confirmacao'
    ? `<h3 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#0D2238;">Por que essa apresentação importa?</h3>
       <ul style="margin:0;padding-left:20px;color:#1A4E82;font-size:13.5px;line-height:1.7;">
         <li><strong>Decisões mais inteligentes:</strong> você vê com seus próprios olhos como o sistema resolve dores reais do seu dia a dia.</li>
         <li><strong>Tempo bem investido:</strong> ${duracao} minutos que podem economizar meses de retrabalho e perdas operacionais.</li>
         <li><strong>Acesso direto:</strong> tire suas dúvidas com quem entende de varejo, farmácia, padaria — sem rodeios.</li>
         <li><strong>Plano sob medida:</strong> ao final, você recebe uma proposta ajustada à realidade do seu negócio.</li>
       </ul>`
    : `<div style="background:#FEF2F2;border-left:4px solid #dc2626;border-radius:8px;padding:14px 18px;margin-bottom:14px;">
         <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#991B1B;">⏱️ A importância de comparecer no horário</p>
         <p style="margin:0;font-size:13px;color:#7F1D1D;line-height:1.6;">
           Cada minuto importa — tanto na sua agenda quanto na do nosso especialista. Atrasos reduzem o tempo
           útil de apresentação, e ausências representam meses de oportunidade desperdiçada (a sua e a nossa).
         </p>
       </div>
       <h3 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#0D2238;">Para extrair o máximo dos próximos ${duracao} minutos:</h3>
       <ul style="margin:0;padding-left:20px;color:#1A4E82;font-size:13.5px;line-height:1.7;">
         <li><strong>Tenha em mãos suas principais dúvidas</strong> sobre gestão, controle de estoque, vendas e fiscal.</li>
         <li><strong>Avise quem for participar com você</strong> — sócio, gerente, financeiro. Decisão em equipe é mais rápida.</li>
         <li><strong>Esteja em local com boa internet</strong> e sem interrupções para aproveitar 100% do encontro.</li>
         <li><strong>Se houver qualquer imprevisto</strong>, fale com a gente AGORA para reagendarmos — sua oportunidade não some.</li>
       </ul>`;

  const rescheduleBlock = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:18px 22px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#9A3412;">📞 Precisa reagendar ou tem alguma dúvida?</p>
          <p style="margin:0;font-size:13px;color:#7C2D12;line-height:1.6;">
            ${params.responsavel_nome ? `Fale diretamente com <strong>${params.responsavel_nome}</strong>` : 'Fale com a equipe ProSystem'}${params.responsavel_telefone ? ` pelo telefone <a href="tel:${params.responsavel_telefone.replace(/\D/g, '')}" style="color:#9A3412;font-weight:700;">${params.responsavel_telefone}</a>` : ''}
            ou responda este e-mail. Vamos achar o melhor horário juntos.
          </p>
        </td>
      </tr>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F7FB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(13,34,56,.10);max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D2238 0%,#1A4E82 100%);padding:36px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
                Pro<span style="color:#90BEF0;">System</span>
              </p>
              <p style="margin:0;font-size:12px;color:#6AAAE5;letter-spacing:2px;text-transform:uppercase;">
                ${eyebrow}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 0;">
              <h2 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0D2238;line-height:1.3;">
                ${headline}
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#4A6E8A;line-height:1.7;">
                ${intro}
              </p>

              <!-- Card data/hora -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#EBF4FF,#F4F7FB);border:1px solid #C3DCFC;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#1A4E82;text-transform:uppercase;letter-spacing:1px;">${modo === 'confirmacao' ? '📅 Data marcada' : '📅 Hoje'}</p>
                    <p style="margin:0 0 16px;font-size:18px;color:#0D2238;font-weight:700;text-transform:capitalize;">
                      ${data}
                    </p>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#1A4E82;text-transform:uppercase;letter-spacing:1px;">🕐 Horário</p>
                    <p style="margin:0 0 16px;font-size:18px;color:#0D2238;font-weight:700;">
                      ${hora} <span style="font-weight:400;color:#7AAACB;">— até ${horaFim} (${duracao} min)</span>
                    </p>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#1A4E82;text-transform:uppercase;letter-spacing:1px;">🎯 Assunto</p>
                    <p style="margin:0;font-size:14px;color:#0D2238;font-weight:600;">
                      ${params.titulo}
                    </p>
                    ${params.descricao ? `
                    <p style="margin:14px 0 6px;font-size:11px;font-weight:700;color:#1A4E82;text-transform:uppercase;letter-spacing:1px;">📝 Observações</p>
                    <p style="margin:0;font-size:13px;color:#4A6E8A;line-height:1.6;">${params.descricao}</p>
                    ` : ''}
                  </td>
                </tr>
              </table>

              <!-- Meet block -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#0D2238,#1A4E82);border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:26px 32px;text-align:center;">
                    <p style="margin:0 0 14px;font-size:14px;color:#A8C8E8;">
                      ${params.meet_link ? 'Sua sala virtual já está preparada:' : 'Combine o canal da reunião com seu vendedor:'}
                    </p>
                    ${meetBlock}
                  </td>
                </tr>
              </table>

              <!-- Valor / motivação -->
              <div style="margin-bottom:26px;">
                ${valor}
              </div>

              ${rescheduleBlock}

              <p style="margin:0 0 8px;font-size:13px;color:#4A6E8A;line-height:1.7;">
                ${modo === 'confirmacao'
                  ? 'Estamos ansiosos para te receber. Até lá! 👋'
                  : 'A gente te espera no horário marcado. Não perca essa oportunidade. 🚀'}
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#1A4E82;font-weight:700;">
                Equipe ProSystem Sistemas
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #E8F0F8;padding-top:20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#7AAACB;line-height:1.6;">
                      <strong style="color:#1A4E82;">ProSystem Sistemas</strong> · Vitória, ES<br>
                      Av. Prof. Fernando Duarte Rabelo, 330 · Goiabeiras · CEP 29.072-335<br>
                      📞 (27) 3327-6739 · 📱 (27) 99779-8103 · ✉ suporte@prosystemnet.com.br
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

export async function enviarEmailConfirmacaoAgendamento(params: AgendaParams): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[EMAIL] SMTP_USER não configurado — confirmação não enviada');
    return { ok: false, error: 'SMTP não configurado' };
  }
  const { subject, html } = buildEmailAgendamentoBase(params, 'confirmacao');
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"${fromName}" <${fromEmail}>`,
      to:      params.cliente_email,
      bcc:     fromEmail,
      replyTo: fromEmail,
      subject,
      html,
      headers: { 'X-Mailer': 'ProSystem CRM 2.0', 'X-Priority': '1', 'Importance': 'high' },
    });
    console.log(`[EMAIL] Confirmação de agendamento enviada para ${params.cliente_email}`);
    return { ok: true };
  } catch (err: any) {
    console.error('[EMAIL] Erro confirmação agendamento:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function enviarEmailLembreteAgendamento(params: AgendaParams): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[EMAIL] SMTP_USER não configurado — lembrete não enviado');
    return { ok: false, error: 'SMTP não configurado' };
  }
  const { subject, html } = buildEmailAgendamentoBase(params, 'lembrete');
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"${fromName}" <${fromEmail}>`,
      to:      params.cliente_email,
      bcc:     fromEmail,
      replyTo: fromEmail,
      subject,
      html,
      headers: { 'X-Mailer': 'ProSystem CRM 2.0', 'X-Priority': '1', 'Importance': 'high' },
    });
    console.log(`[EMAIL] Lembrete 2h enviado para ${params.cliente_email}`);
    return { ok: true };
  } catch (err: any) {
    console.error('[EMAIL] Erro lembrete agendamento:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function enviarEmailNovaCandidaturaRepresentante(candidato: {
  nome: string; empresa?: string | null; telefone: string; email: string;
  cidade?: string | null; estado?: string | null; perfil_desejado: string;
  respostas_detalhadas: any;
}): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'not implemented yet' };
}
