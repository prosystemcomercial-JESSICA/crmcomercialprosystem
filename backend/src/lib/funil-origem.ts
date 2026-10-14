// Funil por origem (parte 4 do Plano de Expansão, 14/10/2026): de onde vêm os leads que viram venda. Puro.

export type LeadOrigem = { origem?: string | null; utm_source?: string | null; utm_campaign?: string | null; campanha_nome?: string | null };

/** Canal do lead, em palavras da gestão. */
export function canalDoLead(l: LeadOrigem): string {
  const o = String(l.origem || '').toUpperCase();
  const src = String(l.utm_source || '').toLowerCase();
  if (o === 'PROSPECCAO' || l.campanha_nome === 'Prospecção Heitor') return 'Prospecção (Heitor)';
  if (o === 'INDICACAO') return l.campanha_nome === 'Indicação de cliente' ? 'Indicação de cliente' : 'Indicação da loja (decisor)';
  if (o.startsWith('FORMULARIO_BLOG') || src === 'blog') return 'Blog';
  if (/facebook|instagram|fb|ig|meta/.test(src) || o === 'TRAFEGO' || o === 'CAMPANHA') return 'Anúncio (Meta)';
  if (/google|gads/.test(src)) return 'Anúncio (Google)';
  if (o.startsWith('FORMULARIO')) return 'Site';
  if (o.startsWith('APRESENTACAO')) return 'Apresentação';
  if (o === 'WHATSAPP') return 'WhatsApp direto';
  return o ? o.charAt(0) + o.slice(1).toLowerCase() : 'Sem origem';
}

/** Campanha ou peça: a UTM manda; sem UTM, o nome da campanha do CRM; sem nada, o próprio canal. */
export function campanhaDoLead(l: LeadOrigem): string {
  return (l.utm_campaign || '').trim() || (l.campanha_nome || '').trim() || canalDoLead(l);
}

export const ultimos8 = (t: string | null | undefined) => String(t || '').replace(/\D/g, '').slice(-8);
