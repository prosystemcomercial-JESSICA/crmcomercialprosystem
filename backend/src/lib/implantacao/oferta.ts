// Agente de oferta (depois da virada): regras puras do catálogo e do texto da mensagem.
// Dois tipos de item (13/11/2026, pedido da Jessica):
// - PRODUTO: produto, pacote ou serviço da própria Prosystem (a Prosystem vende).
// - INTEGRACAO: ferramenta de uma empresa parceira. A Prosystem só indica; a empresa parceira
//   entra em contato e fecha o contrato direto com o cliente (sem vínculo contratual com a
//   Prosystem). Depois que o cliente fecha, a Prosystem faz a integração com o sistema.

export type TipoItemCatalogo = 'PRODUTO' | 'INTEGRACAO';
export type ItemCatalogo = { tipo?: TipoItemCatalogo; produto: string; descricao: string; preco: string; parceiro?: string };

/** Deixa o item salvo sempre no formato atual (itens antigos não tinham tipo: são produtos). */
export function normalizarItemCatalogo(x: any): ItemCatalogo | null {
  const produto = String(x?.produto || '').trim();
  if (!produto) return null;
  const tipo: TipoItemCatalogo = x?.tipo === 'INTEGRACAO' ? 'INTEGRACAO' : 'PRODUTO';
  const item: ItemCatalogo = { tipo, produto, descricao: String(x?.descricao || '').trim(), preco: String(x?.preco || '').trim() };
  if (tipo === 'INTEGRACAO') item.parceiro = String(x?.parceiro || '').trim() || produto;
  return item;
}

export function ehIntegracao(item: ItemCatalogo): boolean {
  return item.tipo === 'INTEGRACAO';
}

/** Mensagem padrão (usada quando a IA não responde). */
export function textoPadraoOferta(item: ItemCatalogo, ctx: { contato?: string | null; empresa: string }): string {
  const ola = `Olá${ctx.contato ? `, ${ctx.contato.split(' ')[0]}` : ''}! Aqui é da Prosystem.`;
  if (ehIntegracao(item)) {
    return `${ola} Agora que a ${ctx.empresa} já está rodando com o sistema, queria te indicar *${item.produto}*, da ${item.parceiro}, empresa parceira que integra com o Prosystem. ${item.descricao} Se tiver interesse, a própria ${item.parceiro} entra em contato para apresentar e combinar com você, e depois que fechar a gente faz a integração com o sistema. Posso passar seu contato para eles?`;
  }
  return `${ola} Agora que a ${ctx.empresa} já está rodando com o sistema, queria te apresentar: *${item.produto}*. ${item.descricao} Quer que eu te explique melhor?`;
}

/** Instrução para a IA escrever a mensagem, conforme o tipo do item. */
export function instrucaoOferta(item: ItemCatalogo): string {
  const base = 'Você escreve UMA mensagem curta de WhatsApp (até 4 linhas) da Prosystem para um cliente que já usa o sistema há algumas semanas. Use SOMENTE os dados enviados (não invente recursos nem valores). Tom consultivo, sem pressão, sem travessão. Responda só o texto.';
  if (ehIntegracao(item)) {
    return [
      base,
      'O item é uma INTEGRAÇÃO de uma empresa parceira (campo "parceiro"), não um produto da Prosystem. Diga com clareza:',
      '- que é uma indicação da Prosystem de uma empresa parceira que integra com o sistema;',
      '- que, se o cliente quiser, a própria empresa parceira entra em contato para apresentar e fechar com ele (o contrato é direto com o parceiro);',
      '- que, depois que ele fechar, a Prosystem faz a integração com o sistema.',
      'Nunca diga que a Prosystem vende, cobra ou é responsável pelo contrato do parceiro. Não cite preço, a não ser que venha no campo "preco", e nesse caso diga que é o valor informado pelo parceiro.',
      'Termine com UMA pergunta leve: se pode passar o contato dele para a empresa parceira.',
    ].join('\n');
  }
  return `${base} O item é um produto, pacote ou serviço da própria Prosystem que ele ainda não tem. Cite o preço só se vier nos dados. Termine com UMA pergunta leve de interesse.`;
}

/** Linha que vai para o histórico do card. */
export function linhaHistoricoOferta(item: ItemCatalogo): string {
  return ehIntegracao(item)
    ? `🤝 Indicação de integração enviada ao cliente: ${item.produto} (parceiro ${item.parceiro}). Se ele aceitar, passe o contato para o parceiro.`
    : `🛍️ Oferta enviada ao cliente: ${item.produto}.`;
}
