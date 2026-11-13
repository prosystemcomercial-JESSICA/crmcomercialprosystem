import { describe, it, expect } from 'vitest';
import { normalizarItemCatalogo, textoPadraoOferta, instrucaoOferta, linhaHistoricoOferta } from '../src/lib/implantacao/oferta';

describe('catálogo do agente de oferta', () => {
  it('item antigo sem tipo vira produto Prosystem', () => {
    expect(normalizarItemCatalogo({ produto: 'Pacote fiscal', descricao: 'x', preco: 'R$ 50' })).toEqual({ tipo: 'PRODUTO', produto: 'Pacote fiscal', descricao: 'x', preco: 'R$ 50' });
  });
  it('item vazio é descartado', () => {
    expect(normalizarItemCatalogo({ produto: '  ' })).toBeNull();
  });
  it('integração guarda o parceiro (ou usa o nome do item)', () => {
    expect(normalizarItemCatalogo({ tipo: 'INTEGRACAO', produto: 'Delivery', descricao: '', preco: '', parceiro: 'Empresa X' })?.parceiro).toBe('Empresa X');
    expect(normalizarItemCatalogo({ tipo: 'INTEGRACAO', produto: 'Empresa Y', descricao: '', preco: '' })?.parceiro).toBe('Empresa Y');
  });
});

describe('mensagem da oferta', () => {
  const integ = normalizarItemCatalogo({ tipo: 'INTEGRACAO', produto: 'Delivery integrado', descricao: 'Pedidos caem direto no caixa.', preco: '', parceiro: 'Empresa X' })!;
  const prod = normalizarItemCatalogo({ produto: 'Pacote fiscal', descricao: 'Cuida das obrigações.', preco: 'R$ 50/mês' })!;

  it('integração: deixa claro que é indicação, que o parceiro fecha direto e a Prosystem integra depois', () => {
    const t = textoPadraoOferta(integ, { contato: 'Maria Souza', empresa: 'Drogaria A' });
    expect(t).toContain('Maria');
    expect(t).toContain('Empresa X');
    expect(t).toMatch(/entra em contato/);
    expect(t).toMatch(/integração/);
    expect(instrucaoOferta(integ)).toMatch(/Nunca diga que a Prosystem vende/);
    expect(linhaHistoricoOferta(integ)).toContain('parceiro Empresa X');
  });
  it('produto Prosystem continua com o texto de antes', () => {
    expect(textoPadraoOferta(prod, { empresa: 'Drogaria A' })).toContain('queria te apresentar: *Pacote fiscal*');
    expect(instrucaoOferta(prod)).not.toMatch(/parceira/);
    expect(linhaHistoricoOferta(prod)).toBe('🛍️ Oferta enviada ao cliente: Pacote fiscal.');
  });
});
