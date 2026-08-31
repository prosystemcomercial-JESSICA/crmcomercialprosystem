import { describe, it, expect } from 'vitest';
import { ownerWhereId } from '../src/lib/scope';

describe('analise-comercial usa ownerWhereId em vez de OR manual', () => {
  it('ownerWhereId("Lead", scopeId) produz o mesmo filtro que o OR manual reimplementado', () => {
    const scopeId = 'vendedor-123';
    const resultado = ownerWhereId('Lead', scopeId);
    expect(resultado).toEqual({
      deleted_at: null,
      OR: [{ responsavel_id: scopeId }, { created_by: scopeId }],
    });
  });

  it('ownerWhereId("Lead", null) não filtra por dono, mas ainda exclui deletados', () => {
    const resultado = ownerWhereId('Lead', null);
    expect(resultado).toEqual({ deleted_at: null });
  });
});
