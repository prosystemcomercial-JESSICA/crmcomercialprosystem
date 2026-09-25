import { describe, it, expect } from 'vitest';
import { gerarHorarios, menuHorarios, lerBotaoDemo, querRemarcar, rotuloHorario } from '../src/lib/assistente/demo';

// Quinta 24/09/2026 08:00 em São Paulo = 11:00 UTC.
const quinta8h = new Date('2026-09-24T11:00:00Z');
const hora = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit' });

describe('gerarHorarios', () => {
  it('respeita 2h de antecedência, janelas 9–12 e 14–17 e 30 min', () => {
    const s = gerarHorarios(quinta8h, []);
    expect(s).toHaveLength(10);
    expect(hora(s[0])).toMatch(/10:00/); // 8h + 2h
    expect(s.map(hora).some(h => /12:00|12:30|13:/.test(h))).toBe(false);
    expect(hora(s[4])).toMatch(/14:00/);
  });
  it('pula fim de semana e horários ocupados', () => {
    const sexta16h = new Date('2026-09-25T19:00:00Z'); // sex 16h SP → sobra só seg
    const s = gerarHorarios(sexta16h, [{ inicio: new Date('2026-09-28T12:00:00Z'), fim: new Date('2026-09-28T13:00:00Z') }]);
    expect(hora(s[0])).toMatch(/seg.*10:00/); // seg 9h e 9h30 ocupados
    expect(s.every(d => !/s[aá]b|dom/.test(hora(d)))).toBe(true);
  });
});

describe('menu e respostas', () => {
  it('ids voltam para a mesma data', () => {
    const s = gerarHorarios(quinta8h, [], 2);
    const m = menuHorarios(s);
    expect(m.opcoes).toHaveLength(2);
    expect(lerBotaoDemo(m.opcoes[0].id)?.getTime()).toBe(s[0].getTime());
    expect(lerBotaoDemo('prop_ok_x')).toBeNull();
    expect(rotuloHorario(s[0])).toMatch(/^Qui · 24\/09 · 10:00$/i);
  });
  it('remarcar', () => {
    expect(querRemarcar('Remarcar')).toBe(true);
    expect(querRemarcar('preciso mudar horário')).toBe(false);
    expect(querRemarcar('mudar o horário')).toBe(true);
  });
});
