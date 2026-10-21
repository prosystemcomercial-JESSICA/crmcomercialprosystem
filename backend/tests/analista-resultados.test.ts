import { describe, it, expect } from 'vitest';
import { sistemasNoTexto, rankingRetorno, temSinalDeCompra, temperaturaAnalista, retornoAtrasado, semContato, mensagemWhatsapp } from '../src/lib/analista-resultados';
import { inicioDaSemana } from '../src/services/analista-resultados.service';

describe('Analista de Resultados: regras', () => {
  it('acha os sistemas citados e não confunde a Prosystem com sistema do lead', () => {
    expect(sistemasNoTexto('usamos hos')).toEqual(['HOS']);
    expect(sistemasNoTexto('Usamos formula certa')).toEqual(['Fórmula Certa']);
    expect(sistemasNoTexto('Hoje utilizamos o Linx, mas era cliente antiga da Prosystem')).toEqual(['Linx (Big)']);
    expect(sistemasNoTexto('Quero colocar minha padaria sob controle com o Prosystem.')).toEqual([]);
    expect(sistemasNoTexto(null)).toEqual([]);
  });

  it('ranking mede resposta e avanço por grupo', () => {
    const lista = [{ g: 'a', r: true, v: true }, { g: 'a', r: true, v: false }, { g: 'b', r: false, v: false }, { g: null, r: true, v: false }];
    const rk = rankingRetorno(lista, x => x.g, x => x.r, x => x.v);
    expect(rk[0]).toMatchObject({ chave: 'a', contatados: 2, responderam: 2, avancaram: 1, taxa_resposta: 100, taxa_avanco: 50 });
    expect(rk.find(r => r.chave === 'não informado')).toMatchObject({ contatados: 1 });
  });

  it('reconhece pedido de compra na fala do cliente', () => {
    expect(temSinalDeCompra('consegue me falar o valor?')).toBe(true);
    expect(temSinalDeCompra('O seu tem taxa de instalação?')).toBe(true);
    expect(temSinalDeCompra('Ainda não resolvemos. Semana que vem pode agendar uma reunião?')).toBe(true);
    expect(temSinalDeCompra('Olá! Bem vindo(a) à Farmácia Preço Baixo')).toBe(false);
  });

  it('temperatura: proposta recente é quente; pedido de demonstração é morno; robô é frio', () => {
    expect(temperaturaAnalista({ status: 'AGUARDANDO', nota: 30, temProposta: true, sinalCompra: false, diasDesdeCliente: 3 })).toBe('QUENTE');
    expect(temperaturaAnalista({ status: 'VENDEDORA', nota: 20, temProposta: false, sinalCompra: true, diasDesdeCliente: 2 })).toBe('QUENTE');
    expect(temperaturaAnalista({ status: 'VENDEDORA', nota: 20, temProposta: false, sinalCompra: true, diasDesdeCliente: 30 })).toBe('MORNO');
    expect(temperaturaAnalista({ status: 'DEMO', nota: 10, temProposta: false, sinalCompra: false, diasDesdeCliente: 20 })).toBe('MORNO');
    expect(temperaturaAnalista({ status: 'AGUARDANDO', nota: 0, temProposta: false, sinalCompra: false, diasDesdeCliente: 1 })).toBe('FRIO');
  });

  it('retorno combinado atrasado: venceu há mais de 2 h sem mensagem do agente depois', () => {
    const agora = new Date('2026-10-21T15:00:00Z');
    expect(retornoAtrasado('2026-10-21T10:00:00Z', new Date('2026-10-20T10:00:00Z'), agora)).toBe(true);
    expect(retornoAtrasado('2026-10-21T10:00:00Z', new Date('2026-10-21T10:05:00Z'), agora)).toBe(false);
    expect(retornoAtrasado('2026-10-21T14:00:00Z', null, agora)).toBe(false);
    expect(retornoAtrasado(null, null, agora)).toBe(false);
  });

  it('tira e-mail e telefone do texto', () => {
    expect(semContato('meu email ana@x.com.br e fone (27) 99999-1234')).toBe('meu email [e-mail] e fone [número]');
  });

  it('semana começa na segunda, meia-noite de Brasília', () => {
    expect(inicioDaSemana(new Date('2026-10-23T19:00:00Z')).toISOString()).toBe('2026-10-19T03:00:00.000Z');
    expect(inicioDaSemana(new Date('2026-10-19T02:00:00Z')).toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });

  it('mensagem do WhatsApp traz números, quentes e o link', () => {
    const t = mensagemWhatsapp({ semana: '19/10', contatados: 76, humanos: 30, avancaram: 5, propostas: 0, contratos: 0, quentes: [{ empresa: 'Farmácia A' }], mornos: 9, propostasParadas: 18, mensalidadeParada: 6230, principal: 'Ligar para as propostas.', link: 'https://x/analista' });
    expect(t).toContain('Lojas contatadas: 76');
    expect(t).toContain('Farmácia A');
    expect(t).toContain('R$ 6.230/mês');
    expect(t).toContain('https://x/analista');
  });
});

describe('Analista de Resultados: próxima semana', () => {
  it('rotula os dias úteis da semana seguinte', async () => {
    const { proximaSemana } = await import('../src/services/analista-resultados.service');
    expect(proximaSemana(new Date('2026-10-23T19:00:00Z'))).toEqual({ seg: 'seg 26/10', ter: 'ter 27/10', qua: 'qua 28/10', qui: 'qui 29/10', sex: 'sex 30/10' });
  });
});
