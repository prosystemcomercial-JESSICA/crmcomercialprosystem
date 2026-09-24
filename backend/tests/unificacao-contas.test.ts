import { describe, it, expect } from 'vitest';
import {
  resolverContas, montarPlano, filtrarPorColunasExistentes, ddlFlagsFaltantes,
  CONFIG_PADRAO, ErroUnificacao, ALVOS, UsuarioLinha, OBS_REDISTRIBUICAO,
} from '@/lib/unificacao-contas';

// Espelho dos usuários de produção (ids fictícios).
const U = (id: string, email: string, nome: string, cargo: string, status = 'ATIVO'): UsuarioLinha => ({ id, email, nome, cargo, status });
const USUARIOS: UsuarioLinha[] = [
  U('thiago', 'thiago@prosystemnet.com.br', 'Thiago Leandro de Faria', 'CEO'),
  U('ceo-teste', 'prosystemcomercial@gmail.com', 'CEO Teste 1', 'CEO'),
  U('qa', 'teste.qa@prosystemnet.com.br', 'Usuário QA (E2E)', 'CEO'),
  U('ana', 'anaclara@prosystemnet.com.br', 'Ana Clara', 'SDR'),
  U('jess', 'Jessica@ProSystemNet.com.br ', 'Jessica Supervisao ', 'SUPERVISAO_COMERCIAL'),
  U('lucas', 'lucas@prosystemnet.com.br', 'Lucas Diniz', 'TECNICO_IMPLANTACAO'),
  U('jess-vend', 'jelrepresentacoes.44@gmail.com', 'Jessica Vendedora', 'VENDEDOR'),
  U('jess-dup', 'comercialprosystem@gmail.com', 'Jessica Supervisao ', 'SUPERVISAO_COMERCIAL', 'INATIVO'),
  U('sarah', 'sarah@prosystemnet.com.br', 'Sarah Barcelos', 'VENDEDOR', 'INATIVO'),
];

describe('resolverContas', () => {
  it('mapeia contas por e-mail (sem ids fixos)', () => {
    const c = resolverContas(USUARIOS);
    expect(c.manter.id).toBe('jess');
    expect(c.mesclarIds.sort()).toEqual(['jess-dup', 'jess-vend', 'user-jessica']);
    expect(c.inativarIds.sort()).toEqual(['ceo-teste', 'jess-dup', 'jess-vend']);
    expect(c.somenteLeituraIds.sort()).toEqual(['qa', 'thiago']);
    expect(c.sarah?.id).toBe('sarah');
    expect(c.nomeFinal).toBe('Jessica Cardoso');
    expect(c.avisos).toEqual([]);
  });

  it('não mexe em Lucas nem Ana Clara', () => {
    const c = resolverContas(USUARIOS);
    const tocados = [...c.mesclarIds, ...c.inativarIds, ...c.somenteLeituraIds, c.manter.id];
    expect(tocados).not.toContain('lucas');
    expect(tocados).not.toContain('ana');
  });

  it('aborta se a conta mantida não for exatamente 1 ATIVA', () => {
    const semAtiva = USUARIOS.map(u => (u.id === 'jess' ? { ...u, status: 'INATIVO' } : u));
    expect(() => resolverContas(semAtiva)).toThrow(ErroUnificacao);
    const duas = [...USUARIOS, U('jess2', 'jessica@prosystemnet.com.br', 'Outra', 'VENDEDOR')];
    expect(() => resolverContas(duas)).toThrow(/exatamente 1/);
    expect(() => resolverContas(USUARIOS.filter(u => u.id !== 'jess'))).toThrow(ErroUnificacao);
  });

  it('aborta se a configuração mandar mesclar uma conta protegida', () => {
    expect(() => resolverContas(USUARIOS, { ...CONFIG_PADRAO, mesclarEmails: ['thiago@prosystemnet.com.br'] }))
      .toThrow(/Conflito/);
  });

  it('é idempotente: depois de aplicado (duplicatas INATIVAS) resolve igual', () => {
    const depois = USUARIOS.map(u => (['jess-vend', 'ceo-teste'].includes(u.id) ? { ...u, status: 'INATIVO' } : u));
    expect(resolverContas(depois).mesclarIds.sort()).toEqual(['jess-dup', 'jess-vend', 'user-jessica']);
  });

  it('avisa (sem abortar) quando conta opcional não existe', () => {
    const c = resolverContas(USUARIOS.filter(u => u.id !== 'sarah'));
    expect(c.sarah).toBeNull();
    expect(c.avisos.join(' ')).toMatch(/Sarah/);
  });
});

const placeholders = (sql: string) => (sql.match(/\?/g) || []).length;

describe('montarPlano', () => {
  const contas = resolverContas(USUARIOS);
  const plano = montarPlano(contas);

  it('cada SQL tem exatamente um parâmetro por placeholder', () => {
    for (const p of plano) {
      for (const s of [p.contar, ...(p.amostra ? [p.amostra] : []), ...p.aplicar]) {
        expect(placeholders(s.sql), `${p.chave}: ${s.sql}`).toBe(s.params.length);
      }
    }
  });

  it('cobre todas as colunas-alvo e nunca apaga nada', () => {
    const chaves = new Set(plano.map(p => p.chave));
    for (const a of ALVOS) expect(chaves.has(`${a.tabela}.${a.coluna}`)).toBe(true);
    for (const k of ['Lead.responsavel_id', 'ContratoComercial.vendedor_id', 'Comissao.responsavel_id',
      'VendaAdicional.vendedor_id', 'Atividade.responsavel_id', 'WhatsappConversa.dono_id', 'MetaVendedor.vendedor_id',
      'LeadObservacao.created_by', 'PropostaComercial.vendedor_id', 'AuditoriaUsuario.ator_id']) {
      expect(chaves.has(k), k).toBe(true);
    }
    for (const p of plano) for (const s of p.aplicar) expect(s.sql).not.toMatch(/\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i);
  });

  it('reatribuição simples leva ao id mantido e grava nome/e-mail espelho', () => {
    const p = plano.find(x => x.chave === 'PropostaComercial.vendedor_id')!;
    expect(p.aplicar[0].sql).toMatch(/^UPDATE `PropostaComercial` SET `vendedor_id` = \?, `vendedor_nome` = \?, `vendedor_email` = \?/);
    expect(p.aplicar[0].params.slice(0, 3)).toEqual(['jess', 'Jessica Cardoso', 'jessica@prosystemnet.com.br']);
    expect(p.aplicar[0].params.slice(3).sort()).toEqual(['jess-dup', 'jess-vend', 'user-jessica']);
  });

  it('colunas com índice único usam UPDATE IGNORE', () => {
    expect(plano.find(x => x.chave === 'MetaVendedor.vendedor_id')!.aplicar[0].sql).toMatch(/^UPDATE IGNORE/);
    expect(plano.find(x => x.chave === 'CalendarToken.user_id')!.aplicar[0].sql).toMatch(/^UPDATE IGNORE/);
  });

  it('bônus não renomeado (conta mantida já tem "…-<kept>") vira conflito e não é movido', () => {
    const p = plano.find(x => x.chave === 'Comissao.responsavel_id')!;
    const sql = p.aplicar[0].sql;
    // join com o ref RENOMEADO (sufixo do dono antigo trocado pelo id mantido)
    expect(sql).toMatch(/LEFT JOIN Comissao kb ON c\.tipo = 'BONUS'/);
    expect(sql).toMatch(/kb\.referencia_id = CONCAT\(LEFT\(c\.referencia_id, CHAR_LENGTH\(c\.referencia_id\) - CHAR_LENGTH\(c\.responsavel_id\)\), \?\)/);
    // a linha só se move se NÃO houver kb
    expect(sql).toMatch(/k\.id IS NULL AND kb\.id IS NULL/);
    // o parâmetro do sufixo novo é o id mantido (vem logo após os ids do join k)
    const nPlaceK = 1 + contas.mesclarIds.length;
    expect(p.aplicar[0].params[nPlaceK]).toBe('jess');
    const conf = plano.find(x => x.chave === 'Comissao.responsavel_id#conflitos')!;
    expect(conf.contar.sql).toMatch(/k\.id IS NOT NULL OR kb\.id IS NOT NULL/);
  });

  it('WhatsappInstancia: só informa quantas a conta mantida terá (não altera)', () => {
    const w = plano.find(x => x.chave === 'WhatsappInstancia#varias')!;
    expect(w.aplicar).toEqual([]);
    expect(w.contar.params).toContain('jess');
  });

  it('comissões: só troca o dono (sem mexer em tipo/papel/percentual) e reporta conflitos à parte', () => {
    const p = plano.find(x => x.chave === 'Comissao.responsavel_id')!;
    expect(p.aplicar).toHaveLength(1);
    expect(p.aplicar[0].sql).toMatch(/SET c\.responsavel_id = \? WHERE/);
    expect(p.aplicar[0].sql).not.toMatch(/papel\s*=\s*\?|percentual|tipo\s*=\s*\?/);
    const conf = plano.find(x => x.chave === 'Comissao.responsavel_id#conflitos')!;
    expect(conf.aplicar).toEqual([]);
  });

  it('leads da Sarah: observação antes de soltar o lead, e só abertos', () => {
    const p = plano.find(x => x.chave === 'Lead#sarah-redistribuir')!;
    expect(p.aplicar[0].sql).toMatch(/^INSERT INTO LeadObservacao/);
    expect(p.aplicar[0].params[0]).toBe(OBS_REDISTRIBUICAO);
    expect(p.aplicar[1].sql).toMatch(/SET responsavel_id = NULL, vendedor_nome = NULL, etapa_sdr = 'QUALIFICADO'/);
    expect(p.contar.params).toEqual(['sarah', 'FECHADO', 'PERDIDO', 'CONTRATO_ASSINADO', 'GANHO', 'PERDIDO']);
    expect(p.contar.sql).toMatch(/deleted_at IS NULL/);
  });

  it('flags e status das contas', () => {
    const m = plano.find(x => x.chave === 'UsuarioCRM#conta-mantida')!;
    expect(m.aplicar[0].params).toEqual(['Jessica Cardoso', 'jess']);
    const ro = plano.find(x => x.chave === 'UsuarioCRM#somente-leitura')!;
    expect(ro.aplicar[0].params.sort()).toEqual(['qa', 'thiago']);
    const ina = plano.find(x => x.chave === 'UsuarioCRM#inativar')!;
    expect(ina.aplicar[0].params.sort()).toEqual(['ceo-teste', 'jess-dup', 'jess-vend']);
  });

  it('sem contas a mesclar, não gera reatribuições (só flags/status)', () => {
    const c = { ...contas, mesclarIds: [] };
    expect(montarPlano(c).some(p => p.chave === 'Lead.responsavel_id')).toBe(false);
  });
});

describe('filtrarPorColunasExistentes / ddlFlagsFaltantes', () => {
  it('pula passos de tabela/coluna inexistente e gera DDL só das flags que faltam', () => {
    const plano = montarPlano(resolverContas(USUARIOS));
    const existentes = new Set(['Lead.responsavel_id', 'Lead.vendedor_nome', 'UsuarioCRM.status', 'UsuarioCRM.vende']);
    const { ok, ausentes } = filtrarPorColunasExistentes(plano, existentes);
    expect(ok.map(p => p.chave)).toContain('Lead.responsavel_id');
    expect(ok.map(p => p.chave)).toContain('UsuarioCRM#inativar');
    expect(ausentes.find(a => a.passo.chave === 'UsuarioCRM#conta-mantida')!.faltam)
      .toEqual(['UsuarioCRM.admin_sistema', 'UsuarioCRM.somente_leitura']);
    expect(ddlFlagsFaltantes(existentes)).toEqual([
      'ALTER TABLE UsuarioCRM ADD COLUMN admin_sistema TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE UsuarioCRM ADD COLUMN somente_leitura TINYINT(1) NOT NULL DEFAULT 0',
    ]);
  });
});
