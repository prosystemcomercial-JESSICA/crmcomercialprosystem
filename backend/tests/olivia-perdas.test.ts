import { describe, it, expect } from 'vitest';
import { perdeuParaConcorrente, resumoPerdasConcorrentes, tabelaPerdas } from '../src/lib/assistente/olivia-perdas';

describe('Olívia · perdas para concorrentes', () => {
  it('reconhece a perda para concorrente pela chave ou pelo detalhe escrito', () => {
    expect(perdeuParaConcorrente('JA_TEM_FORNECEDOR')).toBe(true);
    expect(perdeuParaConcorrente('OUTRO: fechou com outro sistema mais barato')).toBe(true);
    expect(perdeuParaConcorrente('PRECO')).toBe(false);
    expect(perdeuParaConcorrente('OUTRO: loja vai fechar')).toBe(false);
    expect(perdeuParaConcorrente(null)).toBe(false);
  });

  it('conta por sistema juntando grafias e separa quem não informou', () => {
    const r = resumoPerdasConcorrentes([
      { motivo_perda: 'JA_TEM_FORNECEDOR', sistema_atual: 'Linx', segmento: 'Farmácia' },
      { motivo_perda: 'JA_TEM_FORNECEDOR', sistema_atual: ' linx ', segmento: 'Farmácia' },
      { motivo_perda: 'OUTRO: já usa outro sistema', sistema_atual: null, segmento: 'Padaria' },
      { motivo_perda: 'PRECO', sistema_atual: 'Linx', segmento: 'Farmácia' },
    ]);
    expect(r).toMatchObject({ perdidos: 4, paraConcorrente: 3, pct: 75 });
    expect(r.porConcorrente).toEqual([{ nome: 'Linx', total: 2 }, { nome: 'Não informado', total: 1 }]);
    expect(r.detalhes).toEqual(['já usa outro sistema']);
    expect(tabelaPerdas(r, 90)).toContain('| Linx | 2 |');
  });

  it('sem perdas não divide por zero', () => {
    expect(resumoPerdasConcorrentes([])).toMatchObject({ perdidos: 0, paraConcorrente: 0, pct: 0 });
  });
});
