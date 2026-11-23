import { describe, it, expect } from 'vitest';
import { elegivelUpgrade, escolherParaUpgrade, ferramentasNovas, ferramentasConfirmadas, familiaSegmento, mesesDeCasa, type ClienteBase } from '../src/lib/assistente/mila-upgrade';

const agora = new Date('2026-11-11T12:00:00Z');
const c = (p: Partial<ClienteBase>): ClienteBase => ({ id: 'c1', nome: 'Farmácia Exemplo', situacao: 'ATIVA', plano: 'PRO', data_entrada: new Date('2025-01-10'), email: 'a@b.com', segmento: 'Farmácia', ...p });

describe('Mila · oferta de upgrade', () => {
  it('só entra cliente ativo, antigo, fora do Plus, sem alerta e sem oferta recente', () => {
    expect(elegivelUpgrade(c({}), agora, new Set())).toBe(true);
    expect(elegivelUpgrade(c({ situacao: 'INATIVA' }), agora, new Set())).toBe(false);
    expect(elegivelUpgrade(c({ plano: 'Plus' }), agora, new Set())).toBe(false);
    expect(elegivelUpgrade(c({ risco_atencao: true }), agora, new Set())).toBe(false);
    expect(elegivelUpgrade(c({ apresentou_plus: true }), agora, new Set())).toBe(false);
    expect(elegivelUpgrade(c({ data_entrada: new Date('2026-06-01') }), agora, new Set())).toBe(false); // 5 meses
    expect(elegivelUpgrade(c({ data_entrada: null }), agora, new Set())).toBe(false);
    expect(elegivelUpgrade(c({}), agora, new Set(['c1']))).toBe(false);
  });

  it('escolhe quem tem e-mail primeiro, depois os mais antigos, até o limite', () => {
    const r = escolherParaUpgrade([
      c({ id: 'novo', data_entrada: new Date('2025-12-01') }),
      c({ id: 'sem_email', email: null, data_entrada: new Date('2020-01-01') }),
      c({ id: 'antigo', data_entrada: new Date('2021-01-01') }),
    ], agora, new Set(), 2);
    expect(r.map(x => x.id)).toEqual(['antigo', 'novo']);
  });

  it('lista as ferramentas que o cliente não conhece e o tempo de casa', () => {
    expect(ferramentasNovas(c({ conhece_dashboard: true }))).toEqual(['Mensageria', 'Gerencial', 'Atenção Farma']);
    expect(ferramentasNovas(c({ segmento: 'Padaria' }))).not.toContain('Atenção Farma');
    expect(mesesDeCasa(c({ data_entrada: new Date('2025-11-11') }), agora)).toBe(12);
  });
});

describe('Mila · oferta de upgrade com o manual (seção 12)', () => {
  it('fica de fora quem está bloqueado (caso de churn aberto ou grupo de quem saiu)', () => {
    expect(escolherParaUpgrade([c({ id: 'a' }), c({ id: 'b' })], agora, new Set(), 30, new Set(['a'])).map(x => x.id)).toEqual(['b']);
  });

  it('uma oferta = um segmento só (o maior) e uma loja por CNPJ raiz', () => {
    const r = escolherParaUpgrade([
      c({ id: 'f1', cnpj: '11.111.111/0001-11' }), c({ id: 'f2', cnpj: '11.111.111/0002-00', data_entrada: new Date('2019-01-01') }),
      c({ id: 'f3', cnpj: '22222222000122' }),
      c({ id: 'v1', segmento: 'Varejo', plano: 'Loja Pro' }), c({ id: 'v2', segmento: 'Varejo', plano: 'Loja Pro' }),
    ], agora, new Set());
    expect(r.map(x => x.id).sort()).toEqual(['f2', 'f3']);
    expect(familiaSegmento({ segmento: null, plano: 'Farma Pro' })).toBe('farmacia');
    expect(familiaSegmento({ segmento: 'Padaria', plano: 'PRO' })).toBe('padaria');
  });

  it('"não conhece" só vale para quem respondeu a pesquisa', () => {
    expect(ferramentasConfirmadas(c({}), false)).toEqual([]);
    expect(ferramentasConfirmadas(c({ conhece_dashboard: true }), true)).toEqual(['Mensageria', 'Gerencial', 'Atenção Farma']);
  });
});
