// Fase "Interessados" do Kanban do WhatsApp: contato com interesse que está conversando.
// Puro (sem banco): a regra fica testável e o serviço só busca os dados.

export const DIAS_INTERAGINDO = 7;
const TIPOS_FORA = ['CLIENTE', 'EQUIPE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO', 'TERCEIRO_CLIENTE'];
const ETIQUETAS_FORA = /equipe|prosystem|parceir|fornecedor|suporte|financeiro|cliente|pessoal/i;
const TEMPERATURAS_INTERESSE = ['MORNO', 'QUENTE', 'MUITO_QUENTE'];

export type ConversaInteresse = {
  estagio_funil: string; finalizada_em?: Date | null; optout_campanhas?: boolean | null;
  tipo_contato?: string | null; etiqueta?: string | null; ia_sugestao?: any;
  lead_temperatura?: string | null; ultima_entrada?: Date | null;
};

/** Sinais de interesse: Laya viu intenção de comprar, qualificou quente/morno, ou o lead está morno para cima. */
export function sinaisDeInteresse(c: ConversaInteresse): string[] {
  const s: string[] = [];
  const ia = c.ia_sugestao || {};
  if (ia.intencao === 'comprar') s.push('quer comprar');
  if (['quente', 'morno'].includes(String(ia.qualificacao || '').toLowerCase())) s.push(`qualificação ${String(ia.qualificacao).toLowerCase()}`);
  if (TEMPERATURAS_INTERESSE.includes(String(ia.temperatura || '').toUpperCase())) s.push(`temperatura ${String(ia.temperatura).toLowerCase()}`);
  if (TEMPERATURAS_INTERESSE.includes(String(c.lead_temperatura || '').toUpperCase())) s.push(`lead ${String(c.lead_temperatura).toLowerCase()}`);
  return s;
}

/** Vai para "Interessados"? Só sai de "Novo Contato" (nunca puxa quem a equipe já moveu). */
export function deveIrParaInteressados(c: ConversaInteresse, agora = new Date()): boolean {
  if (c.estagio_funil !== 'NOVO_CONTATO') return false;
  if (c.finalizada_em || c.optout_campanhas) return false;
  if (c.tipo_contato && TIPOS_FORA.includes(c.tipo_contato)) return false;
  if (c.etiqueta && ETIQUETAS_FORA.test(c.etiqueta)) return false;
  if (!c.ultima_entrada || agora.getTime() - c.ultima_entrada.getTime() > DIAS_INTERAGINDO * 864e5) return false;
  return sinaisDeInteresse(c).length > 0;
}
