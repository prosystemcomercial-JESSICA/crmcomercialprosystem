import { describe, it, expect } from 'vitest';
import {
  avaliarAgente, proximoPasso, degrauDepois, textoCobranca, lerPlanoVitoria, descreverProvidencia, semanaDe, mesDe, horaSP, AGENDA,
  type NumerosAgente, type Degrau,
} from '../src/lib/assistente/diretoria';

const base = (x: Partial<NumerosAgente> = {}): NumerosAgente => ({ id: 'caroline', mensagens: 40, ia: { chamadas: 0, falhas: 0 }, ...x });
const dec = (sozinha: number, aprovada: number, editada: number, descartada: number, segurada_laya = 0) => ({ sozinha, aprovada, editada, descartada, segurada_laya });

describe('avaliação dos agentes (13/11/2026)', () => {
  it('poucas mensagens não geram cobrança, mesmo com erro', () => {
    expect(avaliarAgente(base({ decididas: dec(1, 1, 2, 1) })).nivel).toBe('ok');
  });
  it('erro de 25% vira atenção e de 40% vira crítico', () => {
    expect(avaliarAgente(base({ decididas: dec(10, 5, 3, 2) })).nivel).toBe('atencao'); // 5/20
    const c = avaliarAgente(base({ decididas: dec(4, 2, 2, 2, 2) })); // 4/10 (seguradas não somam)
    expect(c.nivel).toBe('critico');
    expect(c.sinais[0]).toContain('a Laya segurou 2 para conferir');
  });
  it('segurada pela Laya não conta como erro (caso real de 13/11: 80 seguradas em 281)', () => {
    expect(avaliarAgente(base({ decididas: dec(150, 84, 5, 42, 80) })).nivel).toBe('ok');
  });
  it('nota baixa no boletim também cobra, com o que melhorar', () => {
    const a = avaliarAgente(base({ id: 'heitor', mensagens: 0, nota: 5, melhorar: 'trazer o WhatsApp do decisor' }));
    expect(a.nivel).toBe('atencao');
    expect(a.sinais[0]).toContain('trazer o WhatsApp do decisor');
    expect(avaliarAgente(base({ nota: 3 })).nivel).toBe('critico');
  });
  it('falha de IA é técnica: aparece, mas não cobra o agente', () => {
    const a = avaliarAgente(base({ ia: { chamadas: 10, falhas: 7 } }));
    expect(a.nivel).toBe('ok');
    expect(a.tecnico).toContain('70%');
  });
});

describe('escada de cobrança', () => {
  const agora = new Date('2026-11-13T21:00:00Z');
  const dias = (n: number) => new Date(agora.getTime() - n * 864e5).toISOString();
  const ruim = avaliarAgente(base({ decididas: dec(5, 5, 5, 5) }));
  const bom = avaliarAgente(base({ decididas: dec(20, 0, 0, 0) }));
  const d = (nivel: 1 | 2 | 3, ultima: number): Degrau => ({ nivel, desde: dias(10), ultima_em: dias(ultima), motivo: 'x' });

  it('cobra, espera 2 dias, pede treino, espera 3, leva à Vitória e relembra a cada 7', () => {
    expect(proximoPasso(undefined, ruim, agora)).toBe('cobrar');
    expect(proximoPasso(d(1, 1), ruim, agora)).toBe('nada');
    expect(proximoPasso(d(1, 2), ruim, agora)).toBe('treinar');
    expect(proximoPasso(d(2, 2), ruim, agora)).toBe('nada');
    expect(proximoPasso(d(2, 3), ruim, agora)).toBe('escalar');
    expect(proximoPasso(d(3, 6), ruim, agora)).toBe('nada');
    expect(proximoPasso(d(3, 7), ruim, agora)).toBe('escalar');
  });
  it('melhorou: segura a escada por 7 dias e depois zera', () => {
    expect(proximoPasso(d(2, 3), bom, agora)).toBe('nada');
    expect(proximoPasso(d(2, 7), bom, agora)).toBe('zerar');
    expect(proximoPasso(undefined, bom, agora)).toBe('nada');
  });
  it('degrau novo guarda o começo quando o nível se repete', () => {
    const atual = d(3, 8);
    expect(degrauDepois('escalar', atual, 'm', agora)!.desde).toBe(atual.desde);
    expect(degrauDepois('cobrar', undefined, 'm', agora)!.nivel).toBe(1);
    expect(degrauDepois('zerar', atual, 'm', agora)).toBeUndefined();
  });
  it('cobrança cita os números e o prazo, sem travessão', () => {
    const t = textoCobranca('renata', 'Mila', avaliarAgente(base({ id: 'mila', nota: 5 })), 'citar a ferramenta nova');
    expect(t).toContain('a Renata, sua gerente');
    expect(t).toContain('nota 5/10');
    expect(t).toContain('2 dias úteis');
    expect(t).not.toMatch(/[—–]/);
  });
});

describe('plano da Vitória', () => {
  const ctx = { agentes: ['caroline', 'julio', 'luiz_felipe', 'heitor', 'mila'], vendedoras: ['u1'] };
  it('deixa passar só o que é seguro de aplicar', () => {
    const p = lerPlanoVitoria({
      diagnostico: 'Funil travado na demo — falta follow-up', prioridades: ['a', 'b'], plano: 'p', resumo_whatsapp: 'r',
      providencias: [
        { tipo: 'regra', agente: 'caroline', texto: 'Ofereça a demonstração já na segunda mensagem.' },
        { tipo: 'regra', agente: 'fantasma', texto: 'agente que não existe não recebe regra' },
        { tipo: 'pausar', agente: 'heitor', dias: 2, motivo: 'não fala com cliente' },
        { tipo: 'pausar', agente: 'julio', dias: 9, motivo: 'erros' },
        { tipo: 'treinar', agente: 'mila' },
        { tipo: 'treinar', agente: 'luiz_felipe', foco: 'objeção de preço' },
        { tipo: 'meta_agente', agente: 'heitor', indicador: 'leads_cadastrados', alvo: 120 },
        { tipo: 'meta_agente', agente: 'heitor', indicador: 'demos_marcadas', alvo: 5 },
        { tipo: 'meta_agente', agente: 'caroline', indicador: 'acerto_pct', alvo: 150 },
        { tipo: 'meta_vendedora', vendedor_id: 'u1', contratos: 6, valor_total: 0 },
        { tipo: 'meta_vendedora', vendedor_id: 'u9', contratos: 6 },
      ],
    }, ctx);
    expect(p.diagnostico).not.toMatch(/[—–]/);
    expect(p.providencias.map(x => x.tipo)).toEqual(['regra', 'pausar', 'treinar', 'meta_agente', 'meta_vendedora']);
    expect(p.providencias[1]).toMatchObject({ agente: 'julio', dias: 3 });
    expect(p.providencias[4]).toMatchObject({ contratos: 6, valor_total: null });
  });
  it('descreve cada providência em uma linha', () => {
    const nome = (id: string) => ({ caroline: 'Caroline', u1: 'Ana' } as any)[id] || id;
    expect(descreverProvidencia({ tipo: 'pausar', agente: 'caroline', dias: 1, motivo: 'erros' }, nome)).toBe('Pausou Caroline por 1 dia(s): erros');
    expect(descreverProvidencia({ tipo: 'meta_vendedora', vendedor_id: 'u1', contratos: 4, valor_total: 12000 }, nome)).toContain('Ana: 4 contrato(s) e R$ 12.000');
  });
});

describe('agenda e datas (horário de Brasília)', () => {
  it('semana começa na segunda e o mês segue Brasília', () => {
    expect(semanaDe(new Date('2026-11-16T02:00:00Z'))).toBe('2026-11-09'); // domingo 23h em SP
    expect(semanaDe(new Date('2026-11-16T12:00:00Z'))).toBe('2026-11-16');
    expect(mesDe(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11');
  });
  it('boletim na sexta 16h, Vitória na segunda 8h, gerentes dias úteis 18h', () => {
    expect(AGENDA.boletim(horaSP(new Date('2026-11-13T19:10:00Z')))).toBe(true);  // sexta 16h10
    expect(AGENDA.vitoria(horaSP(new Date('2026-11-16T11:05:00Z')))).toBe(true);  // segunda 8h05
    expect(AGENDA.gerentes(horaSP(new Date('2026-11-14T21:00:00Z')))).toBe(false); // sábado
    expect(AGENDA.escalacao(horaSP(new Date('2026-11-13T21:20:00Z')))).toBe(false); // 18h20
    expect(AGENDA.escalacao(horaSP(new Date('2026-11-13T21:35:00Z')))).toBe(true);
  });
});
