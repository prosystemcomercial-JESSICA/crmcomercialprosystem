import { describe, it, expect } from 'vitest';
import { janelaLembrete, textoLembreteAtividade } from '../src/lib/lembrete-atividade';

describe('lembrete de atividade de marketing ao responsável', () => {
  it('janela: de 30 min atrás até 1 h à frente', () => {
    const agora = new Date('2026-11-05T19:00:00Z'); // 16h de SP
    const j = janelaLembrete(agora);
    expect(j.gt.toISOString()).toBe('2026-11-05T18:30:00.000Z');
    expect(j.lte.toISOString()).toBe('2026-11-05T20:00:00.000Z'); // story das 17h entra às 16h
  });

  it('texto com título, hora de SP e descrição; link não repete', () => {
    const t = textoLembreteAtividade({
      titulo: 'Postar story com link', data_prevista: new Date('2026-11-05T20:00:00Z'),
      descricao: 'Link: https://exemplo.com/a', link_externo: 'https://exemplo.com/a',
    });
    expect(t).toContain('*Lembrete: Postar story com link* às 17:00');
    expect(t).toContain('Link: https://exemplo.com/a');
    expect(t.match(/exemplo\.com/g)!.length).toBe(1);
  });
});
