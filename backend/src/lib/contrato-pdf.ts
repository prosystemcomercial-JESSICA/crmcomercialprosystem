/**
 * Gerador de PDF do Contrato de Concessão de Uso (SOLUTION – FRENTE DE LOJA).
 *
 * Reproduz fielmente o modelo padrão da Prosystem (MINUTA CONTRATO SOLUTION 2024)
 * — cláusulas 1ª a 9ª, CONTRATADA fixa, foro de Vitória e bloco de assinaturas —
 * injetando apenas os campos variáveis vindos da proposta/contrato:
 *   • número do contrato        • razão social / endereço / CNPJ do CONTRATANTE
 *   • versão (MEI/Basic/Pro/Plus) • valor mensal (nº + extenso)
 *   • dia de vencimento          • valor de instalação (nº + extenso, à vista ou parcelado)
 *   • representante + CPF         • data e local
 *
 * Usa pdfmake (puro JS, sem Chromium) — seguro p/ Railway. Fontes Roboto
 * carregadas em memória a partir do vfs embutido (sem TTF em disco).
 */
import { createRequire } from 'module';
import { fmtBRL, numPorExtenso } from '@/routes/contratos-comerciais';

// O projeto roda como ESM (tsx, "type":"module"); pdfmake 0.2.x é CommonJS.
// Usamos createRequire para carregar o PdfPrinter (server-side) e o vfs de fontes.
const require = createRequire(import.meta.url);
const PdfPrinter = require('pdfmake');
const vfsMod = require('pdfmake/build/vfs_fonts.js');
const vfs: Record<string, string> =
  (vfsMod.pdfMake && vfsMod.pdfMake.vfs) || vfsMod.vfs || vfsMod.default || vfsMod;

const fontBuffer = (k: string) => Buffer.from(vfs[k], 'base64');
const FONTS = {
  Roboto: {
    normal: fontBuffer('Roboto-Regular.ttf'),
    bold: fontBuffer('Roboto-Medium.ttf'),
    italics: fontBuffer('Roboto-Italic.ttf'),
    bolditalics: fontBuffer('Roboto-MediumItalic.ttf'),
  },
};

// ── Dados fixos da CONTRATADA (idênticos em todos os modelos) ───────────────
const CONTRATADA = {
  razao: 'SOLUTION DESENVOLVIMENTO DE SOFTWARE LTDA',
  sede: 'AV. PROF. FERNANDO DUARTE RABELO, 330, LOJA 02 - SEGURANÇA DO LAR - VITÓRIA E.S.',
  cnpj: '09.559.678/0001-83',
  representante: 'THIAGO LEANDRO DE FARIA',
  representante_cpf: '055.224.017-61',
  site: 'www.prosystemnet.com.br',
};

const SOFTWARE = 'SOLUTION - FRENTE DE LOJA';

// ── Identidade visual Prosystem (cabeçalho/rodapé) ──────────────────────────
const BRAND = {
  azulEscuro: '#1B5FAA',
  ciano: '#28A9E0',
  cinzaTexto: '#3A3A3A',
  tel: '(027) 9.9658-1370 / 3327-6739',
  email: 'comercial@prosystemnet.com.br',
  endereco: 'Av. Prof. Fernando Duarte Rabelo, 330 / Loja 02',
  bairroCidade: 'Goiabeiras - Vitória/ES',
};

const PAGE_W = 595.28; // A4 em pt
const MARGEM_X = 48;

// Cabeçalho desenhado em cada página: barras azuis + logo PROSYSTEM + site.
function buildHeader() {
  return {
    margin: [0, 0, 0, 0],
    stack: [
      // duas barras superiores (azul escuro + ciano)
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: PAGE_W, h: 7, color: BRAND.azulEscuro },
          { type: 'rect', x: 0, y: 9, w: PAGE_W, h: 4, color: BRAND.ciano },
        ],
      },
      {
        margin: [MARGEM_X, 10, MARGEM_X, 0],
        columns: [
          {
            width: '*',
            columns: [
              // ícone "play" em círculo azul
              {
                width: 26,
                canvas: [
                  { type: 'ellipse', x: 13, y: 13, color: BRAND.azulEscuro, r1: 13, r2: 13 },
                  { type: 'polyline', closePath: true, color: '#FFFFFF', points: [{ x: 10, y: 7 }, { x: 10, y: 19 }, { x: 19, y: 13 }] },
                ],
              },
              {
                width: 'auto',
                margin: [6, 1, 0, 0],
                stack: [
                  { text: 'PROSYSTEM', color: BRAND.azulEscuro, bold: true, fontSize: 15, characterSpacing: 0.5 },
                  { text: 'Desenvolvimento de Sistemas', color: BRAND.cinzaTexto, fontSize: 6.5, italics: true, margin: [0, -1, 0, 0] },
                ],
              },
            ],
          },
          {
            width: 'auto',
            text: BRAND.site,
            color: BRAND.cinzaTexto,
            fontSize: 10,
            alignment: 'right',
            margin: [0, 7, 0, 0],
          },
        ],
      },
    ],
  };
}

// Rodapé desenhado em cada página: contatos + endereço + barra azul + paginação.
function buildFooter(currentPage: number, pageCount: number) {
  return {
    margin: [0, 0, 0, 0],
    stack: [
      {
        margin: [MARGEM_X, 0, MARGEM_X, 2],
        stack: [
          { text: BRAND.tel, alignment: 'center', color: BRAND.cinzaTexto, fontSize: 8 },
          { text: BRAND.email, alignment: 'center', color: BRAND.cinzaTexto, fontSize: 8 },
          { text: BRAND.endereco, alignment: 'center', color: BRAND.cinzaTexto, fontSize: 8 },
          { text: BRAND.bairroCidade, alignment: 'center', color: BRAND.cinzaTexto, fontSize: 8 },
        ],
      },
      { canvas: [{ type: 'rect', x: 0, y: 4, w: PAGE_W, h: 9, color: BRAND.azulEscuro }] },
      {
        text: `${currentPage}/${pageCount}`,
        alignment: 'right',
        color: '#FFFFFF',
        fontSize: 7,
        margin: [0, -10, MARGEM_X, 0],
      },
    ],
  };
}

export interface ContratoPdfData {
  numero_contrato?: string | null;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  numero_endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  representante_nome?: string | null;
  representante_cpf?: string | null;
  software_versao?: string | null;
  plano_contratado?: string | null;
  mensalidade?: number | null;
  dia_vencimento?: number | null;
  valor_setup_total?: number | null;
  valor_setup_entrada?: number | null;
  setup_parcelas?: number | null;
  valor_setup_parcela?: number | null;
  setup_a_vista?: boolean | null;
  data_contrato?: Date | string | null;
}

const EXT_PARCELAS = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis',
  'sete', 'oito', 'nove', 'dez', 'onze', 'doze'];

// Primeira letra maiúscula (espelha o modelo: "(Trezentos reais)", "(Novecentos reais)").
function capExt(v: number): string {
  const s = numPorExtenso(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function versaoDe(c: ContratoPdfData): string {
  return String(c.software_versao || c.plano_contratado || 'PRO').toUpperCase();
}

// Monta o endereço completo do CONTRATANTE em uma frase.
function enderecoContratante(c: ContratoPdfData): string {
  const partes = [
    c.endereco,
    c.numero_endereco ? `N° ${c.numero_endereco}` : '',
    c.bairro,
    c.cidade,
    c.estado,
    c.cep ? `CEP: ${c.cep}` : '',
  ].filter(Boolean);
  return partes.join(', ');
}

// Cláusula 3.5 — instalação (à vista ou parcelada), espelhando o modelo.
function textoInstalacao(c: ContratoPdfData): string {
  const total = c.valor_setup_total || 0;
  if (total <= 0) return '';
  if (c.setup_a_vista || !c.setup_parcelas || c.setup_parcelas <= 1) {
    return `3.5 - INSTALAÇÃO: Será cobrado pela instalação o valor de ${fmtBRL(total)} ` +
      `(${capExt(total)}) à vista, que deverá ser paga no ato da instalação. ` +
      `Esse valor não será reembolsável, salvo em caso de falhas técnicas não resolvidas.`;
  }
  const entrada = c.valor_setup_entrada || 0;
  const parcelas = c.setup_parcelas;
  const valorParcela = c.valor_setup_parcela || 0;
  const parcExt = EXT_PARCELAS[parcelas] || String(parcelas);
  return `3.5 - INSTALAÇÃO: Será cobrado pela instalação o valor de ${fmtBRL(total)} ` +
    `(${capExt(total)}), sendo entrada de ${fmtBRL(entrada)} (${numPorExtenso(entrada)}), ` +
    `com o saldo restante parcelado em ${parcExt} ${parcelas === 1 ? 'vez' : 'vezes'} de ` +
    `${fmtBRL(valorParcela)} (${numPorExtenso(valorParcela)}), a serem pagas conforme condição ` +
    `aprovada na proposta comercial. Esse valor não será reembolsável, salvo em caso de falhas ` +
    `técnicas não resolvidas.`;
}

function dataLocal(c: ContratoPdfData): string {
  const d = c.data_contrato ? new Date(c.data_contrato) : new Date();
  const fmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  // O local de assinatura é sempre a sede da CONTRATADA (Vitória-ES), não a cidade do cliente.
  return `Vitória-ES, ${fmt}.`;
}

// ── Estilos / helpers de layout ─────────────────────────────────────────────
const S = {
  h1: { fontSize: 13, bold: true, alignment: 'center' as const, margin: [0, 0, 0, 14] as [number, number, number, number] },
  clausula: { fontSize: 11, bold: true, margin: [0, 12, 0, 4] as [number, number, number, number] },
  p: { fontSize: 10, alignment: 'justify' as const, margin: [0, 0, 0, 6] as [number, number, number, number], lineHeight: 1.25 },
  item: { fontSize: 10, margin: [10, 0, 0, 2] as [number, number, number, number] },
};

function par(text: string) {
  return { text, style: 'p' };
}

/**
 * Gera o documento do contrato e retorna o PDF como Buffer.
 */
export function gerarContratoPdf(c: ContratoPdfData): Promise<Buffer> {
  const versao = versaoDe(c);
  const numero = c.numero_contrato || '___/____';
  const mensal = c.mensalidade || 0;
  const dia = c.dia_vencimento || 25;
  const fantasia = c.nome_fantasia ? ` (${c.nome_fantasia})` : '';

  const content: any[] = [
    { text: `CONTRATO DE CONCESSÃO DE USO Nº ${numero}`, style: 'h1' },

    par(`Entre as partes, de um lado como CONTRATADA, ${CONTRATADA.razao}, com sede à ` +
      `${CONTRATADA.sede}, inscrita no CNPJ sob o N.º ${CONTRATADA.cnpj}, e de outro lado como ` +
      `CONTRATANTE:`),

    par(`A Empresa ${c.razao_social}${fantasia} com sede à ${enderecoContratante(c)} inscrita no ` +
      `CNPJ: ${c.cnpj || '___'} e representado por seu representante legal abaixo assinado.`),

    par('Fica justo e contratado o seguinte:'),

    { text: 'CLÁUSULA PRIMEIRA - OBJETO E OBJETIVO DO CONTRATO', style: 'clausula' },
    par(`1.1 - OBJETO DO CONTRATO: A CONTRATADA disponibiliza na forma de CONCESSÃO de uso por ` +
      `tempo determinado o SOFTWARE: ${SOFTWARE} e demais módulos que o compõem, na versão ${versao}.`),
    par(`1.2 - OBJETIVO DO CONTRATO: Disponibilização do SOFTWARE: ${SOFTWARE}, versão ${versao}, ` +
      `Software original desenvolvido pela empresa ${CONTRATADA.razao}, sem exclusividade, sendo vetado ` +
      `o direito de sublocar, adaptar, dissassemblar, vender ou criar produtos derivados de qualquer ` +
      `dos componentes do objeto deste contrato. O objeto do contrato poderá ser transferido de um ` +
      `computador para outro, desde que seja garantido que o Software será utilizado em um único ` +
      `computador, ou em uma única rede de computadores não pública de propriedade da CONTRATANTE, e ` +
      `deverá ser previamente comunicado por escrito à CONTRATADA.`),

    { text: 'CLÁUSULA SEGUNDA - VALIDADE E RESCISÃO DO CONTRATO', style: 'clausula' },
    par('2.1 - O prazo de validade do presente contrato será ajustado em 12 (doze) meses, sendo este ' +
      'de renovação automática. Findo o prazo ajustado, caso não haja manifestação contrária de nenhuma ' +
      'das partes o aceite da renovação será tácito.'),
    par('2.2 - Caso a eventual rescisão seja efetuada antes que tenha decorrido todo o prazo de validade ' +
      'do contrato, deverá o CONTRATANTE pagar à CONTRATADA o valor referente a três parcelas mensais, ' +
      'a título de multa rescisória. Após o referido período de vigor do contrato, não será devida ' +
      'qualquer tipo de multa desde que a eventual intenção de descontinuidade seja comunicada com a ' +
      'antecedência mínima de 30 (trinta) dias em relação à data de renovação do contrato.'),
    par('2.3 - A CONTRATADA poderá rescindir o contrato conforme sua necessidade caso a CONTRATANTE não ' +
      'esteja cumprindo com as condições descritas nas cláusulas 3 e seus artigos, que tratam dos valores ' +
      'e data de pagamento e cláusula 6 e seus artigos, que trata dos deveres da CONTRATANTE.'),

    { text: 'CLÁUSULA TERCEIRA - VALORES E DATA DE PAGAMENTO', style: 'clausula' },
    par(`3.1 - VALOR DO CONTRATO: O valor para a concessão do SOFTWARE: ${SOFTWARE}, versão ${versao}, ` +
      `será de ${fmtBRL(mensal)} (${capExt(mensal)}) mensais, que deverá ser pago em moeda ` +
      `corrente nacional pela CONTRATANTE através de boleto mensal emitido pela CONTRATADA.`),
    par('3.2 - A CONTRATANTE autoriza que o montante do preço convencionado neste instrumento, seja ' +
      'representado por duplicatas de prestação de serviços com cobrança bancária direta.'),
    par('3.2.1 - O aceite será considerado válido enquanto o software estiver instalado, ou até que seja ' +
      'comunicado por escrito a desinstalação. Caso a CONTRATANTE desinstale o software por motivos ' +
      'técnicos comprovados, e comunicado por escrito a CONTRATADA, a continuidade da cobrança será ' +
      'suspensa até que o problema seja resolvido pela CONTRATADA.'),
    par(`3.3 - DATA DO PAGAMENTO: O pagamento se dará no dia ${dia} de cada mês.`),
    par('3.3.1 - Os pagamentos em atraso serão acrescidos de multa conforme juros de mercado.'),
    par('3.3.2 - Em caso de atraso superior a 10 (dez) dias, a CONTRATANTE será notificada por escrito, ' +
      'concedendo-lhe um prazo adicional de 5 (cinco) dias úteis para regularizar o pagamento antes de ' +
      'ocorrer o protesto bancário.'),
    par('3.4 - PROTESTO BANCÁRIO: Juros e despesas com protestos serão acrescidos em cobrança subsequente, ' +
      'ainda que a CONTRATANTE já tenha pago o protesto em cartório.'),
    ...(textoInstalacao(c) ? [par(textoInstalacao(c))] : []),

    { text: 'CLÁUSULA QUARTA - REAJUSTE', style: 'clausula' },
    par('4.1 - O valor mensal deste contrato será automaticamente reajustado conforme o índice do IGP-M ' +
      'acumulado a cada doze (12) meses a contar da data da instalação do SOFTWARE, sendo a CONTRATANTE ' +
      'notificada por escrito com antecedência de 30 dias. Caso a CONTRATANTE não concorde com o reajuste, ' +
      'poderá rescindir o contrato sem aplicação de multa.'),
    par('4.2 - O pagamento da primeira mensalidade após o reajuste será considerado aceite, desde que a ' +
      'CONTRATADA tenha notificado a CONTRATANTE previamente.'),

    { text: 'CLÁUSULA QUINTA - DEVERES DA CONTRATADA', style: 'clausula' },
    par(`5.1 - SUPORTE TÉCNICO: Dar suporte técnico regular, EXCLUSIVAMENTE ao SOFTWARE: ${SOFTWARE}, ` +
      `versão ${versao}, de Segunda a Sexta-feira, das 07:00 as 22:00 exceto feriados.`),
    par('O atendimento é realizado de forma remota, via voz, chat, texto, e conexão nos computadores, ' +
      'sabendo-se que para isso é necessário que a internet esteja funcionando corretamente.'),
    par('Nos fins de semana e feriados, o suporte ocorre nos mesmos horários, mas somente para ' +
      'atendimentos de emergência, casos em que o funcionamento dos sistemas estejam interferindo no ' +
      'fluxo geral de vendas da empresa, demais solicitações serão agendadas para atendimento no próximo ' +
      'dia útil.'),
    par('5.2 - Não faz parte do suporte técnico da CONTRATADA:'),
    {
      ul: [
        'Instalação física dos equipamentos;',
        `Instalação de Impressoras ou outros equipamentos periféricos, posterior à instalação do SOFTWARE: ${SOFTWARE} - versão ${versao};`,
        'Reinstalação do programa licenciado, solicitada em decorrência de problemas técnicos nos equipamentos da CONTRATANTE ou por substituição dos mesmos;',
        'Alimentação de dados no sistema;',
        'Execução e guarda de backups do sistema;',
        'Execução das gerações de arquivos fiscais do sistema;',
        'Gerenciamento de acessos do sistema;',
        'A solicitação destes serviços serão atendidas com base na Cláusula 7.',
      ],
      style: 'p', margin: [10, 0, 0, 6],
    },
    par(`5.3 - TREINAMENTO: O Treinamento do SOFTWARE: ${SOFTWARE} será efetuado pela CONTRATADA de forma ` +
      `on-line, salvo em casos que a proposta comercial acordada defina critérios próprios.`),
    par(`5.4 - BENEFÍCIOS DO SOFTWARE: ${SOFTWARE}, versão ${versao}: A CONTRATADA garante as seguintes ` +
      `funcionalidades:`),
    {
      ul: [
        'Cadastro de produtos;',
        'Cadastro de clientes;',
        'Controle de convênio;',
        'Controle financeiro;',
        'Controle crediário;',
        'Vendas em balcão;',
        'Entrada de produtos;',
        'Controle de estoques;',
        'Emissão de nota fiscal eletrônica;',
        'Emissão de conhecimento de frete eletrônico;',
        `Emissão de cupom fiscal: Em impressoras homologadas no SOFTWARE: ${SOFTWARE}.`,
        `Emissão de cupom de vendas em impressoras não fiscais homologadas no SOFTWARE: ${SOFTWARE}.`,
      ],
      style: 'p', margin: [10, 0, 0, 6],
    },

    { text: 'CLÁUSULA SEXTA - DEVERES DA CONTRATANTE', style: 'clausula' },
    par(`6.1 - DAS INFORMAÇÕES: É de responsabilidade da CONTRATANTE todas as informações registradas no ` +
      `SOFTWARE: ${SOFTWARE} bem como as configurações e manutenção dos dados e suas respectivas cópias de ` +
      `segurança (BACKUP).`),
    par(`6.2 - AUTORIZAÇÃO DE ACESSO: fica autorizado pela CONTRATANTE o livre acesso dos funcionários da ` +
      `CONTRATADA para efeito de manutenção e suporte técnico do SOFTWARE: ${SOFTWARE} nas dependências da ` +
      `CONTRATANTE enquanto durar este contrato.`),
    par(`6.3 - MANUTENÇÃO: Efetuar manutenção periódica em todos seus equipamentos de informática para o ` +
      `perfeito funcionamento do SOFTWARE: ${SOFTWARE}.`),
    par('6.4 - NOTIFICAÇÕES: Caso a CONTRATANTE queira fazer qualquer reclamação relacionada ao suporte ' +
      'técnico, falta de atendimento ou solicitações em geral, o mesmo deverá fazer tal notificação por ' +
      'escrito e enviá-la a CONTRATADA.'),
    par(`6.5 - EQUIPAMENTO: A CONTRATANTE obriga-se a manter em funcionamento, acesso a INTERNET, para ` +
      `suporte da CONTRATADA do SOFTWARE: ${SOFTWARE}. O não cumprimento da presente exigência acarretará ` +
      `na desobrigação da CONTRATADA em efetuar a atendimento técnica, atendendo apenas por telefone, ou ` +
      `utilizando-se da Cláusula 7.1.`),
    par('6.6 - A contratante se compromete a zelar pelo fiel cumprimento deste contrato, tratando os ' +
      'funcionários e representante legal da CONTRATADA com respeito, evitando qualquer interpelação aos ' +
      'mesmos na frente de terceiros, sob pena de indenização moral.'),

    { text: 'CLÁUSULA SÉTIMA - CONDIÇÕES GERAIS', style: 'clausula' },
    par('7.1 - A CONTRATANTE será responsável por custos extras de serviços técnicos que não sejam ' +
      'cobertos pelo contrato, tais como translado, hospedagem e alimentação, solicitações de alterações ' +
      'no software, desde que estes sejam previamente aprovados pela CONTRATANTE, sendo apresentadas notas ' +
      'fiscais dos custos em até 30 dias após a realização do serviço.'),
    par(`7.2 - Toda e qualquer modificação no SOFTWARE: ${SOFTWARE} solicitada pela CONTRATANTE deverá ser ` +
      `encaminhada para a CONTRATADA, para que a mesma possa analisar a viabilidade da solicitação, e ` +
      `enviar orçamento para aprovação.`),
    par('7.3 - Este contrato de prestação de serviços trata da relação entre a CONTRATADA e CONTRATANTE ' +
      'identificadas no preâmbulo deste documento, qualquer alteração de CNPJ deve ser objeto de nova ' +
      'contratação, mesmo se tratando de substituição do atual.'),

    { text: 'CLÁUSULA OITAVA - LIMITAÇÃO DE RESPONSABILIDADE E DANOS INDIRETOS', style: 'clausula' },
    par('8.1 - Sujeito à legislação pertinente, em nenhuma hipótese o fabricante ou seu fornecedor será ' +
      'responsável pela forma de utilização e gerenciamento das informações prestadas pelo SOFTWARE.'),
    par('8.2 - O fabricante ou seu fornecedor não se responsabiliza por quaisquer danos oriundos da ' +
      'impossibilidade de usar este produto, ainda que o fabricante tenha sido alertado para a ' +
      'possibilidade desses danos.'),
    par('8.3 - Fica exclusiva a responsabilidade da CONTRATANTE por quaisquer danos diretos ou indiretos ' +
      'resultantes de lesão corporal, lucro cessante, interrupção de negócios, perdas de informações ou ' +
      'outros prejuízos pecuniários, decorrentes de uso ou da impossibilidade de usar este produto, ainda ' +
      'que a CONTRATADA tenha sido alertado quanto a possibilidade destes danos.'),
    par('8.4 - Em qualquer caso, a responsabilidade integral do fabricante e de seus fornecedores sob este ' +
      'Contrato limitar-se-á ao valor efetivamente pago por V.Sa. pela disponibilização do Software.'),
    par('8.5 - Não são consideradas obrigações ou responsabilidades do CONTRATADO:'),
    {
      ul: [
        'I. A operação de sistemas ou digitação de dados dos arquivos, quaisquer que sejam as circunstâncias;',
        'II. Recuperação de dados irremediavelmente perdidos, mesmo que seja o backup;',
        'III. Reposição de materiais, equipamentos, peças e outros gastos ou danificados em quaisquer que sejam as circunstâncias;',
        'IV. Não compreendem na prestação dos serviços ora contratados suporte a outros sistemas e aplicativos a não ser os mencionados na cláusula primeira;',
        'V. Não compreendem na prestação dos serviços ora contratados manutenção e suporte a microcomputadores, rede interna e outros equipamentos;',
        'VI. Não compreendem na prestação de serviço, levar ou trazer (movimentar) equipamentos para garantias, ou pessoas;',
        'VII. Não está contemplado neste contrato as implantações de tecnologias e mudanças de sistemas operacionais em servidores mesmo os já mencionados;',
        'VIII. Não compreendem na prestação dos serviços ora contratados a execução da geração e conferência de arquivos fiscais gerados pelo sistema;',
        'IX. Não está contemplado neste contrato quaisquer outros itens que não estejam especificados neste contrato, atendendo a CONTRATADA somente naquilo que estiver no escopo da CLÁUSULA PRIMEIRA.',
      ],
      style: 'p', margin: [10, 0, 0, 6],
    },

    { text: 'CLÁUSULA NONA - ELEIÇÃO DO FORO', style: 'clausula' },
    par('Fica eleito como Foro da Comarca de Vitória, Capital do Estado do Espírito Santo, para dirimir ' +
      'qualquer dúvida ou litígio oriundo do presente contrato.'),
    par('E assim, por se acharem justos e contratados, as partes declaram ter lido e concordado ' +
      'integralmente com todos os termos aqui descritos, assinam o presente contrato, na presença das ' +
      'testemunhas abaixo, firmando-o em 02 (duas) vias de igual teor e forma para um único efeito, ' +
      'obrigando-se por si e seus herdeiros e / ou sucessores, a qualquer título, ao cumprimento fiel ' +
      'das suas cláusulas e obrigações.'),

    { text: dataLocal(c), alignment: 'right', margin: [0, 18, 0, 30] as [number, number, number, number], fontSize: 10 },

    // Bloco de assinaturas: mantido junto (unbreakable) com um respiro no topo, para
    // a 1ª assinatura nunca ficar colada no cabeçalho ao cair em página nova.
    {
      unbreakable: true,
      stack: [
        { text: ' ', margin: [0, 24, 0, 0] as [number, number, number, number] }, // respiro do topo
        { text: '___________________________________________________________', alignment: 'center', margin: [0, 40, 0, 0] as [number, number, number, number] },
        { text: CONTRATADA.razao, alignment: 'center', bold: true, fontSize: 10 },
        { text: `${CONTRATADA.representante} - CPF: ${CONTRATADA.representante_cpf}`, alignment: 'center', fontSize: 10 },
        { text: 'CONTRATADA', alignment: 'center', fontSize: 10, margin: [0, 0, 0, 50] as [number, number, number, number] },

        { text: '___________________________________________________________', alignment: 'center', margin: [0, 50, 0, 0] as [number, number, number, number] },
        { text: c.razao_social, alignment: 'center', bold: true, fontSize: 10 },
        {
          text: `${c.representante_nome || ''}${c.representante_cpf ? ` - CPF: ${c.representante_cpf}` : ''}`,
          alignment: 'center', fontSize: 10,
        },
        { text: 'CONTRATANTE', alignment: 'center', fontSize: 10, margin: [0, 0, 0, 40] as [number, number, number, number] },

        { text: 'TESTEMUNHAS:', alignment: 'center', margin: [0, 24, 0, 14] as [number, number, number, number], fontSize: 10 },
        { text: '_____________________________', alignment: 'center', margin: [0, 18, 0, 0] as [number, number, number, number] },
        { text: '_____________________________', alignment: 'center', margin: [0, 18, 0, 0] as [number, number, number, number] },
      ],
    },
  ];

  const docDefinition = {
    pageSize: 'A4',
    // topo: barras+logo (~50pt) + folga; base: contatos+barra (~62pt) + folga
    pageMargins: [MARGEM_X, 64, MARGEM_X, 74] as [number, number, number, number],
    info: {
      title: `Contrato ${numero} - ${c.razao_social}`,
      author: 'Prosystem',
    },
    header: () => buildHeader(),
    footer: (currentPage: number, pageCount: number) => buildFooter(currentPage, pageCount),
    content,
    styles: S,
    defaultStyle: { font: 'Roboto', fontSize: 10 },
  };

  const printer = new PdfPrinter(FONTS);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
