// Painel da IA (visão panorâmica do Escritório virtual): contas puras sobre as
// mensagens do WhatsApp. As consultas ao banco ficam em services/painel-ia.service.ts.

/** Nome técnico gravado em WhatsappMensagem.enviada_por → agente. O resto é pessoa (CRM, celular ou abertura manual). */
const ALIAS_AGENTE: Record<string, string> = { bot: 'bia', assistente_ia: 'clarice', cadencia_automatica: 'luiz_felipe' };
export const AGENTES_QUE_ENVIAM = ['bia', 'clarice', 'luiz_felipe', 'caroline', 'julio', 'lurdinha', 'helena', 'zequinha', 'otavio', 'marta', 'mila', 'heitor'];

export type Remetente = { tipo: 'agente'; agente: string } | { tipo: 'pessoa' };
export function remetenteDe(enviadaPor: string | null | undefined): Remetente {
  const k = (enviadaPor || '').trim();
  if (ALIAS_AGENTE[k]) return { tipo: 'agente', agente: ALIAS_AGENTE[k] };
  if (AGENTES_QUE_ENVIAM.includes(k)) return { tipo: 'agente', agente: k };
  return { tipo: 'pessoa' };
}

export type MsgPainel = { conversaId: string; direcao: string; enviada_por: string | null; status: string; created_at: Date };

const sp = (d: Date) => new Date(d.getTime() - 3 * 36e5); // São Paulo (sem horário de verão)
const diaSP = (d: Date) => sp(d).toISOString().slice(0, 10);
const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b), k = Math.floor(o.length / 2);
  return Math.round(o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2);
};

export function resumirMensagens(msgs: MsgPainel[]) {
  const ord = [...msgs].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const porConversa = new Map<string, MsgPainel[]>();
  for (const x of ord) { const l = porConversa.get(x.conversaId) || []; l.push(x); porConversa.set(x.conversaId, l); }

  let recebidas = 0, agentes = 0, pessoas = 0, falhas = 0;
  const mapa = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const dias = new Map<string, { dia: string; recebidas: number; agentes: number; pessoas: number }>();
  const por_agente: Record<string, { mensagens: number; conversas: number; responderam: number; falhas: number }> = {};

  for (const x of ord) {
    const dia = dias.get(diaSP(x.created_at)) || { dia: diaSP(x.created_at), recebidas: 0, agentes: 0, pessoas: 0 };
    if (x.direcao === 'ENTRADA') {
      recebidas++; dia.recebidas++;
      const h = sp(x.created_at); mapa[h.getUTCDay()][h.getUTCHours()]++;
    } else {
      const r = remetenteDe(x.enviada_por);
      if (r.tipo === 'agente') {
        agentes++; dia.agentes++;
        const a = por_agente[r.agente] ||= { mensagens: 0, conversas: 0, responderam: 0, falhas: 0 };
        a.mensagens++; if (x.status === 'FALHA') a.falhas++;
      } else { pessoas++; dia.pessoas++; }
      if (x.status === 'FALHA') falhas++;
    }
    dias.set(dia.dia, dia);
  }

  // Conversas por agente e se o cliente respondeu depois da 1ª mensagem do agente.
  const tAg: number[] = [], tPe: number[] = [];
  let semResposta = 0;
  for (const lista of porConversa.values()) {
    const primeiraDoAgente = new Map<string, number>();
    lista.forEach((x, i) => {
      if (x.direcao !== 'SAIDA') return;
      const r = remetenteDe(x.enviada_por);
      if (r.tipo === 'agente' && !primeiraDoAgente.has(r.agente)) primeiraDoAgente.set(r.agente, i);
    });
    for (const [ag, i] of primeiraDoAgente) {
      por_agente[ag].conversas++;
      if (lista.slice(i + 1).some(x => x.direcao === 'ENTRADA')) por_agente[ag].responderam++;
    }
    // 1ª resposta: primeira ENTRADA → primeira SAIDA depois dela.
    const iEnt = lista.findIndex(x => x.direcao === 'ENTRADA');
    if (iEnt >= 0) {
      const resp = lista.slice(iEnt + 1).find(x => x.direcao === 'SAIDA');
      if (!resp) semResposta++;
      else {
        const min = (resp.created_at.getTime() - lista[iEnt].created_at.getTime()) / 6e4;
        (remetenteDe(resp.enviada_por).tipo === 'agente' ? tAg : tPe).push(min);
      }
    }
  }

  const enviadas = agentes + pessoas;
  return {
    totais: { recebidas, enviadas_agentes: agentes, enviadas_pessoas: pessoas, automacao_pct: enviadas ? Math.round((agentes / enviadas) * 100) : 0, falhas, conversas: porConversa.size },
    por_agente,
    primeira_resposta: { agentes: { qtd: tAg.length, mediana_min: mediana(tAg) }, pessoas: { qtd: tPe.length, mediana_min: mediana(tPe) }, sem_resposta: semResposta },
    mapa,
    por_dia: [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

export function montarFunil(etapas: [string, number][]) {
  const topo = etapas[0]?.[1] || 0;
  return etapas.map(([etapa, valor], i) => {
    const ant = i ? etapas[i - 1][1] : 0;
    return {
      etapa, valor,
      // Etapa maior que a anterior (ex.: propostas de outros canais): a passagem não faz sentido.
      da_anterior_pct: i && ant && valor <= ant ? Math.round((valor / ant) * 100) : null,
      do_topo_pct: topo ? Math.round((valor / topo) * 100) : null,
    };
  });
}
