import { describe, it, expect } from 'vitest';
import { motivoParaNaoChamar } from '../src/lib/assistente/sdr';

const AGENTES = new Set(['julio', 'caroline', 'luiz_felipe', 'bot']);
const ehAgente = (p: string | null) => !!p && AGENTES.has(p);
const msg = (direcao: 'ENTRADA' | 'SAIDA', texto: string, enviada_por: string | null = null) => ({ direcao, texto, enviada_por });

describe('Contexto antes de qualquer agente escrever', () => {
  it('caso real (14/10): Jessica pelo celular pediu para os consultores não chamarem mais', () => {
    const r = motivoParaNaoChamar([
      msg('SAIDA', 'Conseguiu ajuda ontem?'),
      msg('SAIDA', 'Bom dia! Vou confirmar para os consultores não te chamarem mais! Obrigada.'),
      msg('SAIDA', 'Entendi, o banco de dados já foi feito...', 'julio'),
    ], ehAgente);
    expect(r?.motivo).toBe('equipe_pediu');
  });

  it('caso real: cliente da casa falando de banco de dados e cupom (áudio transcrito)', () => {
    const r = motivoParaNaoChamar([
      msg('ENTRADA', 'Não, eles já fizeram a questão do banco de dados, a troca do Farmácia Popular... já tá emitindo cupom fiscal já com a nova'),
    ], ehAgente);
    expect(r?.motivo).toBe('ja_cliente');
  });

  it('cliente pediu para parar', () => {
    expect(motivoParaNaoChamar([msg('ENTRADA', 'por favor não me chame mais')], ehAgente)?.motivo).toBe('cliente_pediu');
    expect(motivoParaNaoChamar([msg('ENTRADA', 'Sair')], ehAgente)?.motivo).toBe('cliente_pediu');
  });

  it('frase do agente não conta como pedido da equipe', () => {
    expect(motivoParaNaoChamar([msg('SAIDA', 'Combinado, não vou te chamar mais hoje, consultores não trabalham domingo', 'julio')], ehAgente)).toBeNull();
  });

  it('lead normal segue: pergunta de preço, Farmácia Popular como recurso, conversa da equipe', () => {
    expect(motivoParaNaoChamar([
      msg('ENTRADA', 'Quanto custa? O sistema tem integração com a Farmácia Popular?'),
      msg('SAIDA', 'Bom dia, sou a Jessica da Prosystem! Te chamo amanhã com a proposta.'),
      msg('ENTRADA', 'Pode me chamar à tarde'),
    ], ehAgente)).toBeNull();
  });
});
