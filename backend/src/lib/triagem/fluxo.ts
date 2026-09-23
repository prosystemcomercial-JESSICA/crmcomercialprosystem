// Roteiro da triagem automática do WhatsApp da empresa. Puro: recebe o estado,
// os dados coletados e a entrada do cliente; devolve o próximo estado e as
// ações (mensagens) que o executor deve enviar. A consulta de CNPJ e a
// existência de material vêm por injeção (deps), para testar sem rede.

import { extrairCnpj, cnpjValido, type ConsultaCnpj, type DadosReceita } from '../cnpj';
import type { MenuWhatsapp, OpcaoMenu } from '../../services/evolution.service';

export type EstadoTriagem = 'MENU' | 'MENU_CLIENTE' | 'SERVICO' | 'SEGMENTO' | 'RELACAO' | 'NOME' | 'CIDADE' | 'CNPJ' | 'CNPJ_CONFIRMA' | 'FIM';
export const ESTADOS_TRIAGEM: EstadoTriagem[] = ['MENU', 'MENU_CLIENTE', 'SERVICO', 'SEGMENTO', 'RELACAO', 'NOME', 'CIDADE', 'CNPJ', 'CNPJ_CONFIRMA', 'FIM'];

export type DadosTriagem = {
  fluxo?: 'conhecer' | 'servicos' | 'suporte' | 'financeiro';
  segmento?: 'Padaria' | 'Farmácia';
  relacao?: 'cliente' | 'ex_cliente' | 'nao_conhece';
  nome?: string; cidade?: string; servico?: string;
  cnpj?: string; receita?: DadosReceita | null; receita_fonte?: string | null;
};
export type Acao = { tipo: 'texto'; texto: string } | { tipo: 'menu'; menu: MenuWhatsapp } | { tipo: 'material'; segmento: 'Padaria' | 'Farmácia' };
export type Desfecho = 'qualificado' | 'servicos' | 'suporte' | 'financeiro';
export type ResultadoPasso = { estado: EstadoTriagem; dados: DadosTriagem; acoes: Acao[]; desfecho?: Desfecho };
export type DepsTriagem = { consultarCnpj: (cnpj: string) => Promise<ConsultaCnpj>; temMaterial: (segmento: 'Padaria' | 'Farmácia') => boolean };

export const CONTATO_GERAL = '27 99779-8103';
const RODAPE = 'Prosystem Sistemas';

const OPC_MENU: OpcaoMenu[] = [
  { id: 'conhecer', texto: 'Quero conhecer', descricao: 'Conheça nossos sistemas' },
  { id: 'servicos', texto: 'Serviços', descricao: 'Solicite um serviço' },
  { id: 'suporte', texto: 'Suporte', descricao: 'Ajuda técnica' },
  { id: 'financeiro', texto: 'Financeiro', descricao: 'Boletos e pagamentos' },
];
const OPC_CLIENTE: OpcaoMenu[] = [
  { id: 'servicos', texto: 'Serviços' }, { id: 'suporte', texto: 'Suporte' }, { id: 'financeiro', texto: 'Financeiro' },
];
const OPC_SEGMENTO: OpcaoMenu[] = [{ id: 'padaria', texto: 'Padaria' }, { id: 'farmacia', texto: 'Farmácia' }];
const OPC_RELACAO: OpcaoMenu[] = [
  { id: 'cliente', texto: 'Sou cliente' }, { id: 'ex_cliente', texto: 'Já fui cliente' }, { id: 'nao_conhece', texto: 'Não conheço a Prosystem' },
];
const OPC_CONFIRMA: OpcaoMenu[] = [{ id: 'cnpj_sim', texto: 'Sim' }, { id: 'cnpj_nao', texto: 'Não, digitar de novo' }];

// Palavras que também valem como escolha quando o cliente digita em vez de clicar.
const APELIDOS: Record<string, string[]> = {
  conhecer: ['conhecer', 'quero conhecer', 'conhecer o sistema', 'comprar', 'orcamento'],
  servicos: ['servico', 'servicos'],
  suporte: ['suporte', 'ajuda', 'problema', 'erro'],
  financeiro: ['financeiro', 'boleto', 'pagamento', 'cobranca', 'nota fiscal'],
  padaria: ['padaria', 'panificadora', 'confeitaria'],
  farmacia: ['farmacia', 'drogaria'],
  cliente: ['sou cliente', 'ja sou', 'cliente'],
  ex_cliente: ['ja fui', 'ex cliente', 'ex-cliente', 'fui cliente'],
  nao_conhece: ['nao conheco', 'nao sou', 'nunca'],
  cnpj_sim: ['sim', 's', 'isso', 'correto', 'certo'],
  cnpj_nao: ['nao', 'n', 'errado', 'digitar de novo'],
};

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const temLetras = (s: string, min: number) => (s || '').replace(/[^a-zA-ZÀ-ÿ]/g, '').length >= min;
const ehPlaceholder = (s: string) => /^\[[^\]]*\]$/.test((s || '').trim());

function escolher(entrada: { texto: string; botaoId?: string | null }, opcoes: OpcaoMenu[]): string | null {
  if (entrada.botaoId && opcoes.some(o => o.id === entrada.botaoId)) return entrada.botaoId;
  const t = norm(entrada.texto);
  if (!t) return null;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= opcoes.length) return opcoes[n - 1].id;
  const exata = opcoes.find(o => norm(o.texto) === t || o.id === t);
  if (exata) return exata.id;
  // Apelidos: frase mais longa primeiro, para "nao conheco" não cair em "nao".
  const candidatos = opcoes
    .flatMap(o => (APELIDOS[o.id] || []).map(a => ({ id: o.id, a })))
    .sort((x, y) => y.a.length - x.a.length);
  const achou = candidatos.find(({ a }) => (a.length <= 2 ? t === a : t.includes(a)));
  return achou ? achou.id : null;
}

const menuPrincipal = (): Acao => ({
  tipo: 'menu',
  menu: { modo: 'list', texto: 'Olá! 👋 Aqui é a *Prosystem Sistemas*, especialista em sistemas para o varejo.\n\nComo podemos te ajudar?', opcoes: OPC_MENU, botaoLista: 'Ver opções', secao: 'Atendimento', rodape: RODAPE },
});
const menuCliente = (nome: string): Acao => ({
  tipo: 'menu',
  menu: { modo: 'button', texto: `Olá! 👋 Que bom falar com você, *${nome}*!\n\nComo podemos te ajudar?`, opcoes: OPC_CLIENTE, rodape: RODAPE },
});
// Reasking do MENU_CLIENTE quando a resposta não casa: não saudar de novo como
// "*cliente*" (o cliente já foi cumprimentado pelo nome real na 1ª mensagem).
const menuClienteReask = (): Acao => ({
  tipo: 'menu',
  menu: { modo: 'button', texto: 'Como podemos te ajudar? Escolha uma opção:', opcoes: OPC_CLIENTE, rodape: RODAPE },
});
const menuSegmento = (): Acao => ({ tipo: 'menu', menu: { modo: 'button', texto: 'Que ótimo! 😊 Qual é o seu segmento?', opcoes: OPC_SEGMENTO, rodape: RODAPE } });
const menuRelacao = (): Acao => ({ tipo: 'menu', menu: { modo: 'button', texto: 'Você já é cliente Prosystem?', opcoes: OPC_RELACAO, rodape: RODAPE } });
const texto = (t: string): Acao => ({ tipo: 'texto', texto: t });
const repetir = (menu: Acao): Acao[] => [texto('Por favor, escolha uma das opções abaixo 👇'), menu];

const PEDIR_CNPJ = 'Qual é o CNPJ da empresa? (pode mandar só os números)';

export function iniciarTriagem(ctx: { clienteNome?: string | null }): ResultadoPasso {
  if (ctx.clienteNome) return { estado: 'MENU_CLIENTE', dados: {}, acoes: [menuCliente(ctx.clienteNome)] };
  return { estado: 'MENU', dados: {}, acoes: [menuPrincipal()] };
}

function desfechoAtendimentoGeral(dados: DadosTriagem, fluxo: 'suporte' | 'financeiro'): ResultadoPasso {
  const msg = fluxo === 'suporte'
    ? `Para suporte, fale com nosso atendimento geral pelo WhatsApp *${CONTATO_GERAL}*. Eles vão te ajudar! 💙`
    : `Para assuntos financeiros, o contato correto é o nosso atendimento geral: *${CONTATO_GERAL}*. 💙`;
  return { estado: 'FIM', dados: { ...dados, fluxo }, acoes: [texto(msg)], desfecho: fluxo };
}

function escolhaDoMenu(estado: 'MENU' | 'MENU_CLIENTE', dados: DadosTriagem, escolha: string | null, menuReask: Acao): ResultadoPasso {
  if (escolha === 'suporte' || escolha === 'financeiro') return desfechoAtendimentoGeral(dados, escolha);
  if (escolha === 'servicos') {
    return { estado: 'SERVICO', dados: { ...dados, fluxo: 'servicos' }, acoes: [texto('Que tipo de serviço você precisa? Pode descrever em uma mensagem. 📝')] };
  }
  if (escolha === 'conhecer' && estado === 'MENU') {
    return { estado: 'SEGMENTO', dados: { ...dados, fluxo: 'conhecer' }, acoes: [menuSegmento()] };
  }
  return { estado, dados, acoes: repetir(menuReask) };
}

function finalQualificado(dados: DadosTriagem, deps: DepsTriagem): ResultadoPasso {
  const nome = dados.nome ? `, ${dados.nome}` : '';
  const acoes: Acao[] = [texto(`Obrigado${nome}! 🙌 Nossa especialista recebeu seu contato e vai retornar o mais breve possível.`)];
  if (dados.segmento && deps.temMaterial(dados.segmento)) {
    const onde = dados.segmento === 'Farmácia' ? 'farmácia' : 'padaria';
    acoes.push(texto(`Enquanto isso, aqui estão algumas ferramentas que temos para evoluir com você na sua ${onde}:`));
    acoes.push({ tipo: 'material', segmento: dados.segmento });
  }
  return { estado: 'FIM', dados, acoes, desfecho: 'qualificado' };
}

export async function avancarTriagem(
  estado: EstadoTriagem,
  dados: DadosTriagem,
  entrada: { texto: string; botaoId?: string | null },
  deps: DepsTriagem,
): Promise<ResultadoPasso> {
  const livre = ehPlaceholder(entrada.texto) ? '' : (entrada.texto || '').trim();

  switch (estado) {
    case 'MENU':
      return escolhaDoMenu('MENU', dados, escolher(entrada, OPC_MENU), menuPrincipal());
    case 'MENU_CLIENTE':
      return escolhaDoMenu('MENU_CLIENTE', dados, escolher(entrada, OPC_CLIENTE), menuClienteReask());
    case 'SERVICO':
      if (livre.length < 3) return { estado, dados, acoes: [texto('Pode descrever em uma mensagem qual serviço você precisa? 📝')] };
      return { estado: 'FIM', dados: { ...dados, servico: livre.slice(0, 1000) }, acoes: [texto('Recebemos seu pedido! ✅ Um consultor vai te atender em breve.')], desfecho: 'servicos' };
    case 'SEGMENTO': {
      const e = escolher(entrada, OPC_SEGMENTO);
      if (!e) return { estado, dados, acoes: repetir(menuSegmento()) };
      return { estado: 'RELACAO', dados: { ...dados, segmento: e === 'padaria' ? 'Padaria' : 'Farmácia' }, acoes: [menuRelacao()] };
    }
    case 'RELACAO': {
      // Se não veio um clique de botão válido e o texto tem uma negação como
      // palavra isolada ("não", "nunca"), trata como "não conhece" mesmo que
      // a frase também contenha um apelido de outra opção (ex.: "não, nunca
      // fui cliente, mas quero conhecer" não deve virar "ex_cliente").
      const temBotaoValido = !!(entrada.botaoId && OPC_RELACAO.some(o => o.id === entrada.botaoId));
      const temNegacao = !temBotaoValido && /\b(nao|nunca)\b/.test(norm(entrada.texto));
      const e = (temNegacao ? 'nao_conhece' : escolher(entrada, OPC_RELACAO)) as DadosTriagem['relacao'] | null;
      if (!e) return { estado, dados, acoes: repetir(menuRelacao()) };
      return { estado: 'NOME', dados: { ...dados, relacao: e }, acoes: [texto('Qual é o seu nome?')] };
    }
    case 'NOME':
      if (!temLetras(livre, 2)) return { estado, dados, acoes: [texto('Pode me dizer o seu nome?')] };
      return { estado: 'CIDADE', dados: { ...dados, nome: livre.slice(0, 80) }, acoes: [texto(`Prazer, ${livre.slice(0, 80)}! De qual cidade você está falando?`)] };
    case 'CIDADE':
      if (!temLetras(livre, 2)) return { estado, dados, acoes: [texto('De qual cidade você está falando?')] };
      return { estado: 'CNPJ', dados: { ...dados, cidade: livre.slice(0, 80) }, acoes: [texto(PEDIR_CNPJ)] };
    case 'CNPJ': {
      const cnpj = extrairCnpj(livre);
      if (!cnpj || !cnpjValido(cnpj)) {
        return { estado, dados, acoes: [texto('Esse CNPJ não parece válido. 🤔 Confira e digite os 14 números do CNPJ da empresa.')] };
      }
      const consulta = await deps.consultarCnpj(cnpj);
      if (consulta.status === 'nao_encontrado') {
        return { estado, dados, acoes: [texto('Não encontramos esse CNPJ na Receita Federal. Confira e digite novamente, por favor.')] };
      }
      if (consulta.status === 'indisponivel') {
        return finalQualificado({ ...dados, cnpj, receita: null, receita_fonte: null }, deps);
      }
      const r = consulta.dados;
      const nomeEmpresa = r.nome_fantasia || r.razao_social || 'sua empresa';
      const local = [r.municipio, r.uf].filter(Boolean).join('/');
      return {
        estado: 'CNPJ_CONFIRMA',
        dados: { ...dados, cnpj, receita: r, receita_fonte: consulta.fonte },
        acoes: [{ tipo: 'menu', menu: { modo: 'button', texto: `É a *${nomeEmpresa}*${local ? `, de *${local}*` : ''}?`, opcoes: OPC_CONFIRMA, rodape: RODAPE } }],
      };
    }
    case 'CNPJ_CONFIRMA': {
      // Negação como palavra isolada ("não está certo") vence o apelido "certo"; clique em botão vence o texto.
      const temBotaoValidoC = !!(entrada.botaoId && OPC_CONFIRMA.some(o => o.id === entrada.botaoId));
      const temNegacaoC = !temBotaoValidoC && /\b(nao|errad[oa]?)\b/.test(norm(entrada.texto));
      const e = temNegacaoC ? 'cnpj_nao' : escolher(entrada, OPC_CONFIRMA);
      if (e === 'cnpj_sim') return finalQualificado(dados, deps);
      if (e === 'cnpj_nao') {
        const { cnpj: _c, receita: _r, receita_fonte: _f, ...resto } = dados;
        return { estado: 'CNPJ', dados: resto, acoes: [texto(`Tudo bem! ${PEDIR_CNPJ}`)] };
      }
      const r = dados.receita;
      const nomeEmpresa = r?.nome_fantasia || r?.razao_social || 'sua empresa';
      return { estado, dados, acoes: repetir({ tipo: 'menu', menu: { modo: 'button', texto: `É a *${nomeEmpresa}*?`, opcoes: OPC_CONFIRMA, rodape: RODAPE } }) };
    }
    case 'FIM':
    default:
      return { estado: 'FIM', dados, acoes: [] };
  }
}
