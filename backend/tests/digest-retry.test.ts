import { describe, it, expect } from 'vitest';
import { erroSmtpPassageiro } from '../src/services/notification.service';

describe('erroSmtpPassageiro', () => {
  it('421 e queda de conexão são passageiros', () => {
    expect(erroSmtpPassageiro({ code: 'EPROTOCOL', response: '421 Unexpected failure, please try later' })).toBe(true);
    expect(erroSmtpPassageiro({ responseCode: 421 })).toBe(true);
    expect(erroSmtpPassageiro({ code: 'ETIMEDOUT' })).toBe(true);
  });
  it('senha errada ou endereço inválido não repetem', () => {
    expect(erroSmtpPassageiro({ code: 'EAUTH', responseCode: 535, response: '535 Authentication failed' })).toBe(false);
    expect(erroSmtpPassageiro({ responseCode: 550, response: '550 mailbox unavailable' })).toBe(false);
  });
});
