import { describe, it, expect } from 'vitest';
import { montarEstadoConversa, lerRespostaLaya, validarRotulos, medirAcerto } from '../src/lib/laya';

describe('montarEstadoConversa', () => {
  it('usa só texto, marca quem falou e mantém as mais recentes dentro do limite', () => {
    const msgs = [
      { direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'mensagem antiga '.repeat(20) },
      { direcao: 'SAIDA', tipo: 'AUDIO', conteudo: '[áudio]' },
      { direcao: 'SAIDA', tipo: 'TEXTO', conteudo: 'Bom dia!' },
      { direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'quanto custa\n o sistema?' },
    ];
    expect(montarEstadoConversa(msgs, 60)).toBe('Empresa: Bom dia!\nCliente: quanto custa o sistema?');
  });
  it('sempre inclui pelo menos a última mensagem', () => {
    expect(montarEstadoConversa([{ direcao: 'ENTRADA', tipo: 'TEXTO', conteudo: 'x'.repeat(50) }], 10)).toHaveLength(59);
  });
});

describe('lerRespostaLaya', () => {
  it('lê as respostas e limita os números', () => {
    expect(lerRespostaLaya({ answers: { segmento: { choice: 'padaria' }, intencao: { choice: 'comprar' }, cancelar: { noul: 0.1234 }, urgencia: { score: 9 } } }))
      .toEqual({ segmento: 'padaria', intencao: 'comprar', cancelar: 0.12, urgencia: 3 });
  });
  it('resposta estranha vira valores neutros', () => {
    expect(lerRespostaLaya({ answers: { segmento: { choice: 'banco' } } })).toEqual({ segmento: 'nao_sei', intencao: 'outro', cancelar: 0, urgencia: 0 });
  });
});

describe('validarRotulos', () => {
  it('aceita etiquetas válidas ou ignorar', () => {
    expect(validarRotulos({ segmento: 'farmacia', intencao: 'suporte', cancelar: false })).toEqual({ segmento: 'farmacia', intencao: 'suporte', cancelar: false });
    expect(validarRotulos({ ignorar: true })).toEqual({ ignorar: true });
  });
  it('recusa valores fora da lista', () => {
    expect(validarRotulos({ segmento: 'banco', intencao: 'suporte', cancelar: false })).toBeNull();
    expect(validarRotulos({ segmento: 'farmacia', intencao: 'suporte' })).toBeNull();
  });
});

describe('medirAcerto', () => {
  it('compara sugestão com o confirmado, pulando ignoradas e sem sugestão', () => {
    const r = medirAcerto([
      { rotulos: { segmento: 'farmacia', intencao: 'comprar', cancelar: false }, sugestao: { segmento: 'farmacia', intencao: 'suporte', cancelar: 0.1 } },
      { rotulos: { segmento: 'padaria', intencao: 'comprar', cancelar: true }, sugestao: { segmento: 'varejo', intencao: 'comprar', cancelar: 0.8 } },
      { rotulos: { ignorar: true }, sugestao: { segmento: 'varejo' } },
      { rotulos: { segmento: 'padaria', intencao: 'comprar', cancelar: false }, sugestao: null },
    ]);
    expect(r).toEqual({ comparaveis: 2, segmento: 50, intencao: 50, cancelar: 100 });
  });
});
