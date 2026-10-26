import { describe, it, expect } from 'vitest';
import { STATUS_CASO, STATUS_PERDA, STATUS_ENCERRADO } from '@/lib/caso-churn-status';
import { STATUS_PODE_ENVIAR, STATUS_LISTA_EXCLUSAO, statusAposConfirmacao, etapasDoCancelamento } from '@/lib/churn-exclusao';

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

describe('confirmações do CEO levam o caso para Finalizado', () => {
  it('as duas marcadas: vai para FINALIZADO a partir de um caso perdido', () => {
    expect(statusAposConfirmacao('CONCLUIDO', 'AGUARDANDO_EXCLUSAO')).toBe('FINALIZADO');
    expect(statusAposConfirmacao('CONCLUIDO', 'PERDIDO')).toBe('FINALIZADO');
    expect(statusAposConfirmacao('CONCLUIDO', 'SISTEMA_REMOVIDO')).toBe('FINALIZADO');
  });

  it('já finalizado ou recuperado: não muda', () => {
    expect(statusAposConfirmacao('CONCLUIDO', 'FINALIZADO')).toBeNull();
    expect(statusAposConfirmacao('CONCLUIDO', 'RECUPERADO')).toBeNull();
  });

  it('desmarcar não volta o caso (finalizado é definitivo)', () => {
    expect(statusAposConfirmacao('ENVIADO', 'FINALIZADO')).toBeNull();
    expect(statusAposConfirmacao('ENVIADO', 'AGUARDANDO_EXCLUSAO')).toBeNull();
  });
});

describe('fluxograma do cancelamento', () => {
  const caso = { created_at: '2026-09-01T12:00:00.000Z', resolvido_em: '2026-10-01T12:00:00.000Z', sistema_removido_em: null, status: 'FINALIZADO' };
  const reg = { enviado_em: '2026-10-20T12:00:00.000Z', enviado_por: 'u1', enviado_por_nome: 'Jessica', suporte_em: '2026-10-26T13:00:00.000Z', suporte_por_nome: 'Jessica', cobranca_em: '2026-10-26T12:00:00.000Z', cobranca_por_nome: 'Jessica' };

  it('as sete etapas em ordem; finalizado na data da última confirmação', () => {
    const e = etapasDoCancelamento(caso, null, reg);
    expect(e.map(x => x.chave)).toEqual(['aberto', 'perdido', 'sistema', 'enviado', 'suporte', 'cobranca', 'finalizado']);
    expect(e.find(x => x.chave === 'finalizado')!.em).toBe('2026-10-26T13:00:00.000Z');
    expect(e.find(x => x.chave === 'sistema')).toMatchObject({ em: null, opcional: true });
  });

  it('sem pedido ao CEO, as etapas do CEO ficam vazias; perdido usa a inativação quando não há resolução', () => {
    const e = etapasDoCancelamento({ ...caso, resolvido_em: null, status: 'PERDIDO' }, '2026-10-02T00:00:00.000Z', null);
    expect(e.find(x => x.chave === 'perdido')!.em).toBe('2026-10-02T00:00:00.000Z');
    expect(e.filter(x => ['enviado', 'suporte', 'cobranca', 'finalizado'].includes(x.chave)).every(x => x.em === null)).toBe(true);
  });
});
