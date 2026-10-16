import { describe, it, expect } from 'vitest';
import { regraRepeticao, tentativasDeSocorro, SOCORRO_MAX, ehRespostaAutomatica, PLAYBOOK_CONVERSA, promptCaroline } from '../src/lib/assistente/sdr';

// Pedido da Jessica (16/10/2026): conversas abandonadas são gravíssimas; toda conversa tem começo, meio e fim.
describe('trava de repetição não pode matar a conversa', () => {
  it('na resposta só olha as 2 últimas falas e só barra quase-cópia', () => {
    expect(regraRepeticao('resposta')).toEqual({ falas: 2, limiar: 0.75 });
  });
  it('primeiro contato e retomada continuam rígidos (protege o número)', () => {
    expect(regraRepeticao('abertura')).toEqual({ falas: 4, limiar: 0.6 });
    expect(regraRepeticao('retomada')).toEqual({ falas: 4, limiar: 0.6 });
  });
});

describe('socorro do agente', () => {
  const em = '2026-10-16T15:06:32.716Z';
  it('conta as tentativas da MESMA mensagem do cliente; mensagem nova zera', () => {
    expect(tentativasDeSocorro(null, em)).toBe(0);
    expect(tentativasDeSocorro({ n: 2, ultima_lead_em: em }, em)).toBe(2);
    expect(tentativasDeSocorro({ n: 3, ultima_lead_em: em }, '2026-10-16T16:00:00.000Z')).toBe(0);
    expect(SOCORRO_MAX).toBeGreaterThanOrEqual(3);
  });
});

describe('robôs de loja de 16/10 e pessoas de verdade', () => {
  it('reconhece os robôs que passavam', () => {
    expect(ehRespostaAutomatica('Ok! Logo um de nossos atendentes dará continuidade ao seu atendimento')).toBe(true);
    expect(ehRespostaAutomatica('Estoque disponível semana que vem novamente. \n\nEntre no nosso site')).toBe(true);
    expect(ehRespostaAutomatica('Para aperfeiçoar nosso atendimento, nos diga como foi a sua experiência')).toBe(true);
  });
  it('não confunde pessoa com robô', () => {
    expect(ehRespostaAutomatica('não sou o responsavel pelo setor')).toBe(false);
    expect(ehRespostaAutomatica('Ei bom dia, não é mais da farmácia')).toBe(false);
    expect(ehRespostaAutomatica('pode me ligar amanhã')).toBe(false);
  });
});

describe('playbook de condução e objeções', () => {
  it('traz começo, meio e fim, as objeções e as técnicas', () => {
    expect(PLAYBOOK_CONVERSA).toContain('COMEÇO, MEIO E FIM');
    expect(PLAYBOOK_CONVERSA).toContain('"Não sou o responsável"');
    expect(PLAYBOOK_CONVERSA).toContain('"Não é mais da farmácia"');
    expect(PLAYBOOK_CONVERSA).toContain('"Já tenho sistema"');
    expect(PLAYBOOK_CONVERSA).toContain('TÉCNICAS DE PERSUASÃO');
  });
  it('entra no prompt de todos os agentes', () => {
    for (const perfil of ['caroline', 'julio', 'luiz_felipe']) {
      const p = promptCaroline({ guia: 'g', instrucoes: '', exemplos: [], historico: 'Cliente: não sou o responsável', fase: 'resposta', saudacao: 'Boa tarde', perfil,
        lead: { nome: 'Didio', empresa: null, segmento: 'Farmácia', campanha: null, abertura_jessica: false, tentativa: 1 } } as any);
      expect(p.sistema + p.usuario).toContain('QUEBRA DE OBJEÇÕES');
    }
  });
});
