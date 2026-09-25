import { describe, it, expect } from 'vitest';
import { interpretarTarefa, ehComandoTarefa, lerBotaoTarefa, menuConfirmarTarefa, rotuloPrazo } from '../src/lib/assistente/tarefa-mensagem';

// Quinta 24/09/2026 15:00 em São Paulo = 18:00 UTC.
const agora = new Date('2026-09-24T18:00:00Z');
const pessoas = [{ id: 'ana', nome: 'Ana Clara' }, { id: 'jess', nome: 'Jessica Cardoso' }];
const autor = { id: 'jess', nome: 'Jessica Cardoso' };
const sp = (d: Date) => rotuloPrazo(d);

describe('interpretarTarefa', () => {
  it('responsável, tipo, título e amanhã 10h', () => {
    const r = interpretarTarefa('tarefa Ana, ligar para Farmácia Rangel amanhã 10h', agora, pessoas, autor)!;
    expect(r.responsavel_id).toBe('ana');
    expect(r.tipo).toBe('LIGACAO');
    expect(r.titulo).toBe('Ligar para Farmácia Rangel');
    expect(sp(r.prazo)).toMatch(/sex · 25\/09 · 10:00/);
  });
  it('sem nome conhecido: fica com quem mandou; dia da semana e 14h30', () => {
    const r = interpretarTarefa('atividade mandar mensagem para padaria Pão Quente segunda 14h30', agora, pessoas, autor)!;
    expect(r.responsavel_id).toBe('jess');
    expect(r.tipo).toBe('WHATSAPP');
    expect(r.titulo).toBe('Mandar mensagem para padaria Pão Quente');
    expect(sp(r.prazo)).toMatch(/seg · 28\/09 · 14:30/);
  });
  it('só hora já passada vai para amanhã; só data vence às 18h; nada = 24h', () => {
    expect(sp(interpretarTarefa('tarefa Ana revisar proposta 9h', agora, pessoas, autor)!.prazo)).toMatch(/sex · 25\/09 · 09:00/);
    expect(sp(interpretarTarefa('tarefa Ana revisar proposta 30/09', agora, pessoas, autor)!.prazo)).toMatch(/qua · 30\/09 · 18:00/);
    expect(interpretarTarefa('tarefa Ana revisar proposta', agora, pessoas, autor)!.prazo.getTime()).toBe(agora.getTime() + 86400000);
  });
  it('não é comando ou título vazio', () => {
    expect(ehComandoTarefa('a tarefa de hoje foi boa')).toBe(false);
    expect(interpretarTarefa('tarefa Ana amanhã', agora, pessoas, autor)).toBeNull();
  });
});

describe('confirmação', () => {
  it('botões e leitura', () => {
    const r = interpretarTarefa('tarefa Ana ligar para X amanhã 10h', agora, pessoas, autor)!;
    const m = menuConfirmarTarefa('abc123', r);
    expect(m.texto).toContain('Para: *Ana*');
    expect(m.opcoes.map(o => o.id)).toEqual(['ativ_ok_abc123', 'ativ_no_abc123']);
    expect(lerBotaoTarefa('ativ_ok_abc123')).toEqual({ ok: true, chave: 'abc123' });
    expect(lerBotaoTarefa('prop_ok_x')).toBeNull();
  });
});
