import { describe, it, expect } from 'vitest';
import { montarProximasAcoes } from '../src/lib/assistente/proxima-acao';

const agora = new Date('2026-09-25T15:00:00Z');
const conv = (id: string, o: any = {}) => ({ id, nome: id, ultima: 'oi', ultima_em: new Date('2026-09-25T13:00:00Z'), prioridade: 'NORMAL', sla_prazo_em: null, dono_id: 'u', ultima_direcao: 'ENTRADA', ...o });

describe('montarProximasAcoes', () => {
  it('ordena crítica > prazo estourado/demo/proposta aberta > fila sem dono, sem repetir conversa', () => {
    const r = montarProximasAcoes({
      agora,
      conversas: [
        conv('fila', { dono_id: null }),
        conv('atrasada', { sla_prazo_em: new Date('2026-09-25T14:00:00Z') }),
        conv('critica', { prioridade: 'CRITICA', sla_prazo_em: new Date('2026-09-25T14:30:00Z') }),
        conv('respondida', { ultima_direcao: 'SAIDA', prioridade: 'CRITICA' }),
      ],
      propostasVistas: [{ conversaId: 'p1', nome: 'Farmácia Vida', vista_em: new Date('2026-09-25T12:00:00Z'), valor: 1500 }],
      demosHoje: [{ conversaId: 'd1', nome: 'Padaria X', quando: new Date('2026-09-25T17:00:00Z') }, { conversaId: 'd2', nome: 'Passou', quando: new Date('2026-09-25T12:00:00Z') }],
    });
    expect(r.map(a => a.chave)).toEqual(['conv:critica', 'conv:p1', 'conv:atrasada', 'demo:d1:1790355600000', 'conv:fila']);
    expect(r[0].urgencia).toBe('urgente');
    expect(r.find(a => a.chave === 'conv:p1')!.titulo).toMatch(/Farmácia Vida abriu a proposta \(R\$\s?1\.500\)/);
    expect(r.some(a => a.chave === 'conv:respondida')).toBe(false);
  });
  it('respeita o limite', () => {
    const cs = Array.from({ length: 20 }, (_, i) => conv(`c${i}`, { dono_id: null }));
    expect(montarProximasAcoes({ agora, conversas: cs, propostasVistas: [], demosHoje: [] }, 5)).toHaveLength(5);
  });
});
