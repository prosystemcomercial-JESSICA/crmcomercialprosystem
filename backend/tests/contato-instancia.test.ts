import { describe, it, expect } from 'vitest';
import { chaveContato, decidirInstanciaEnvio } from '../src/lib/contato-instancia';
import { opcaoEscolhida, menuEmTexto } from '../src/services/whatsapp-gratis.service';

const inst = (id: string, status = 'CONECTADO', token: string | null = `tk-${id}`) => ({ id, instancia_nome: id, apelido: null, instance_token: token, status });

describe('contato preso ao número', () => {
  it('mesma chave com ou sem o 9 extra; DDD diferente é outro contato', () => {
    expect(chaveContato('5527999990000')).toBe(chaveContato('552799990000'));
    expect(chaveContato('5527999990000')).not.toBe(chaveContato('5531999990000'));
  });

  it('contato novo: sai pelo número pedido', () => {
    expect(decidirInstanciaEnvio('tk-empresa', inst('empresa'), null)).toEqual({ token: 'tk-empresa', desviou: false });
  });

  it('contato já é do número pedido: sai por ele', () => {
    expect(decidirInstanciaEnvio('tk-gratis-1', inst('gratis-1'), inst('gratis-1'))).toEqual({ token: 'tk-gratis-1', desviou: false });
  });

  it('contato de outro número: sempre sai pelo dono, nunca pelo pedido', () => {
    expect(decidirInstanciaEnvio('tk-empresa', inst('empresa'), inst('gratis-2'))).toEqual({ token: 'tk-gratis-2', desviou: true });
    expect(decidirInstanciaEnvio('token-desconhecido', null, inst('gratis-2'))).toEqual({ token: 'tk-gratis-2', desviou: true });
  });

  it('número dono desconectado: bloqueia em vez de usar outro', () => {
    expect(decidirInstanciaEnvio('tk-empresa', inst('empresa'), inst('gratis-1', 'DESCONECTADO'))).toEqual({ bloquear: 'gratis-1' });
    expect(decidirInstanciaEnvio('tk-empresa', inst('empresa'), inst('gratis-1', 'CONECTADO', null))).toEqual({ bloquear: 'gratis-1' });
  });
});

describe('menu em texto (API gratuita)', () => {
  const opcoes = [{ id: 'demo_sim', texto: '📅 Agendar demonstração' }, { id: 'demo_nao', texto: 'Agora não' }];
  it('monta as opções numeradas', () => {
    expect(menuEmTexto('Quer ver o sistema?', opcoes)).toBe('Quer ver o sistema?\n\n*1* - 📅 Agendar demonstração\n*2* - Agora não\n\n_Responda com o número da opção._');
  });
  it('entende "2", "2️⃣", "opção 1" e o texto da opção', () => {
    expect(opcaoEscolhida('2', opcoes)?.id).toBe('demo_nao');
    expect(opcaoEscolhida('2️⃣', opcoes)?.id).toBe('demo_nao');
    expect(opcaoEscolhida('Opção 1', opcoes)?.id).toBe('demo_sim');
    expect(opcaoEscolhida('agora nao', opcoes)?.id).toBe('demo_nao');
    expect(opcaoEscolhida('3', opcoes)).toBeNull();
    expect(opcaoEscolhida('tenho 2 lojas', opcoes)).toBeNull();
  });
});

import { escolherNumero } from '../src/services/prospeccao-rodizio.service';
import { limiteDoDia } from '../src/lib/whatsapp-vagas';

describe('rodízio da prospecção', () => {
  const n = (id: string, usados: number, limite: number) => ({ id, instancia_nome: id, instance_token: `evo:${id}`, usados, limite });
  it('escolhe o número com mais folga e ignora quem bateu o limite', () => {
    expect(escolherNumero([n('a', 5, 10), n('b', 2, 10), n('c', 10, 10)])?.id).toBe('b');
    expect(escolherNumero([n('a', 10, 20), n('b', 6, 10)])?.id).toBe('a');
    expect(escolherNumero([n('a', 10, 10)])).toBeNull();
    expect(escolherNumero([])).toBeNull();
  });
  it('aquecimento: 10 → 20 → 30 → 40 por semana; limite manual menor prevalece', () => {
    const d0 = new Date('2026-10-01T12:00:00Z');
    expect(limiteDoDia(d0, null, new Date('2026-10-03T12:00:00Z'))).toBe(10);
    expect(limiteDoDia(d0, null, new Date('2026-10-09T12:00:00Z'))).toBe(20);
    expect(limiteDoDia(d0, null, new Date('2026-10-16T12:00:00Z'))).toBe(30);
    expect(limiteDoDia(d0, null, new Date('2026-11-01T12:00:00Z'))).toBe(40);
    expect(limiteDoDia(d0, 15, new Date('2026-11-01T12:00:00Z'))).toBe(15);
    expect(limiteDoDia(null, null)).toBe(10);
  });
});
