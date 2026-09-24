import { describe, it, expect, vi } from 'vitest';
import { decidirAcesso, criarCacheEstadoConta } from '@/lib/permissoes-conta';

const jwtVelho = { id: 'thiago', role: 'SUPERVISAO_COMERCIAL', somente_leitura: false };

describe('decidirAcesso (banco é a fonte da verdade)', () => {
  it('JWT antigo sem flag, mas banco diz somente_leitura → 403 em escrita', () => {
    expect(decidirAcesso(jwtVelho, { status: 'ATIVO', role: 'SUPERVISAO_COMERCIAL', somente_leitura: 1 }, 'POST', '/leads')).toBe('somente_leitura');
  });
  it('GET continua liberado para consulta', () => {
    expect(decidirAcesso(jwtVelho, { status: 'ATIVO', role: 'CEO', somente_leitura: 0 }, 'GET', '/leads')).toBe('ok');
  });
  it('cargo atual CEO sem admin → bloqueia escrita; com admin → libera', () => {
    expect(decidirAcesso(jwtVelho, { status: 'ATIVO', role: 'CEO' }, 'PATCH', '/x')).toBe('somente_leitura');
    expect(decidirAcesso(jwtVelho, { status: 'ATIVO', role: 'CEO', admin_sistema: 1 }, 'PATCH', '/x')).toBe('ok');
  });
  it('JWT diz somente leitura mas banco já liberou → ok', () => {
    expect(decidirAcesso({ ...jwtVelho, somente_leitura: true }, { status: 'ATIVO', role: 'VENDEDOR', somente_leitura: 0 }, 'POST', '/leads')).toBe('ok');
  });
  it('conta INATIVA ou apagada → inativo (também em GET)', () => {
    expect(decidirAcesso(jwtVelho, { status: 'INATIVO', role: 'VENDEDOR' }, 'GET', '/leads')).toBe('inativo');
    expect(decidirAcesso(jwtVelho, null, 'POST', '/leads')).toBe('inativo');
  });
  it('rotas da própria sessão sempre passam', () => {
    expect(decidirAcesso(jwtVelho, { status: 'INATIVO', role: 'CEO' }, 'POST', '/auth/logout')).toBe('ok');
    expect(decidirAcesso(jwtVelho, { status: 'ATIVO', role: 'CEO', somente_leitura: 1 }, 'POST', '/auth/alterar-senha')).toBe('ok');
  });
  it('banco indisponível (undefined) → usa flags do JWT', () => {
    expect(decidirAcesso({ id: 'a', role: 'CEO' }, undefined, 'POST', '/leads')).toBe('somente_leitura');
    expect(decidirAcesso({ id: 'a', role: 'VENDEDOR' }, undefined, 'POST', '/leads')).toBe('ok');
  });
});

describe('criarCacheEstadoConta', () => {
  it('consulta o banco 1x dentro do TTL e de novo depois', async () => {
    let t = 0;
    const carregar = vi.fn(async () => ({ status: 'ATIVO', role: 'VENDEDOR' }));
    const get = criarCacheEstadoConta(carregar, 1000, () => t);
    await get('u'); await get('u');
    expect(carregar).toHaveBeenCalledTimes(1);
    t = 1500; await get('u');
    expect(carregar).toHaveBeenCalledTimes(2);
  });
  it('erro no banco → undefined (fallback) e não fica em cache', async () => {
    const carregar = vi.fn(async () => { throw new Error('db'); });
    const get = criarCacheEstadoConta(carregar as any, 1000, () => 0);
    expect(await get('u')).toBeUndefined();
    await get('u');
    expect(carregar).toHaveBeenCalledTimes(2);
  });
});
