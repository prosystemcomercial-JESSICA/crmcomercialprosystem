// Histórico do card (06/10/2026): uma linha do tempo única com a execução (play, pausas com motivo, trocas),
// esperas, recados, observações, prints e os eventos do sistema. Função pura: as rotas buscam os dados e
// esta monta a lista (mais recente primeiro).

export type GrupoHistorico = 'EXECUCAO' | 'PAUSA' | 'ESPERA' | 'PRINT' | 'OBS' | 'RECADO' | 'SISTEMA';

export type EventoHistorico = {
  id: string;
  em: string;
  grupo: GrupoHistorico;
  texto: string;
  autor: string | null;
  /** Print ou observação do histórico: editável por quem escreveu (ou pela gestão). */
  registro?: { id: string; categoria: string | null; texto: string | null; tem_imagem: boolean; editado_em: string | null; pode_mexer: boolean } | null;
  /** Observação da aba Observações: pessoal = só quem escreveu vê. */
  pessoal?: boolean;
};

export const CATEGORIAS_PRINT: Record<string, string> = { SUPORTE: 'Print do suporte', CONVERSA: 'Conversa', AVISO: 'Aviso', OUTRO: 'Outro' };

/** Linhas que o cronômetro e as esperas gravam em ImplantacaoAtividade viram execução, pausa ou espera. */
export function grupoDaAtividade(tipo: string | null | undefined, descricao: string): GrupoHistorico {
  const d = (descricao || '').trim();
  if (tipo === 'CRONOMETRO') {
    if (d.startsWith('▶')) return 'EXECUCAO';
    if (d.startsWith('⏸') || d.startsWith('⏱')) return 'PAUSA';
    if (d.startsWith('⏳') || d.startsWith('✅ Fim da espera')) return 'ESPERA';
    return 'EXECUCAO';
  }
  return 'SISTEMA';
}

type Ator = { id: string; gestao: boolean };
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export function montarHistorico(p: {
  ator: Ator;
  atividades: { id: string; tipo: string | null; descricao: string; autor_nome: string | null; created_at: Date | string }[];
  registros: { id: string; tipo: string; categoria: string | null; texto: string | null; imagem_caminho: string | null; autor_id: string; autor_nome: string | null; editado_em: Date | string | null; created_at: Date | string }[];
  observacoes: { id: string; texto: string; privada: boolean; autor_id: string; autor_nome: string | null; created_at: Date | string }[];
  recados: { id: string; texto: string; de_nome: string | null; para_nome: string | null; lido_em: Date | string | null; origem: string; created_at: Date | string }[];
}): EventoHistorico[] {
  const ev: EventoHistorico[] = [];
  for (const a of p.atividades) ev.push({ id: `a-${a.id}`, em: iso(a.created_at), grupo: grupoDaAtividade(a.tipo, a.descricao), texto: a.descricao, autor: a.autor_nome });
  for (const r of p.registros) {
    const print = r.tipo === 'PRINT';
    ev.push({
      id: `r-${r.id}`, em: iso(r.created_at), grupo: print ? 'PRINT' : 'OBS',
      texto: r.texto || (print ? `Print${r.categoria && CATEGORIAS_PRINT[r.categoria] ? ` (${CATEGORIAS_PRINT[r.categoria].toLowerCase()})` : ''}` : ''),
      autor: r.autor_nome,
      registro: { id: r.id, categoria: r.categoria, texto: r.texto, tem_imagem: !!r.imagem_caminho, editado_em: r.editado_em ? iso(r.editado_em) : null, pode_mexer: p.ator.gestao || r.autor_id === p.ator.id },
    });
  }
  for (const o of p.observacoes) {
    if (o.privada && o.autor_id !== p.ator.id) continue; // pessoal: só de quem escreveu
    ev.push({ id: `o-${o.id}`, em: iso(o.created_at), grupo: 'OBS', texto: o.texto, autor: o.autor_nome, pessoal: o.privada });
  }
  for (const r of p.recados) {
    if (r.origem !== 'GESTAO') continue; // avisos automáticos do sistema já aparecem pelas atividades
    ev.push({ id: `v-${r.id}`, em: iso(r.created_at), grupo: 'RECADO', texto: `Recado para ${r.para_nome || 'o técnico'}: ${r.texto}${r.lido_em ? ` · lido em ${new Date(r.lido_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ' · ainda não lido'}`, autor: r.de_nome });
  }
  return ev.sort((x, y) => (x.em < y.em ? 1 : x.em > y.em ? -1 : 0));
}
