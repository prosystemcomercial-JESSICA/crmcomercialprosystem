import { describe, it, expect } from 'vitest';
import { agenteDaPilha, tokensDaResposta, somarPorAgente, totalPorAgente, nomeDoAgente, usoAgenteVazio } from '../src/lib/uso-ia-agentes';

describe('agenteDaPilha', () => {
  it('pula o cliente de IA e devolve o primeiro serviço que chamou', () => {
    const pilha = [
      'Error',
      '    at chamarGemini (/var/www/comercial-prosystem/backend/src/services/ia-gemini.service.ts:140:30)',
      '    at gerarEdicao (/var/www/comercial-prosystem/backend/src/services/joana.service.ts:64:28)',
      '    at rotina (/var/www/comercial-prosystem/backend/src/services/especialista.service.ts:10:3)',
    ].join('\n');
    expect(agenteDaPilha(pilha)).toBe('joana');
  });
  it('aceita caminho do Windows e arquivo sem nome conhecido', () => {
    expect(agenteDaPilha('at x (C:\\crm\\backend\\src\\services\\assistente-ia.service.ts:1:1)')).toBe('clarice');
    expect(agenteDaPilha('at x (/app/src/services/novo-robo.service.ts:1:1)')).toBe('novo-robo');
  });
  it('sem serviço na pilha: outros', () => {
    expect(agenteDaPilha(undefined)).toBe('outros');
    expect(agenteDaPilha('at x (/app/src/routes/whatsapp.ts:1:1)')).toBe('outros');
  });
  it('lê a pilha de verdade (o arquivo de teste não é serviço)', () => {
    expect(agenteDaPilha(new Error().stack)).toBe('outros');
  });
});

describe('tokensDaResposta', () => {
  it('API Responses, formato antigo e resposta sem uso', () => {
    expect(tokensDaResposta({ usage: { input_tokens: 1200, output_tokens: 300 } })).toEqual({ entrada: 1200, saida: 300 });
    expect(tokensDaResposta({ usage: { prompt_tokens: 10, completion_tokens: 2 } })).toEqual({ entrada: 10, saida: 2 });
    expect(tokensDaResposta({ text: 'oi' })).toEqual({ entrada: 0, saida: 0 });
  });
});

describe('soma por assistente', () => {
  it('soma o gravado com a memória e ordena pela OpenAI', () => {
    const gravado = { rafael: { ...usoAgenteVazio(), openai: 3, tokens_entrada: 100 }, heitor: { ...usoAgenteVazio(), openai: 1 } };
    const memoria = { rafael: { ...usoAgenteVazio(), openai: 1, falhas: 1 }, caroline: { ...usoAgenteVazio(), openai: 7 } };
    const dia = somarPorAgente(gravado, memoria);
    expect(dia.rafael).toEqual({ ...usoAgenteVazio(), openai: 4, falhas: 1, tokens_entrada: 100 });
    const linhas = totalPorAgente([{ agentes: dia }, { agentes: { heitor: { ...usoAgenteVazio(), openai: 2 } } }]);
    expect(linhas.map(l => [l.agente, l.openai])).toEqual([['caroline', 7], ['rafael', 4], ['heitor', 3]]);
  });
  it('valor gravado incompleto não quebra', () => {
    expect(somarPorAgente({ joana: { openai: 2 } }, {}).joana).toEqual({ ...usoAgenteVazio(), openai: 2 });
  });
  it('nomes para a tela', () => {
    expect(nomeDoAgente('luiz_felipe')).toBe('Luiz Felipe');
    expect(nomeDoAgente('conversa-rafael')).toBe('Rafael (conversa no Escritório)');
    expect(nomeDoAgente('novo-robo')).toBe('novo-robo');
  });
});
