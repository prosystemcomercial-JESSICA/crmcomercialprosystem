import { describe, it, expect } from 'vitest';
import { lerRastro, resumirVisitas, textoAvisoVolta, grupoDaTela, ORDEM_COMPLETA, type Visita } from '../src/lib/proposta-visitas';

const visita = (p: Partial<Visita> & { telas: Record<string, number>; caminho: number[] }): Visita => ({
  inicio: new Date('2026-10-23T10:00:00Z'), ultimo_sinal: new Date('2026-10-23T10:05:00Z'),
  segundos: Object.values(p.telas).reduce((s, n) => s + n, 0), origem: 'cliente', versao: 'completa', dispositivo: 'celular', eventos: [], ...p,
});

describe('rastro da proposta (comportamento do cliente, 23/10/2026)', () => {
  it('aceita o texto JSON do navegador e descarta o que não serve', () => {
    const r = lerRastro(JSON.stringify({
      sessao: 'abc123def', origem: 'cliente', versao: 'simples', dispositivo: 'celular', segundos: 42.4,
      telas: { '17': 30, '18': 12, '999': 5, x: 1 }, caminho: [17, 18, 'a', 500], eventos: [{ s: 3, t: 18, a: '  Aceitar   proposta ' }, { a: '' }],
    }));
    expect(r).toEqual({
      sessao: 'abc123def', origem: 'cliente', versao: 'simples', dispositivo: 'celular', segundos: 42,
      telas: { '17': 30, '18': 12 }, caminho: [17, 18], eventos: [{ s: 3, t: 18, a: 'Aceitar proposta' }],
    });
    expect(lerRastro('{"sessao":"X!"}')).toBeNull();
    expect(lerRastro('não é json')).toBeNull();
  });

  it('separa as telas em grupos', () => {
    expect([grupoDaTela(-1), grupoDaTela(0), grupoDaTela(6), grupoDaTela(18), grupoDaTela(100), grupoDaTela(24)])
      .toEqual(['escolha', 'apresentacao', 'modulos', 'valores', 'valores', 'fechamento']);
  });

  it('cliente que pula para os valores e volta depois', () => {
    const r = resumirVisitas([
      visita({ telas: { '-1': 4, '0': 1, '17': 60, '18': 120 }, caminho: [-1, 0, 17, 18] }),
      visita({ inicio: new Date('2026-10-24T09:00:00Z'), ultimo_sinal: new Date('2026-10-24T09:02:00Z'), telas: { '18': 90, '19': 30 }, caminho: [18, 19] }),
    ]);
    expect(r.aberturas).toBe(2);
    expect(r.segundos_total).toBe(305);
    expect(r.foi_direto_aos_valores).toBe(true);
    expect(r.grupos.find(g => g.grupo === 'valores')?.segundos).toBe(300);
    expect(r.nao_vistas).toHaveLength(ORDEM_COMPLETA.length - 3); // viu só 17, 18 e 19 (a capa ficou 1 s)
    expect(r.visitas[0].n).toBe(2); // mais recente primeiro
    expect(r.leitura).toContain('Foi direto aos valores na primeira abertura.');
    expect(r.leitura.join(' ')).toMatch(/Voltou à proposta 1 vez/);
  });

  it('cliente que vê a apresentação inteira não "foi direto aos valores"', () => {
    const telas = Object.fromEntries(ORDEM_COMPLETA.map(t => [String(t), 10]));
    const r = resumirVisitas([visita({ telas, caminho: ORDEM_COMPLETA })]);
    expect(r.foi_direto_aos_valores).toBe(false);
    expect(r.nao_vistas).toEqual([]);
  });

  it('sem visitas, resumo vazio', () => {
    const r = resumirVisitas([]);
    expect(r).toMatchObject({ aberturas: 0, segundos_total: 0, leitura: [], visitas: [] });
  });

  it('aviso de volta traz a abertura e o tempo nos valores', () => {
    const t = textoAvisoVolta('Farmácia Boa', 3, [visita({ telas: { '18': 240 }, caminho: [18] })], 'Sarah');
    expect(t).toContain('*Farmácia Boa voltou à proposta* (3ª abertura)');
    expect(t).toContain('4 min nos valores');
    expect(t).toContain('Vendedora: Sarah');
  });
});
