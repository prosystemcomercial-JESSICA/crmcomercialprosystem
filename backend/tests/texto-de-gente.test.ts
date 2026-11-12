import { describe, it, expect } from 'vitest';
import { TEXTO_DE_GENTE } from '../src/lib/assistente/texto-de-gente';
import { promptCaroline } from '../src/lib/assistente/sdr';
import { REGRAS_COMERCIAIS } from '../src/lib/assistente/ia-texto';

describe('texto de gente, não de folder (12/11/2026)', () => {
  it('a regra pede situação prática encadeada na conversa, sem frase solta, e proíbe inventar detalhe', () => {
    expect(TEXTO_DE_GENTE).toContain('NADA DE FRASE SOLTA');
    expect(TEXTO_DE_GENTE).toContain('solução completa e integrada');
    expect(TEXTO_DE_GENTE).toContain('Nunca invente funcionário');
    expect(TEXTO_DE_GENTE).toContain('GANCHO COM PERGUNTA RETÓRICA');
    expect(TEXTO_DE_GENTE).toContain('não conta como pergunta de investigação');
    expect(TEXTO_DE_GENTE).not.toMatch(/[—–]/); // sem travessão, como o resto das regras
  });

  it('chega aos agentes de conversa (Caroline, Julio, Luiz Felipe...) e às sugestões das vendedoras', () => {
    const p = promptCaroline({ guia: 'G', instrucoes: '', exemplos: [], historico: '', fase: 'abertura', saudacao: 'Bom dia',
      lead: { nome: 'Ana', empresa: null, segmento: 'Farmácia', campanha: null, abertura_jessica: false, tentativa: 0 } });
    expect(p.sistema).toContain(TEXTO_DE_GENTE);
    expect(REGRAS_COMERCIAIS).toContain(TEXTO_DE_GENTE);
  });
});
