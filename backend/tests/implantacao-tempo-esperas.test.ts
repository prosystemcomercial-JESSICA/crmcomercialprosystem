import { describe, it, expect } from 'vitest';
import { esperaPreRequisito, slaDaDemanda, msEsperaCliente, PRE_REQUISITO_PADRAO } from '../src/lib/implantacao/portal';
import { relatorioDeTempo, msUteis, ticketsDaDemanda as _t } from '../src/lib/implantacao/cronometro';

const d = (s: string) => new Date(`${s}-03:00`);
const H = 3600000, DIA = 24 * H;

describe('pré-requisitos do cliente: o prazo só começa na entrega (30/10/2026)', () => {
  const assinatura = d('2026-10-01T10:00:00');

  it('itens padrão que impedem começar: certificado, equipamento e contador', () => {
    expect(PRE_REQUISITO_PADRAO.test('Certificado digital A1 (arquivo .pfx)')).toBe(true);
    expect(PRE_REQUISITO_PADRAO.test('Dados do contador')).toBe(true);
    expect(PRE_REQUISITO_PADRAO.test('Equipamento (computador do caixa)')).toBe(true);
    expect(PRE_REQUISITO_PADRAO.test('Código CSC da NFC-e')).toBe(false);
  });

  it('faltando item: espera aberta desde a assinatura; entregue tudo: fecha na última entrega', () => {
    const aberta = esperaPreRequisito(assinatura, [
      { titulo: 'Certificado', status: 'ENVIADA', enviada_em: d('2026-10-05T09:00:00') },
      { titulo: 'Equipamento', status: 'PENDENTE' },
    ]);
    expect(aberta?.inicio).toEqual(assinatura);
    expect(aberta?.fim).toBeNull();
    expect(aberta?.pendentes).toEqual(['Equipamento']);
    const fechada = esperaPreRequisito(assinatura, [
      { titulo: 'Certificado', status: 'CONCLUIDA', enviada_em: d('2026-10-05T09:00:00'), concluida_em: d('2026-10-06T09:00:00') },
      { titulo: 'Equipamento', status: 'ENVIADA', enviada_em: d('2026-10-08T15:00:00') },
    ]);
    expect(fechada?.fim).toEqual(d('2026-10-08T15:00:00'));
    expect(esperaPreRequisito(assinatura, [])).toBeNull();
  });

  it('enquanto falta pré-requisito o prazo não começou; entregue, os 15 dias contam da entrega', () => {
    const prazo = new Date(assinatura.getTime() + 15 * DIA);
    const aberta = [{ tipo: 'PRE_REQUISITO', inicio: assinatura, fim: null }];
    const s1 = slaDaDemanda(assinatura, prazo, aberta, null, d('2026-10-20T10:00:00'));
    expect(s1?.situacao).toBe('AGUARDANDO_INICIO');
    const entrega = d('2026-10-10T10:00:00');
    const fechada = [{ tipo: 'PRE_REQUISITO', inicio: assinatura, fim: entrega }];
    const s2 = slaDaDemanda(assinatura, prazo, fechada, null, d('2026-10-20T10:00:00'));
    expect(s2?.prazo).toEqual(new Date(entrega.getTime() + 15 * DIA));
    expect(s2?.situacao).toBe('NO_PRAZO');
    expect(s2?.pct).toBe(67); // 10 de 15 dias depois da entrega
  });

  it('pré-requisito e tarefa vencida ao mesmo tempo contam uma vez só', () => {
    const ms = msEsperaCliente([
      { tipo: 'PRE_REQUISITO', inicio: d('2026-10-01T10:00:00'), fim: d('2026-10-05T10:00:00') },
      { tipo: 'CLIENTE', inicio: d('2026-10-03T10:00:00'), fim: d('2026-10-06T10:00:00') },
      { tipo: 'N3', inicio: d('2026-10-01T10:00:00'), fim: d('2026-10-09T10:00:00') }, // repasse interno não pausa o prazo
    ]);
    expect(ms).toBe(5 * DIA);
  });
});

describe('para onde vai o tempo: executando x esperando (30/10/2026)', () => {
  it('horas úteis: noite e fim de semana não contam', () => {
    // sexta 17h → segunda 9h: 1h na sexta + 1h na segunda
    expect(msUteis([{ inicio: d('2026-10-30T17:00:00'), fim: d('2026-11-02T09:00:00') }])).toBe(2 * H);
  });

  it('separa executando, cliente e repasses internos, com o tempo até voltar', () => {
    const de = d('2026-10-26T00:00:00'), ate = d('2026-10-31T00:00:00');
    const r = relatorioDeTempo(
      [
        { inicio: d('2026-10-26T08:00:00'), fim: d('2026-10-26T10:00:00'), implantacao_id: 'a', tecnico_id: 't1', cliente: 'Loja A' },
        { inicio: d('2026-10-26T20:00:00'), fim: d('2026-10-26T21:00:00'), implantacao_id: 'a', tecnico_id: 't1', cliente: 'Loja A' }, // fora do horário conta
        { inicio: d('2026-10-26T08:00:00'), fim: d('2026-10-26T09:00:00'), implantacao_id: 'b', tecnico_id: 't2', cliente: 'Loja B' },
      ],
      [
        { tipo: 'N3', inicio: d('2026-10-26T10:00:00'), fim: d('2026-10-26T15:00:00'), implantacao_id: 'a' }, // 4h úteis (1h de almoço)
        { tipo: 'PROGRAMACAO', inicio: d('2026-10-27T08:00:00'), fim: null, implantacao_id: 'b' },
        { tipo: 'CLIENTE', inicio: d('2026-10-28T08:00:00'), fim: d('2026-10-28T10:00:00'), implantacao_id: 'a' },
      ],
      de, ate, { agora: d('2026-10-27T18:00:00') },
    );
    expect(r.executando_ms).toBe(4 * H);
    expect(r.por_tipo.N3.voltaram).toBe(1);
    expect(r.por_tipo.N3.retorno_medio_uteis_ms).toBe(4 * H);
    expect(r.por_tipo.PROGRAMACAO.abertas).toBe(1);
    expect(r.por_tipo.PROGRAMACAO.uteis_ms).toBe(9 * H);
    const a = r.por_demanda.find(x => x.implantacao_id === 'a')!;
    expect(a.executando_ms).toBe(3 * H);
    expect(a.n3_uteis_ms).toBe(4 * H);
    expect(a.cliente_uteis_ms).toBe(2 * H);
  });
});

describe('chamados internos: repasse vira chamado dentro do card (30/10/2026)', () => {
  const r1 = { id: 'c1', tipo: 'N3', motivo: 'ajuste fiscal', inicio: d('2026-10-26T09:00:00'), fim: d('2026-10-26T11:00:00') };
  it('com o setor → em teste → devolvido → fechado, com tempos e devoluções', () => {
    const ticketsDaDemanda = _t;
    const agora = d('2026-10-26T18:00:00');
    expect(ticketsDaDemanda([{ ...r1, fim: null }], agora)[0].situacao).toBe('COM_SETOR');
    expect(ticketsDaDemanda([r1], agora)[0].situacao).toBe('EM_TESTE');
    const r2 = { id: 'c2', tipo: 'N3', motivo: 'ainda dá erro', inicio: d('2026-10-26T12:00:00'), fim: d('2026-10-26T14:00:00'), ticket_id: 'c1' };
    const t = ticketsDaDemanda([{ ...r1, fechado_em: d('2026-10-26T15:00:00') }, r2], agora)[0];
    expect(t.situacao).toBe('FECHADO');
    expect(t.devolucoes).toBe(1);
    expect(t.com_setor_ms).toBe(4 * H);
    expect(t.em_teste_ms).toBe(2 * H); // 11h→12h e 14h→15h
  });
  it('dois chamados ao mesmo tempo para setores diferentes; cliente não vira chamado interno', () => {
    const ticketsDaDemanda = _t;
    const ts = ticketsDaDemanda([{ ...r1, fim: null }, { id: 'c3', tipo: 'PROGRAMACAO', motivo: 'importação', inicio: d('2026-10-26T10:00:00'), fim: null }, { id: 'c4', tipo: 'CLIENTE', motivo: 'x', inicio: d('2026-10-26T10:00:00'), fim: null }]);
    expect(ts.map((t: any) => t.setor).sort()).toEqual(['Desenvolvimento (Sinval)', 'N3']);
  });
  it('relatório conta chamados e a taxa de devolução', () => {
    const r = relatorioDeTempo([], [
      { id: 'c1', tipo: 'N3', inicio: d('2026-10-26T09:00:00'), fim: d('2026-10-26T11:00:00'), implantacao_id: 'a' },
      { id: 'c2', tipo: 'N3', inicio: d('2026-10-26T12:00:00'), fim: d('2026-10-26T14:00:00'), implantacao_id: 'a', ticket_id: 'c1' },
      { id: 'c5', tipo: 'N3', inicio: d('2026-10-27T09:00:00'), fim: d('2026-10-27T10:00:00'), implantacao_id: 'b' },
    ], d('2026-10-26T00:00:00'), d('2026-10-31T00:00:00'));
    expect(r.por_tipo.N3.chamados).toBe(2);
    expect(r.por_tipo.N3.devolvidos).toBe(1);
    expect(r.por_tipo.N3.taxa_devolucao_pct).toBe(50);
  });
});
