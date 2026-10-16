import { describe, it, expect } from 'vitest';
import { urlDescadastro } from '../src/lib/url-descadastro';

describe('link de descadastro da sequência de e-mail', () => {
  it('usa o /api do domínio público (sem ele o link dava "não encontrada")', () => {
    expect(urlDescadastro('https://comercial.prosystemnet.com', 'abc')).toBe('https://comercial.prosystemnet.com/api/sequencias-email/descadastro/abc');
    expect(urlDescadastro('https://comercial.prosystemnet.com/', 'abc')).toBe('https://comercial.prosystemnet.com/api/sequencias-email/descadastro/abc');
  });
  it('não duplica o /api e tem padrão quando a variável falta', () => {
    expect(urlDescadastro('https://comercial.prosystemnet.com/api', 'abc')).toBe('https://comercial.prosystemnet.com/api/sequencias-email/descadastro/abc');
    expect(urlDescadastro(undefined, 'x y')).toBe('https://comercial.prosystemnet.com/api/sequencias-email/descadastro/x%20y');
  });
});
