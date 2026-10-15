import { describe, it, expect } from 'vitest';
import { lerCnpj, lerEmail, dadosPropostaFaltando, linhaDadosProposta, fichaDoLead, lerRespostaCaroline, promptCaroline } from '../src/lib/assistente/sdr';

// Pedido da Jessica (15/10/2026): quando o cliente pedir o valor, o agente pede os dados para montar a proposta
// (CNPJ, e-mail e quantidade de computadores, como ela pediu à Patricia por áudio).
describe('dados para a proposta', () => {
  it('CNPJ só com 14 dígitos; e-mail válido', () => {
    expect(lerCnpj('31.650.425/0001-70')).toBe('31650425000170');
    expect(lerCnpj('123')).toBeNull();
    expect(lerEmail(' Farmacia@Gmail.com ')).toBe('farmacia@gmail.com');
    expect(lerEmail('sem email')).toBeNull();
  });
  it('mostra o que falta e, completo, avisa que é com a consultora', () => {
    expect(dadosPropostaFaltando({})).toEqual(['CNPJ', 'e-mail', 'quantidade de computadores']);
    expect(dadosPropostaFaltando({ cnpj: '31650425000170', computadores: '2' })).toEqual(['e-mail']);
    expect(linhaDadosProposta({})).toBeNull();
    expect(linhaDadosProposta({ computadores: '2', tipo_loja: 'nova' })).toBe('- Dados para a proposta já recebidos: 2 computador(es), loja nova. Falta: CNPJ, e-mail');
    expect(linhaDadosProposta({ cnpj: '31650425000170', email: 'a@b.com', computadores: '2' })).toContain('Completos: é com a consultora');
  });
  it('a ficha do lead traz os dados já recebidos (o agente não pede de novo)', () => {
    expect(fichaDoLead({ dados: { computadores: '2' } })).toContain('Falta: CNPJ, e-mail');
  });
  it('lê CNPJ, e-mail, computadores e tipo de loja da resposta da IA', () => {
    const r = lerRespostaCaroline({ mensagens: ['Perfeito, obrigada!'], acao: 'passar_vendedora', nota: 60, dados: { cnpj: '31.650.425/0001-70', email: 'Loja@x.com.br', computadores: '2 (caixa e balcão)', tipo_loja: 'nova' } })!;
    expect(r.dados.cnpj).toBe('31650425000170');
    expect(r.dados.email).toBe('loja@x.com.br');
    expect(r.dados.computadores).toBe('2 (caixa e balcão)');
    expect(r.dados.tipo_loja).toBe('nova');
    const lixo = lerRespostaCaroline({ mensagens: ['oi'], acao: 'continuar', dados: { cnpj: '12', email: 'x', tipo_loja: 'outra' } })!;
    expect([lixo.dados.cnpj, lixo.dados.email, lixo.dados.tipo_loja]).toEqual([null, null, null]);
  });
  it('o prompt manda pedir os dados quando o cliente pergunta o valor', () => {
    const p = promptCaroline({ guia: 'g', instrucoes: '', exemplos: [], historico: 'Cliente: quanto custa?', fase: 'resposta', saudacao: 'Bom dia', perfil: 'caroline',
      lead: { nome: 'Ana', empresa: null, segmento: 'Farmácia', campanha: null, abertura_jessica: false, tentativa: 1 } } as any);
    const tudo = p.sistema + p.usuario;
    expect(tudo).toContain('DADOS PARA A PROPOSTA');
    expect(tudo).toContain('quantos computadores a loja vai ter');
    expect(tudo).toContain('"tipo_loja":"nova|troca|null"');
    expect(tudo).toContain('ou quando o cliente pedir o valor ou a proposta');
  });
});
