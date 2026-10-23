import { describe, it, expect } from 'vitest';
import { lerRespostaZapSign, telefoneZapSign } from '../src/routes/contratos-comerciais';

describe('resposta da ZapSign', () => {
  it('402 em texto puro (sem Plano de API) vira mensagem legível', async () => {
    const r = await lerRespostaZapSign(new Response('É obrigatório contratar um Plano de API para utilizá-la em modo produção.', { status: 402 }));
    expect(r.ok).toBe(false);
    expect(r.erro).toContain('Plano de API');
    expect(r.erro).toContain('A chave está certa');
  });
  it('erro em JSON usa o detail', async () => {
    const r = await lerRespostaZapSign(new Response(JSON.stringify({ detail: 'Token da API não encontrado' }), { status: 403 }));
    expect(r.erro).toBe('ZapSign (403): Token da API não encontrado');
  });
  it('sucesso devolve os dados', async () => {
    const r = await lerRespostaZapSign(new Response(JSON.stringify({ token: 'abc', signers: [] }), { status: 200 }));
    expect(r).toEqual({ ok: true, dados: { token: 'abc', signers: [] } });
  });
  it('telefone sem o 55 (vai em phone_country)', () => {
    expect(telefoneZapSign('5527997521370')).toBe('27997521370');
    expect(telefoneZapSign('(27) 99752-1370')).toBe('27997521370');
    expect(telefoneZapSign(null)).toBe('');
  });
});
