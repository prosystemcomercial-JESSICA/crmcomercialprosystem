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

  const modulosHtml = (proposta.modulos_inclusos || []).length > 0
    ? (proposta.modulos_inclusos || []).map(m =>
        `<span style="display:inline-block;background:#EBF4FF;color:#1A4E82;
                      border:1px solid #C3DCFC;border-radius:20px;
                      padding:4px 12px;font-size:12px;margin:3px 3px 3px 0;">
          ${m}
        </span>`).join('')
    : '';

  const servHtml = (proposta.servicos_adicionais || []).length > 0
    ? (proposta.servicos_adicionais || []).map(s =>
        `<span style="display:inline-block;background:#F0FDF4;color:#166534;
                      border:1px solid #BBF7D0;border-radius:20px;
                      padding:4px 12px;font-size:12px;margin:3px 3px 3px 0;">
          + ${s}
        </span>`).join('')
    : '';

  const linkProposta = proposta.public_token
    ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/p/${proposta.public_token}`
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

                      <!-- Módulos inclusos -->
                      ${modulosHtml ? `
                      <tr>
                        <td colspan="2" style="padding-top:16px;">
                          <p style="margin:0 0 8px;font-size:11px;color:#7AAACB;
                                     text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                            📦 Módulos Inclusos
                          </p>
                          <div>${modulosHtml}</div>
                        </td>
                      </tr>` : ''}

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
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_USER) {
    console.warn('[EMAIL] SMTP_USER não configurado — e-mail não enviado');
    return { ok: false, error: 'SMTP não configurado' };
  }

  const empresa = proposta.nome_fantasia || proposta.razao_social;
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER!;
  const fromName  = process.env.SMTP_FROM_NAME  || 'ProSystem Sistemas';
  const html = buildPropostaEmail(proposta);

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:       `"${fromName}" <${fromEmail}>`,
      to:         proposta.responsavel_email,
      bcc:        fromEmail,         // cópia oculta para jessica (confirmação + backup)
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
    console.log(`[EMAIL] Proposta enviada para ${proposta.responsavel_email} (BCC: ${fromEmail})`);
    return { ok: true };
  } catch (err: any) {
    console.error('[EMAIL] Erro ao enviar e-mail:', err.message);
    return { ok: false, error: err.message };
  }
}
