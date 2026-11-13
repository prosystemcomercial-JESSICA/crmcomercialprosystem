import { describe, it, expect } from 'vitest';
import { artigosRelacionados, palavras, baseUniversidade, conhecimentoProduto, trechosUniversidade } from '../src/lib/assistente/universidade';

const art = (titulo: string, categoria: string, texto: string) => ({ url: `https://x/${titulo}`, categoria, titulo, atualizado: null, texto });

describe('Universidade Prosystem no conhecimento do Rafael', () => {
  it('palavras: sem acento, sem palavras vazias, sem repetir', () => {
    expect(palavras('Como faço o balanço do estoque? Balanço!')).toEqual(['faco', 'balanco', 'estoque']);
  });

  it('acha o artigo pelo assunto e ignora o que não tem relação', () => {
    const artigos = [
      art('Contagem de estoque com aplicativo ContEstoque', 'admin-retaguarda › gestao-de-estoque', 'balanço pelo celular'),
      art('AnyDesk', 'suporte-tecnico › acesso-remoto', 'baixe o programa'),
    ];
    expect(artigosRelacionados(artigos, 'dá para fazer a contagem de estoque pelo celular?').map(a => a.titulo)).toEqual(['Contagem de estoque com aplicativo ContEstoque']);
    expect(artigosRelacionados(artigos, 'qual o preço do plano?')).toEqual([]);
  });

  it('a base lida está no repositório e entra no conhecimento do Rafael', () => {
    const b = baseUniversidade();
    expect(b.artigos.length).toBeGreaterThan(100);
    expect(b.artigos.every(a => !/Este artigo foi útil/.test(a.texto))).toBe(true);
    const c = conhecimentoProduto();
    expect(c).toContain('Universidade Prosystem');
    expect(c).toContain('SNGPC');
    expect(trechosUniversidade('como enviar o SNGPC para a Anvisa')).toContain('universidade.prosystemnet.com');
  });
});
