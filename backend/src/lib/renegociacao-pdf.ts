/**
 * Gerador de PDF do TERMO DE RENEGOCIAÇÃO DE DÉBITO — Prosystem.
 *
 * Formaliza o acordo feito com o cliente em dificuldade financeira:
 * valor devido, data do acordo, empresa devedora, responsável (nome + CPF),
 * entrada e parcelas restantes (até 6x). Vai para a parte de contrato/assinatura.
 *
 * Reaproveita 100% da identidade visual (cabeçalho/rodapé/fontes) e os helpers
 * de valor por extenso do gerador de contrato — mesmo printer pdfmake (sem Chromium,
 * seguro p/ Railway).
 */
import {
  PdfPrinterRef,
  FONTS,
  BRAND,
  CONTRATADA,
  MARGEM_X,
  buildHeader,
  buildFooter,
  capExt,
} from '@/lib/contrato-pdf';
import { fmtBRL, numPorExtenso } from '@/routes/contratos-comerciais';

const EXT_PARCELAS = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis'];

export interface RenegociacaoPdfData {
  // devedor
  razao_social: string;          // empresa devedora (razão social / nome)
  nome_fantasia?: string | null;
  cnpj?: string | null;
  responsavel: string;           // nome completo do responsável que assina
  responsavel_cpf: string;       // CPF do responsável
  // valores
  valor_devido: number;          // total devido antes do acordo
  valor_entrada?: number | null; // entrada paga no ato
  parcelas?: number | null;      // nº de parcelas restantes (1 a 6)
  // contexto
  como_mantido?: string | null;  // o que foi feito p/ manter o cliente
  resultado?: string | null;     // como ficou após a renegociação
  data?: Date | string | null;   // data do acordo (default: hoje)
  proximo_vencimento?: Date | string | null; // vencimento da 1ª parcela (preenchido pelo gestor)
}

const S = {
  h1: { fontSize: 14, bold: true, alignment: 'center' as const, margin: [0, 0, 0, 4] as [number, number, number, number] },
  sub: { fontSize: 9, alignment: 'center' as const, color: '#666', margin: [0, 0, 0, 16] as [number, number, number, number] },
  clausula: { fontSize: 11, bold: true, margin: [0, 12, 0, 4] as [number, number, number, number] },
  p: { fontSize: 10.5, alignment: 'justify' as const, margin: [0, 0, 0, 6] as [number, number, number, number], lineHeight: 1.3 },
  label: { fontSize: 9, color: '#666', bold: true },
  val: { fontSize: 11, bold: true, color: BRAND.azulEscuro },
};

function par(text: any) {
  return { text, style: 'p' };
}

function dataExtenso(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Tabela de parcelas: divide o saldo (devido - entrada) em N parcelas iguais.
// Se `primeiraParcela` for informada (data do próximo vencimento preenchida pelo
// gestor), a 1ª parcela vence NESSA data e as seguintes mês a mês a partir dela.
// Senão, mantém o comportamento antigo: 1ª parcela no mês seguinte ao acordo.
function tabelaParcelas(saldo: number, parcelas: number, dataBase: Date, primeiraParcela?: Date | null): any {
  const valorParcela = Math.round((saldo / parcelas) * 100) / 100;
  const linhas: any[] = [
    [
      { text: 'Parcela', style: 'label', fillColor: '#EAF2FB' },
      { text: 'Vencimento', style: 'label', fillColor: '#EAF2FB' },
      { text: 'Valor', style: 'label', alignment: 'right', fillColor: '#EAF2FB' },
    ],
  ];
  let acumulado = 0;
  for (let i = 1; i <= parcelas; i++) {
    let venc: Date;
    if (primeiraParcela) {
      venc = new Date(primeiraParcela);
      venc.setMonth(venc.getMonth() + (i - 1));
    } else {
      venc = new Date(dataBase);
      venc.setMonth(venc.getMonth() + i);
    }
    // a última parcela absorve o arredondamento p/ fechar exatamente o saldo
    const v = i === parcelas ? Math.round((saldo - acumulado) * 100) / 100 : valorParcela;
    acumulado += v;
    linhas.push([
      { text: `${i}/${parcelas}`, fontSize: 10 },
      { text: venc.toLocaleDateString('pt-BR'), fontSize: 10 },
      { text: fmtBRL(v), fontSize: 10, alignment: 'right' },
    ]);
  }
  return {
    margin: [0, 4, 0, 10] as [number, number, number, number],
    table: { headerRows: 1, widths: ['auto', '*', 'auto'], body: linhas },
    layout: {
      hLineColor: () => '#D5DEE8',
      vLineColor: () => '#D5DEE8',
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
  };
}

export function gerarRenegociacaoPdf(d: RenegociacaoPdfData): Promise<Buffer> {
  const data = d.data ? new Date(d.data) : new Date();
  const primeiraParcela = d.proximo_vencimento ? new Date(d.proximo_vencimento) : null;
  const devido = d.valor_devido || 0;
  const entrada = d.valor_entrada || 0;
  const parcelas = Math.max(0, Math.min(6, d.parcelas || 0));
  const saldo = Math.max(0, devido - entrada);
  const fantasia = d.nome_fantasia ? ` (${d.nome_fantasia})` : '';
  const parcExt = EXT_PARCELAS[parcelas] || String(parcelas);

  const content: any[] = [
    { text: 'TERMO DE RENEGOCIAÇÃO E CONFISSÃO DE DÍVIDA', style: 'h1' },
    { text: 'Acordo de pagamento amigável', style: 'sub' },

    par([
      'Pelo presente instrumento particular, de um lado, como CREDORA, ',
      { text: CONTRATADA.razao, bold: true },
      `, inscrita no CNPJ sob o nº ${CONTRATADA.cnpj}, com sede à ${CONTRATADA.sede}; e de outro lado, como DEVEDORA, `,
      { text: `${d.razao_social}${fantasia}`, bold: true },
      d.cnpj ? `, inscrita no CNPJ sob o nº ${d.cnpj}` : '',
      ', neste ato representada por ',
      { text: d.responsavel, bold: true },
      `, portador(a) do CPF nº ${d.responsavel_cpf}, têm entre si, justo e acordado, o que segue:`,
    ]),

    { text: 'CLÁUSULA PRIMEIRA — DO DÉBITO', style: 'clausula' },
    par([
      'A DEVEDORA reconhece e confessa dever à CREDORA, na presente data, a quantia de ',
      { text: `${fmtBRL(devido)} (${capExt(devido)})`, bold: true },
      ', referente a mensalidades e serviços do software Prosystem em aberto.',
    ]),

    { text: 'CLÁUSULA SEGUNDA — DA FORMA DE PAGAMENTO', style: 'clausula' },
    ...(entrada > 0
      ? [par([
          'A DEVEDORA pagará, no ato da assinatura deste termo, a título de ENTRADA, o valor de ',
          { text: `${fmtBRL(entrada)} (${capExt(entrada)})`, bold: true },
          '.',
        ])]
      : []),
    ...(parcelas > 0 && saldo > 0
      ? [
          par([
            'O saldo remanescente de ',
            { text: `${fmtBRL(saldo)} (${capExt(saldo)})`, bold: true },
            ` será pago em ${parcExt} (${parcelas}) ${parcelas === 1 ? 'parcela' : 'parcelas'} mensais e sucessivas, conforme o quadro abaixo:`,
          ]),
          tabelaParcelas(saldo, parcelas, data, primeiraParcela),
        ]
      : entrada > 0 && saldo <= 0
      ? [par('Com o pagamento da entrada acima, a DEVEDORA quita integralmente o débito confessado.')]
      : [par([
          'A DEVEDORA pagará o valor total de ',
          { text: `${fmtBRL(devido)} (${capExt(devido)})`, bold: true },
          ' em parcela única, na data acordada entre as partes.',
        ])]),

    { text: 'CLÁUSULA TERCEIRA — DO INADIMPLEMENTO', style: 'clausula' },
    par('O atraso no pagamento de qualquer parcela acarretará o vencimento antecipado de todo o saldo ' +
      'devedor, acrescido de multa de 2% (dois por cento) e juros de mora de 1% (um por cento) ao mês, ' +
      'sem prejuízo da retomada das medidas de cobrança e da eventual suspensão do software contratado.'),

    { text: 'CLÁUSULA QUARTA — DA CONTINUIDADE DO SERVIÇO', style: 'clausula' },
    par('Cumprido o presente acordo, fica mantida a prestação de serviços e a licença de uso do software ' +
      'Prosystem nas condições contratuais vigentes, restabelecida a normalidade da relação comercial entre as partes.'),

    // Bloco interno (NÃO sai impresso em destaque, mas registra o que foi feito p/ manter o cliente)
    ...(d.como_mantido || d.resultado
      ? [
          { text: 'OBSERVAÇÕES DO ACORDO', style: 'clausula' },
          ...(d.como_mantido ? [par([{ text: 'Como o cliente foi mantido: ', bold: true }, d.como_mantido])] : []),
          ...(d.resultado ? [par([{ text: 'Resultado após a renegociação: ', bold: true }, d.resultado])] : []),
        ]
      : []),

    par('E, por estarem assim justas e acordadas, as partes assinam o presente termo em 02 (duas) vias ' +
      'de igual teor, na presença das testemunhas abaixo.'),

    { text: `Vitória-ES, ${dataExtenso(data)}.`, alignment: 'right', margin: [0, 16, 0, 30] as [number, number, number, number], fontSize: 10 },

    {
      unbreakable: true,
      stack: [
        { text: '___________________________________________________________', alignment: 'center', margin: [0, 30, 0, 0] as [number, number, number, number] },
        { text: CONTRATADA.razao, alignment: 'center', bold: true, fontSize: 10 },
        { text: `${CONTRATADA.representante} - CPF: ${CONTRATADA.representante_cpf}`, alignment: 'center', fontSize: 10 },
        { text: 'CREDORA', alignment: 'center', fontSize: 10, margin: [0, 0, 0, 46] as [number, number, number, number] },

        { text: '___________________________________________________________', alignment: 'center', margin: [0, 46, 0, 0] as [number, number, number, number] },
        { text: d.razao_social, alignment: 'center', bold: true, fontSize: 10 },
        { text: `${d.responsavel} - CPF: ${d.responsavel_cpf}`, alignment: 'center', fontSize: 10 },
        { text: 'DEVEDORA', alignment: 'center', fontSize: 10, margin: [0, 0, 0, 36] as [number, number, number, number] },

        { text: 'TESTEMUNHAS:', alignment: 'center', margin: [0, 20, 0, 14] as [number, number, number, number], fontSize: 10 },
        { text: '_____________________________', alignment: 'center', margin: [0, 16, 0, 0] as [number, number, number, number] },
        { text: '_____________________________', alignment: 'center', margin: [0, 16, 0, 0] as [number, number, number, number] },
      ],
    },
  ];

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [MARGEM_X, 64, MARGEM_X, 74] as [number, number, number, number],
    info: { title: `Renegociação - ${d.razao_social}`, author: 'Prosystem' },
    header: () => buildHeader(),
    footer: (currentPage: number, pageCount: number) => buildFooter(currentPage, pageCount),
    content,
    styles: S,
    defaultStyle: { font: 'Roboto', fontSize: 10 },
  };

  const printer = new PdfPrinterRef(FONTS);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
