/**
 * Agenda do técnico (12/11/2026, pedido da Jessica): reuniões, ligações, acessos remotos e visitas que o técnico
 * marca com o cliente, pelo menu Agenda do Portal Técnico ou dentro do card do cliente. Na hora escolhida o técnico
 * recebe o alerta no WhatsApp dele (e no sino do portal). Regras puras, sem banco, para os testes.
 *
 * Nada aqui fala com o cliente: o alerta é só para o técnico (o número da empresa não manda nada ao cliente).
 */

export const TIPOS_COMPROMISSO: Record<string, { label: string; emoji: string }> = {
  REUNIAO: { label: 'Reunião', emoji: '🤝' },
  LIGACAO: { label: 'Ligação', emoji: '📞' },
  ACESSO_REMOTO: { label: 'Acesso remoto', emoji: '💻' },
  VISITA: { label: 'Visita', emoji: '🚗' },
  TREINAMENTO: { label: 'Treinamento', emoji: '🎓' },
  OUTRO: { label: 'Outro', emoji: '📌' },
};

/** Quando avisar, em minutos antes do horário. 0 = na hora. */
export const ANTECEDENCIAS_MIN = [0, 5, 15, 30, 60, 120, 1440] as const;
export const ROTULO_ANTECEDENCIA: Record<number, string> = {
  0: 'Na hora', 5: '5 min antes', 15: '15 min antes', 30: '30 min antes', 60: '1 hora antes', 120: '2 horas antes', 1440: '1 dia antes',
};

/** Se o servidor ficou parado, o alerta ainda sai até este tempo depois do horário do compromisso. Depois, não. */
export const JANELA_ATRASO_MIN = 60;

export const STATUS_COMPROMISSO = ['AGENDADO', 'REALIZADO', 'CANCELADO'] as const;

type ParaAlerta = { status: string; alerta_em: Date | null; inicio: Date; avisar_antes_min: number };

export const momentoDoAlerta = (c: { inicio: Date; avisar_antes_min: number }) =>
  new Date(c.inicio.getTime() - (c.avisar_antes_min || 0) * 60000);

export function alertaDevido(c: ParaAlerta, agora: Date): boolean {
  if (c.status !== 'AGENDADO' || c.alerta_em) return false;
  if (agora.getTime() < momentoDoAlerta(c).getTime()) return false;
  return agora.getTime() <= c.inicio.getTime() + JANELA_ATRASO_MIN * 60000;
}

/** Mensagem de erro (para a tela) ou null se está tudo certo. */
export function validarCompromisso(c: { titulo?: string | null; inicio: Date; tipo?: string | null; avisar_antes_min?: number | null; duracao_min?: number | null }, agora: Date): string | null {
  if (!String(c.titulo || '').trim()) return 'Escreva o assunto do compromisso.';
  if (!(c.inicio instanceof Date) || isNaN(c.inicio.getTime())) return 'Escolha a data e a hora.';
  if (c.inicio.getTime() < agora.getTime() - 5 * 60000) return 'Esse horário já passou. Escolha um horário futuro.';
  if (c.tipo && !TIPOS_COMPROMISSO[c.tipo]) return 'Tipo de compromisso desconhecido.';
  if (c.avisar_antes_min != null && !(ANTECEDENCIAS_MIN as readonly number[]).includes(c.avisar_antes_min)) return 'Escolha quando receber o aviso.';
  if (c.duracao_min != null && (c.duracao_min < 5 || c.duracao_min > 12 * 60)) return 'Duração entre 5 minutos e 12 horas.';
  return null;
}

const horaSP = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const dataSP = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit' });

/** Texto do alerta. O "quando" conta o que falta de verdade (marcado em cima da hora não diz "amanhã"). */
export function textoAlertaCompromisso(c: {
  inicio: Date; avisar_antes_min: number; tipo?: string | null; titulo: string; cliente_nome?: string | null;
  contato_nome?: string | null; contato_fone?: string | null; link?: string | null; descricao?: string | null;
}, linkPortal: string, agora: Date = momentoDoAlerta(c)): string {
  const tipo = TIPOS_COMPROMISSO[c.tipo || 'OUTRO'] || TIPOS_COMPROMISSO.OUTRO;
  const falta = Math.round((c.inicio.getTime() - agora.getTime()) / 60000);
  const mesmoDia = c.inicio.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) === agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const quando = falta <= 1 ? `*agora*, ${horaSP(c.inicio)}`
    : falta < 60 ? `às ${horaSP(c.inicio)} (daqui a ${falta} min)`
    : mesmoDia ? `hoje às ${horaSP(c.inicio)} (daqui a ${Math.floor(falta / 60)}h${falta % 60 ? String(falta % 60).padStart(2, '0') : ''})`
    : `${dataSP(c.inicio)} às ${horaSP(c.inicio)}`;
  const linhas = [
    `${tipo.emoji} ${tipo.label}${c.cliente_nome ? ` com *${c.cliente_nome}*` : ''} ${quando}`,
    `Assunto: ${c.titulo.trim()}`,
    c.contato_nome || c.contato_fone ? `Contato: ${[c.contato_nome, c.contato_fone].filter(Boolean).join(' · ')}` : '',
    c.link ? `Link: ${c.link}` : '',
    c.descricao ? `Anotação: ${c.descricao.trim().slice(0, 400)}` : '',
  ].filter(Boolean);
  return [...linhas, '', `Abrir a agenda: ${linkPortal}`].join('\n');
}
