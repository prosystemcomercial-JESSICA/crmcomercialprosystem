import { describe, it, expect } from 'vitest';
import { alertaDevido, momentoDoAlerta, textoAlertaCompromisso, validarCompromisso, ANTECEDENCIAS_MIN, JANELA_ATRASO_MIN } from '../src/lib/implantacao/agenda-tecnico';

const t = (s: string) => new Date(`${s}-03:00`);
const base = { status: 'AGENDADO', alerta_em: null, inicio: t('2026-11-13T10:00:00'), avisar_antes_min: 0 };

describe('agenda do técnico: quando o alerta sai', () => {
  it('sem antecedência, o alerta é na hora marcada', () => {
    expect(momentoDoAlerta(base).toISOString()).toBe(t('2026-11-13T10:00:00').toISOString());
    expect(alertaDevido(base, t('2026-11-13T09:59:00'))).toBe(false);
    expect(alertaDevido(base, t('2026-11-13T10:00:00'))).toBe(true);
  });

  it('com 15 min de antecedência, sai às 9h45', () => {
    const c = { ...base, avisar_antes_min: 15 };
    expect(alertaDevido(c, t('2026-11-13T09:44:00'))).toBe(false);
    expect(alertaDevido(c, t('2026-11-13T09:45:30'))).toBe(true);
  });

  it('um dia antes, sai no dia anterior na mesma hora', () => {
    const c = { ...base, avisar_antes_min: 1440 };
    expect(alertaDevido(c, t('2026-11-12T10:00:00'))).toBe(true);
    expect(alertaDevido(c, t('2026-11-12T09:59:00'))).toBe(false);
  });

  it('não repete: alerta já enviado não sai de novo', () => {
    expect(alertaDevido({ ...base, alerta_em: t('2026-11-13T10:00:00') }, t('2026-11-13T10:01:00'))).toBe(false);
  });

  it('compromisso cancelado ou realizado não avisa', () => {
    expect(alertaDevido({ ...base, status: 'CANCELADO' }, t('2026-11-13T10:00:00'))).toBe(false);
    expect(alertaDevido({ ...base, status: 'REALIZADO' }, t('2026-11-13T10:00:00'))).toBe(false);
  });

  it('servidor fora do ar: alerta atrasado ainda sai dentro da janela, mas não horas depois', () => {
    expect(alertaDevido(base, t('2026-11-13T10:20:00'))).toBe(true);
    const depois = new Date(base.inicio.getTime() + (JANELA_ATRASO_MIN + 1) * 60000);
    expect(alertaDevido(base, depois)).toBe(false);
  });
});

describe('agenda do técnico: validação', () => {
  const ok = { titulo: 'Reunião de alinhamento', inicio: t('2026-11-13T10:00:00'), tipo: 'REUNIAO', avisar_antes_min: 15, duracao_min: 60 };
  const agora = t('2026-11-12T15:00:00');

  it('aceita um compromisso normal', () => {
    expect(validarCompromisso(ok, agora)).toBeNull();
  });

  it('exige título e data', () => {
    expect(validarCompromisso({ ...ok, titulo: '  ' }, agora)).toMatch(/assunto/i);
    expect(validarCompromisso({ ...ok, inicio: new Date('x') }, agora)).toMatch(/data/i);
  });

  it('não deixa marcar no passado', () => {
    expect(validarCompromisso({ ...ok, inicio: t('2026-11-12T14:00:00') }, agora)).toMatch(/passou/i);
  });

  it('só aceita as antecedências da lista e tipos conhecidos', () => {
    expect(ANTECEDENCIAS_MIN).toContain(0);
    expect(validarCompromisso({ ...ok, avisar_antes_min: 7 }, agora)).toMatch(/aviso/i);
    expect(validarCompromisso({ ...ok, tipo: 'FESTA' }, agora)).toMatch(/tipo/i);
  });
});

describe('agenda do técnico: texto do alerta no WhatsApp', () => {
  it('traz cliente, hora, contato e link do card', () => {
    const txt = textoAlertaCompromisso({
      ...base, tipo: 'REUNIAO', titulo: 'Alinhar a virada', cliente_nome: 'Farmácia Exemplo', contato_nome: 'Ana', contato_fone: '27999990000',
      link: 'https://meet.google.com/abc', descricao: 'Levar a lista de pendências',
    }, 'https://crm/portal-tecnico?tab=agenda');
    expect(txt).toContain('Farmácia Exemplo');
    expect(txt).toContain('Alinhar a virada');
    expect(txt).toContain('10:00');
    expect(txt).toContain('Ana');
    expect(txt).toContain('https://meet.google.com/abc');
    expect(txt).toContain('https://crm/portal-tecnico?tab=agenda');
    expect(txt).toMatch(/agora/i);
  });

  it('com antecedência, diz quanto falta', () => {
    const txt = textoAlertaCompromisso({ ...base, avisar_antes_min: 30, tipo: 'LIGACAO', titulo: 'Retorno' }, 'x');
    expect(txt).toMatch(/daqui a 30 min/);
    expect(textoAlertaCompromisso({ ...base, avisar_antes_min: 120, titulo: 'R' }, 'x')).toContain('hoje às 10:00 (daqui a 2h)');
    expect(textoAlertaCompromisso({ ...base, avisar_antes_min: 1440, titulo: 'R' }, 'x')).toContain('sexta-feira, 13/11 às 10:00');
  });

  it('marcado em cima da hora com aviso de 1 dia antes: conta o tempo real', () => {
    const txt = textoAlertaCompromisso({ ...base, avisar_antes_min: 1440, titulo: 'R' }, 'x', t('2026-11-13T09:40:00'));
    expect(txt).toMatch(/daqui a 20 min/);
  });
});
