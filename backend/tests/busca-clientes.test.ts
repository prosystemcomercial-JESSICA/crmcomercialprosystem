import { describe, it, expect } from 'vitest';
import { normalizarBuscaCliente, wherePrismaBusca, sqlBusca, SQL_CNPJ_DIGITOS } from '../src/lib/busca-clientes';

describe('normalizarBuscaCliente', () => {
  it('quebra em palavras e detecta dígitos de CNPJ', () => {
    expect(normalizarBuscaCliente('  padaria   pão ')).toEqual({ tokens: ['padaria', 'pão'], digitosCnpj: null });
    expect(normalizarBuscaCliente('11.222.333/0001-81')).toEqual({ tokens: ['11.222.333/0001-81'], digitosCnpj: '11222333000181' });
    expect(normalizarBuscaCliente('1122333')).toEqual({ tokens: ['1122333'], digitosCnpj: null });
    expect(normalizarBuscaCliente('')).toEqual({ tokens: [], digitosCnpj: null });
  });
});

describe('filtros', () => {
  it('Prisma: AND de palavras, OR de campos; ids por CNPJ em OR', () => {
    const w = wherePrismaBusca(normalizarBuscaCliente('pao quente'));
    expect(w.AND).toHaveLength(2);
    expect(w.AND[0].OR).toContainEqual({ razao_social: { contains: 'pao' } });
    expect(wherePrismaBusca(normalizarBuscaCliente('11222333'), ['a']).OR[1]).toEqual({ id: { in: ['a'] } });
    expect(wherePrismaBusca(normalizarBuscaCliente(' '))).toBeNull();
  });
  it('SQL: mesma regra e parâmetros na ordem', () => {
    const r = sqlBusca(normalizarBuscaCliente('pao quente'))!;
    expect(r.params).toHaveLength(14);
    expect(r.sql.split(' AND ')).toHaveLength(2);
    const c = sqlBusca(normalizarBuscaCliente('11.222.333/0001-81'))!;
    expect(c.sql).toContain(`${SQL_CNPJ_DIGITOS} LIKE ?`);
    expect(c.params[c.params.length - 1]).toBe('%11222333000181%');
    expect((c.sql.match(/\?/g) || []).length).toBe(c.params.length);
  });
});
