import { describe, it, expect } from 'vitest';
import { textoNovaDemanda, maquinasDaProposta, telefoneLegivel } from '../src/lib/implantacao/nova-demanda';

describe('aviso de nova demanda (contrato assinado)', () => {
  const base = { cliente: 'Farmácia Teste', numeroContrato: '56/2026', link: 'https://x.com/portal-tecnico?tab=quadro&demanda=abc', tecnico: 'Lucas Diniz' };

  it('conversão mostra o sistema, máquinas, responsável, contato e link', () => {
    const t = textoNovaDemanda({ ...base, conversao: true, sistemaAnterior: 'Trier', maquinas: 3, responsavel: 'Maria', contato: '5527999990000' });
    expect(t).toContain('*Conversão de dados:* Sim, do sistema *Trier*');
    expect(t).toContain('*Máquinas:* 3');
    expect(t).toContain('*Responsável:* Maria');
    expect(t).toContain('*Contato do responsável:* (27) 99999-0000');
    expect(t).toContain('*Técnico:* Lucas Diniz');
    expect(t).toContain('*Card no painel técnico:* https://x.com/portal-tecnico?tab=quadro&demanda=abc');
  });

  it('banco zerado e dados faltando aparecem como não informado', () => {
    const t = textoNovaDemanda({ ...base, conversao: false });
    expect(t).toContain('*Conversão de dados:* Não (banco zerado)');
    expect(t).toContain('*Máquinas:* não informado');
    expect(t).toContain('*Responsável:* não informado');
    expect(t).toContain('*Contato do responsável:* não informado');
  });

  it('conversão sem sistema informado', () => {
    expect(textoNovaDemanda({ ...base, conversao: true })).toContain('Sim, do sistema *não informado*');
  });

  it('máquinas: campo direto ou soma das lojas', () => {
    expect(maquinasDaProposta({ maquinas: 2 })).toBe(2);
    expect(maquinasDaProposta({ maquinas: null, lojas_projeto: [{ maquinas: 2 }, { maquinas: '3' }, {}] })).toBe(5);
    expect(maquinasDaProposta({ maquinas: 0, lojas_projeto: null })).toBeNull();
    expect(maquinasDaProposta(null)).toBeNull();
  });

  it('telefone legível', () => {
    expect(telefoneLegivel('27 3333-4444')).toBe('(27) 3333-4444');
    expect(telefoneLegivel('')).toBeNull();
  });
});
