// Olívia · perdas para concorrentes (11/11/2026). Puro: conta, a partir dos leads perdidos, quantos foram
// para outro sistema e para qual. Os números saem daqui (nunca da IA); a IA só escreve a leitura e os argumentos.

export type LeadPerdido = { motivo_perda: string | null; sistema_atual: string | null; segmento?: string | null };

const CHAVES_CONCORRENTE = ['JA_TEM_FORNECEDOR', 'CONCORRENTE'];
const TEXTO_CONCORRENTE = /concorr|outro sistema|outra empresa|fechou com|j[aá] (tem|usa|fechou)/i;

/** A perda foi para um concorrente? Vale a chave da taxonomia ou o detalhe escrito em "OUTRO: ...". */
export function perdeuParaConcorrente(motivo: string | null): boolean {
  if (!motivo) return false;
  const [chave, ...resto] = motivo.split(':');
  return CHAVES_CONCORRENTE.includes(chave.trim().toUpperCase()) || TEXTO_CONCORRENTE.test(resto.join(':'));
}

const semNome = 'Não informado';
/** Junta grafias diferentes do mesmo sistema ("Linx ", "linx") e mostra a primeira que apareceu. */
function contar(valores: (string | null | undefined)[]): { nome: string; total: number }[] {
  const m = new Map<string, { nome: string; total: number }>();
  for (const v of valores) {
    const nome = (v || '').trim().replace(/\s+/g, ' ') || semNome;
    const k = nome.toLowerCase();
    const atual = m.get(k);
    if (atual) atual.total++; else m.set(k, { nome, total: 1 });
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

export function resumoPerdasConcorrentes(leads: LeadPerdido[]) {
  const conc = leads.filter(l => perdeuParaConcorrente(l.motivo_perda));
  return {
    perdidos: leads.length,
    paraConcorrente: conc.length,
    pct: leads.length ? Math.round((conc.length / leads.length) * 100) : 0,
    porConcorrente: contar(conc.map(l => l.sistema_atual)),
    porSegmento: contar(conc.map(l => l.segmento)),
    // O que a equipe escreveu no motivo (sem nome de lead), para a Olívia ler.
    detalhes: conc.map(l => (l.motivo_perda || '').split(':').slice(1).join(':').trim()).filter(Boolean).slice(0, 40),
  };
}

/** Tabela em markdown com os números (vai no documento, antes da leitura da Olívia). */
export function tabelaPerdas(r: ReturnType<typeof resumoPerdasConcorrentes>, dias: number): string {
  return [
    `Nos últimos ${dias} dias: **${r.perdidos}** lead(s) perdido(s), **${r.paraConcorrente}** para outro sistema (${r.pct}%).`, '',
    '| Sistema que o lead usa ou escolheu | Perdas |', '| --- | --- |',
    ...r.porConcorrente.map(c => `| ${c.nome} | ${c.total} |`), '',
    '| Segmento | Perdas |', '| --- | --- |',
    ...r.porSegmento.map(c => `| ${c.nome} | ${c.total} |`),
  ].join('\n');
}
