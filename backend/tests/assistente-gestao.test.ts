import { describe, it, expect } from 'vitest';
import { acharGestor, interpretarComando, lerPreferenciasAvisos, textoPropostasParadas, textoClientes, TIPOS_AVISO } from '../src/lib/assistente/gestao';

describe('acharGestor', () => {
  const g = [{ id: 'j', telefone: '(27) 99752-1370' }, { id: 't', telefone: null }];
  it('casa pelos últimos 8 dígitos', () => {
    expect(acharGestor('5527997521370', g)?.id).toBe('j');
    expect(acharGestor('552797521370', g)?.id).toBe('j'); // sem o 9
  });
  it('não casa número diferente ou curto', () => {
    expect(acharGestor('5527988798093', g)).toBeNull();
    expect(acharGestor('123', g)).toBeNull();
  });
});

describe('interpretarComando', () => {
  it('entende os comandos', () => {
    expect(interpretarComando('Como está hoje?')).toEqual({ tipo: 'hoje' });
    expect(interpretarComando('semana')).toEqual({ tipo: 'semana' });
    expect(interpretarComando('propostas paradas')).toEqual({ tipo: 'propostas_paradas' });
    expect(interpretarComando('cliente 381')).toEqual({ tipo: 'cliente', termo: '381' });
    expect(interpretarComando('Cliente Padaria Pão')).toEqual({ tipo: 'cliente', termo: 'Padaria Pão' });
    expect(interpretarComando('oi')).toEqual({ tipo: 'ajuda' });
  });
});

describe('preferências de avisos', () => {
  it('ausente ou inválido = todos; filtra tipos desconhecidos', () => {
    expect(lerPreferenciasAvisos(null)).toEqual([...TIPOS_AVISO]);
    expect(lerPreferenciasAvisos('xx')).toEqual([...TIPOS_AVISO]);
    expect(lerPreferenciasAvisos('["proposta_aceita","nada"]')).toEqual(['proposta_aceita']);
    expect(lerPreferenciasAvisos('[]')).toEqual([]);
  });
});

describe('textos', () => {
  it('propostas paradas', () => {
    expect(textoPropostasParadas([])).toContain('Nenhuma');
    expect(textoPropostasParadas([{ nome: 'Farmácia Vida', valor: 1500, dias: 9, status: 'ENVIADA' }])).toContain('• Farmácia Vida: R$');
  });
  it('clientes', () => {
    const t = textoClientes([{ codigo: '381', nome: 'Padaria Pão Quente', plano: 'PRO', mensalidade: 330, situacao: 'ATIVA', segmento: 'Padaria' }], '381');
    expect(t).toContain('#381 Padaria Pão Quente · Padaria · PRO');
    expect(textoClientes([], 'xyz')).toBe('Não achei cliente para "xyz".');
  });
});
