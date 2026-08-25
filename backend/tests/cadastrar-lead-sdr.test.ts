import { describe, expect, it, vi } from 'vitest';
import { cadastrarLeadSdr } from '../../frontend/lib/cadastrar-lead-sdr';

describe('cadastrarLeadSdr', () => {
  it('conclui o cadastro sem aguardar a recarga do funil', async () => {
    const lead = {
      id: 'lead-1',
      nome: 'Empresa Exemplo',
      razao_social: 'Empresa Exemplo',
      origem: 'Indicação',
      temperatura: 'FRIO',
      etapa_sdr: 'NOVO_LEAD',
      created_at: '2026-08-24T12:00:00.000Z',
    };
    const criar = vi.fn().mockResolvedValue({ data: { status: 'success', data: lead } });
    const recarregar = vi.fn(() => new Promise<void>(() => {}));

    const resultado = await cadastrarLeadSdr({
      formulario: { razao_social: 'Empresa Exemplo', origem: 'Indicação', temperatura: 'FRIO' },
      criar,
      recarregar,
    });

    expect(resultado).toEqual(lead);
    expect(criar).toHaveBeenCalledWith({
      nome: 'Empresa Exemplo',
      razao_social: 'Empresa Exemplo',
      origem: 'Indicação',
      temperatura: 'FRIO',
    });
    expect(recarregar).toHaveBeenCalledOnce();
  });
});
