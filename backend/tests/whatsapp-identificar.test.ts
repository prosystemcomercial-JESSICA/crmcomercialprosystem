import { describe, it, expect } from 'vitest';
import { decidirIdentificacao, TIPOS_CONTATO, ETIQUETA_TIPO } from '../src/lib/whatsapp-identificar';

describe('decidirIdentificacao', () => {
  it('CLIENTE exige cliente, vincula e sai do funil', () => {
    expect(decidirIdentificacao('CLIENTE', {})).toEqual({ erro: 'Selecione o cliente.' });
    expect(decidirIdentificacao('CLIENTE', { cliente_id: 'c1' })).toMatchObject({ vincularCliente: true, sairDoFunil: true, garantirLead: false, salvarEmpresa: false, etiqueta: 'Cliente', etiqueta_cor: '#0891b2' });
  });
  it('TERCEIRO_CLIENTE exige cliente, vincula e sai do funil', () => {
    expect(decidirIdentificacao('TERCEIRO_CLIENTE', { cliente_id: null })).toHaveProperty('erro');
    expect(decidirIdentificacao('TERCEIRO_CLIENTE', { cliente_id: 'c1' })).toMatchObject({ vincularCliente: true, sairDoFunil: true, etiqueta: 'Terceiro de cliente', etiqueta_cor: '#0d9488' });
  });
  it('LEAD fica no funil e garante o lead', () => {
    expect(decidirIdentificacao('LEAD', {})).toMatchObject({ vincularCliente: false, sairDoFunil: false, garantirLead: true, salvarEmpresa: false, etiqueta: 'Lead', etiqueta_cor: '#7c3aed' });
  });
  it.each(['PARCEIRO', 'EQUIPE', 'FORNECEDOR', 'OUTRO'] as const)('%s sai do funil e salva a empresa', (tipo) => {
    const d = decidirIdentificacao(tipo, {}) as any;
    expect(d).toMatchObject({ vincularCliente: false, sairDoFunil: true, garantirLead: false, salvarEmpresa: true });
    expect(d.etiqueta).toBe(ETIQUETA_TIPO[tipo].etiqueta);
  });
  it('toda etiqueta tem cor', () => {
    expect(TIPOS_CONTATO.map(t => ETIQUETA_TIPO[t].cor)).toEqual(['#0891b2', '#7c3aed', '#db2777', '#475569', '#0d9488', '#ca8a04', '#6b7280']);
  });
});
