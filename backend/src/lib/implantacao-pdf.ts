/**
 * PDFs do Portal Técnico: relatório final da implantação (para o cliente) e termo de aceite
 * (assinado pelo decisor no ZapSign). Mesma identidade visual do contrato (cabeçalho/rodapé Prosystem).
 */
import { FONTS, PdfPrinterRef, CONTRATADA, BRAND, buildHeader, buildFooter, MARGEM_X } from '@/lib/contrato-pdf';

export type DadosRelatorioImplantacao = {
  cliente: string; cnpj?: string | null; modulo: string; tipo: string; plano?: string | null;
  tecnico?: string | null; assinatura?: Date | null; virada?: Date | null; validacao?: Date | null;
  decisor?: string | null; contato?: string | null;
  etapas: { nome: string; feitos: number; total: number }[];
  testes: { item: string; resultado: string; observacao?: string | null }[];
  treinamento: { ordem: number; nome: string; realizada_em?: Date | null; participantes?: string[] | null; confirmado_por?: string | null }[];
  assistida?: { feitos: number; total: number } | null;
  correcoes: { titulo: string; situacao: string }[];
  equipamentos: { tipo: string; descricao?: string }[];
  horas?: number | null;
  suporte: { telefone: string; link?: string };
};

const data = (d?: Date | null) => (d ? d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const RES: Record<string, string> = { OK: 'Ok', DIVERGENTE: 'Divergência', NAO_APLICA: 'Não se aplica', PENDENTE: 'Sem conferir' };

function conteudo(d: DadosRelatorioImplantacao, termo: boolean): any[] {
  const titulo = (t: string) => ({ text: t, fontSize: 11, bold: true, color: BRAND.azulEscuro, margin: [0, 14, 0, 6] });
  const linha = (rot: string, val: string) => ({ columns: [{ text: rot, width: 150, color: '#6B7280' }, { text: val, width: '*' }], margin: [0, 0, 0, 3] });
  const c: any[] = [
    { text: termo ? 'TERMO DE ACEITE E CONCLUSÃO' : 'RELATÓRIO FINAL', fontSize: 15, bold: true, color: BRAND.azulEscuro, margin: [0, 6, 0, 2] },
    { text: `${d.modulo === 'SERVICO' ? 'Serviço' : 'Implantação'} do sistema Prosystem · ${d.cliente}`, fontSize: 11, color: BRAND.cinzaTexto, margin: [0, 0, 0, 10] },
    linha('Cliente', `${d.cliente}${d.cnpj ? ` · CNPJ ${d.cnpj}` : ''}`),
    linha('Tipo', `${d.tipo}${d.plano ? ` · plano ${d.plano}` : ''}`),
    linha('Técnico responsável', d.tecnico || '—'),
    linha('Contrato assinado em', data(d.assinatura)),
    ...(d.modulo === 'SERVICO' ? [] : [linha('Sistema em uso desde', data(d.virada))]),
    linha('Validado pela Prosystem em', data(d.validacao)),
    ...(d.horas ? [linha('Tempo de trabalho dedicado', `${d.horas} h`)] : []),
  ];
  if (d.etapas.length) {
    c.push(titulo('O que foi feito'));
    c.push({ table: { widths: ['*', 70], body: [[{ text: 'Etapa', bold: true }, { text: 'Concluído', bold: true }], ...d.etapas.map(e => [e.nome, `${e.feitos} de ${e.total}`])] }, layout: 'lightHorizontalLines' });
  }
  if (d.testes.length) {
    c.push(titulo('Conferência dos dados convertidos'));
    c.push({ table: { widths: ['*', 90, '*'], body: [[{ text: 'Cadastro', bold: true }, { text: 'Resultado', bold: true }, { text: 'Observação', bold: true }], ...d.testes.map(t => [t.item, RES[t.resultado] || t.resultado, t.observacao || ''])] }, layout: 'lightHorizontalLines' });
  }
  if (d.treinamento.length) {
    c.push(titulo('Treinamento'));
    c.push({ table: { widths: ['*', 70, '*'], body: [[{ text: 'Fase', bold: true }, { text: 'Realizada', bold: true }, { text: 'Participantes', bold: true }],
      ...d.treinamento.map(f => [`${f.ordem}. ${f.nome}`, data(f.realizada_em), f.participantes?.length ? `${f.participantes.join(', ')}${f.confirmado_por ? ` (confirmado por ${f.confirmado_por})` : ''}` : '—'])] }, layout: 'lightHorizontalLines' });
  }
  if (d.assistida) c.push(titulo('Acompanhamento depois da virada'), { text: `Operação assistida: ${d.assistida.feitos} de ${d.assistida.total} dias úteis conferidos (vendas, NFC-e e estoque).` });
  if (d.correcoes.length) {
    c.push(titulo('Ajustes feitos durante a implantação'));
    c.push({ ul: d.correcoes.map(o => `${o.titulo}${o.situacao !== 'RESOLVIDA' ? ' (em acompanhamento)' : ''}`) });
  }
  if (d.equipamentos.length) {
    c.push(titulo('Equipamentos configurados'));
    c.push({ ul: d.equipamentos.map(e => `${e.tipo}${e.descricao ? ` · ${e.descricao}` : ''}`) });
  }
  if (termo) {
    c.push(titulo('Declaração'));
    c.push({ text: `O CONTRATANTE declara que a ${d.modulo === 'SERVICO' ? 'execução do serviço' : 'implantação do sistema SOLUTION - FRENTE DE LOJA'} descrita acima foi concluída, que o sistema está em uso na loja${d.treinamento.length ? ' e que a equipe indicada recebeu o treinamento' : ''}, dando por aceita a entrega. A partir desta data, o atendimento passa a ser feito pelo suporte técnico da Prosystem, conforme o contrato.`, alignment: 'justify', lineHeight: 1.3 });
    c.push({ text: `CONTRATADA: ${CONTRATADA.razao} · CNPJ ${CONTRATADA.cnpj}`, fontSize: 9, color: '#6B7280', margin: [0, 10, 0, 0] });
    c.push({ text: `Assinatura eletrônica do CONTRATANTE${d.decisor ? `: ${d.decisor}` : ''} (via ZapSign).`, fontSize: 9, color: '#6B7280', margin: [0, 4, 0, 0] });
  } else {
    c.push(titulo('Daqui para frente'));
    c.push({ text: `Dúvidas e chamados pelo suporte da Prosystem: ${d.suporte.telefone}${d.suporte.link ? ` · ${d.suporte.link}` : ''}.${d.contato ? ` Contato da loja registrado: ${d.contato}.` : ''}`, lineHeight: 1.3 });
  }
  return c;
}

export function gerarPdfImplantacao(d: DadosRelatorioImplantacao, termo: boolean): Promise<Buffer> {
  const printer = new PdfPrinterRef(FONTS);
  const pdfDoc = printer.createPdfKitDocument({
    pageSize: 'A4',
    pageMargins: [MARGEM_X, 64, MARGEM_X, 74],
    info: { title: `${termo ? 'Termo de aceite' : 'Relatório da implantação'} - ${d.cliente}`, author: 'Prosystem' },
    header: () => buildHeader(),
    footer: (p: number, n: number) => buildFooter(p, n),
    content: conteudo(d, termo),
    defaultStyle: { font: 'Roboto', fontSize: 10 },
  });
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (x: Buffer) => chunks.push(x));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
