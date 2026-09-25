// Escritório virtual: os agentes do assistente como "funcionários". Puro:
// cadastro dos agentes, status a partir da última ação e registro em memória
// das ações que não ficam gravadas no banco (comandos e avisos da gestão).

export const AGENTES = [
  { id: 'bia', nome: 'Bia', funcao: 'Recepção · triagem de novos contatos', cor: '#e11d74' },
  { id: 'lurdinha', nome: 'Lurdinha', funcao: 'Agenda · demonstrações e lembretes', cor: '#f59e0b' },
  { id: 'clarice', nome: 'Clarice', funcao: 'Tira-dúvidas com IA e transcrição', cor: '#8b5cf6' },
  { id: 'luiz_felipe', nome: 'Luiz Felipe', funcao: 'Follow-up de propostas', cor: '#2563eb' },
  { id: 'zequinha', nome: 'Zequinha', funcao: 'Campanhas pelo WhatsApp', cor: '#16a34a' },
  { id: 'helena', nome: 'Helena', funcao: 'Pós-venda · boas-vindas e pesquisa', cor: '#0891b2' },
  { id: 'laya', nome: 'Laya', funcao: 'IA que analisa conversas e aprende', cor: '#db2777' },
  { id: 'marta', nome: 'Marta', funcao: 'Assistente da gestão · comandos e avisos', cor: '#7c3aed' },
  { id: 'sofia', nome: 'Sofia', funcao: 'Pesquisadora · assuntos do setor e novidades', cor: '#ea580c' },
] as const;
export type AgenteId = typeof AGENTES[number]['id'];
export type StatusAgente = 'trabalhando' | 'parado' | 'desligado';

export const MINUTOS_TRABALHANDO = 10;

export function statusAgente(ligado: boolean, ultimaEm: Date | null, agora: Date): StatusAgente {
  if (!ligado) return 'desligado';
  if (ultimaEm && agora.getTime() - ultimaEm.getTime() <= MINUTOS_TRABALHANDO * 60000) return 'trabalhando';
  return 'parado';
}

/** Mais recente entre duas ações (qualquer uma pode faltar). */
export function maisRecente<T extends { em: Date } | null>(a: T, b: T): T {
  if (!a) return b;
  if (!b) return a;
  return a.em >= b.em ? a : b;
}

// Registro em memória (reinicia com o servidor): ações sem rastro no banco.
const registro = new Map<AgenteId, { texto: string; em: Date }>();
export function registrarAcaoAgente(agente: AgenteId, texto: string, em = new Date()) {
  registro.set(agente, { texto: texto.slice(0, 140), em });
}
export const acaoRegistrada = (agente: AgenteId) => registro.get(agente) || null;
