/**
 * Relatório em PDF dos clientes de churn enviados ao CEO para retirar o cadastro do suporte e
 * suspender as cobranças (pedido da Jessica, 15/10/2026: a conversa interna sobre isso é no Teams).
 * Mesma identidade visual do contrato e do termo de renegociação (cabeçalho, rodapé, fontes).
 */
import { PdfPrinterRef, FONTS, BRAND, MARGEM_X, PAGE_W, buildHeader, buildFooter } from '@/lib/contrato-pdf';

export interface ClienteRelatorio {
  codigo?: string | null;
  nome: string;
  razao_social?: string | null;
  cnpj?: string | null;
  cidade?: string | null;
  grupo_tecnico?: string | null;
  status: string;
  perdido_em?: Date | string | null;
  mensalidade?: number | null;
  valor_devido?: number | null;
  motivo?: string | null;
  relato?: string | null;
  fin_situacao?: string | null;
  fin_observacao?: string | null;
  observacao_envio?: string | null;
  atualizacoes?: { em: Date | string; por?: string | null; texto: string }[];
}

export interface RelatorioExclusaoData {
  enviado_por: string;
  para?: string | null;
  observacao?: string | null;
  data?: Date;
  link: string;
  clientes: ClienteRelatorio[];
}

// Margem do pdfmake é [esquerda, topo, direita, baixo]; aqui: topo, direita, baixo, esquerda.
const M = (topo: number, dir = 0, baixo = 0, esq = 0): [number, number, number, number] => [esq, topo, dir, baixo];
const real = (v?: number | null) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (v?: Date | string | null) => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); };
const cnpjFmt = (c?: string | null) => { const d = (c || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (c || '—'); };
const STATUS: Record<string, string> = { PERDIDO: 'Perdido', SISTEMA_REMOVIDO: 'Sistema removido', AGUARDANDO_EXCLUSAO: 'Aguardando exclusão', FINALIZADO: 'Finalizado' };
const FIN: Record<string, string> = { EM_DIA: 'Em dia', EM_ATRASO: 'Em atraso', NEGOCIANDO: 'Negociando', INADIMPLENTE: 'Inadimplente' };
const CINZA = '#6B7280';
const FUNDO = '#EAF2FB';
const LARG = PAGE_W - MARGEM_X * 2;

// Caixa de marcar desenhada (a fonte não tem o caractere ☐).
const caixa = (rotulo: string) => ({
  columns: [
    { width: 12, canvas: [{ type: 'rect', x: 0, y: 1, w: 9, h: 9, lineWidth: 0.8, lineColor: BRAND.azulEscuro }] },
    { width: '*', text: [{ text: rotulo, bold: true }, { text: '   em ____/____/______   por ______________________', color: CINZA }], fontSize: 9 },
  ],
  margin: M(3),
});

function indicador(rotulo: string, valor: string) {
  return {
    width: '*',
    table: { widths: ['*'], body: [[{ stack: [{ text: rotulo.toUpperCase(), fontSize: 7.5, color: CINZA, bold: true }, { text: valor, fontSize: 15, bold: true, color: BRAND.azulEscuro, margin: M(2) }], fillColor: FUNDO, margin: [8, 6, 8, 6] }]] },
    layout: 'noBorders',
  };
}

function blocoCliente(c: ClienteRelatorio, i: number) {
  const linha = (rot: string, val?: string | null) => val ? { text: [{ text: `${rot}: `, bold: true }, val], fontSize: 9, margin: M(2), lineHeight: 1.2 } : null;
  const fin = [c.fin_situacao && (FIN[c.fin_situacao] || c.fin_situacao), c.valor_devido ? `deve ${real(c.valor_devido)}` : null, c.fin_observacao].filter(Boolean).join(' · ');
  return {
    unbreakable: true,
    margin: M(10),
    stack: [
      { canvas: [{ type: 'rect', x: 0, y: 0, w: LARG, h: 2, color: BRAND.ciano }] },
      {
        margin: M(6),
        columns: [
          { width: '*', stack: [
            { text: `${i + 1}. ${c.codigo ? `${c.codigo} · ` : ''}${c.nome}`, fontSize: 11, bold: true, color: BRAND.azulEscuro },
            { text: [c.razao_social && c.razao_social !== c.nome ? c.razao_social : null, `CNPJ ${cnpjFmt(c.cnpj)}`, c.cidade].filter(Boolean).join(' · '), fontSize: 8.5, color: CINZA, margin: M(1) },
          ] },
          { width: 'auto', alignment: 'right', stack: [
            { text: `${real(c.mensalidade)}/mês`, fontSize: 10, bold: true },
            { text: `${STATUS[c.status] || c.status} em ${dia(c.perdido_em)}`, fontSize: 8, color: CINZA },
          ] },
        ],
      },
      { margin: M(4), stack: [
        linha('Grupo técnico (suporte)', c.grupo_tecnico || 'não informado'),
        linha('Motivo da saída', c.motivo),
        linha('Relato', c.relato && c.relato !== c.motivo ? c.relato : null),
        linha('Financeiro', fin || null),
        linha('Observação do envio', c.observacao_envio),
      ].filter(Boolean) },
      ...(c.atualizacoes?.length ? [{
        margin: M(4),
        stack: [
          { text: 'Últimas observações do caso', fontSize: 8, bold: true, color: CINZA },
          ...c.atualizacoes.slice(0, 4).map(a => ({ text: [{ text: `${dia(a.em)}${a.por ? ` · ${a.por}` : ''}: `, color: CINZA }, a.texto.replace(/\s+/g, ' ').slice(0, 300)], fontSize: 8.5, margin: M(1), lineHeight: 1.15 })),
        ],
      }] : []),
      { margin: M(6), stack: [caixa('Retirado do suporte'), caixa('Cobranças suspensas')] },
    ],
  };
}

export async function gerarRelatorioExclusaoPdf(d: RelatorioExclusaoData): Promise<Buffer> {
  const data = d.data || new Date();
  const total = d.clientes.reduce((t, c) => t + (c.mensalidade || 0), 0);
  const devido = d.clientes.reduce((t, c) => t + (c.valor_devido || 0), 0);
  const cab = (t: string, align: 'left' | 'right' = 'left') => ({ text: t, bold: true, fontSize: 8, color: BRAND.azulEscuro, fillColor: FUNDO, alignment: align });

  const content: any[] = [
    { text: 'Churn: clientes para retirar do suporte e suspender as cobranças', fontSize: 15, bold: true, color: BRAND.azulEscuro, margin: M(4) },
    { text: `${d.para ? `Para: ${d.para} · ` : ''}Enviado por: ${d.enviado_por} · ${data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}`, fontSize: 9, color: CINZA, margin: M(2, 0, 12) },
    { columnGap: 8, columns: [
      indicador('Clientes', String(d.clientes.length)),
      indicador('Mensalidades a suspender', real(total)),
      indicador('Valor devido somado', devido ? real(devido) : '—'),
    ] },
    {
      margin: M(12),
      table: { widths: ['*'], body: [[{
        fillColor: '#F8FAFC', margin: [10, 8, 10, 8],
        stack: [
          { text: 'O que precisa ser feito', bold: true, fontSize: 10, color: BRAND.azulEscuro },
          { ol: ['Retirar o cadastro de cada cliente do suporte (grupo técnico indicado).', 'Suspender as cobranças (mensalidade e boletos em aberto, conforme a observação de cada um).', `Marcar as duas confirmações no CRM: ${d.link}`], fontSize: 9, margin: M(4), lineHeight: 1.25 },
          ...(d.observacao?.trim() ? [{ text: [{ text: 'Observação: ', bold: true }, d.observacao.trim()], fontSize: 9, margin: M(6) }] : []),
        ],
      }]] },
      layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 3 : 0), vLineColor: () => BRAND.ciano },
    },
    { text: 'Resumo', fontSize: 11, bold: true, color: BRAND.azulEscuro, margin: M(14, 0, 6) },
    {
      table: {
        headerRows: 1,
        widths: [34, '*', 84, 70, 56, 52],
        body: [
          [cab('Código'), cab('Cliente'), cab('CNPJ'), cab('Suporte'), cab('Mensal.', 'right'), cab('Deve', 'right')],
          ...d.clientes.map(c => [
            { text: c.codigo || '—', fontSize: 8 },
            { text: c.nome, fontSize: 8 },
            { text: cnpjFmt(c.cnpj), fontSize: 8 },
            { text: c.grupo_tecnico || '—', fontSize: 7.5 },
            { text: real(c.mensalidade), fontSize: 8, alignment: 'right' },
            { text: c.valor_devido ? real(c.valor_devido) : '—', fontSize: 8, alignment: 'right' },
          ]),
        ],
      },
      layout: { hLineWidth: (i: number) => (i <= 1 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => '#E5E7EB', paddingTop: () => 4, paddingBottom: () => 4 },
    },
    { text: 'Detalhes e observações', fontSize: 11, bold: true, color: BRAND.azulEscuro, margin: M(18, 0, 2), pageBreak: d.clientes.length > 8 ? 'before' : undefined },
    ...d.clientes.map(blocoCliente),
  ];

  const printer = new PdfPrinterRef(FONTS);
  const pdfDoc = printer.createPdfKitDocument({
    pageSize: 'A4',
    pageMargins: [MARGEM_X, 64, MARGEM_X, 74] as [number, number, number, number],
    info: { title: `Churn - retirar do suporte e suspender cobrancas - ${data.toLocaleDateString('pt-BR')}`, author: 'Prosystem' },
    header: () => buildHeader(),
    footer: (p: number, n: number) => buildFooter(p, n),
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: BRAND.cinzaTexto },
  } as any);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
