import { describe, it, expect } from 'vitest';
import { mensagemEncerramentoProposta, complementoApresentacaoEncerramento, PROPOSTA_FECHADA, BLOG_PROSYSTEM, INSTAGRAM_PROSYSTEM } from '../src/lib/assistente/sdr';

describe('Luiz Felipe — encerramento da proposta sem resposta', () => {
  const manha = new Date('2026-10-14T12:30:00Z'); // 9h30 em Brasília

  it('avisa que a proposta expirou, agradece e manda blog e Instagram', () => {
    const m = mensagemEncerramentoProposta('OGNER HENRIQUE ALVES DIAS', manha);
    expect(m.startsWith('Bom dia, Ogner! Aqui é o Luiz Felipe, da Prosystem.')).toBe(true);
    expect(m).toContain('expirada');
    expect(m).toContain('obrigado');
    expect(m).toContain(BLOG_PROSYSTEM);
    expect(m).toContain(INSTAGRAM_PROSYSTEM);
    expect(m).not.toContain('inscri'); // proposta enviada, ninguém se inscreveu
    expect(m).not.toContain('—');
  });

  it('sem nome, cumprimenta sem nome', () => {
    expect(mensagemEncerramentoProposta(null, new Date('2026-10-14T18:00:00Z')).startsWith('Boa tarde! Aqui é o Luiz Felipe')).toBe(true);
  });

  it('proposta com contrato a caminho não é cobrada', () => {
    expect(PROPOSTA_FECHADA).toContain('CONTRATO_EM_GERACAO');
    expect(PROPOSTA_FECHADA).not.toContain('EXPIRADA');
  });
});

describe('Luiz Felipe — apresentação do segmento no encerramento', () => {
  const manha = new Date('2026-10-14T12:30:00Z');
  const farmacia = { tipo: 'farmacia' as const, url: 'https://comercial.prosystemnet.com/apresentacao/farmacia' };

  it('leva a apresentação quando a conversa ainda não teve', () => {
    const m = mensagemEncerramentoProposta('Darci', manha, { tipo: 'padaria', url: 'https://comercial.prosystemnet.com/apresentacao/padaria' });
    expect(m).toContain('rotina da sua padaria');
    expect(m).toContain('/apresentacao/padaria');
    expect(m.indexOf('/apresentacao/')).toBeLessThan(m.indexOf(BLOG_PROSYSTEM));
  });

  it('sem apresentação pendente, o texto fica igual', () => {
    expect(mensagemEncerramentoProposta('Darci', manha, null)).toBe(mensagemEncerramentoProposta('Darci', manha));
  });

  it('complemento para quem já foi encerrado', () => {
    const m = complementoApresentacaoEncerramento('OGNER', farmacia);
    expect(m.startsWith('Ogner, complementando:')).toBe(true);
    expect(m).toContain('farmácia');
    expect(m).toContain(farmacia.url);
    expect(complementoApresentacaoEncerramento(null, farmacia).startsWith('Complementando:')).toBe(true);
  });
});
