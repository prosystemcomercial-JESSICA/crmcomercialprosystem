import { describe, it, expect } from 'vitest';
import { emHorarioComercial, podeAutoResponder, lerJsonIa, respostaSegura, promptTiraDuvidas } from '../src/lib/assistente/ia-texto';

const quinta10h = new Date('2026-09-24T13:00:00Z'); // qui 10h SP
const quinta22h = new Date('2026-09-25T01:00:00Z'); // qui 22h SP
const sabado10h = new Date('2026-09-26T13:00:00Z');

describe('horário comercial', () => {
  it('seg–sex 8h–18h', () => {
    expect(emHorarioComercial(quinta10h)).toBe(true);
    expect(emHorarioComercial(quinta22h)).toBe(false);
    expect(emHorarioComercial(sabado10h)).toBe(false);
  });
});

describe('podeAutoResponder', () => {
  const base = { modo: 'fora_do_horario' as const, agora: quinta22h, tipo_contato: null, em_triagem: false, ultima_saida_humana_em: null, auto_hoje: 0, texto: 'vocês têm controle de validade?' };
  it('fora do horário, lead, sem humano recente: sim', () => expect(podeAutoResponder(base)).toBe(true));
  it('bloqueios', () => {
    expect(podeAutoResponder({ ...base, agora: quinta10h })).toBe(false);
    expect(podeAutoResponder({ ...base, modo: 'sempre', agora: quinta10h })).toBe(true);
    expect(podeAutoResponder({ ...base, modo: 'desligado' })).toBe(false);
    expect(podeAutoResponder({ ...base, tipo_contato: 'CLIENTE' })).toBe(false);
    expect(podeAutoResponder({ ...base, em_triagem: true })).toBe(false);
    expect(podeAutoResponder({ ...base, ultima_saida_humana_em: new Date(quinta22h.getTime() - 3600000) })).toBe(false);
    expect(podeAutoResponder({ ...base, auto_hoje: 3 })).toBe(false);
    expect(podeAutoResponder({ ...base, texto: 'ok' })).toBe(false);
  });
});

describe('respostas da IA', () => {
  it('lê JSON com ou sem cerca', () => {
    expect(lerJsonIa('```json\n{"responder": true}\n```')).toEqual({ responder: true });
    expect(lerJsonIa('Claro! {"a":1} fim')).toEqual({ a: 1 });
    expect(lerJsonIa('nada')).toBeNull();
  });
  it('resposta segura bloqueia preço e desconto', () => {
    expect(respostaSegura({ responder: true, resposta: 'Temos sim! O sistema avisa o lote perto de vencer.' })).toContain('Temos sim');
    expect(respostaSegura({ responder: true, resposta: 'Custa R$ 330 por mês, uma ótima escolha.' })).toBeNull();
    expect(respostaSegura({ responder: true, resposta: 'Conseguimos um desconto especial para você hoje.' })).toBeNull();
    expect(respostaSegura({ responder: false, resposta: 'x'.repeat(20) })).toBeNull();
  });
  it('prompt leva o guia e a conversa', () => {
    const p = promptTiraDuvidas('GUIA', 'Cliente: oi');
    expect(p.sistema).toContain('GUIA');
    expect(p.sistema).toContain('NUNCA informe preço');
    expect(p.usuario).toContain('Cliente: oi');
  });
});
