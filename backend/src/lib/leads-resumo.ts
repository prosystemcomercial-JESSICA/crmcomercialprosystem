// Leads em números para o Painel do CEO (no lugar da Central de Leads): base, mês,
// etapas, origem, últimos 6 meses, temperatura, vendedores e motivos de perda.
// "Ganho/perdido no mês" usa updated_at do lead com status GANHO/PERDIDO.

export type LeadResumo = { origem: string | null; status: string; etapa_comercial: string | null; temperatura: string | null; responsavel_id: string | null; created_at: Date; updated_at: Date };

const FIM = ['GANHO', 'PERDIDO'];
const mesSP = (d: Date) => new Date(d.getTime() - 3 * 36e5).toISOString().slice(0, 7);
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

export function rotuloOrigem(o: string | null | undefined): string {
  const k = sem(o || '');
  if (!k || k === 'OUTRO' || k === 'MANUAL') return 'Outros';
  if (k.startsWith('FORMULARIO')) return 'Formulário do site/blog';
  if (k.startsWith('PROSPEC')) return 'Prospecção';
  if (k.startsWith('CAMPANHA')) return 'Campanhas';
  if (k.startsWith('IMPORTACAO')) return 'Lista importada (marketing)';
  if (k.startsWith('INDICA')) return 'Indicação';
  if (k.startsWith('RECUPERACAO')) return 'Recuperação de inativos';
  if (k.includes('CLIENTE') && k.includes('ANTIGO')) return 'Cliente antigo';
  const fixos: Record<string, string> = { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', PROPOSTA: 'Proposta', AGENDA: 'Agenda', TRAFEGO: 'Tráfego pago', VISITA: 'Visita' };
  return fixos[k] || (o as string);
}

const ETAPAS: [string, string][] = [
  ['NOVO_LEAD', 'Novo lead'], ['PRIMEIRO_CONTATO', 'Primeiro contato'], ['QUALIFICADO', 'Qualificado'], ['EM_ATENDIMENTO', 'Em atendimento'],
  ['AGUARDANDO_RETORNO', 'Aguardando retorno'], ['PROPOSTA_A_GERAR', 'Proposta a gerar'], ['PROPOSTA_ENVIADA', 'Proposta enviada'], ['EM_NEGOCIACAO', 'Em negociação'],
];
const rotuloEtapa = (e: string | null) => (e?.startsWith('FUP_') ? 'Follow-up' : ETAPAS.find(([k]) => k === e)?.[1] || 'Outras');
const ORDEM_ETAPA = [...ETAPAS.map(([, l]) => l), 'Follow-up', 'Outras'];
const TEMP: Record<string, string> = { FRIO: 'Frio', MORNO: 'Morno', QUENTE: 'Quente', MUITO_QUENTE: 'Muito quente' };
const MOTIVO: Record<string, string> = { PRECO: 'Preço', SEM_RETORNO: 'Sem retorno', CONCORRENTE: 'Fechou com concorrente', SEM_INTERESSE: 'Sem interesse', TIMING: 'Momento errado', SEM_ORCAMENTO: 'Sem orçamento' };
const rotuloMotivo = (m: string | null) => (m ? MOTIVO[sem(m)] || m.charAt(0).toUpperCase() + m.slice(1).toLowerCase().replace(/_/g, ' ') : 'Não informado');

const conta = <K extends string>(itens: K[]) => itens.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map<K, number>());

export function montarResumoLeads(leads: LeadResumo[], perdas: { motivo: string | null; created_at: Date | null }[], nomes: Record<string, string>, agora = new Date()) {
  const mes = mesSP(agora);
  const ant = (() => { const [a, m] = mes.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`; })();
  const ativos = leads.filter(l => !FIM.includes(l.status));
  const ha = (dias: number) => new Date(agora.getTime() - dias * 864e5);
  const em90 = leads.filter(l => l.created_at >= ha(90));

  const totais = {
    base: leads.length, ativos: ativos.length,
    novos_mes: leads.filter(l => mesSP(l.created_at) === mes).length,
    novos_mes_anterior: leads.filter(l => mesSP(l.created_at) === ant).length,
    ganhos_mes: leads.filter(l => l.status === 'GANHO' && mesSP(l.updated_at) === mes).length,
    perdidos_mes: leads.filter(l => l.status === 'PERDIDO' && mesSP(l.updated_at) === mes).length,
    conversao_90d_pct: em90.length ? Math.round((em90.filter(l => l.status === 'GANHO').length / em90.length) * 100) : 0,
  };

  const etapas = conta(ativos.map(l => rotuloEtapa(l.etapa_comercial)));
  const por_etapa = ORDEM_ETAPA.filter(e => etapas.get(e)).map(e => ({ etapa: e, ativos: etapas.get(e)! }));

  const doAno = leads.filter(l => l.created_at >= ha(365));
  const origens = new Map<string, { origem: string; captados: number; ativos: number; ganhos: number; conversao_pct: number }>();
  for (const l of doAno) {
    const k = rotuloOrigem(l.origem);
    const o = origens.get(k) || { origem: k, captados: 0, ativos: 0, ganhos: 0, conversao_pct: 0 };
    o.captados++; if (!FIM.includes(l.status)) o.ativos++; if (l.status === 'GANHO') o.ganhos++;
    origens.set(k, o);
  }
  const por_origem = [...origens.values()].map(o => ({ ...o, conversao_pct: o.captados ? Math.round((o.ganhos / o.captados) * 100) : 0 }))
    .sort((a, b) => b.captados - a.captados || b.ganhos - a.ganhos);

  const meses: string[] = [];
  for (let i = 5; i >= 0; i--) { const x = new Date(agora.getFullYear(), agora.getMonth() - i, 15); meses.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  const por_mes = meses.map(m => ({
    mes: m, captados: leads.filter(l => mesSP(l.created_at) === m).length,
    ganhos: leads.filter(l => l.status === 'GANHO' && mesSP(l.updated_at) === m).length,
    perdidos: leads.filter(l => l.status === 'PERDIDO' && mesSP(l.updated_at) === m).length,
  }));

  const temps = conta(ativos.map(l => TEMP[l.temperatura || ''] || 'Sem temperatura'));
  const por_temperatura = [...temps.entries()].map(([temperatura, n]) => ({ temperatura, ativos: n })).sort((a, b) => b.ativos - a.ativos);

  const vend = new Map<string, { vendedor: string; ativos: number; novos_mes: number; ganhos_mes: number }>();
  for (const l of leads) {
    const k = l.responsavel_id || '';
    const v = vend.get(k) || { vendedor: (k && nomes[k]) || 'Sem responsável', ativos: 0, novos_mes: 0, ganhos_mes: 0 };
    if (!FIM.includes(l.status)) v.ativos++;
    if (mesSP(l.created_at) === mes) v.novos_mes++;
    if (l.status === 'GANHO' && mesSP(l.updated_at) === mes) v.ganhos_mes++;
    vend.set(k, v);
  }
  const por_vendedor = [...vend.values()].sort((a, b) => b.ativos - a.ativos);

  const mot = conta(perdas.filter(p => p.created_at && p.created_at >= ha(90)).map(p => rotuloMotivo(p.motivo)));
  const motivos_perda = [...mot.entries()].map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 8);

  return { totais, por_etapa, por_origem, por_mes, por_temperatura, por_vendedor, motivos_perda };
}
