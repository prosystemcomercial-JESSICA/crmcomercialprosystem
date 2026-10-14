import { describe, it, expect } from 'vitest';
import { situacaoDaIndicacao } from '../src/lib/indicacao-situacao';

// Painel das indicações de clientes (14/10/2026).
describe('situação da indicação', () => {
  it('segue da fila da Caroline ao contrato', () => {
    expect(situacaoDaIndicacao({ sdrStatus: 'FILA' })).toEqual({ fase: 'Na fila da Caroline', status: 'PENDENTE' });
    expect(situacaoDaIndicacao({ sdrStatus: 'AGUARDANDO', primeiroEnvio: new Date() }).fase).toBe('Caroline chamou');
    expect(situacaoDaIndicacao({ sdrStatus: 'CONVERSANDO', primeiroEnvio: new Date(), respondeu: true }).fase).toBe('Respondeu');
    expect(situacaoDaIndicacao({ sdrStatus: 'CONVERSANDO', respondeu: true, nota: 60 }).fase).toBe('Interessado');
    expect(situacaoDaIndicacao({ sdrStatus: 'DEMO' }).fase).toBe('Demonstração marcada');
    expect(situacaoDaIndicacao({ temProposta: true }).fase).toBe('Com proposta');
    expect(situacaoDaIndicacao({ temProposta: true, fechou: true })).toEqual({ fase: 'Fechou contrato', status: 'CONVERTIDO' });
  });
  it('perdido quando não tem interesse ou o número não tem WhatsApp; fechado continua fechado', () => {
    expect(situacaoDaIndicacao({ sdrStatus: 'SEM_INTERESSE' }).status).toBe('PERDIDO');
    expect(situacaoDaIndicacao({ sdrStatus: 'SEM_WHATSAPP' }).fase).toBe('Número sem WhatsApp');
    expect(situacaoDaIndicacao({ statusAtual: 'CONVERTIDO' }).status).toBe('CONVERTIDO');
  });
});
