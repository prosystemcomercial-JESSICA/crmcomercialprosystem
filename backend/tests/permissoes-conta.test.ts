import { describe, it, expect } from 'vitest';
import {
  flagsDaLinha, ehSomenteLeitura, ehAdminSistema, podeReceberComissaoVendedor, bloquearPorSomenteLeitura,
} from '@/lib/permissoes-conta';

describe('flagsDaLinha', () => {
  it('converte TINYINT/boolean/ausente em booleanos', () => {
    expect(flagsDaLinha({ vende: 1, admin_sistema: 0, somente_leitura: null })).toEqual({ vende: true, admin: false, somente_leitura: false });
    expect(flagsDaLinha({ vende: true, admin_sistema: '1' })).toEqual({ vende: true, admin: true, somente_leitura: false });
    expect(flagsDaLinha({})).toEqual({ vende: false, admin: false, somente_leitura: false });
    expect(flagsDaLinha(undefined)).toEqual({ vende: false, admin: false, somente_leitura: false });
  });
});

describe('ehSomenteLeitura', () => {
  it('CEO é sempre consulta', () => {
    expect(ehSomenteLeitura({ role: 'CEO' })).toBe(true);
  });
  it('flag somente_leitura trava qualquer cargo', () => {
    expect(ehSomenteLeitura({ role: 'VENDEDOR', somente_leitura: true })).toBe(true);
  });
  it('admin nunca fica travado', () => {
    expect(ehSomenteLeitura({ role: 'CEO', admin: true })).toBe(false);
  });
  it('supervisão/vendedor normais escrevem', () => {
    expect(ehSomenteLeitura({ role: 'SUPERVISAO_COMERCIAL' })).toBe(false);
    expect(ehSomenteLeitura({ role: 'VENDEDOR' })).toBe(false);
    expect(ehSomenteLeitura(undefined)).toBe(false);
  });
});

describe('ehAdminSistema', () => {
  it('flag admin ou cargo ADMIN/DIRETOR', () => {
    expect(ehAdminSistema({ role: 'SUPERVISAO_COMERCIAL', admin: true })).toBe(true);
    expect(ehAdminSistema({ role: 'ADMIN' })).toBe(true);
    expect(ehAdminSistema({ role: 'SUPERVISAO_COMERCIAL' })).toBe(false);
    expect(ehAdminSistema({ role: 'CEO' })).toBe(false);
  });
});

describe('podeReceberComissaoVendedor', () => {
  it('cargo VENDEDOR ou flag vende', () => {
    expect(podeReceberComissaoVendedor({ cargo: 'VENDEDOR' })).toBe(true);
    expect(podeReceberComissaoVendedor({ cargo: 'SUPERVISAO_COMERCIAL', vende: 1 })).toBe(true);
    expect(podeReceberComissaoVendedor({ cargo: 'SUPERVISAO_COMERCIAL', vende: 0 })).toBe(false);
    expect(podeReceberComissaoVendedor({ cargo: 'CEO' })).toBe(false);
  });
});

describe('bloquearPorSomenteLeitura', () => {
  const ceo = { id: 't', role: 'CEO' };
  it('bloqueia POST/PATCH/PUT/DELETE do CEO', () => {
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(bloquearPorSomenteLeitura(ceo, m, '/leads/123')).toBe(true);
    }
  });
  it('libera leitura', () => {
    expect(bloquearPorSomenteLeitura(ceo, 'GET', '/leads')).toBe(false);
    expect(bloquearPorSomenteLeitura(ceo, 'HEAD', '/leads')).toBe(false);
    expect(bloquearPorSomenteLeitura(ceo, 'OPTIONS', '/leads')).toBe(false);
  });
  it('libera rotas da própria sessão (allowlist), com query string ou barra final', () => {
    expect(bloquearPorSomenteLeitura(ceo, 'POST', '/auth/logout')).toBe(false);
    expect(bloquearPorSomenteLeitura(ceo, 'POST', '/auth/refresh')).toBe(false);
    expect(bloquearPorSomenteLeitura(ceo, 'POST', '/auth/alterar-senha/')).toBe(false);
    expect(bloquearPorSomenteLeitura(ceo, 'POST', '/auth/login?x=1')).toBe(false);
  });
  it('não confunde prefixo da allowlist', () => {
    expect(bloquearPorSomenteLeitura(ceo, 'POST', '/auth/login-extra')).toBe(true);
  });
  it('não afeta quem não é somente leitura nem requisição anônima (webhooks)', () => {
    expect(bloquearPorSomenteLeitura({ role: 'SUPERVISAO_COMERCIAL', admin: true }, 'POST', '/usuarios')).toBe(false);
    expect(bloquearPorSomenteLeitura(undefined, 'POST', '/whatsapp/webhook')).toBe(false);
  });
});
