import { PrismaClient } from '@prisma/client';
import { limitesPeriodo, partesNoFuso } from '@/lib/painel-tv';

/**
 * TV DO ESCRITÓRIO — tela 3: captação de leads.
 * Hoje e acumulado do mês (dia 1 ao último), por fonte (Heitor x campanha x WhatsApp x outros),
 * por região, funil do Heitor e retorno efetivo dos primeiros contatos (quem respondeu, qualificou, marcou demo).
 */

export type Fonte = 'heitor' | 'campanha' | 'whatsapp' | 'outros';
const FONTES: Fonte[] = ['heitor', 'campanha', 'whatsapp', 'outros'];

export function fonteDoLead(l: { created_by: string | null; campanha_nome: string | null; utm_source: string | null; origem: string | null }): Fonte {
  if (l.created_by === 'heitor' || l.utm_source === 'google_maps') return 'heitor';
  if (l.campanha_nome || /facebook|instagram|meta|ads/i.test(l.utm_source || '')) return 'campanha';
  if ((l.origem || '').toUpperCase() === 'WHATSAPP') return 'whatsapp';
  return 'outros';
}

const vazio = () => ({ heitor: 0, campanha: 0, whatsapp: 0, outros: 0 });
const regiao = (cidade: string | null, uf: string | null) => (cidade ? `${cidade.trim()}${uf ? `/${uf.trim().toUpperCase()}` : ''}` : uf ? uf.trim().toUpperCase() : 'Sem cidade');

export async function montarCaptacao(prisma: PrismaClient, agora = new Date()) {
  const { inicioHoje, fimHoje, inicioMes, fimMes } = limitesPeriodo(agora);
  const hojeP = partesNoFuso(agora);
  const diasNoMes = new Date(Date.UTC(hojeP.ano, hojeP.mes, 0)).getUTCDate();

  // ── Leads do mês (uma consulta; o resto é agrupamento) ───────────────────
  const leads = await prisma.lead.findMany({
    where: { deleted_at: null, created_at: { gte: inicioMes, lt: fimMes } } as any,
    select: { id: true, nome: true, nome_fantasia: true, cidade: true, estado: true, created_at: true, created_by: true, campanha_nome: true, utm_source: true, origem: true, segmento: true },
    orderBy: { created_at: 'desc' },
  });

  const hoje = vazio();
  const mes = vazio();
  const porDia = Array.from({ length: diasNoMes }, () => vazio());
  const regioesMes = new Map<string, { total: number; heitor: number; campanha: number }>();
  const regioesHoje = new Map<string, number>();
  const ultimos: { nome: string; regiao: string; fonte: Fonte; em: string; segmento: string | null }[] = [];
  const campanhasMes = new Map<string, number>();

  for (const l of leads) {
    const f = fonteDoLead(l as any);
    const dia = partesNoFuso(l.created_at).dia;
    mes[f]++;
    porDia[dia - 1][f]++;
    const r = regiao(l.cidade, l.estado);
    const rm = regioesMes.get(r) || { total: 0, heitor: 0, campanha: 0 };
    rm.total++; if (f === 'heitor') rm.heitor++; if (f === 'campanha') rm.campanha++;
    regioesMes.set(r, rm);
    if (l.campanha_nome && f === 'campanha') campanhasMes.set(l.campanha_nome, (campanhasMes.get(l.campanha_nome) || 0) + 1);
    if (l.created_at >= inicioHoje && l.created_at < fimHoje) {
      hoje[f]++;
      regioesHoje.set(r, (regioesHoje.get(r) || 0) + 1);
      if (ultimos.length < 10) ultimos.push({ nome: (l.nome_fantasia || l.nome || '').trim(), regiao: r, fonte: f, em: l.created_at.toISOString(), segmento: l.segmento });
    }
  }
  const totalHoje = FONTES.reduce((s, f) => s + hoje[f], 0);
  const totalMes = FONTES.reduce((s, f) => s + mes[f], 0);

  // Mesmo ponto do mês passado (para comparar o ritmo).
  const inicioMesPassado = new Date(Date.UTC(hojeP.ano, hojeP.mes - 2, 1, 3));
  const mesmoDiaMesPassado = new Date(inicioMesPassado.getTime() + (agora.getTime() - inicioMes.getTime()));
  const mesPassadoAteHoje = await prisma.lead.count({ where: { deleted_at: null, created_at: { gte: inicioMesPassado, lt: mesmoDiaMesPassado } } as any }).catch(() => null);

  // ── Heitor: funil do dia ─────────────────────────────────────────────────
  const hojeW = { gte: inicioHoje, lt: fimHoje };
  const [encontrados, cadastrados, semWhatsapp, descartados, filaCaroline, cadastradosMes] = await Promise.all([
    prisma.prospeccaoLocal.count({ where: { created_at: hojeW } }).catch(() => 0),
    prisma.prospeccaoLocal.count({ where: { status: 'CADASTRADO', cadastrado_em: hojeW } }).catch(() => 0),
    prisma.prospeccaoLocal.count({ where: { status: 'SEM_WHATSAPP', updated_at: hojeW } }).catch(() => 0),
    prisma.prospeccaoLocal.count({ where: { status: { in: ['REDE', 'FORA_DO_PERFIL'] }, created_at: hojeW } }).catch(() => 0),
    prisma.sdrLead.count({ where: { criado_por: 'heitor', status: 'FILA' } }).catch(() => 0),
    prisma.prospeccaoLocal.count({ where: { status: 'CADASTRADO', cadastrado_em: { gte: inicioMes, lt: fimMes } } }).catch(() => 0),
  ]);
  const { obterConfigHeitor } = await import('./heitor.service');
  const heitorCfg = await obterConfigHeitor(prisma).catch(() => null as any);
  const aguardandoHeitor = await prisma.prospeccaoLocal.count({ where: { status: 'NOVO' } }).catch(() => 0);

  // ── Retorno efetivo dos primeiros contatos no mês (agentes SDR) ──────────
  const sdrs = await prisma.sdrLead.findMany({
    where: { primeiro_envio_em: { gte: inicioMes, lt: fimMes } },
    select: { criado_por: true, campanha: true, agente: true, status: true, nota: true, ultima_lead_em: true },
  });
  const retorno = (filtro: (s: typeof sdrs[number]) => boolean) => {
    const xs = sdrs.filter(filtro);
    const contatados = xs.length;
    const responderam = xs.filter(s => s.ultima_lead_em).length;
    const qualificados = xs.filter(s => (s.nota ?? 0) >= 35 || ['DEMO', 'VENDEDORA'].includes(s.status)).length;
    const demos = xs.filter(s => s.status === 'DEMO').length;
    const semInteresse = xs.filter(s => s.status === 'SEM_INTERESSE').length;
    return { contatados, responderam, qualificados, demos, sem_interesse: semInteresse, taxa_resposta: contatados ? Math.round((responderam / contatados) * 100) : null, taxa_qualificacao: contatados ? Math.round((qualificados / contatados) * 100) : null };
  };
  const retornoHeitor = retorno(s => s.criado_por === 'heitor');
  const retornoCampanha = retorno(s => s.criado_por !== 'heitor' && s.agente === 'caroline');

  // ── Pontos de atenção (piscam na tela) ───────────────────────────────────
  const horaSP = partesNoFuso(agora).hora;
  const atencao: { chave: string; texto: string; tom: 'bad' | 'warn' }[] = [];
  if (heitorCfg?.ultimo_erro) atencao.push({ chave: 'heitor_erro', texto: `Heitor parou: ${String(heitorCfg.ultimo_erro).slice(0, 90)}`, tom: 'bad' });
  if (heitorCfg && !heitorCfg.ativo) atencao.push({ chave: 'heitor_off', texto: 'Heitor está desligado', tom: 'warn' });
  if (horaSP >= 11 && totalHoje === 0) atencao.push({ chave: 'sem_leads', texto: 'Nenhum lead captado hoje até agora', tom: 'bad' });
  if (retornoHeitor.contatados >= 10 && (retornoHeitor.taxa_resposta ?? 100) < 10) atencao.push({ chave: 'retorno_heitor', texto: `Retorno baixo nos leads do Heitor (${retornoHeitor.taxa_resposta}%)`, tom: 'warn' });
  if (retornoCampanha.contatados >= 10 && (retornoCampanha.taxa_resposta ?? 100) < 10) atencao.push({ chave: 'retorno_campanha', texto: `Retorno baixo nos leads de campanha (${retornoCampanha.taxa_resposta}%)`, tom: 'warn' });
  if (filaCaroline >= 30) atencao.push({ chave: 'fila', texto: `${filaCaroline} leads do Heitor esperando a Caroline`, tom: 'warn' });

  const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    hoje: { total: totalHoje, ...hoje },
    mes: {
      total: totalMes, ...mes, dia_atual: hojeP.dia, dias_no_mes: diasNoMes,
      por_dia: porDia, media_dia: hojeP.dia ? Math.round((totalMes / hojeP.dia) * 10) / 10 : 0,
      projecao: hojeP.dia ? Math.round((totalMes / hojeP.dia) * diasNoMes) : null,
      mes_passado_ate_hoje: mesPassadoAteHoje,
      nome: agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long' }),
    },
    regioes_mes: [...regioesMes.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([nome, v]) => ({ nome, ...v })),
    regioes_hoje: top(regioesHoje, 5).map(([nome, total]) => ({ nome, total })),
    campanhas_mes: top(campanhasMes, 4).map(([nome, total]) => ({ nome, total })),
    ultimos,
    heitor: {
      ativo: !!heitorCfg?.ativo, erro: heitorCfg?.ultimo_erro || null, ultima_rodada: heitorCfg?.ultima_rodada || null,
      encontrados, cadastrados, sem_whatsapp: semWhatsapp, descartados, fila_caroline: filaCaroline, aguardando: aguardandoHeitor, cadastrados_mes: cadastradosMes,
    },
    retorno: { heitor: retornoHeitor, campanha: retornoCampanha },
    atencao,
  };
}
