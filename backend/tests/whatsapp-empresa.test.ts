import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  tokenWebhookConfere, whereListaConversas, whereAcaoConversa, whereLeituraConversa,
} from '../src/lib/whatsapp-empresa';
import { registrarClienteSSE, emitirEventoConversa } from '../src/services/whatsapp-eventos.service';

const vendedor = { id: 'u-vend', role: 'VENDEDOR' };
const gestora = { id: 'u-gest', role: 'supervisao_comercial' };

describe('tokenWebhookConfere', () => {
  it('confere token idêntico', () => {
    expect(tokenWebhookConfere('tok-abc-123', 'tok-abc-123')).toBe(true);
  });
  it('recusa token diferente, de outro tamanho, ausente ou sem token salvo', () => {
    expect(tokenWebhookConfere('tok-abc-124', 'tok-abc-123')).toBe(false);
    expect(tokenWebhookConfere('tok', 'tok-abc-123')).toBe(false);
    expect(tokenWebhookConfere(undefined, 'tok-abc-123')).toBe(false);
    expect(tokenWebhookConfere('', '')).toBe(false);
    expect(tokenWebhookConfere('tok-abc-123', null)).toBe(false);
    expect(tokenWebhookConfere(123 as any, '123')).toBe(false);
  });
});

describe('escopo das conversas', () => {
  it('escopo=pool lista só conversas sem dono, para qualquer usuário', () => {
    expect(whereListaConversas('pool', vendedor)).toEqual({ dono_id: null });
  });
  it('escopo=todos só vale para gestão (case-insensitive no papel)', () => {
    expect(whereListaConversas('todos', gestora)).toEqual({});
    expect(whereListaConversas('todos', vendedor)).toEqual({ dono_id: 'u-vend' });
  });
  it('padrão = só as próprias; sem usuário não vaza nada', () => {
    expect(whereListaConversas(undefined, vendedor)).toEqual({ dono_id: 'u-vend' });
    expect(whereListaConversas(undefined, undefined)).toEqual({ dono_id: '__no_user__' });
  });
  it('ações: dono ou pool', () => {
    expect(whereAcaoConversa(vendedor)).toEqual({ OR: [{ dono_id: 'u-vend' }, { dono_id: null }] });
  });
  it('leitura: gestão vê tudo; demais dono ou pool', () => {
    expect(whereLeituraConversa(gestora)).toEqual({});
    expect(whereLeituraConversa(vendedor)).toEqual({ OR: [{ dono_id: 'u-vend' }, { dono_id: null }] });
  });
});

describe('SSE: eventos de conversa', () => {
  const removers: Array<() => void> = [];
  afterEach(() => { removers.splice(0).forEach(r => r()); });

  function cliente(userId: string, gestao: boolean) {
    const write = vi.fn();
    removers.push(registrarClienteSSE({ raw: { write } } as any, userId, gestao) as any);
    return write;
  }

  it('conversa do pool (dono null) chega a todos os conectados', () => {
    const a = cliente('u-a', false);
    const b = cliente('u-b', false);
    emitirEventoConversa(null, 'mensagem', { conversaId: 'c1' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a.mock.calls[0][0]).toContain('"conversaId":"c1"');
  });

  it('conversa com dono chega só ao dono e à gestão', () => {
    const dono = cliente('u-a', false);
    const outro = cliente('u-b', false);
    const gestao = cliente('u-g', true);
    emitirEventoConversa('u-a', 'conversa_atualizada', { conversaId: 'c2' });
    expect(dono).toHaveBeenCalledTimes(1);
    expect(outro).not.toHaveBeenCalled();
    expect(gestao).toHaveBeenCalledTimes(1);
  });
});
