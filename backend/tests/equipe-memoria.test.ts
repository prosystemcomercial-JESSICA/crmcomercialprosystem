import { describe, it, expect } from 'vitest';
import { registrarConversaAgentes, ligarPersistencia, recarregar, memoriaDoAgente, conversasRecentes } from '../src/lib/assistente/conversas-agentes';

describe('mural da equipe: memória que não se perde (06/10/2026)', () => {
  it('cada conversa entre agentes vai para o banco pelo gancho', () => {
    const gravadas: any[] = [];
    ligarPersistencia(c => gravadas.push(c));
    registrarConversaAgentes('julio', 'caroline', 'Lead Farmácia X', [{ quem: 'julio', texto: 'Carol, é contigo' }, { quem: 'caroline', texto: 'Deixa comigo' }]);
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({ de: 'julio', para: 'caroline', tema: 'Lead Farmácia X' });
    expect(memoriaDoAgente('caroline')[0].texto).toContain('Lead Farmácia X');
  });

  it('ao subir, recarrega conversas e memória do banco (mais recente primeiro)', () => {
    recarregar(
      [{ id: 'c1', de: 'rafael', para: 'equipe', tema: 'Reunião', falas: [{ quem: 'rafael', texto: 'Bom dia, time' }], em: new Date().toISOString() }],
      [
        { agente: 'julio', texto: 'antiga', em: '2026-10-01T10:00:00Z' },
        { agente: 'julio', texto: 'nova', em: '2026-10-05T10:00:00Z' },
      ],
    );
    expect(conversasRecentes(6).map(c => c.id)).toEqual(['c1']);
    expect(memoriaDoAgente('julio').map(m => m.texto)).toEqual(['nova', 'antiga']);
    expect(memoriaDoAgente('caroline')).toEqual([]);
  });

  it('falha ao gravar não derruba a operação', () => {
    ligarPersistencia(() => { throw new Error('banco fora'); });
    expect(() => registrarConversaAgentes('mila', 'helena', 'Retenção', [{ quem: 'mila', texto: 'oi' }])).not.toThrow();
  });
});
