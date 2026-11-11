import { describe, it, expect } from 'vitest';
import { AGENTES } from '../src/lib/assistente/escritorio';
import { SETORES, LIGACOES, setorDe, recebeDe, entregaPara, motivoErro, situacaoTeto } from '../src/lib/assistente/escritorio-setores';

describe('escritório por setores', () => {
  it('todo agente está em exatamente um setor e as ligações só citam agentes existentes', () => {
    const ids = AGENTES.map(a => a.id) as string[];
    const nosSetores = SETORES.flatMap(s => [...s.agentes]);
    expect([...nosSetores].sort()).toEqual([...ids].sort());
    for (const l of LIGACOES) { expect(ids).toContain(l.de); expect(ids).toContain(l.para); }
    expect(setorDe('laya')).toBe('inteligencia');
    expect(recebeDe('caroline')).toEqual(expect.arrayContaining(['heitor', 'bia', 'julio', 'rafael', 'laya']));
    expect(entregaPara('caroline')).toEqual(['lurdinha']);
  });

  it('erro: pausa vigente ou só falhas de IA hoje', () => {
    const agora = new Date('2026-11-10T15:00:00Z');
    expect(motivoErro({ pausadaMotivo: '3 falhas', pausadaAte: '2026-11-10T16:00:00Z', agora })).toBe('3 falhas');
    expect(motivoErro({ pausadaMotivo: '3 falhas', pausadaAte: '2026-11-10T14:00:00Z', agora })).toBeNull();
    expect(motivoErro({ agora, iaHoje: { ok: 0, falhas: 5 } })).toMatch(/5 falhas/);
    expect(motivoErro({ agora, iaHoje: { ok: 2, falhas: 5 } })).toBeNull();
  });

  it('teto: atenção a partir de 80%', () => {
    expect(situacaoTeto(10, 20, 0).nivel).toBe('sem_teto');
    expect(situacaoTeto(79, 100, 100)).toMatchObject({ nivel: 'ok', previsao_estoura: false });
    expect(situacaoTeto(80, 130, 100)).toMatchObject({ nivel: 'atencao', previsao_estoura: true });
    expect(situacaoTeto(101, 130, 100).nivel).toBe('estourou');
  });
});

describe('resumo diário da Marta', () => {
  it('conta por tipo, marca "+" no teto e lista o que precisa de atenção', async () => {
    const { textoResumoMarta } = await import('../src/lib/assistente/escritorio-setores');
    const t = textoResumoMarta({
      esperando: [{ tipo: 'mensagem' }, { tipo: 'pergunta' }, { tipo: 'pergunta' }],
      comErro: [{ nome: 'Zequinha', motivo: '3 falhas seguidas' }], whatsappFora: ['Número 2'], iasPausadas: [],
      link: 'https://exemplo/escritorio', tetos: { pergunta: 2 },
    });
    expect(t).toContain('• 1 mensagem(ns) dos agentes para aprovar');
    expect(t).toContain('• 2+ pergunta(s) do Rafael');
    expect(t).not.toContain('documento(s)');
    expect(t).toContain('Zequinha parou: 3 falhas seguidas');
    expect(t).toContain('WhatsApp desconectado: Número 2');
    expect(t).toContain('https://exemplo/escritorio');
  });
  it('sem nada parado diz isso e não abre a seção de atenção', async () => {
    const { textoResumoMarta } = await import('../src/lib/assistente/escritorio-setores');
    const t = textoResumoMarta({ esperando: [], comErro: [], whatsappFora: [], iasPausadas: [], link: 'x' });
    expect(t).toContain('Nada parado com você');
    expect(t).not.toContain('Precisa de atenção');
  });
});
