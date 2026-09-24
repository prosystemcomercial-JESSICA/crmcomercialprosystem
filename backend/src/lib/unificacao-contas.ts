/**
 * Unificação das contas da Jessica (set/2026) — partes PURAS (sem banco), usadas
 * por scripts/unificar-contas-jessica.ts e testadas em tests/unificacao-contas.test.ts.
 *
 * Decisões aprovadas pela Jessica:
 *   - Conta mantida: jessica@prosystemnet.com.br (SUPERVISAO_COMERCIAL) + flags
 *     vende=1 e admin_sistema=1.
 *   - Tudo que é de "Jessica Vendedora" (jelrepresentacoes.44@gmail.com), da conta
 *     mock 'user-jessica' e da duplicata INATIVA comercialprosystem@gmail.com passa
 *     para a conta mantida. Nada é apagado.
 *   - Leads ABERTOS da Sarah (saiu) voltam para "Leads para Distribuir".
 *   - Thiago (CEO) e Usuário QA ficam somente leitura; "CEO Teste 1" fica INATIVO.
 */

export interface UsuarioLinha {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  status: string | null;
}

export interface ConfigUnificacao {
  manterEmail: string;
  mesclarEmails: string[];
  mesclarIdsExtras: string[];       // ids sem linha em UsuarioCRM (conta mock)
  inativarEmails: string[];         // além das contas mescladas
  somenteLeituraEmails: string[];
  sarahEmail: string | null;
  nomeFinal: string | null;         // null = nome atual (trim) da conta mantida
}

export const CONFIG_PADRAO: ConfigUnificacao = {
  manterEmail: 'jessica@prosystemnet.com.br',
  mesclarEmails: ['jelrepresentacoes.44@gmail.com', 'comercialprosystem@gmail.com'],
  mesclarIdsExtras: ['user-jessica'],
  inativarEmails: ['prosystemcomercial@gmail.com'],
  somenteLeituraEmails: ['thiago@prosystemnet.com.br', 'teste.qa@prosystemnet.com.br'],
  sarahEmail: 'sarah@prosystemnet.com.br',
  nomeFinal: 'Jessica Cardoso',
};

export interface ContasResolvidas {
  manter: UsuarioLinha;
  nomeFinal: string;
  mesclarIds: string[];             // ids cujos registros vão para manter.id
  mescladasDb: UsuarioLinha[];      // as que existem em UsuarioCRM (serão INATIVADAS)
  inativarIds: string[];            // todas que devem terminar INATIVAS
  somenteLeituraIds: string[];
  sarah: UsuarioLinha | null;
  avisos: string[];
}

export class ErroUnificacao extends Error {
  constructor(msg: string) { super(msg); this.name = 'ErroUnificacao'; }
}

const norm = (e: string | null | undefined) => String(e || '').trim().toLowerCase();
const ativo = (u: UsuarioLinha) => String(u.status || 'ATIVO').toUpperCase() === 'ATIVO';

/** Decide quem é quem a partir dos usuários do banco — sempre por E-MAIL. */
export function resolverContas(usuarios: UsuarioLinha[], cfg: ConfigUnificacao = CONFIG_PADRAO): ContasResolvidas {
  const avisos: string[] = [];
  const porEmail = (email: string) => usuarios.filter(u => norm(u.email) === norm(email));

  const candidatosManter = porEmail(cfg.manterEmail).filter(ativo);
  if (candidatosManter.length !== 1) {
    throw new ErroUnificacao(
      `Conta a manter (${cfg.manterEmail}) precisa ser exatamente 1 linha ATIVA; encontradas ${candidatosManter.length}. Abortado.`
    );
  }
  const manter = candidatosManter[0];

  const mescladasDb: UsuarioLinha[] = [];
  for (const email of cfg.mesclarEmails) {
    const achadas = porEmail(email);
    if (!achadas.length) avisos.push(`Conta a mesclar não encontrada: ${email} (ignorada).`);
    for (const u of achadas) if (u.id !== manter.id) mescladasDb.push(u);
  }
  const mesclarIds = [...new Set([...mescladasDb.map(u => u.id), ...cfg.mesclarIdsExtras])]
    .filter(id => id && id !== manter.id);

  const protegidos = new Set<string>();
  const somenteLeituraIds: string[] = [];
  for (const email of cfg.somenteLeituraEmails) {
    const achadas = porEmail(email);
    if (!achadas.length) avisos.push(`Conta somente leitura não encontrada: ${email}.`);
    achadas.forEach(u => { somenteLeituraIds.push(u.id); protegidos.add(u.id); });
  }

  const inativarExtras: string[] = [];
  for (const email of cfg.inativarEmails) {
    const achadas = porEmail(email);
    if (!achadas.length) avisos.push(`Conta a inativar não encontrada: ${email}.`);
    achadas.forEach(u => inativarExtras.push(u.id));
  }

  let sarah: UsuarioLinha | null = null;
  if (cfg.sarahEmail) {
    const s = porEmail(cfg.sarahEmail);
    if (s.length === 1) sarah = s[0];
    else avisos.push(`Sarah (${cfg.sarahEmail}): ${s.length} linhas — redistribuição de leads ignorada.`);
  }

  // Salvaguardas: nada do que é mesclado pode ser a conta mantida, um usuário
  // somente leitura ou a Sarah (cada um tem destino próprio).
  for (const id of mesclarIds) {
    if (protegidos.has(id) || id === sarah?.id) {
      throw new ErroUnificacao(`Conflito de configuração: ${id} está na lista de mescla e em outra regra. Abortado.`);
    }
  }
  if (inativarExtras.includes(manter.id) || somenteLeituraIds.includes(manter.id)) {
    throw new ErroUnificacao('Conflito de configuração: a conta mantida não pode ser inativada nem somente leitura. Abortado.');
  }

  const inativarIds = [...new Set([...mescladasDb.map(u => u.id), ...inativarExtras])];
  const nomeFinal = (cfg.nomeFinal || manter.nome || '').trim() || 'Jessica';

  return { manter, nomeFinal, mesclarIds, mescladasDb, inativarIds, somenteLeituraIds, sarah, avisos };
}

// ─── Colunas que guardam id de usuário (dono/autoria) ─────────────────────────
export interface AlvoColuna {
  tabela: string;
  coluna: string;
  /** Colunas "espelho" (nome/e-mail do mesmo usuário) atualizadas junto. */
  espelhos?: { coluna: string; valor: 'nome' | 'email' }[];
  /** 'ignore' = UPDATE IGNORE (coluna em índice único; conflito fica no dono antigo e é reportado). */
  modo?: 'simples' | 'ignore';
}

const N = (coluna: string) => ({ coluna, valor: 'nome' as const });
const E = (coluna: string) => ({ coluna, valor: 'email' as const });

/**
 * Levantamento feito no schema.prisma + tabelas criadas por SQL cru nas rotas
 * (FunilEtapa/LeadPerda/LeadHistorico/MetaVendedor/AuditoriaUsuario/UsuarioCRM).
 * Comissao.responsavel_id e Meta.responsaveis_ids (JSON) têm passos próprios.
 * NÃO entram (de propósito): AuditoriaUsuario.alvo_id (o alvo histórico é a
 * conta antiga) e as colunas *_nome de trilhas de auditoria (nome histórico).
 */
export const ALVOS: AlvoColuna[] = [
  // Leads e funil
  { tabela: 'Lead', coluna: 'responsavel_id', espelhos: [N('vendedor_nome')] },
  { tabela: 'Lead', coluna: 'created_by' },
  { tabela: 'Lead', coluna: 'deleted_by' },
  { tabela: 'Lead', coluna: 'fechamento_por' },
  { tabela: 'LeadObservacao', coluna: 'created_by', espelhos: [N('created_by_name')] },
  { tabela: 'HistoricoLead', coluna: 'created_by' },
  { tabela: 'LeadHistorico', coluna: 'ator_id' },
  { tabela: 'LeadPerda', coluna: 'vendedor_id', espelhos: [N('vendedor_nome')] },
  { tabela: 'LeadOnboarding', coluna: 'created_by' },
  { tabela: 'LeadSequenciaEmail', coluna: 'created_by' },
  { tabela: 'KanbanColuna', coluna: 'created_by' },
  { tabela: 'QuadroComercial', coluna: 'dono_id' },
  { tabela: 'QuadroComercial', coluna: 'created_by' },
  { tabela: 'QuadroCompartilhamento', coluna: 'usuario_id', modo: 'ignore' },
  { tabela: 'Etiqueta', coluna: 'created_by' },
  { tabela: 'Atividade', coluna: 'responsavel_id' },
  { tabela: 'Atividade', coluna: 'created_by' },
  { tabela: 'CalendarToken', coluna: 'user_id', modo: 'ignore' },
  // Propostas / contratos / vendas
  { tabela: 'Proposta', coluna: 'created_by' },
  { tabela: 'PropostaComercial', coluna: 'vendedor_id', espelhos: [N('vendedor_nome'), E('vendedor_email')] },
  { tabela: 'PropostaComercial', coluna: 'supervisor_id', espelhos: [N('supervisor_nome'), E('supervisor_email')] },
  { tabela: 'PropostaComercial', coluna: 'created_by', espelhos: [N('created_by_name')] },
  { tabela: 'PropostaComercial', coluna: 'deleted_by' },
  { tabela: 'PropostaHistorico', coluna: 'feito_por_id' },
  { tabela: 'Contrato', coluna: 'created_by' },
  { tabela: 'Contrato', coluna: 'deleted_by' },
  { tabela: 'ContratoComercial', coluna: 'vendedor_id', espelhos: [N('vendedor_nome')] },
  { tabela: 'ContratoComercial', coluna: 'created_by' },
  { tabela: 'VendaAdicional', coluna: 'vendedor_id', espelhos: [N('vendedor_nome')] },
  { tabela: 'VendaAdicional', coluna: 'supervisao_id' },
  { tabela: 'VendaAdicional', coluna: 'created_by' },
  { tabela: 'Implantacao', coluna: 'vendedor_id', espelhos: [N('vendedor_nome')] },
  { tabela: 'Implantacao', coluna: 'created_by' },
  { tabela: 'CampanhaAtivo', coluna: 'vendedor_id', espelhos: [N('vendedor_nome')] },
  { tabela: 'CampanhaAtivo', coluna: 'criada_por' },
  { tabela: 'ContatoAtivo', coluna: 'vendedor_id' },
  { tabela: 'OportunidadeAtivo', coluna: 'vendedor_id' },
  { tabela: 'OportunidadeAtivo', coluna: 'criado_por' },
  { tabela: 'OportunidadeAtivo', coluna: 'confirmado_por' },
  // Metas / comissões / financeiro
  { tabela: 'Meta', coluna: 'responsavel_id' },
  { tabela: 'Meta', coluna: 'created_by' },
  { tabela: 'MetaVendedor', coluna: 'vendedor_id', espelhos: [N('vendedor_nome')], modo: 'ignore' },
  { tabela: 'RegraComissao', coluna: 'responsavel_id' },
  { tabela: 'Comissao', coluna: 'aprovada_por' },
  { tabela: 'Comissao', coluna: 'created_by' },
  { tabela: 'LancamentoFinanceiro', coluna: 'vendedor_id' },
  { tabela: 'LancamentoFinanceiro', coluna: 'created_by' },
  // Campanhas / e-mail
  { tabela: 'Campanha', coluna: 'created_by' },
  { tabela: 'Campanha', coluna: 'updated_by' },
  { tabela: 'Template', coluna: 'created_by' },
  { tabela: 'Template', coluna: 'updated_by' },
  { tabela: 'AuditoriaCompanha', coluna: 'usuario_id' },
  { tabela: 'SequenciaEmail', coluna: 'created_by' },
  // Clientes / retenção / suporte / implantação
  { tabela: 'CasoChurn', coluna: 'created_by' },
  { tabela: 'AcaoRetencao', coluna: 'responsavel_id' },
  { tabela: 'AtualizacaoCaso', coluna: 'feito_por' },
  { tabela: 'EventoCliente', coluna: 'feito_por' },
  { tabela: 'ClienteDocumento', coluna: 'enviado_por' },
  { tabela: 'HistoricoCnpjCliente', coluna: 'trocado_por' },
  { tabela: 'Licenca', coluna: 'responsavel_id' },
  { tabela: 'Onboarding', coluna: 'responsavel_id' },
  { tabela: 'Renovacao', coluna: 'responsavel_id' },
  { tabela: 'TicketSuporte', coluna: 'responsavel_id' },
  { tabela: 'ExecucaoTecnica', coluna: 'created_by' },
  { tabela: 'ImplantacaoAtividade', coluna: 'autor_id', espelhos: [N('autor_nome')] },
  { tabela: 'ImplantacaoTeste', coluna: 'testado_por' },
  { tabela: 'ImplantacaoArquivo', coluna: 'enviado_por' },
  { tabela: 'ImplantacaoChecklistItem', coluna: 'feito_por' },
  { tabela: 'CsatSurvey', coluna: 'criado_por' },
  { tabela: 'KbArtigo', coluna: 'autor_id', espelhos: [N('autor_nome')] },
  // WhatsApp
  { tabela: 'WhatsappInstancia', coluna: 'dono_id', espelhos: [N('dono_nome')] },
  { tabela: 'WhatsappConversa', coluna: 'dono_id' },
  { tabela: 'WhatsappMensagem', coluna: 'enviada_por' },
  // Sistema / auditoria
  { tabela: 'UsuarioCRM', coluna: 'created_by' },
  { tabela: 'ConfiguracaoIntegracao', coluna: 'updated_by' },
  { tabela: 'ResultadoAnualHistorico', coluna: 'created_by' },
  { tabela: 'AuditoriaUsuario', coluna: 'ator_id' },
];

// ─── Plano (SQL puro, parametrizado) ──────────────────────────────────────────
export interface Sql { sql: string; params: any[] }
export interface Passo {
  chave: string;
  descricao: string;
  requer: Array<[string, string]>;     // [tabela, coluna] que precisam existir
  contar: Sql;                         // deve devolver uma linha com { n }
  amostra?: Sql;                       // devolve linhas com { id }
  aplicar: Sql[];                      // vazio = passo só informativo
}

const q = (ident: string) => '`' + ident.replace(/`/g, '') + '`';
const lista = (n: number) => Array.from({ length: n }, () => '?').join(',');

export const STATUS_LEAD_FECHADO = { etapas: ['FECHADO', 'PERDIDO', 'CONTRATO_ASSINADO'], status: ['GANHO', 'PERDIDO'] };
export const OBS_REDISTRIBUICAO = 'Redistribuição: vendedora saiu';
export const COLUNAS_FLAGS = ['vende', 'admin_sistema', 'somente_leitura'];

export function montarPlano(c: ContasResolvidas, alvos: AlvoColuna[] = ALVOS): Passo[] {
  const passos: Passo[] = [];
  const ids = c.mesclarIds;
  const kept = c.manter.id;
  const valorEspelho = (v: 'nome' | 'email') => (v === 'nome' ? c.nomeFinal : norm(c.manter.email));

  if (ids.length) {
    // 1) Colunas simples (+ espelhos de nome/e-mail).
    for (const a of alvos) {
      const t = q(a.tabela), col = q(a.coluna);
      const esp = a.espelhos || [];
      const sets = [`${col} = ?`, ...esp.map(e => `${q(e.coluna)} = ?`)].join(', ');
      const ignore = a.modo === 'ignore' ? 'IGNORE ' : '';
      passos.push({
        chave: `${a.tabela}.${a.coluna}`,
        descricao: `Reatribui ${a.tabela}.${a.coluna}${esp.length ? ` (+ ${esp.map(e => e.coluna).join(', ')})` : ''}${a.modo === 'ignore' ? ' — índice único: conflitos ficam no dono antigo' : ''}`,
        requer: [[a.tabela, a.coluna], ...esp.map(e => [a.tabela, e.coluna] as [string, string])],
        contar: { sql: `SELECT COUNT(*) AS n FROM ${t} WHERE ${col} IN (${lista(ids.length)})`, params: [...ids] },
        amostra: { sql: `SELECT id FROM ${t} WHERE ${col} IN (${lista(ids.length)}) LIMIT 5`, params: [...ids] },
        aplicar: [{
          sql: `UPDATE ${ignore}${t} SET ${sets} WHERE ${col} IN (${lista(ids.length)})`,
          params: [kept, ...esp.map(e => valorEspelho(e.valor)), ...ids],
        }],
      });
      // Normaliza o nome/e-mail espelho nos registros que JÁ eram da conta mantida.
      for (const e of esp) {
        const val = valorEspelho(e.valor);
        passos.push({
          chave: `${a.tabela}.${e.coluna}#normaliza`,
          descricao: `Padroniza ${a.tabela}.${e.coluna} = "${val}" onde ${a.coluna} já é da conta mantida`,
          requer: [[a.tabela, a.coluna], [a.tabela, e.coluna]],
          contar: { sql: `SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ? AND ${q(e.coluna)} IS NOT NULL AND ${q(e.coluna)} <> ?`, params: [kept, val] },
          amostra: { sql: `SELECT id FROM ${t} WHERE ${col} = ? AND ${q(e.coluna)} IS NOT NULL AND ${q(e.coluna)} <> ? LIMIT 5`, params: [kept, val] },
          aplicar: [{ sql: `UPDATE ${t} SET ${q(e.coluna)} = ? WHERE ${col} = ? AND ${q(e.coluna)} IS NOT NULL AND ${q(e.coluna)} <> ?`, params: [val, kept, val] }],
        });
      }
    }

    // 2) Comissao.referencia_id dos BÔNUS (chave de idempotência "bonus-<tri>-<id>"):
    //    troca o sufixo do id antigo pelo mantido, p/ o lançamento do trimestre não duplicar.
    for (const old of ids) {
      const novoRef = `CONCAT(LEFT(c.referencia_id, CHAR_LENGTH(c.referencia_id) - CHAR_LENGTH(?)), ?)`;
      const where = `c.tipo = 'BONUS' AND c.referencia_id LIKE ? AND k.id IS NULL`;
      const join = `LEFT JOIN Comissao k ON k.tipo = 'BONUS' AND k.referencia_id = ${novoRef}`;
      const pJoin = [old, kept];
      const pLike = [`%-${old}`];
      passos.push({
        chave: `Comissao.referencia_id#bonus:${old}`,
        descricao: `Bônus: referencia_id "…-${old}" → "…-${kept}" (sem sobrescrever bônus já existente)`,
        requer: [['Comissao', 'referencia_id']],
        contar: { sql: `SELECT COUNT(*) AS n FROM Comissao c ${join} WHERE ${where}`, params: [...pJoin, ...pLike] },
        amostra: { sql: `SELECT c.id FROM Comissao c ${join} WHERE ${where} LIMIT 5`, params: [...pJoin, ...pLike] },
        aplicar: [{
          sql: `UPDATE Comissao c ${join} SET c.referencia_id = ${novoRef} WHERE ${where}`,
          params: [...pJoin, old, kept, ...pLike],
        }],
      });
    }

    // 3) Comissao.responsavel_id — re-dono SEM mudar tipo/papel/percentual. Se a
    //    conta mantida (ou outra conta mesclada) já tem comissão ativa da MESMA
    //    referência+tipo+papel, a linha NÃO é movida (evita pagar em dobro) e é
    //    listada no passo informativo abaixo para revisão manual.
    const todos = [kept, ...ids];
    const joinConf = `LEFT JOIN Comissao k ON k.id <> c.id AND c.referencia_id IS NOT NULL AND k.referencia_id = c.referencia_id`
      + ` AND k.tipo = c.tipo AND k.papel <=> c.papel AND k.status <> 'CANCELADA' AND k.responsavel_id IN (${lista(todos.length)})`;
    const semConflito = `c.responsavel_id IN (${lista(ids.length)}) AND (k.id IS NULL OR c.status = 'CANCELADA')`;
    const comConflito = `c.responsavel_id IN (${lista(ids.length)}) AND k.id IS NOT NULL AND c.status <> 'CANCELADA'`;
    passos.push({
      chave: 'Comissao.responsavel_id',
      descricao: 'Reatribui comissões (tipo/papel/percentual intactos; 15% continua comissão de venda)',
      requer: [['Comissao', 'responsavel_id'], ['Comissao', 'papel']],
      contar: { sql: `SELECT COUNT(DISTINCT c.id) AS n FROM Comissao c ${joinConf} WHERE ${semConflito}`, params: [...todos, ...ids] },
      amostra: { sql: `SELECT DISTINCT c.id FROM Comissao c ${joinConf} WHERE ${semConflito} LIMIT 5`, params: [...todos, ...ids] },
      aplicar: [{ sql: `UPDATE Comissao c ${joinConf} SET c.responsavel_id = ? WHERE ${semConflito}`, params: [...todos, kept, ...ids] }],
    });
    passos.push({
      chave: 'Comissao.responsavel_id#conflitos',
      descricao: 'INFORMATIVO — comissões que NÃO serão movidas (duplicariam referência+tipo+papel); revisar manualmente',
      requer: [['Comissao', 'responsavel_id'], ['Comissao', 'papel']],
      contar: { sql: `SELECT COUNT(DISTINCT c.id) AS n FROM Comissao c ${joinConf} WHERE ${comConflito}`, params: [...todos, ...ids] },
      amostra: { sql: `SELECT DISTINCT c.id FROM Comissao c ${joinConf} WHERE ${comConflito} LIMIT 20`, params: [...todos, ...ids] },
      aplicar: [],
    });

    // 4) Meta.responsaveis_ids (JSON com a lista de responsáveis).
    for (const old of ids) {
      passos.push({
        chave: `Meta.responsaveis_ids:${old}`,
        descricao: `Troca ${old} por ${kept} dentro de Meta.responsaveis_ids (JSON)`,
        requer: [['Meta', 'responsaveis_ids']],
        contar: { sql: `SELECT COUNT(*) AS n FROM Meta WHERE JSON_CONTAINS(responsaveis_ids, JSON_QUOTE(?))`, params: [old] },
        amostra: { sql: `SELECT id FROM Meta WHERE JSON_CONTAINS(responsaveis_ids, JSON_QUOTE(?)) LIMIT 5`, params: [old] },
        aplicar: [{
          sql: `UPDATE Meta SET responsaveis_ids = CAST(REPLACE(CAST(responsaveis_ids AS CHAR), ?, ?) AS JSON) WHERE JSON_CONTAINS(responsaveis_ids, JSON_QUOTE(?))`,
          params: [JSON.stringify(old), JSON.stringify(kept), old],
        }],
      });
    }
  }

  // 5) Leads ABERTOS da Sarah → "Leads para Distribuir" (etapa_sdr QUALIFICADO +
  //    sem responsável), com observação. Fechados/perdidos continuam dela.
  if (c.sarah) {
    const e = STATUS_LEAD_FECHADO;
    const cond = `responsavel_id = ? AND deleted_at IS NULL`
      + ` AND etapa_comercial NOT IN (${lista(e.etapas.length)}) AND status NOT IN (${lista(e.status.length)})`;
    const p = [c.sarah.id, ...e.etapas, ...e.status];
    passos.push({
      chave: 'Lead#sarah-redistribuir',
      descricao: `Leads abertos de ${c.sarah.nome.trim()} → Leads para Distribuir (+ observação "${OBS_REDISTRIBUICAO}")`,
      requer: [['Lead', 'responsavel_id'], ['Lead', 'deleted_at'], ['Lead', 'etapa_sdr'], ['LeadObservacao', 'lead_id']],
      contar: { sql: `SELECT COUNT(*) AS n FROM \`Lead\` WHERE ${cond}`, params: p },
      amostra: { sql: `SELECT id FROM \`Lead\` WHERE ${cond} LIMIT 5`, params: p },
      aplicar: [
        // A observação vem ANTES do UPDATE (depois dele o lead não casa mais com a condição).
        {
          sql: `INSERT INTO LeadObservacao (id, lead_id, tipo, descricao, created_by, created_by_name, created_at)`
            + ` SELECT UUID(), id, 'SISTEMA', ?, ?, 'Sistema', NOW() FROM \`Lead\` WHERE ${cond}`,
          params: [OBS_REDISTRIBUICAO, kept, ...p],
        },
        {
          sql: `UPDATE \`Lead\` SET responsavel_id = NULL, vendedor_nome = NULL, etapa_sdr = 'QUALIFICADO' WHERE ${cond}`,
          params: p,
        },
      ],
    });
  }

  // 6) Contas: flags, nome e status.
  const flagCols: Array<[string, string]> = COLUNAS_FLAGS.map(f => ['UsuarioCRM', f] as [string, string]);
  passos.push({
    chave: 'UsuarioCRM#conta-mantida',
    descricao: `Conta mantida (${c.manter.email}): vende=1, admin_sistema=1, somente_leitura=0, nome="${c.nomeFinal}"`,
    requer: flagCols,
    contar: {
      sql: `SELECT COUNT(*) AS n FROM UsuarioCRM WHERE id = ? AND (vende <> 1 OR admin_sistema <> 1 OR somente_leitura <> 0 OR nome <> ?)`,
      params: [kept, c.nomeFinal],
    },
    aplicar: [{
      sql: `UPDATE UsuarioCRM SET vende = 1, admin_sistema = 1, somente_leitura = 0, nome = ?, updated_at = NOW() WHERE id = ?`,
      params: [c.nomeFinal, kept],
    }],
  });
  if (c.somenteLeituraIds.length) {
    const L = c.somenteLeituraIds;
    passos.push({
      chave: 'UsuarioCRM#somente-leitura',
      descricao: 'Thiago (CEO) e Usuário QA → somente_leitura=1',
      requer: flagCols,
      contar: { sql: `SELECT COUNT(*) AS n FROM UsuarioCRM WHERE id IN (${lista(L.length)}) AND somente_leitura <> 1`, params: [...L] },
      amostra: { sql: `SELECT id FROM UsuarioCRM WHERE id IN (${lista(L.length)}) AND somente_leitura <> 1`, params: [...L] },
      aplicar: [{ sql: `UPDATE UsuarioCRM SET somente_leitura = 1, updated_at = NOW() WHERE id IN (${lista(L.length)})`, params: [...L] }],
    });
  }
  if (c.inativarIds.length) {
    const I = c.inativarIds;
    passos.push({
      chave: 'UsuarioCRM#inativar',
      descricao: 'Jessica Vendedora, duplicata comercialprosystem e CEO Teste 1 → INATIVO',
      requer: [['UsuarioCRM', 'status']],
      contar: { sql: `SELECT COUNT(*) AS n FROM UsuarioCRM WHERE id IN (${lista(I.length)}) AND (status IS NULL OR status <> 'INATIVO')`, params: [...I] },
      amostra: { sql: `SELECT id FROM UsuarioCRM WHERE id IN (${lista(I.length)}) AND (status IS NULL OR status <> 'INATIVO')`, params: [...I] },
      aplicar: [{ sql: `UPDATE UsuarioCRM SET status = 'INATIVO', updated_at = NOW() WHERE id IN (${lista(I.length)})`, params: [...I] }],
    });
  }

  return passos;
}

/** Separa passos executáveis dos que dependem de tabela/coluna inexistente. */
export function filtrarPorColunasExistentes(passos: Passo[], existentes: Set<string>) {
  const ok: Passo[] = [];
  const ausentes: { passo: Passo; faltam: string[] }[] = [];
  for (const p of passos) {
    const faltam = p.requer.map(([t, c]) => `${t}.${c}`).filter(k => !existentes.has(k));
    if (faltam.length) ausentes.push({ passo: p, faltam });
    else ok.push(p);
  }
  return { ok, ausentes };
}

/** DDL aditiva das flags que ainda faltam (roda FORA da transação — DDL faz commit implícito no MySQL). */
export function ddlFlagsFaltantes(existentes: Set<string>): string[] {
  return COLUNAS_FLAGS
    .filter(f => !existentes.has(`UsuarioCRM.${f}`))
    .map(f => `ALTER TABLE UsuarioCRM ADD COLUMN ${f} TINYINT(1) NOT NULL DEFAULT 0`);
}
