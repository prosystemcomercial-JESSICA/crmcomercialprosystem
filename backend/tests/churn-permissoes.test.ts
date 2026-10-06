import { describe, it, expect } from 'vitest';
import { ROLES_TRATAM_CHURN } from '../src/lib/scope';
import { requireRole } from '../src/middleware/auth';

// Simula a requisição/resposta do Fastify o suficiente para o guard de cargo.
async function passa(role: string) {
  let bloqueou = false;
  const reply: any = { status: () => reply, send: () => { bloqueou = true; return reply; } };
  await (requireRole(ROLES_TRATAM_CHURN) as any)({ user: { id: 'u1', role } }, reply);
  return !bloqueou;
}

describe('quem trata casos de churn', () => {
  it('SDR inclui e trata casos (pedido da Jessica, 06/10/2026)', async () => {
    expect(await passa('SDR')).toBe(true);
  });
  it('supervisões e CEO continuam; cargos atuais e antigos', async () => {
    for (const r of ['CEO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'SUPERVISAO', 'TECNICO']) expect(await passa(r)).toBe(true);
  });
  it('vendedor não trata casos de churn', async () => {
    expect(await passa('VENDEDOR')).toBe(false);
  });
});
