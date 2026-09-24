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

describe('interpretarRespostaCliente / decidirRespostaCliente', () => {
  it('botões e textos', () => {
    expect(interpretarRespostaCliente('', 'cli_sim')).toBe('sim');
    expect(interpretarRespostaCliente('', 'cli_nao')).toBe('nao');
    expect(interpretarRespostaCliente('Sim')).toBe('sim');
    expect(interpretarRespostaCliente('Isso mesmo!')).toBe('sim');
    expect(interpretarRespostaCliente('Não')).toBe('nao');
    expect(interpretarRespostaCliente('nao, não é')).toBe('nao');
    expect(interpretarRespostaCliente('sim? não')).toBe('nao');
    expect(interpretarRespostaCliente('bom dia, preciso de um boleto')).toBeNull();
    expect(interpretarRespostaCliente('11.222.333/0001-81')).toBeNull();
  });
  const pend: ConfirmacaoCliente = { cliente_id: 'c1', rotulo: 'X', codigo: '1', cnpj: CNPJ, enviada: true };
  it('pendente + sim/não/botão → ação', () => {
    expect(decidirRespostaCliente({ bot_dados: { confirmacao_cliente: pend }, emTriagem: false, texto: 'sim' })).toBe('sim');
    expect(decidirRespostaCliente({ bot_dados: { confirmacao_cliente: pend }, emTriagem: false, texto: '', botaoId: 'cli_nao' })).toBe('nao');
  });
  it('sem pendência, adiada, ou triagem ativa → não consome', () => {
    expect(decidirRespostaCliente({ bot_dados: {}, emTriagem: false, texto: 'sim' })).toBeNull();
    expect(decidirRespostaCliente({ bot_dados: { confirmacao_cliente: { ...pend, enviada: false } }, emTriagem: false, texto: 'sim' })).toBeNull();
    expect(decidirRespostaCliente({ bot_dados: { confirmacao_cliente: pend }, emTriagem: true, texto: 'sim' })).toBeNull();
    expect(decidirRespostaCliente({ bot_dados: { confirmacao_cliente: pend }, emTriagem: false, texto: 'qual o valor?' })).toBeNull();
  });
});
