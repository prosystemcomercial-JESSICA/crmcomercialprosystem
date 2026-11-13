import { describe, it, expect } from 'vitest';
import { vereditoTemperatura } from '../src/lib/laya-temperatura';
import { confirmadaPelaLaya } from '../src/services/laya-temperatura.service';

const agora = new Date('2026-11-13T12:00:00-03:00');
const base = { status: 'AGUARDANDO', nota: 10, temperaturaAgente: 'FRIO', falasCliente: [] as string[], ultimaFalaEm: null as Date | null, agora };

describe('Termômetro da Laya', () => {
  it('sem resposta de pessoa é Frio', () => {
    expect(vereditoTemperatura(base)).toMatchObject({ temperatura: 'FRIO', regra: 'sem_resposta' });
    expect(vereditoTemperatura({ ...base, status: 'SEM_WHATSAPP' }).regra).toBe('sem_contato');
  });

  it('negativo recente derruba para Frio, mesmo com nota alta', () => {
    const v = vereditoTemperatura({ ...base, nota: 70, temperaturaAgente: 'QUENTE', falasCliente: ['Bom dia', 'Não temos interesse, já usamos um sistema'], ultimaFalaEm: agora });
    expect(v).toMatchObject({ temperatura: 'FRIO', regra: 'negativo' });
  });

  it('pedido concreto do cliente esquenta; contrato é Muito quente; demo sem pedido é Morno', () => {
    expect(vereditoTemperatura({ ...base, falasCliente: ['Quanto custa o sistema pra farmácia?'], ultimaFalaEm: agora }).temperatura).toBe('QUENTE');
    expect(vereditoTemperatura({ ...base, falasCliente: ['Pode mandar o contrato'], ultimaFalaEm: agora }).temperatura).toBe('MUITO_QUENTE');
    expect(vereditoTemperatura({ ...base, status: 'DEMO', falasCliente: ['ok'], ultimaFalaEm: agora })).toMatchObject({ temperatura: 'MORNO', regra: 'demo' });
  });

  it('sem pedido concreto segue a nota do agente, no máximo Morno', () => {
    expect(vereditoTemperatura({ ...base, falasCliente: ['Bom dia, quem fala?'], ultimaFalaEm: agora }).temperatura).toBe('FRIO');
    const v = vereditoTemperatura({ ...base, nota: 85, temperaturaAgente: 'MUITO_QUENTE', falasCliente: ['Sim, sou o dono'], ultimaFalaEm: agora });
    expect(v.temperatura).toBe('MORNO');
    expect(v.motivo).toContain('no máximo Morno');
  });

  it('interesse ou dor contada pelo cliente vira Morno', () => {
    expect(vereditoTemperatura({ ...base, falasCliente: ['Nosso sistema está travando muito'], ultimaFalaEm: agora })).toMatchObject({ temperatura: 'MORNO', regra: 'interesse' });
  });

  it('memória de caso parecido confirmado vale sobre a nota', () => {
    const v = vereditoTemperatura({ ...base, nota: 50, temperaturaAgente: 'MORNO', falasCliente: ['Oi tudo bem'], ultimaFalaEm: agora, memoria: { rotulo: 'FRIO', similaridade: 0.8 } });
    expect(v).toMatchObject({ temperatura: 'FRIO', regra: 'memoria' });
  });

  it('esfria um nível se o cliente sumiu há mais de 21 dias (exceto demo)', () => {
    const antigo = new Date(agora.getTime() - 30 * 864e5);
    expect(vereditoTemperatura({ ...base, falasCliente: ['Me manda o preço'], ultimaFalaEm: antigo }).temperatura).toBe('MORNO');
    expect(vereditoTemperatura({ ...base, status: 'DEMO', falasCliente: ['ok'], ultimaFalaEm: antigo }).temperatura).toBe('MORNO');
  });

  it('robô de boas-vindas e menu da loja não contam como fala do cliente', () => {
    const v = vereditoTemperatura({ ...base, falasCliente: ['Olá! Seja bem-vindo à Farmácia X', 'Digite apenas o número correspondente: 1️⃣ Solicitar orçamento'], ultimaFalaEm: agora });
    expect(v.regra).toBe('sem_resposta');
    expect(vereditoTemperatura({ ...base, falasCliente: ['Aqui não é farmácia, somos padaria'], ultimaFalaEm: agora }).regra).toBe('negativo');
  });

  it('só remede o que ela mesma confirmou', () => {
    expect(confirmadaPelaLaya({ temperatura_confirmada: 'FRIO', dados: { temperatura_laya: { valor: 'FRIO' } } })).toBe(true);
    expect(confirmadaPelaLaya({ temperatura_confirmada: 'MORNO', dados: { temperatura_laya: { valor: 'FRIO' } } })).toBe(false);
    expect(confirmadaPelaLaya({ temperatura_confirmada: 'FRIO', dados: {} })).toBe(false);
  });
});
