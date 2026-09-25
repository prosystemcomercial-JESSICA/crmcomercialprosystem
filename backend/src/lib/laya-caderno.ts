// Caderno da Laya: o que ela aprende com as confirmações da equipe, em texto e dados
// que sobrevivem ao modelo. Vocabulário por etiqueta, memória de casos parecidos,
// nível por tarefa e o documento do Caderno. Puro, sem rede nem banco.

export const TAREFAS_LAYA = ['segmento', 'intencao', 'cancelar'] as const;
export type TarefaLaya = typeof TAREFAS_LAYA[number];
export type AmostraLaya = { texto: string; rotulos: any; sugestao: any; criado_por?: string | null; created_at: Date | string };

const STOP = new Set(('para pela pelo com uma umas uns que como mais mas nao sim isso essa esse esta este aqui voce voces vou vai tem tenho temos sobre quando onde qual quais porque entao ainda muito bom boa dia tarde noite obrigado obrigada ola tudo bem sera seria pode poderia gostaria queria quero preciso favor sistema empresa prosystem cliente ok okay blz beleza').split(' '));

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Palavras do cliente (só as linhas "Cliente:"), sem acento e sem palavras vazias. */
export function palavrasDoCliente(texto: string): string[] {
  const linhas = texto.split('\n').filter(l => l.startsWith('Cliente:')).map(l => l.slice(8));
  const fonte = linhas.length ? linhas.join(' ') : texto;
  return semAcento(fonte).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** Etiqueta confirmada de uma tarefa (null se a amostra não vale para ela). */
export function rotuloDe(a: { rotulos: any }, t: TarefaLaya): string | null {
  const r = a.rotulos;
  if (!r || r.ignorar) return null;
  if (t === 'cancelar') return typeof r.cancelar === 'boolean' ? (r.cancelar ? 'sim' : 'nao') : null;
  return typeof r[t] === 'string' ? r[t] : null;
}

/** O que a Laya tinha sugerido na amostra (antes da confirmação). */
export function sugestaoDe(a: { sugestao: any }, t: TarefaLaya): string | null {
  const s = a.sugestao;
  if (!s) return null;
  if (t === 'cancelar') return typeof s.cancelar === 'number' ? (s.cancelar >= 0.5 ? 'sim' : 'nao') : null;
  return typeof s[t] === 'string' ? s[t] : null;
}

/** Palavras mais típicas de cada etiqueta (aparecem em 2+ amostras e mais nela do que no geral). */
export function vocabulario(amostras: AmostraLaya[], t: TarefaLaya, max = 8): Record<string, string[]> {
  const geral = new Map<string, number>();
  const porRotulo = new Map<string, { n: number; cont: Map<string, number> }>();
  let total = 0;
  for (const a of amostras) {
    const r = rotuloDe(a, t);
    if (!r) continue;
    total++;
    const ws = new Set(palavrasDoCliente(a.texto));
    const g = porRotulo.get(r) || { n: 0, cont: new Map() };
    g.n++;
    for (const w of ws) { geral.set(w, (geral.get(w) || 0) + 1); g.cont.set(w, (g.cont.get(w) || 0) + 1); }
    porRotulo.set(r, g);
  }
  const out: Record<string, string[]> = {};
  for (const [r, g] of porRotulo) {
    out[r] = [...g.cont.entries()]
      .filter(([w, c]) => c >= 2 && c / g.n > (geral.get(w)! / total) * 1.2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, max).map(([w]) => w);
  }
  return out;
}

/** Caso confirmado mais parecido (Jaccard nas palavras do cliente). */
export function casoParecido(texto: string, amostras: AmostraLaya[], t: TarefaLaya): { rotulo: string; similaridade: number } | null {
  const a1 = new Set(palavrasDoCliente(texto));
  if (a1.size < 3) return null;
  let melhor: { rotulo: string; similaridade: number } | null = null;
  for (const a of amostras) {
    const r = rotuloDe(a, t);
    if (!r) continue;
    const a2 = new Set(palavrasDoCliente(a.texto));
    if (!a2.size) continue;
    let inter = 0;
    for (const w of a1) if (a2.has(w)) inter++;
    const sim = inter / (a1.size + a2.size - inter);
    if (!melhor || sim > melhor.similaridade) melhor = { rotulo: r, similaridade: Math.round(sim * 100) / 100 };
  }
  return melhor;
}

export const NIVEIS = { aprendiz: '🎓 Aprendiz', assistente: '🧑‍💼 Assistente', titular: '⭐ Titular' } as const;
export type Nivel = keyof typeof NIVEIS;

/** Acertos da Laya numa tarefa, do mais antigo ao mais recente. */
export function historicoAcertos(amostras: AmostraLaya[], t: TarefaLaya): boolean[] {
  return [...amostras]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(a => ({ r: rotuloDe(a, t), s: sugestaoDe(a, t) }))
    .filter(x => x.r && x.s)
    .map(x => x.r === x.s);
}

const taxa = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : 0);

/** Nível: Titular >90% nos últimos 50; Assistente ≥80% nos últimos 30; senão Aprendiz (mín. 30 exemplos). */
export function nivelTarefa(acertos: boolean[]): { nivel: Nivel; exemplos: number; acerto: number | null } {
  const n = acertos.length;
  const acerto = n ? Math.round(taxa(acertos.slice(-50)) * 100) : null;
  if (n >= 50 && taxa(acertos.slice(-50)) > 0.9) return { nivel: 'titular', exemplos: n, acerto };
  if (n >= 30 && taxa(acertos.slice(-30)) >= 0.8) return { nivel: 'assistente', exemplos: n, acerto };
  return { nivel: 'aprendiz', exemplos: n, acerto };
}

const NOMES_TAREFA: Record<TarefaLaya, string> = { segmento: 'Ramo do cliente', intencao: 'O que o cliente quer', cancelar: 'Risco de cancelar' };

/** Documento do Caderno (Markdown), completo o bastante para ensinar outra IA. */
export function gerarCaderno(amostras: AmostraLaya[], criterios: Record<string, Record<string, string>>, agora = new Date()): string {
  const validas = amostras.filter(a => a.rotulos && !a.rotulos.ignorar);
  const l: string[] = [];
  l.push('# Caderno da Laya', '', `Gerado em ${agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. ${validas.length} exemplos confirmados pela equipe (${amostras.length - validas.length} marcados como não comerciais).`, '');
  l.push('Este caderno reúne tudo o que a Laya aprendeu no CRM Comercial Prosystem com as confirmações da equipe. Serve para ensinar qualquer outra IA a fazer o mesmo trabalho: leia as definições, as palavras típicas, os casos difíceis e os exemplos.', '');
  l.push('## Níveis e acerto', '', '| Tarefa | Nível | Exemplos | Acerto (últimos 50) |', '|---|---|---|---|');
  for (const t of TAREFAS_LAYA) {
    const n = nivelTarefa(historicoAcertos(amostras, t));
    l.push(`| ${NOMES_TAREFA[t]} | ${NIVEIS[n.nivel]} | ${n.exemplos} | ${n.acerto == null ? '—' : n.acerto + '%'} |`);
  }
  l.push('');
  for (const t of TAREFAS_LAYA) {
    l.push(`## ${NOMES_TAREFA[t]}`, '');
    const crit = criterios[t] || {};
    const voc = vocabulario(amostras, t);
    const cont: Record<string, number> = {};
    for (const a of amostras) { const r = rotuloDe(a, t); if (r) cont[r] = (cont[r] || 0) + 1; }
    const rotulos = [...new Set([...Object.keys(crit), ...Object.keys(cont)])];
    for (const r of rotulos) {
      l.push(`- **${r}**${crit[r] ? `: ${crit[r]}` : ''}. ${cont[r] || 0} exemplo(s).${voc[r]?.length ? ` Palavras típicas do cliente: ${voc[r].join(', ')}.` : ''}`);
    }
    const erros = [...amostras].reverse().filter(a => { const r = rotuloDe(a, t), s = sugestaoDe(a, t); return r && s && r !== s; }).slice(0, 15);
    if (erros.length) {
      l.push('', '**Casos difíceis (a Laya errou, a equipe corrigiu):**', '');
      for (const a of erros) {
        const trecho = a.texto.split('\n').filter(x => x.startsWith('Cliente:')).map(x => x.slice(9)).join(' / ').slice(0, 220);
        l.push(`- "${trecho}" → era **${rotuloDe(a, t)}** (ela disse ${sugestaoDe(a, t)})`);
      }
    }
    l.push('');
  }
  l.push('## Regras fixas', '', '- Só a confirmação de uma pessoa da equipe vira exemplo. O que a IA sugere sozinha nunca é lição.', '- Contatos da equipe, parceiros e fornecedores não são analisados.', '- Os exemplos completos (texto da conversa + etiquetas) estão no arquivo de dados que acompanha este caderno (JSONL, um exemplo por linha).', '');
  return l.join('\n');
}
