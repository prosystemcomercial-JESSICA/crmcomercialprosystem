import { describe, it, expect } from 'vitest';
import {
  decidirPerguntaCliente, dadosComConfirmacao, menuConfirmacaoCliente, interpretarRespostaCliente, decidirRespostaCliente, observacaoRecusa,
  type ConfirmacaoCliente,
} from '../src/lib/whatsapp-confirmacao-cliente';

const CNPJ = '11222333000181';
const CLI = { id: 'c1', codigo: '381', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', nome: null };
const base = { cliente_id: null, bot_dados: { cnpj: '11.222.333/0001-81' }, emTriagem: false, candidatos: [CLI] };

describe('decidirPerguntaCliente', () => {
  it('exatamente um cliente → pergunta', () => {
    const d = decidirPerguntaCliente(base);
    expect(d.acao).toBe('perguntar');
    if (d.acao !== 'nenhuma') expect(d.confirmacao).toEqual({ cliente_id: 'c1', rotulo: 'PADARIA PAO QUENTE LTDA', codigo: '381', cnpj: CNPJ, enviada: true });
  });
  it('zero ou vários clientes → não pergunta', () => {
    expect(decidirPerguntaCliente({ ...base, candidatos: [] }).acao).toBe('nenhuma');
    expect(decidirPerguntaCliente({ ...base, candidatos: [CLI, { ...CLI, id: 'c2' }] }).acao).toBe('nenhuma');
  });
  it('conversa já vinculada ou sem CNPJ → não pergunta', () => {
    expect(decidirPerguntaCliente({ ...base, cliente_id: 'x' }).acao).toBe('nenhuma');
    expect(decidirPerguntaCliente({ ...base, bot_dados: {} }).acao).toBe('nenhuma');
  });
  it('em triagem → adia; no fim da triagem envia a adiada', () => {
    const d = decidirPerguntaCliente({ ...base, emTriagem: true });
    expect(d.acao).toBe('adiar');
    if (d.acao === 'nenhuma') return;
    expect(d.confirmacao.enviada).toBe(false);
    const dados = dadosComConfirmacao(base.bot_dados, d.confirmacao);
    expect(decidirPerguntaCliente({ ...base, bot_dados: dados, emTriagem: true }).acao).toBe('nenhuma');
    const fim = decidirPerguntaCliente({ ...base, bot_dados: dados });
    expect(fim.acao).toBe('perguntar');
    if (fim.acao !== 'nenhuma') expect(fim.confirmacao.enviada).toBe(true);
  });
  it('pergunta uma vez só por CNPJ', () => {
    const d = decidirPerguntaCliente(base);
    if (d.acao === 'nenhuma') throw new Error();
    const dados = dadosComConfirmacao(base.bot_dados, d.confirmacao);
    expect(dados.confirmacao_cliente_cnpjs).toEqual([CNPJ]);
    expect(decidirPerguntaCliente({ ...base, bot_dados: dados }).acao).toBe('nenhuma');
    expect(decidirPerguntaCliente({ ...base, bot_dados: { ...dados, confirmacao_cliente: null } }).acao).toBe('nenhuma');
  });
});

describe('menu e observação', () => {
  it('texto e botões', () => {
    const m = menuConfirmacaoCliente({ rotulo: 'PADARIA X', codigo: '12' });
    expect(m.texto).toBe('Encontramos o cadastro *PADARIA X* (cód. 12). É a sua empresa?');
    expect(m.opcoes.map(o => o.id)).toEqual(['cli_sim', 'cli_nao']);
  });
  it('observação da recusa', () => {
    expect(observacaoRecusa({ cnpj: CNPJ, rotulo: 'PADARIA X' })).toBe(`Contato disse que o CNPJ ${CNPJ} não é do cadastro PADARIA X`);
  });
});

describe('interpretarRespostaCliente', () => {
  it('botões e textos claros', () => {
    expect(interpretarRespostaCliente('', 'cli_sim')).toBe('sim');
    expect(interpretarRespostaCliente('', 'cli_nao')).toBe('nao');
    for (const t of ['Sim', 's', 'É sim', 'sim!']) expect(interpretarRespostaCliente(t)).toBe('sim');
    for (const t of ['Não', 'nao', 'N', 'não é']) expect(interpretarRespostaCliente(t)).toBe('nao');
  });
  it('ambíguos não valem', () => {
    for (const t of ['ok', 'certo', 'isso', 'sim, mas quero um boleto', 'bom dia', '11.222.333/0001-81']) expect(interpretarRespostaCliente(t)).toBeNull();
  });
});

describe('decidirRespostaCliente', () => {
  const T0 = new Date('2026-09-24T12:00:00Z');
  const pend: ConfirmacaoCliente = { cliente_id: 'c1', rotulo: 'X', codigo: '1', cnpj: CNPJ, enviada: true, perguntada_em: T0.toISOString() };
  const min = (m: number) => new Date(T0.getTime() + m * 60000);
  const ctx = (o: any = {}) => ({ bot_dados: { confirmacao_cliente: pend }, emTriagem: false, texto: 'sim', botaoId: null, agora: min(5), entradasAposPergunta: 1, humanoAposPergunta: false, ...o });

  it('texto claro: 1ª mensagem, até 2 h, sem humano → ação', () => {
    expect(decidirRespostaCliente(ctx())).toEqual({ acao: 'sim' });
    expect(decidirRespostaCliente(ctx({ texto: 'não' }))).toEqual({ acao: 'nao' });
  });
  it('texto depois de 2 h, não é a 1ª mensagem, ou humano falou → expira', () => {
    expect(decidirRespostaCliente(ctx({ agora: min(121) }))).toEqual({ acao: 'expirar' });
    expect(decidirRespostaCliente(ctx({ entradasAposPergunta: 2 }))).toEqual({ acao: 'expirar' });
    expect(decidirRespostaCliente(ctx({ humanoAposPergunta: true }))).toEqual({ acao: 'expirar' });
  });
  it('mensagem que não é sim/não → expira', () => {
    expect(decidirRespostaCliente(ctx({ texto: 'ok' }))).toEqual({ acao: 'expirar' });
    expect(decidirRespostaCliente(ctx({ texto: 'qual o valor?' }))).toEqual({ acao: 'expirar' });
    expect(decidirRespostaCliente(ctx({ texto: '', botaoId: 'suporte' }))).toEqual({ acao: 'expirar' });
  });
  it('botão vale até 24 h mesmo após outras mensagens/humano', () => {
    expect(decidirRespostaCliente(ctx({ texto: '', botaoId: 'cli_nao', agora: min(600), entradasAposPergunta: 5, humanoAposPergunta: true }))).toEqual({ acao: 'nao' });
    expect(decidirRespostaCliente(ctx({ texto: '', botaoId: 'cli_sim', agora: min(24 * 60 + 1) }))).toEqual({ acao: 'expirar' });
  });
  it('sem pendência, adiada ou triagem ativa → nada', () => {
    expect(decidirRespostaCliente(ctx({ bot_dados: {} }))).toBeNull();
    expect(decidirRespostaCliente(ctx({ bot_dados: { confirmacao_cliente: { ...pend, enviada: false } } }))).toBeNull();
    expect(decidirRespostaCliente(ctx({ emTriagem: true }))).toBeNull();
  });
});
