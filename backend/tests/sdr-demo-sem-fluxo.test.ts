import { describe, it, expect } from 'vitest';
import { demoSemFluxo, promptCaroline } from '../src/lib/assistente/sdr';

// Caso Farmácia Preço Baixo (26/10/2026): a Caroline chamou a loja, listou recursos sem saber a dor, o farmacêutico
// perguntou "com quem estou falando?", confirmou a loja com "SIM" e recebeu a lista de horários da demonstração.
describe('demonstração sem fluxo no contato ativo', () => {
  const caso = ['*DR. LUCIANO BAPTISTA:* COM QUEM ESTOU FALANDO?', '*DR. LUCIANO BAPTISTA:* SIM'];

  it('segura a demonstração quando a pessoa só confirmou a loja', () => {
    expect(demoSemFluxo({ contatoAtivo: true, acao: 'oferecer_demo', dor: null, falasCliente: caso })).toBe(true);
  });

  it('libera quando a pessoa contou a dor', () => {
    expect(demoSemFluxo({ contatoAtivo: true, acao: 'oferecer_demo', dor: 'estoque não bate', falasCliente: caso })).toBe(false);
  });

  it('libera quando a pessoa pediu ou aceitou ver o sistema', () => {
    expect(demoSemFluxo({ contatoAtivo: true, acao: 'oferecer_demo', dor: null, falasCliente: ['quero ver como funciona'] })).toBe(false);
    expect(demoSemFluxo({ contatoAtivo: true, acao: 'oferecer_demo', dor: null, falasCliente: ['quanto custa?'] })).toBe(false);
  });

  it('não mexe em quem nos procurou nem em outras ações', () => {
    expect(demoSemFluxo({ contatoAtivo: false, acao: 'oferecer_demo', dor: null, falasCliente: caso })).toBe(false);
    expect(demoSemFluxo({ contatoAtivo: true, acao: 'continuar', dor: null, falasCliente: caso })).toBe(false);
  });

  it('o roteiro do contato ativo traz o fluxo e a resposta ao "com quem estou falando?"', () => {
    const p = promptCaroline({ guia: 'g', instrucoes: '', exemplos: [], historico: 'Cliente: COM QUEM ESTOU FALANDO?', fase: 'resposta', saudacao: 'Bom dia', perfil: 'caroline',
      lead: { nome: null, empresa: 'Farmácia', segmento: null, campanha: null, abertura_jessica: false, tentativa: 1, prospeccao: { cidade: 'Vila Velha', bairro: null } } } as any);
    expect(p.sistema).toContain('FLUXO DO CONTATO ATIVO');
    expect(p.sistema).toContain('Confirmar a loja e a cidade NÃO é interesse');
    expect(p.sistema).toContain('COM QUEM ESTOU FALANDO');
  });
});
