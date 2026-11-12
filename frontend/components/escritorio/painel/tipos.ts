// Dados de GET /assistente/escritorio/painel (escritório por setores, 10/11/2026).

export type StatusAgente = 'trabalhando' | 'parado' | 'desligado' | 'erro';
export type Setor = { id: string; nome: string; agentes: string[] };
export type Provedor = { provedor: string; estado: 'sem_chave' | 'ok' | 'pausado' | 'sem_uso'; volta_em_min: number; ultimo_erro: string | null; ultima_ok: string | null; ultima_falha: string | null };
export type Quadro = {
  id: string; setor: string; erro: string | null; precisa_de_voce: string | null;
  recebe_de: string[]; entrega_para: string[];
  mensagens: { hoje: number; d7: number; d30: number } | null;
  qualidade: { sozinha: number; aprovada: number; editada: number; descartada: number; segurada_laya: number; esperando: number } | null;
  ia_mes: { chamadas: number; falhas: number; brl: number };
};
export type Passagem = { de: string; para: string; tipo: 'passa' | 'orienta'; rotulo: string; hoje: number | null };
export type ItemEsperando = { id: string; tipo: 'mensagem' | 'pergunta' | 'documento'; agente: string; painel: string; titulo: string; detalhe: string; em: string };
export type Consumo = {
  mes: string; brl: number; previsao: number; teto: number; usado: number; nivel: 'sem_teto' | 'ok' | 'atencao' | 'estourou'; previsao_estoura: boolean;
  por_dia: { dia: string; chamadas: number; falhas: number; brl: number }[];
  por_agente: Record<string, { chamadas: number; falhas: number; brl: number }>;
  falhas_provedor: ({ dia: string } & Record<string, number | string>)[];
  /** Motivos das falhas no mês, por agente (gravados desde 12/11/2026). */
  erros_por_agente?: Record<string, { provedor: string; motivo: string; texto: string; n: number; primeiro: string; ultimo: string; exemplo: string; modelo?: string; dias: number }[]>;
  cotacao: number;
};
export type Painel = {
  setores: Setor[];
  saude: {
    agentes: { total: number; ligados: number; com_erro: { id: string; nome: string; motivo: string }[] };
    ias: { total: number; com_falha: Provedor[]; provedores: Provedor[] };
    whatsapp: { total: number; conectados: number; desconectados: string[] };
    esperando: number;
  };
  quadros: Quadro[]; passagens: Passagem[]; esperando: ItemEsperando[]; consumo: Consumo;
};
export type AgenteTela = {
  id: string; nome: string; funcao: string; cor: string; status: StatusAgente;
  ultima: { texto: string; em: string } | null; numeros: { rotulo: string; valor: number | string }[]; observacao?: string;
};

export const NOME_PROVEDOR: Record<string, string> = { groq: 'Groq', openrouter: 'OpenRouter', openai: 'OpenAI', grok: 'Grok', gemini: 'Gemini' };
export const ROTULO_STATUS: Record<StatusAgente, string> = { trabalhando: 'Trabalhando agora', parado: 'Parado', desligado: 'Desligado', erro: 'Com erro' };
export const COR_STATUS: Record<StatusAgente, string> = { trabalhando: '#16a34a', parado: '#ca8a04', desligado: '#64748b', erro: '#dc2626' };
export const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const haQuanto = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
