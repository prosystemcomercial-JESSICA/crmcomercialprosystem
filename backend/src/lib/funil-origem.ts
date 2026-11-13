// Funil por origem (parte 4 do Plano de Expansão, 14/10/2026): de onde vêm os leads que viram venda. Puro.
// 13/11/2026 (Painel de Leads da Laya): a origem chega escrita de vários jeitos ("Indicação", "INDICACAO",
// "Instagram", "CAMPANHA_PADARIA_2025_2026"...). Tudo passa por `chave` (sem acento, maiúscula, com _) antes.

export type LeadOrigem = { origem?: string | null; utm_source?: string | null; utm_campaign?: string | null; campanha_nome?: string | null };

const chave = (s: string | null | undefined) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/[\s-]+/g, '_');
/** "CAMPANHA_PADARIA_2025_2026" → "Campanha padaria 2025 2026". */
const legivel = (s: string) => { const t = s.replace(/_/g, ' ').trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Canal do lead, em palavras da gestão. */
export function canalDoLead(l: LeadOrigem): string {
  const o = chave(l.origem);
  const src = String(l.utm_source || '').toLowerCase();
  const camp = chave(l.campanha_nome);
  if (o === 'PROSPECCAO' || camp === 'PROSPECCAO_HEITOR') return 'Prospecção (Heitor)';
  if (o === 'PROSPECCAO_ATIVA') return 'Prospecção ativa (equipe)';
  if (o === 'INDICACAO') {
    if (camp === 'INDICACAO_DE_CLIENTE') return 'Indicação de cliente';
    // A origem gravada pelo sistema (INDICACAO) é a do decisor indicado pela loja; a digitada à mão ("Indicação") é genérica.
    return /DECISOR|LOJA/.test(camp) || (l.origem === 'INDICACAO' && !camp) ? 'Indicação da loja (decisor)' : 'Indicação';
  }
  if (o.startsWith('FORMULARIO_BLOG') || src === 'blog') return 'Blog';
  if (/facebook|instagram|fb|ig|meta/.test(src) || o === 'TRAFEGO' || o === 'CAMPANHA') return 'Anúncio (Meta)';
  if (/google|gads/.test(src)) return 'Anúncio (Google)';
  if (o === 'INSTAGRAM') return 'Instagram';
  if (o.startsWith('FORMULARIO')) return 'Site';
  if (o.startsWith('APRESENTACAO')) return 'Apresentação';
  if (o === 'WHATSAPP') return 'WhatsApp direto';
  if (o === 'CLIENTE_ANTIGO') return 'Cliente antigo';
  if (o.startsWith('RECUPERACAO')) return 'Recuperação de inativos';
  if (o.startsWith('CAMPANHA_')) return 'Campanha pelo WhatsApp';
  if (o === 'PROPOSTA') return 'Proposta direta';
  if (o === 'VISITA') return 'Visita';
  if (o === 'MANUAL') return 'Cadastro manual';
  return o ? legivel(o) : 'Sem origem';
}

/** Campanha ou peça: a UTM manda; sem UTM, o nome da campanha do CRM; sem nada, o próprio canal. */
export function campanhaDoLead(l: LeadOrigem): string {
  const o = chave(l.origem);
  return (l.utm_campaign || '').trim() || (l.campanha_nome || '').trim() || (o.startsWith('CAMPANHA_') ? legivel(o) : canalDoLead(l));
}

export const ultimos8 = (t: string | null | undefined) => String(t || '').replace(/\D/g, '').slice(-8);
