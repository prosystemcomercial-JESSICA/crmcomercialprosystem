// Termômetro da Laya (13/11/2026, pedido da Jessica: "a Laya mede sozinha as temperaturas").
// Puro, sem rede nem banco. A Laya decide a temperatura de cada lead dos SDRs sem esperar a
// confirmação da Jessica, com o método recomendado para pontuação de leads:
//  1) só o que o CLIENTE disse conta (robô da loja e o que o agente ofereceu não contam);
//  2) sinal negativo do cliente derruba para Frio;
//  3) pedido concreto do cliente (contrato, demonstração, preço) esquenta; demo marcada pelo agente
//     sem pedido do cliente é Morno (é como a Jessica confirma);
//  4) sem pedido concreto, vale a nota do agente (a Jessica confirmou 152 de 154 delas),
//     mas nunca acima de Morno (evita "esquentar" quem só conversou);
//  5) quem parou de responder esfria com o tempo.
// O palpite cru do modelo da Laya NÃO entra: em 13/11/2026 ele acertou 10 de 80 casos confirmados.

export type TemperaturaLead = 'FRIO' | 'MORNO' | 'QUENTE' | 'MUITO_QUENTE';
const ORDEM: TemperaturaLead[] = ['FRIO', 'MORNO', 'QUENTE', 'MUITO_QUENTE'];
export const NOME_TEMPERATURA: Record<TemperaturaLead, string> = { FRIO: 'Frio', MORNO: 'Morno', QUENTE: 'Quente', MUITO_QUENTE: 'Muito quente' };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[*_~]/g, ' ');

/** Fecha negócio: aceitou, pede contrato, pagamento ou instalação. */
const FECHAR = /\b(contrato|assinar|assino|forma de pagamento|como (eu )?pago|pode (mandar|enviar) o boleto|fechad[oa]|vamos fechar|quero fechar|fechar (o )?negocio|aceit(o|amos|ei) (a )?proposta|pode instalar|quando (voces )?(instala|instalam)|data (da|de) instalacao|agendar (a )?instalacao)\b/;
/** Pedido concreto: demonstração, proposta, preço, troca de sistema, prazo. */
const PEDIDO = /\b(demonstra\w*|apresenta(cao|r o sistema)|proposta|orcamento|quanto (custa|fica|sai)|qual (o |e o )?(valor|preco)|valores|preco|mensalidade|quero (trocar|mudar)|(trocar|mudar) de sistema|quero conhecer|quero ver o sistema)\b/;
// Fora de propósito: "semana que vem", "me liga", "marcar horário" costumam ser só o cliente aceitando a
// demo que o agente ofereceu; a Jessica confirma esses casos como Morno (validação de 13/11/2026).
/** Interesse ou dor contada pelo próprio cliente (morno). */
const INTERESSE = /\b(tenho interesse|temos interesse|me interessa|interessad[oa]|gostaria de (saber|conhecer|entender)|como funciona|problema|insatisfeit[oa]|lento|travando|trava muito|caro demais|nao gosto do (nosso |meu )?sistema|sistema (atual )?(e )?ruim|fiscal|estoque|sngpc|nota fiscal)\b/;
/** Sinal negativo do cliente. */
const NEGATIVO = /\b(nao (tenho|temos) interesse|sem interesse|nao (preciso|precisamos)|nao quero|nao queremos|ja (temos|tenho|uso|usamos) (um )?sistema|estamos satisfeit|satisfeit[oa]s? com (o|nosso)|nao (me )?(chame|ligue|mande)|pare de (mandar|enviar)|remov(a|er) (meu|o) (numero|contato)|descadastr|nao e (comigo|aqui)|aqui nao e|nao somos|nao trabalhamos com|nao,? obrigad[oa]|numero errado|engano)\b/;

/** Robô ou atendimento automático da loja que o filtro geral não pegou (boas-vindas, menu, transferência). */
const ROBO_LOJA = /(bem[ -]?vind[oa]|seja (muito )?bem|horario de funcionamento|digite (apenas )?o numero|digite \d|atendimento transferido|ja (irei|vou) (comecar|iniciar) (o |seu )?atendimento|(logo|ja) (iremos|vamos) (te )?atender|agradecemos (o|seu) contato|em que (posso|podemos) (te )?ajudar|grupo (exclusivo )?de ofertas|nos envie a receita|fa(ca|z) (o )?seu pedido|setor responsavel|foi um prazer (te )?atender|atendentes? human|transferisse|pelo nosso site|escolha uma (das )?opc|1️?⃣)/;
/** Mensagem automática ou de atendente da loja (não é o cliente falando com a Prosystem). */
export function ehRoboDaLoja(texto: string): boolean { return ROBO_LOJA.test(norm(texto)); }

/** Situações do agente em que não houve conversa possível. */
const SEM_CONTATO = ['SEM_WHATSAPP', 'ERRO_ENVIO'];

export type EntradaTermometro = {
  status: string;
  nota: number | null;
  temperaturaAgente: string | null;
  /** Só falas de pessoas do lado do cliente (sem robô da loja), da mais antiga à mais nova. */
  falasCliente: string[];
  ultimaFalaEm: Date | null;
  agora?: Date;
  /** Caso parecido já confirmado pela Jessica (memória da Laya). */
  memoria?: { rotulo: string; similaridade: number } | null;
};

export type VereditoTemperatura = { temperatura: TemperaturaLead; regra: string; motivo: string };

const DIAS_ESFRIAR = 21;
const SIMILARIDADE_MEMORIA = 0.6;

const valida = (t: string | null | undefined): t is TemperaturaLead => !!t && (ORDEM as string[]).includes(t);
const temperaturaDaNota = (n: number): TemperaturaLead => (n >= 80 ? 'MUITO_QUENTE' : n >= 60 ? 'QUENTE' : n >= 35 ? 'MORNO' : 'FRIO');

/** Esfria um nível se o cliente não fala há mais de 21 dias. */
function esfriar(v: VereditoTemperatura, e: EntradaTermometro): VereditoTemperatura {
  if (!e.ultimaFalaEm || v.temperatura === 'FRIO' || e.status === 'DEMO') return v;
  const dias = Math.floor(((e.agora || new Date()).getTime() - e.ultimaFalaEm.getTime()) / 864e5);
  if (dias <= DIAS_ESFRIAR) return v;
  const nova = ORDEM[ORDEM.indexOf(v.temperatura) - 1];
  return { temperatura: nova, regra: `${v.regra}+esfriou`, motivo: `${v.motivo}; esfriou porque o cliente não responde há ${dias} dias` };
}

export function vereditoTemperatura(e: EntradaTermometro): VereditoTemperatura {
  if (SEM_CONTATO.includes(e.status)) return { temperatura: 'FRIO', regra: 'sem_contato', motivo: 'não foi possível falar com o cliente pelo WhatsApp' };
  const falas = e.falasCliente.filter(f => f.trim() && !ehRoboDaLoja(f)).map(norm);
  if (!falas.length) return { temperatura: 'FRIO', regra: 'sem_resposta', motivo: 'o cliente ainda não respondeu (só o robô da loja ou nada)' };
  const recentes = falas.slice(-3).join(' \n ');
  const tudo = falas.join(' \n ');
  if (NEGATIVO.test(recentes)) return { temperatura: 'FRIO', regra: 'negativo', motivo: 'o cliente disse que não tem interesse ou já está atendido' };
  if (e.status === 'SEM_INTERESSE') return { temperatura: 'FRIO', regra: 'sem_interesse', motivo: 'a conversa terminou sem interesse' };
  if (FECHAR.test(tudo)) return esfriar({ temperatura: 'MUITO_QUENTE', regra: 'fechar', motivo: 'o cliente falou em contrato, pagamento ou instalação' }, e);
  if (PEDIDO.test(tudo)) return esfriar({ temperatura: 'QUENTE', regra: 'pedido', motivo: 'o cliente pediu demonstração, preço ou proposta, ou quer trocar de sistema' }, e);
  // Sem pedido concreto: memória (caso parecido confirmado pela Jessica) ou a nota do agente, no máximo Morno.
  let base: TemperaturaLead = valida(e.temperaturaAgente) ? e.temperaturaAgente : typeof e.nota === 'number' ? temperaturaDaNota(e.nota) : 'FRIO';
  let regra = 'nota_agente';
  let motivo = `segue a nota do agente (${e.nota ?? '—'})`;
  if (e.memoria && e.memoria.similaridade >= SIMILARIDADE_MEMORIA && valida(e.memoria.rotulo)) {
    base = e.memoria.rotulo; regra = 'memoria';
    motivo = `conversa parecida com uma que a Jessica confirmou como ${NOME_TEMPERATURA[base]}`;
  }
  if (ORDEM.indexOf(base) > ORDEM.indexOf('MORNO')) { base = 'MORNO'; motivo += '; sem pedido concreto do cliente, fica no máximo Morno'; }
  if (base === 'FRIO' && INTERESSE.test(tudo)) { base = 'MORNO'; regra = 'interesse'; motivo = 'o cliente contou um problema ou disse que tem interesse'; }
  // Demonstração marcada sem pedido do próprio cliente: a Jessica confirma como Morno (5 de 8 casos até 13/11).
  if (e.status === 'DEMO' && base === 'FRIO') { base = 'MORNO'; regra = 'demo'; motivo = 'demonstração marcada pelo agente, sem pedido concreto do cliente'; }
  if (e.status === 'DEMO') return { temperatura: base, regra, motivo };
  return esfriar({ temperatura: base, regra, motivo }, e);
}
