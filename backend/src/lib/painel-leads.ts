// Painel de Leads da Laya (pedido da Jessica, 13/11/2026): por qual canal os leads chegam, até onde vão no funil,
// quanto convertem, quem está rendendo e o que precisa melhorar. Regras puras (sem banco), testadas em
// tests/painel-leads.test.ts. A Laya mede; a Vitória decide com isso; o Rafael explica o porquê do gargalo.

/** Etapas do funil, em ordem. Cada lead conta em todas as etapas até a mais longe que alcançou. */
export const ETAPAS = [
  { k: 'chegaram', r: 'Chegaram' },
  { k: 'contatados', r: 'Receberam contato' },
  { k: 'responderam', r: 'Responderam' },
  { k: 'interessados', r: 'Interessados' },
  { k: 'demonstracoes', r: 'Demonstração' },
  { k: 'propostas', r: 'Proposta' },
  { k: 'contratos', r: 'Contrato' },
] as const;
export type EtapaId = typeof ETAPAS[number]['k'];
export type Contagem = Record<EtapaId, number> & { valor: number; perdidos: number; sem_contato: number };

/** O que se sabe de um lead, já lido do banco. */
export type LeadMedido = {
  canal: string; campanha: string; criado: Date;
  contatado: boolean; respondeu: boolean; interessado: boolean; demo: boolean; proposta: boolean; contrato: boolean;
  valor: number; perdido: boolean; agente: string | null; horas_ate_contato: number | null; temperatura: string | null;
};

/** Até que etapa o lead chegou (índice em ETAPAS). Etapa mais adiante implica as anteriores. */
export function etapaAlcancada(l: Pick<LeadMedido, 'contatado' | 'respondeu' | 'interessado' | 'demo' | 'proposta' | 'contrato'>): number {
  if (l.contrato) return 6;
  if (l.proposta) return 5;
  if (l.demo) return 4;
  if (l.interessado) return 3;
  if (l.respondeu) return 2;
  if (l.contatado) return 1;
  return 0;
}

export function vazia(): Contagem {
  return { chegaram: 0, contatados: 0, responderam: 0, interessados: 0, demonstracoes: 0, propostas: 0, contratos: 0, valor: 0, perdidos: 0, sem_contato: 0 };
}

/** Soma os leads no funil. `agora` serve para "sem contato": só conta quem chegou há mais de 48 horas. */
export function contar(leads: LeadMedido[], agora: Date): Contagem {
  const c = vazia();
  for (const l of leads) {
    const e = etapaAlcancada(l);
    ETAPAS.forEach((et, i) => { if (e >= i) c[et.k]++; });
    if (l.contrato) c.valor += l.valor || 0;
    if (l.perdido) c.perdidos++;
    if (e === 0 && agora.getTime() - l.criado.getTime() > 48 * 3600e3) c.sem_contato++;
  }
  c.valor = Math.round(c.valor);
  return c;
}

export const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** Funil com a passagem de uma etapa para a seguinte e o gargalo (a pior passagem com volume). */
export function funil(c: Contagem) {
  const etapas = ETAPAS.map((e, i) => ({
    k: e.k, rotulo: e.r, n: c[e.k],
    do_total: pct(c[e.k], c.chegaram),
    da_anterior: i === 0 ? null : pct(c[e.k], c[ETAPAS[i - 1].k]),
  }));
  let gargalo: { de: string; para: string; taxa: number; perdidos: number } | null = null;
  for (let i = 1; i < etapas.length; i++) {
    const ant = etapas[i - 1], at = etapas[i];
    if (ant.n < 5 || at.da_anterior === null) continue;
    if (!gargalo || at.da_anterior < gargalo.taxa) gargalo = { de: ant.rotulo, para: at.rotulo, taxa: at.da_anterior, perdidos: ant.n - at.n };
  }
  return { etapas, gargalo };
}

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
};

export type LinhaCanal = Contagem & {
  canal: string; parte: number | null; resposta: number | null; conversao: number | null; ate_demo: number | null;
  horas_ate_contato: number | null; campanhas: { campanha: string; chegaram: number; responderam: number; demonstracoes: number; contratos: number }[];
};

/** Uma linha por canal, com as taxas e as campanhas de dentro. Ordena por contratos, depois propostas, depois volume. */
export function porCanal(leads: LeadMedido[], agora: Date): LinhaCanal[] {
  const grupos = new Map<string, LeadMedido[]>();
  for (const l of leads) grupos.set(l.canal, [...(grupos.get(l.canal) || []), l]);
  const total = leads.length;
  return [...grupos.entries()].map(([canal, ls]) => {
    const c = contar(ls, agora);
    const camps = new Map<string, LeadMedido[]>();
    for (const l of ls) camps.set(l.campanha, [...(camps.get(l.campanha) || []), l]);
    return {
      ...c, canal, parte: pct(ls.length, total),
      resposta: pct(c.responderam, c.contatados), conversao: pct(c.contratos, c.chegaram), ate_demo: pct(c.demonstracoes, c.chegaram),
      horas_ate_contato: mediana(ls.map(l => l.horas_ate_contato).filter((h): h is number => h !== null && h >= 0)),
      campanhas: [...camps.entries()].map(([campanha, xs]) => { const k = contar(xs, agora); return { campanha, chegaram: k.chegaram, responderam: k.responderam, demonstracoes: k.demonstracoes, contratos: k.contratos }; })
        .sort((a, b) => b.contratos - a.contratos || b.chegaram - a.chegaram),
    };
  }).sort((a, b) => b.contratos - a.contratos || b.propostas - a.propostas || b.chegaram - a.chegaram);
}

/** Desempenho dos agentes de primeiro contato (Caroline, Julio, Luiz Felipe...) sobre os leads do período. */
export function porAgente(leads: LeadMedido[], agora: Date) {
  const g = new Map<string, LeadMedido[]>();
  for (const l of leads) if (l.agente) g.set(l.agente, [...(g.get(l.agente) || []), l]);
  return [...g.entries()].map(([agente, ls]) => {
    const c = contar(ls, agora);
    return { agente, leads: c.chegaram, contatados: c.contatados, responderam: c.responderam, interessados: c.interessados, demonstracoes: c.demonstracoes, contratos: c.contratos, resposta: pct(c.responderam, c.contatados), ate_demo: pct(c.demonstracoes, c.responderam) };
  }).sort((a, b) => b.leads - a.leads);
}

export type PropostaMedida = { vendedor: string | null; fechada: boolean; valor: number };
/** Propostas e contratos por vendedora no período. */
export function porVendedora(ps: PropostaMedida[]) {
  const g = new Map<string, { vendedora: string; propostas: number; contratos: number; valor: number }>();
  for (const p of ps) {
    const k = (p.vendedor || 'Sem vendedora').trim() || 'Sem vendedora';
    const r = g.get(k) || { vendedora: k, propostas: 0, contratos: 0, valor: 0 };
    r.propostas++;
    if (p.fechada) { r.contratos++; r.valor += p.valor || 0; }
    g.set(k, r);
  }
  return [...g.values()].map(r => ({ ...r, valor: Math.round(r.valor), fechamento: pct(r.contratos, r.propostas) })).sort((a, b) => b.contratos - a.contratos || b.propostas - a.propostas);
}

/** Semana (segunda) de uma data, no fuso de São Paulo, como "AAAA-MM-DD". */
export function segundaDe(d: Date): string {
  const sp = new Date(d.getTime() - 3 * 3600e3);
  const dow = (sp.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() - dow)).toISOString().slice(0, 10);
}

/** Leads por semana de chegada: quantos chegaram, responderam, viraram demonstração e contrato. */
export function porSemana(leads: LeadMedido[], agora: Date) {
  const g = new Map<string, LeadMedido[]>();
  for (const l of leads) { const s = segundaDe(l.criado); g.set(s, [...(g.get(s) || []), l]); }
  return [...g.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([semana, ls]) => {
    const c = contar(ls, agora);
    return { semana, chegaram: c.chegaram, responderam: c.responderam, demonstracoes: c.demonstracoes, contratos: c.contratos };
  });
}

// ───────────── Motivos de perda ─────────────

export const MOTIVOS: Record<string, string> = {
  JA_TEM_FORNECEDOR: 'Já tem sistema / fechou com outro',
  PRECO: 'Preço',
  SEM_INTERESSE: 'Sem interesse agora',
  SEM_RESPOSTA: 'Parou de responder',
  NAO_E_O_PERFIL: 'Fora do perfil',
  JA_CLIENTE: 'Já é cliente Prosystem',
  OUTRO: 'Outro motivo',
  SEM_MOTIVO: 'Sem motivo anotado',
};

/** Categoria do motivo de perda. O agente grava "CATEGORIA: texto"; a pessoa escreve livre. */
export function categoriaPerda(motivo: string | null | undefined): keyof typeof MOTIVOS {
  const m = String(motivo || '').trim();
  if (!m) return 'SEM_MOTIVO';
  const pref = m.match(/^([A-Z_]{4,}):/)?.[1];
  const t = m.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/ja (e|sou) cliente|ja (tem|usa|trabalha com) (a |o )?prosystem|prosystem instalado/.test(t)) return 'JA_CLIENTE';
  if (pref && pref in MOTIVOS) return pref as keyof typeof MOTIVOS;
  if (/preco|caro|valor|custo|financeir|dinheiro/.test(t)) return 'PRECO';
  if (/concorrente|outro sistema|ja (tem|usa|contratou|fechou)|fornecedor|permanecer|continuar com/.test(t)) return 'JA_TEM_FORNECEDOR';
  if (/sem resposta|nao responde|parou de responder|sumiu|nao retorn/.test(t)) return 'SEM_RESPOSTA';
  if (/sem interesse|nao (quer|tem interesse)|agora nao|depois/.test(t)) return 'SEM_INTERESSE';
  if (/perfil|nao e farmacia|nao e padaria|fechou a loja|encerrou|nao atende/.test(t)) return 'NAO_E_O_PERFIL';
  return 'OUTRO';
}

export function motivosDePerda(motivos: (string | null)[]) {
  const g = new Map<string, number>();
  for (const m of motivos) { const k = categoriaPerda(m); g.set(k, (g.get(k) || 0) + 1); }
  const total = motivos.length;
  return [...g.entries()].map(([id, n]) => ({ id, rotulo: MOTIVOS[id], n, parte: pct(n, total) })).sort((a, b) => b.n - a.n);
}

// ───────────── O que melhorar ─────────────

export type Melhoria = { nivel: 'alta' | 'media' | 'info'; titulo: string; detalhe: string; quem: string };

/**
 * Pontos de melhoria por regra, do mais urgente ao menos. Quem mede é a Laya; `quem` diz quem age.
 * Sem IA: os números mandam. A explicação do porquê fica com o Rafael (leitura das conversas).
 */
export function oQueMelhorar(p: {
  atual: Contagem; anterior: Contagem; canais: LinhaCanal[]; perdas: ReturnType<typeof motivosDePerda>; dias: number;
}): Melhoria[] {
  const out: Melhoria[] = [];
  const { atual, anterior, canais, perdas, dias } = p;
  const f = funil(atual);

  for (const c of canais) {
    if (c.chegaram >= 30 && c.demonstracoes === 0) {
      out.push({ nivel: 'alta', quem: c.canal.includes('Heitor') ? 'Heitor, Caroline e Rafael' : 'Rafael',
        titulo: `${c.canal}: muito lead e nenhuma demonstração`,
        detalhe: `${c.chegaram} leads em ${dias} dias (${c.parte ?? 0}% do total), ${c.responderam} responderam, ${c.interessados} se interessaram e nenhum chegou à demonstração. Antes de trazer mais, é preciso descobrir por que a conversa não avança (o Rafael lê as conversas).` });
    } else if (c.contatados >= 30 && (c.resposta ?? 100) < 15) {
      out.push({ nivel: 'media', quem: 'Rafael e o agente do primeiro contato', titulo: `${c.canal}: poucos respondem`,
        detalhe: `Só ${c.resposta}% de quem recebeu contato respondeu (${c.responderam} de ${c.contatados}). Vale testar outra mensagem de abertura ou outro horário.` });
    }
  }

  if (atual.sem_contato >= 10 || (atual.chegaram >= 20 && atual.sem_contato / atual.chegaram >= 0.2)) {
    out.push({ nivel: 'alta', quem: 'Vitória, Heitor e Caroline', titulo: `${atual.sem_contato} leads sem nenhum contato há mais de 2 dias`,
      detalhe: `${pct(atual.sem_contato, atual.chegaram)}% dos leads que chegaram. Lead que não recebe contato esfria. Chegam mais leads do que o limite seguro de primeiros contatos do WhatsApp deixa chamar: priorize os de melhor perfil e ajuste o ritmo da captação, sem aumentar o limite (proteção do número).` });
  }

  for (const c of canais) {
    if (c.contatados >= 20 && (c.horas_ate_contato ?? 0) > 72) {
      out.push({ nivel: 'media', quem: 'Vitória e Caroline', titulo: `${c.canal}: demora ${Math.round((c.horas_ate_contato ?? 0) / 24)} dias até o primeiro contato`,
        detalhe: 'Metade dos leads desse canal espera mais que isso. Quanto mais tempo, menos gente responde: chame primeiro os que acabaram de chegar.' });
    }
  }

  const intSemDemo = atual.interessados - atual.demonstracoes;
  if (intSemDemo >= 3) {
    out.push({ nivel: 'alta', quem: 'Caroline, Lurdinha e vendedoras', titulo: `${intSemDemo} interessados sem demonstração`,
      detalhe: `${atual.interessados} leads mostraram interesse e só ${atual.demonstracoes} chegaram à demonstração. Ofereça horário fechado ("amanhã às 10h ou às 15h?") em vez de perguntar se querem.` });
  }

  if (atual.propostas >= 3 && (pct(atual.contratos, atual.propostas) ?? 0) < 25) {
    out.push({ nivel: 'media', quem: 'Luiz Felipe e vendedoras', titulo: 'Propostas que não fecham',
      detalhe: `${atual.propostas} propostas e ${atual.contratos} contratos (${pct(atual.contratos, atual.propostas) ?? 0}%). Retome as propostas abertas com uma condição de fechamento e prazo.` });
  }

  const comVenda = canais.filter(c => c.contratos > 0 && c.chegaram >= 2).sort((a, b) => (b.conversao ?? 0) - (a.conversao ?? 0));
  const melhor = comVenda[0];
  if (melhor && (melhor.parte ?? 0) < 10) {
    out.push({ nivel: 'media', quem: 'Vitória', titulo: `${melhor.canal} vende e recebe pouco esforço`,
      detalhe: `Converte ${melhor.conversao}% (${melhor.contratos} de ${melhor.chegaram}), mas é só ${melhor.parte}% dos leads. Vale pôr mais esforço nesse canal.` });
  }

  const topPerda = perdas.find(x => x.id !== 'SEM_MOTIVO');
  const totalPerdas = perdas.reduce((s, x) => s + x.n, 0);
  if (topPerda && topPerda.n >= 3 && (topPerda.parte ?? 0) >= 40) {
    out.push({ nivel: 'media', quem: 'Rafael', titulo: `Principal motivo de perda: ${topPerda.rotulo.toLowerCase()}`,
      detalhe: `${topPerda.n} de ${totalPerdas} perdas (${topPerda.parte}%). Prepare a resposta para essa objeção e entre antes no assunto.` });
  }
  const semMotivo = perdas.find(x => x.id === 'SEM_MOTIVO');
  if (semMotivo && semMotivo.n >= 3) {
    out.push({ nivel: 'info', quem: 'vendedoras', titulo: `${semMotivo.n} perdas sem motivo anotado`,
      detalhe: 'Sem o motivo não dá para corrigir o processo. Ao marcar como perdido, escreva o porquê.' });
  }

  if (anterior.chegaram >= 20 && atual.chegaram < anterior.chegaram * 0.7) {
    out.push({ nivel: 'media', quem: 'Vitória e Heitor', titulo: 'Chegaram menos leads que no período anterior',
      detalhe: `${atual.chegaram} contra ${anterior.chegaram} nos ${dias} dias anteriores.` });
  }
  if (anterior.contratos >= 2 && atual.contratos < anterior.contratos) {
    out.push({ nivel: 'media', quem: 'Vitória', titulo: 'Menos contratos que no período anterior',
      detalhe: `${atual.contratos} contra ${anterior.contratos} nos ${dias} dias anteriores.` });
  }

  const semOrigem = canais.find(c => c.canal === 'Sem origem');
  if (semOrigem && (semOrigem.parte ?? 0) >= 10) {
    out.push({ nivel: 'info', quem: 'equipe', titulo: `${semOrigem.parte}% dos leads sem origem`,
      detalhe: 'Ao cadastrar um lead à mão, escolha de onde ele veio; senão o canal some da conta.' });
  }

  if (f.gargalo && !out.some(m => m.nivel === 'alta')) {
    out.push({ nivel: 'media', quem: 'Rafael', titulo: `Maior perda do funil: de "${f.gargalo.de}" para "${f.gargalo.para}"`,
      detalhe: `Só ${f.gargalo.taxa}% passam (${f.gargalo.perdidos} ficaram para trás).` });
  }

  const ordem = { alta: 0, media: 1, info: 2 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

/** Resumo em texto para a Vitória ler na reunião de segunda (curto, só números). */
export function resumoParaVitoria(p: { dias: number; atual: Contagem; anterior: Contagem; canais: LinhaCanal[]; melhorias: Melhoria[]; porque?: { resumo: string; acoes: string[] } | null }): string {
  const f = funil(p.atual);
  const linhas = [
    `Funil (${p.dias} dias; entre parênteses, os ${p.dias} dias anteriores): ${f.etapas.map(e => `${e.rotulo} ${e.n} (${p.anterior[e.k as EtapaId]})`).join(' → ')}. Valor fechado R$ ${p.atual.valor}.`,
    f.gargalo ? `Gargalo: de ${f.gargalo.de} para ${f.gargalo.para}, só ${f.gargalo.taxa}% passam.` : '',
    'Por canal:',
    ...p.canais.slice(0, 10).map(c => `- ${c.canal}: ${c.chegaram} leads (${c.parte}%), resposta ${c.resposta ?? '-'}%, ${c.interessados} interessados, ${c.demonstracoes} demos, ${c.propostas} propostas, ${c.contratos} contratos (conversão ${c.conversao ?? 0}%)`),
    p.melhorias.length ? 'O que melhorar (regras da Laya):' : '',
    ...p.melhorias.slice(0, 8).map(m => `- [${m.nivel}] ${m.titulo}: ${m.detalhe} (quem: ${m.quem})`),
    p.porque ? `Por que trava, segundo o Rafael: ${p.porque.resumo}${p.porque.acoes.length ? ` Ações: ${p.porque.acoes.join('; ')}` : ''}` : '',
  ];
  return linhas.filter(Boolean).join('\n');
}
