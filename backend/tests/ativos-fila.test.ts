import { describe, it, expect } from 'vitest';
import { prioridadeAtivo, filaDoDia } from '../src/lib/ativos-fila';
import { promptCaroline } from '../src/lib/assistente/sdr';

// Programa de Ativos (parte 3 do plano, 14/10/2026).
const agora = new Date('2026-10-15T10:00:00-03:00');
const diasAtras = (n: number) => new Date(agora.getTime() - n * 864e5);

describe('fila do dia de ativos', () => {
  it('prioriza risco, depois nunca contatado, depois parado há 14 dias', () => {
    expect(prioridadeAtivo({ etapa: 'EM_CONTATO', saude: 'RISCO', contatado_em: diasAtras(1) }, agora)).toBe(0);
    expect(prioridadeAtivo({ etapa: 'A_CONTATAR' }, agora)).toBe(1);
    expect(prioridadeAtivo({ etapa: 'EM_CONTATO', contatado_em: diasAtras(20) }, agora)).toBe(2);
    expect(prioridadeAtivo({ etapa: 'EM_CONTATO', contatado_em: diasAtras(3) }, agora)).toBeNull();
    expect(prioridadeAtivo({ etapa: 'CONCLUIDO', tem_problema: true }, agora)).toBeNull();
    expect(prioridadeAtivo({ etapa: 'A_CONTATAR', oculto: true }, agora)).toBeNull();
  });

  it('pega só os 8 da vez, quem está há mais tempo sem contato primeiro', () => {
    const contatos = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, etapa: 'A_CONTATAR' })),
      { id: 'parado', etapa: 'EM_CONTATO', contatado_em: diasAtras(60) },
      { id: 'risco', etapa: 'EM_CONTATO', tem_problema: true, contatado_em: diasAtras(2) },
    ];
    const f = filaDoDia(contatos, agora);
    expect(f).toHaveLength(8);
    expect(f[0].id).toBe('risco');
    expect(f.some(c => c.id === 'parado')).toBe(false); // os nunca contatados vêm antes
  });
});

describe('indicação de cliente no primeiro contato', () => {
  it('a Caroline cita o cliente que indicou', () => {
    const p = promptCaroline({ guia: 'g', instrucoes: '', exemplos: [], historico: '', fase: 'abertura', saudacao: 'Bom dia', perfil: 'caroline',
      lead: { nome: 'Ana Souza', empresa: 'Drogaria Bem Viver', segmento: 'Farmácia', campanha: 'Indicação de cliente', abertura_jessica: false, tentativa: 0, indicacao: { por: 'Farmácia Central', cargo: null, cliente: true } } } as any);
    const tudo = p.sistema + p.usuario;
    expect(tudo).toContain('INDICAÇÃO DE CLIENTE');
    expect(tudo).toContain('Farmácia Central');
  });
});
