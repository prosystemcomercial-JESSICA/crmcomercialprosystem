import { describe, it, expect } from 'vitest';
import { STATUS_CASO, STATUS_PERDA, STATUS_ENCERRADO } from '@/lib/caso-churn-status';
import { STATUS_PODE_ENVIAR, STATUS_LISTA_EXCLUSAO } from '@/lib/churn-exclusao';

describe('status do caso de churn', () => {
  it('FINALIZADO é a última etapa e conta como perda e como encerrado', () => {
    expect(STATUS_CASO[STATUS_CASO.length - 1]).toBe('FINALIZADO');
    expect(STATUS_PERDA).toContain('FINALIZADO');
    expect(STATUS_ENCERRADO).toEqual(['RECUPERADO', 'PERDIDO', 'SISTEMA_REMOVIDO', 'AGUARDANDO_EXCLUSAO', 'FINALIZADO']);
  });

  it('finalizado aparece na aba de exclusão, mas não é reenviado ao CEO como novo pedido', () => {
    expect(STATUS_PODE_ENVIAR).not.toContain('FINALIZADO');
    expect(STATUS_LISTA_EXCLUSAO).toContain('FINALIZADO');
  });
});
