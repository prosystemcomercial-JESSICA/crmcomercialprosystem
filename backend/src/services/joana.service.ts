import type { PrismaClient } from '@prisma/client';
import { chamarGemini } from './ia-gemini.service';
import { lerJsonIa } from '@/lib/assistente/ia-texto';
import { registrarAcaoAgente } from '@/lib/assistente/escritorio';

/**
 * JOANA — jornalista do Informativo Prosystem (quinzenal).
 * Papel: ESCREVE. A Sofia pesquisa, a Jessica aprova, o Zequinha envia pelo WhatsApp
 * e o e-mail sai pelo servidor do sistema. Nada sai sem aprovação.
 *  - Edição "lista": leads com a porta aberta (etiqueta Informativo Prosystem) → WhatsApp curto + e-mail.
 *  - Edição "clientes": clientes ativos → só e-mail (sem risco para o número de WhatsApp).
 */

const JOANA = [
  'Você é a Joana, jornalista da Prosystem Sistemas (ERP/PDV para farmácias, drogarias, manipulação e padarias no Brasil).',
  'Você escreve o Informativo Prosystem: útil, curto, com cara de jornal e não de propaganda. Dá dicas práticas de gestão e conta as novidades do setor com fonte.',
  'Português do Brasil, frases curtas, sem travessão, sem exagero de emoji. Nunca invente dados, prazos, leis ou números: use só o que está nas pesquisas. Nunca fale de preço ou desconto.',
].join('\n');

const LOTE_EMAILS = 40; // por rodada do agendador (ritmo seguro para o servidor de e-mail)

type Edicao = {
  assunto_clientes: string; email_clientes: string;
  assunto_lista: string; email_lista: string; whatsapp_lista: string;
};

/** Markdown simples → HTML de e-mail (títulos, listas, negrito, links). */
export function mdParaHtml(md: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (t: string) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  const out: string[] = [];
  let lista = false;
  for (const l of md.split('\n')) {
    const li = l.match(/^\s*[-*] (.*)/);
    if (li) { if (!lista) { out.push('<ul>'); lista = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (lista) { out.push('</ul>'); lista = false; }
    if (/^#{1,3} /.test(l)) out.push(`<h2 style="font-size:18px;margin:18px 0 6px;color:#0f172a">${inline(l.replace(/^#+ /, ''))}</h2>`);
    else if (l.trim()) out.push(`<p style="margin:0 0 10px">${inline(l)}</p>`);
  }
  if (lista) out.push('</ul>');
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#334155;max-width:620px;margin:0 auto">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed;margin:0 0 4px"><b>Informativo Prosystem</b></p>
${out.join('\n')}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 10px">
<p style="font-size:12px;color:#94a3b8">Você recebe este informativo porque tem relacionamento com a Prosystem Sistemas. Para não receber mais, responda este e-mail com a palavra SAIR.</p>
</div>`;
}

/** Joana escreve a edição (a partir das pesquisas recentes da Sofia) e deixa para a Jessica aprovar. */
export async function escreverInformativo(prisma: PrismaClient) {
  const desde = new Date(Date.now() - 30 * 864e5);
  const pesquisas = await prisma.pesquisaSetor.findMany({ where: { created_at: { gte: desde } }, orderBy: { created_at: 'desc' }, take: 4 }).catch(() => [] as any[]);
  if (!pesquisas.length) { registrarAcaoAgente('joana', 'esperando pesquisas da Sofia para escrever'); return null; }
  const material = pesquisas.map((p: any) => `## ${p.titulo}\n${p.resumo || ''}\n${JSON.stringify(p.itens || '').slice(0, 5000)}\nFontes: ${JSON.stringify(p.fontes || '').slice(0, 800)}`).join('\n\n');
  const { instrucoesPara } = await import('./agentes-conversa.service');
  const pergunta = [
    'Escreva a próxima edição do Informativo Prosystem com base nas pesquisas da Sofia abaixo. Duas versões:',
    '1) CLIENTES (já usam o sistema Prosystem): foco em tirar mais proveito do dia a dia da loja, novidades do setor que afetam a gestão e dicas práticas. Tom de parceiro. E-mail em markdown, 3 a 5 blocos curtos com título, cada notícia com a fonte.',
    '2) LISTA (lojistas que conversaram com a gente mas ainda não compraram): mesmo conteúdo útil, sem vender; no fim, uma frase leve dizendo que estamos à disposição. E-mail em markdown + uma versão para WhatsApp com no máximo 700 caracteres, sem links, 2 ou 3 dicas numeradas.',
    'Assuntos de e-mail curtos e específicos (sem "Newsletter", sem caixa alta).',
    'Responda APENAS com JSON: {"assunto_clientes": string, "email_clientes": string, "assunto_lista": string, "email_lista": string, "whatsapp_lista": string}',
    '', '=== PESQUISAS DA SOFIA ===', material,
  ].join('\n');
  const r = lerJsonIa<Edicao>(await chamarGemini(prisma, { sistema: JOANA + (await instrucoesPara(prisma, 'joana')), partes: [{ text: pergunta }], json: true, temperatura: 0.5, timeoutMs: 150_000 }));
  if (!r?.email_clientes || !r?.whatsapp_lista) throw new Error('a Joana não conseguiu fechar a edição desta vez');
  const dia = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const md = [
    `# Informativo Prosystem · edição de ${dia}`, '',
    `Fontes: pesquisas da Sofia (${pesquisas.map((p: any) => p.titulo).join('; ')}).`, '',
    '## Para os clientes (e-mail)', `**Assunto:** ${r.assunto_clientes}`, '', r.email_clientes, '',
    '## Para a lista Informativo (e-mail)', `**Assunto:** ${r.assunto_lista}`, '', r.email_lista, '',
    '## Para a lista Informativo (WhatsApp)', r.whatsapp_lista.slice(0, 900),
  ].join('\n');
  const doc = await prisma.especialistaDoc.create({
    data: { tipo: 'INFORMATIVO', titulo: `Informativo Prosystem · ${dia}`, conteudo: md, origem: 'joana', status: 'PROPOSTO', fontes: { edicao: r as any, envio: null } },
  });
  registrarAcaoAgente('joana', `escreveu o Informativo de ${dia} (esperando aprovação)`);
  const { enviarAvisoGestao } = await import('./assistente-gestao.service');
  await enviarAvisoGestao(prisma, 'lead_qualificado', `📰 *Joana escreveu o Informativo Prosystem de ${dia}*\nClientes: "${r.assunto_clientes}"\nLista: "${r.assunto_lista}"\n\nLeia e aprove no Escritório virtual › Painel da Joana. Só sai depois da sua aprovação.`, { somenteAprovadora: true }).catch(() => {});
  return doc;
}

/** Aprovada pela Jessica: monta a fila de e-mails (clientes + lista) e a campanha de WhatsApp da lista (Zequinha). */
export async function aprovarInformativo(prisma: PrismaClient, id: string, userId: string) {
  const d = await prisma.especialistaDoc.findUnique({ where: { id } });
  if (!d || d.origem !== 'joana') throw new Error('Edição não encontrada.');
  if (d.status !== 'PROPOSTO') throw new Error('Esta edição já foi decidida.');
  const e: Edicao = (d.fontes as any)?.edicao;
  if (!e) throw new Error('Edição sem conteúdo.');
  const clientes = await prisma.cliente.findMany({ where: { situacao: 'ATIVA', email: { contains: '@' } }, select: { email: true } });
  const lista = await prisma.lead.findMany({
    where: { deleted_at: null, email: { contains: '@' }, etiquetas_lead: { some: { etiqueta: { nome: { in: ['Informativo Prosystem', 'News'] }, tipo: 'LEAD' } } } } as any,
    select: { email: true },
  });
  const limpa = (xs: (string | null)[]) => [...new Set(xs.map(x => (x || '').trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))];
  const filaClientes = limpa(clientes.map(c => c.email));
  const filaLista = limpa(lista.map(l => l.email)).filter(x => !filaClientes.includes(x));
  // WhatsApp só para a lista (poucos contatos), pelo Zequinha, no ritmo seguro das campanhas.
  const { criarCampanha } = await import('./assistente-campanhas.service');
  const camp = await criarCampanha(prisma, { publico: 'NEWS' as any, nome: `Informativo Prosystem · ${d.titulo.split('· ')[1] || ''}`.trim(), texto: e.whatsapp_lista.slice(0, 900) }, userId).catch(() => null);
  const envio = { clientes: filaClientes, lista: filaLista, total: filaClientes.length + filaLista.length, enviados: 0, falhas: 0, campanha_id: camp?.id || null, whatsapp: camp?.total || 0, inicio: new Date().toISOString() };
  await prisma.especialistaDoc.update({ where: { id }, data: { status: 'APROVADO', decidido_por: userId, decidido_em: new Date(), fontes: { edicao: e as any, envio } as any } });
  registrarAcaoAgente('joana', `teve o Informativo aprovado: ${envio.total} e-mails e ${envio.whatsapp} WhatsApp na fila`);
  if (camp) registrarAcaoAgente('zequinha', `recebeu da Joana o Informativo para ${camp.total} contato(s) da lista`);
  return { emails: envio.total, whatsapp: envio.whatsapp };
}

/** Agendador: escreve a edição quinzenal (quinta de manhã) e manda os e-mails aprovados em lotes. */
export async function rodarJoana(prisma: PrismaClient, agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  const dia = partes.find(p => p.type === 'weekday')?.value || '';
  const hora = Number(partes.find(p => p.type === 'hour')?.value);
  const { podeEnviarUmaVez } = await import('./envio-unico.service');
  if (dia === 'Thu' && hora >= 9 && hora < 12 && await podeEnviarUmaVez(prisma, 'joana.edicao', 24 * 13)) {
    await escreverInformativo(prisma).catch(e => console.error('[JOANA] edição:', e?.message));
  }
  // Envio dos e-mails aprovados: dias úteis, 8h–18h, em lotes.
  if (['Sat', 'Sun'].includes(dia) || hora < 8 || hora >= 18) return;
  const d = await prisma.especialistaDoc.findFirst({ where: { origem: 'joana', status: 'APROVADO' }, orderBy: { decidido_em: 'desc' } });
  const f: any = d?.fontes;
  const env = f?.envio;
  if (!d || !env || env.enviados + env.falhas >= env.total) return;
  const { enviarEmailInformativo } = await import('./email.service');
  const todos: { para: string; assunto: string; md: string }[] = [
    ...env.clientes.map((x: string) => ({ para: x, assunto: f.edicao.assunto_clientes, md: f.edicao.email_clientes })),
    ...env.lista.map((x: string) => ({ para: x, assunto: f.edicao.assunto_lista, md: f.edicao.email_lista })),
  ];
  const inicio = env.enviados + env.falhas;
  let ok = 0, falha = 0;
  for (const m of todos.slice(inicio, inicio + LOTE_EMAILS)) {
    const r = await enviarEmailInformativo(m.para, m.assunto, mdParaHtml(m.md)).catch(() => false);
    if (r) ok++; else falha++;
    await new Promise(res => setTimeout(res, 1500));
  }
  await prisma.especialistaDoc.update({ where: { id: d.id }, data: { fontes: { ...f, envio: { ...env, enviados: env.enviados + ok, falhas: env.falhas + falha } } } });
  registrarAcaoAgente('joana', `enviou ${ok} e-mail(s) do Informativo (${env.enviados + ok}/${env.total})`);
}
