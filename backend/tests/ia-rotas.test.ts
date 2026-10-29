import { describe, it, expect } from 'vitest';
import { catalogo, validarRotas, planoDaRota, funcaoDoAgente, FUNCOES, type Provedor } from '../src/lib/ia-rotas';

const modelos = catalogo({ OPENAI_MODEL: 'gpt-x', XAI_MODEL: 'grok-x' });
const todas = (_: Provedor) => true;
const ids = (p: ReturnType<typeof planoDaRota>) => p.tentar.map(m => m.id);

describe('catalogo', () => {
  it('usa o modelo do .env para OpenAI e Grok', () => {
    expect(modelos.map(m => m.id)).toContain('openai:gpt-x');
    expect(modelos.map(m => m.id)).toContain('grok:grok-x');
  });
});

describe('validarRotas', () => {
  it('guarda só o que foi escolhido; desconhecido vira automático', () => {
    const r = validarRotas({
      caroline: { principal: 'groq:openai/gpt-oss-120b', reserva: 'openai:gpt-x' },
      heitor: { principal: 'auto', reserva: 'auto' },
      joana: { principal: 'modelo-que-nao-existe', reserva: 'nenhuma' },
      funcao_inventada: { principal: 'openai:gpt-x', reserva: 'auto' },
    }, modelos);
    expect(r).toEqual({
      caroline: { principal: 'groq:openai/gpt-oss-120b', reserva: 'openai:gpt-x' },
      joana: { principal: 'auto', reserva: 'nenhuma' },
    });
  });
  it('entrada vazia ou inválida: tudo automático', () => {
    expect(validarRotas(null, modelos)).toEqual({});
    expect(validarRotas('lixo', modelos)).toEqual({});
  });
});

describe('planoDaRota', () => {
  it('sem rota: automático', () => {
    expect(planoDaRota(undefined, modelos, { temChave: todas })).toEqual({ tentar: [], auto: true });
  });
  it('principal e reserva, depois automático só se a reserva for Automático', () => {
    expect(ids(planoDaRota({ principal: 'gemini:gemini-2.5-flash', reserva: 'openai:gpt-x' }, modelos, { temChave: todas }))).toEqual(['gemini:gemini-2.5-flash', 'openai:gpt-x']);
    expect(planoDaRota({ principal: 'gemini:gemini-2.5-flash', reserva: 'openai:gpt-x' }, modelos, { temChave: todas }).auto).toBe(false);
    expect(planoDaRota({ principal: 'gemini:gemini-2.5-flash', reserva: 'auto' }, modelos, { temChave: todas }).auto).toBe(true);
    expect(planoDaRota({ principal: 'gemini:gemini-2.5-flash', reserva: 'nenhuma' }, modelos, { temChave: todas }).auto).toBe(false);
  });
  it('Groq não lê imagem nem pesquisa: pula para quem consegue', () => {
    const rota = { principal: 'groq:openai/gpt-oss-120b', reserva: 'gemini:gemini-2.5-flash' };
    expect(ids(planoDaRota(rota, modelos, { imagem: true, temChave: todas }))).toEqual(['gemini:gemini-2.5-flash']);
    expect(ids(planoDaRota(rota, modelos, { busca: true, temChave: todas }))).toEqual(['gemini:gemini-2.5-flash']);
  });
  it('nada escolhido serve ou tem chave: volta ao automático em vez de deixar sem IA', () => {
    const p = planoDaRota({ principal: 'groq:openai/gpt-oss-120b', reserva: 'nenhuma' }, modelos, { imagem: true, temChave: todas });
    expect(p).toEqual({ tentar: [], auto: true });
    const semChave = planoDaRota({ principal: 'gemini:gemini-2.5-flash', reserva: 'nenhuma' }, modelos, { temChave: pv => pv !== 'gemini' });
    expect(semChave).toEqual({ tentar: [], auto: true });
  });
  it('mesmo modelo nas duas: tenta uma vez', () => {
    expect(ids(planoDaRota({ principal: 'openai:gpt-x', reserva: 'openai:gpt-x' }, modelos, { temChave: todas }))).toEqual(['openai:gpt-x']);
  });
});

describe('funções', () => {
  it('conversa no Escritório usa a linha do Escritório', () => {
    expect(funcaoDoAgente('conversa-rafael')).toBe('escritorio');
    expect(funcaoDoAgente('caroline')).toBe('caroline');
  });
  it('ids únicos', () => {
    expect(new Set(FUNCOES.map(f => f.id)).size).toBe(FUNCOES.length);
  });
});
