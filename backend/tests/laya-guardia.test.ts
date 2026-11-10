import { describe, it, expect } from 'vitest';
import { conferirPura, linkIncompleto, pareceCortada, cobertura } from '../src/lib/laya-guardia';

describe('Laya guardiã: conferência pura', () => {
  it('pega link quebrado, texto cortado e repetição', () => {
    expect(linkIncompleto('Veja aqui: https://')).toBe(true);
    expect(linkIncompleto('Veja aqui: [link]')).toBe(true);
    expect(linkIncompleto('Veja aqui: https://prosystemnet.com/farmacia')).toBe(false);
    expect(pareceCortada('Boa, Enares. Sobre isso: o Prosystem já tem TEF, Pix e boleto, e o controle de')).toBe(true);
    expect(pareceCortada('Qual o melhor horário pra você')).toBe(false);
    const ultimas = ['Oi! Aqui é a Caroline, da Prosystem. Vi que você tem uma farmácia e queria entender como está o controle do caixa hoje.'];
    expect(conferirPura({ mensagens: ['Oi! Aqui é a Caroline da Prosystem. Vi que você tem uma farmácia e queria entender como está o controle do caixa hoje!'], ultimas })).toContain('repete o que o agente já disse nesta conversa');
    expect(conferirPura({ mensagens: ['Perfeito, então combinamos quinta às 10h. Até lá!'], ultimas })).toEqual([]);
    expect(conferirPura({ mensagens: ['a', 'b', 'c', 'd'], ultimas: [] })).toContain('4 mensagens de uma vez (máximo 3)');
  });

  it('cobertura: a resposta da Jessica cobre a pergunta do Rafael', () => {
    const pergunta = 'Qual é a tabela vigente de mensalidade e implantação por segmento e plano?';
    expect(cobertura(pergunta, 'Tabela de mensalidade 2025 por plano: Farma Pro R$ 350, implantação R$ 500, por segmento farmácia e padaria.')).toBeGreaterThanOrEqual(0.6);
    expect(cobertura(pergunta, 'O fluxo de produtos comprados para revenda usados na produção é lançado como consumo interno.')).toBeLessThan(0.3);
  });
});
