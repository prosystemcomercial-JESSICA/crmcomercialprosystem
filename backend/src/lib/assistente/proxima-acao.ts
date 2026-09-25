// "Próxima melhor ação" (Fase 2 do assistente): junta sinais do CRM numa lista
// curta do que fazer agora, da mais urgente para a menos. Só sugere na tela;
// não cria atividade. Puro: recebe os sinais já buscados.

export type Urgencia = 'urgente' | 'alta' | 'normal';
export type AcaoSugerida = { chave: string; urgencia: Urgencia; titulo: string; detalhe: string; conversaId: string | null; quando: string };

type Conv = { id: string; nome: string; ultima: string | null; ultima_em: Date | null; prioridade: string; sla_prazo_em: Date | null; dono_id: string | null; ultima_direcao: string | null };
type PropVista = { conversaId: string | null; nome: string; vista_em: Date; valor: number | null };
type Demo = { conversaId: string | null; nome: string; quando: Date };

const ORDEM: Record<Urgencia, number> = { urgente: 0, alta: 1, normal: 2 };
const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const brl = (n: number | null) => n == null ? '' : ` (${n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })})`;

export function montarProximasAcoes(s: { agora: Date; conversas: Conv[]; propostasVistas: PropVista[]; demosHoje: Demo[] }, limite = 8): AcaoSugerida[] {
  const out: AcaoSugerida[] = [];
  const jaTem = new Set<string>();
  const add = (a: AcaoSugerida) => { if (!jaTem.has(a.chave)) { jaTem.add(a.chave); out.push(a); } };
  const esperando = s.conversas.filter(c => c.ultima_direcao === 'ENTRADA');

  for (const c of esperando.filter(c => c.prioridade === 'CRITICA')) {
    add({ chave: `conv:${c.id}`, urgencia: 'urgente', titulo: `Responder ${c.nome}`, detalhe: `Prioridade crítica: "${(c.ultima || '').slice(0, 60)}"`, conversaId: c.id, quando: c.ultima_em?.toISOString() || '' });
  }
  for (const c of esperando.filter(c => c.sla_prazo_em && c.sla_prazo_em < s.agora)) {
    add({ chave: `conv:${c.id}`, urgencia: 'alta', titulo: `Responder ${c.nome}`, detalhe: `Passou do prazo de resposta às ${hhmm(c.sla_prazo_em!)}`, conversaId: c.id, quando: c.sla_prazo_em!.toISOString() });
  }
  for (const d of s.demosHoje.filter(d => d.quando > s.agora)) {
    add({ chave: `demo:${d.conversaId}:${d.quando.getTime()}`, urgencia: 'alta', titulo: `Demonstração com ${d.nome} às ${hhmm(d.quando)}`, detalhe: 'Envie o link da reunião antes do horário', conversaId: d.conversaId, quando: d.quando.toISOString() });
  }
  for (const p of s.propostasVistas) {
    add({ chave: p.conversaId ? `conv:${p.conversaId}` : `prop:${p.nome}`, urgencia: 'alta', titulo: `${p.nome} abriu a proposta${brl(p.valor)}`, detalhe: 'Ótima hora para chamar e tirar dúvidas', conversaId: p.conversaId, quando: p.vista_em.toISOString() });
  }
  for (const c of esperando.filter(c => !c.dono_id)) {
    add({ chave: `conv:${c.id}`, urgencia: 'normal', titulo: `${c.nome} está na fila sem dono`, detalhe: `"${(c.ultima || '').slice(0, 60)}"`, conversaId: c.id, quando: c.ultima_em?.toISOString() || '' });
  }
  return out.sort((a, b) => ORDEM[a.urgencia] - ORDEM[b.urgencia] || a.quando.localeCompare(b.quando)).slice(0, limite);
}
