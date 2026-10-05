import { describe, it, expect } from 'vitest';
import { apresentacaoDoSegmento, garantirLinkApresentacao, promptCaroline, URL_APRESENTACAO } from '../src/lib/assistente/sdr';

describe('apresentação do segmento (05/10/2026)', () => {
  it('padaria para padaria, farmácia para farmácia', () => {
    expect(apresentacaoDoSegmento('Padaria')?.url).toBe(URL_APRESENTACAO.padaria);
    expect(apresentacaoDoSegmento('Confeitaria Doce Mel')?.tipo).toBe('padaria');
    expect(apresentacaoDoSegmento('Farmácia')?.url).toBe(URL_APRESENTACAO.farmacia);
    expect(apresentacaoDoSegmento('DROGARIA SÃO JOSÉ')?.tipo).toBe('farmacia');
  });

  it('segmento decide antes do nome da empresa; sem pista, nada', () => {
    expect(apresentacaoDoSegmento('Padaria', 'Farmácia Central')?.tipo).toBe('padaria');
    expect(apresentacaoDoSegmento(null, 'Panificadora Bom Pão')?.tipo).toBe('padaria');
    expect(apresentacaoDoSegmento('Varejo', 'Loja do Zé')).toBeNull();
    expect(apresentacaoDoSegmento(null, undefined)).toBeNull();
  });

  it('acrescenta o link só quando a IA esqueceu', () => {
    const url = URL_APRESENTACAO.farmacia;
    expect(garantirLinkApresentacao(['Oi!', 'Tudo bem?'], url)).toEqual(['Oi!', `Tudo bem?\n\n${url}`]);
    expect(garantirLinkApresentacao([`Separei uma apresentação:\n${url}`], url)).toEqual([`Separei uma apresentação:\n${url}`]);
    expect(garantirLinkApresentacao([], url)).toEqual([]);
  });

  it('prompt pede a apresentação pendente e não reenvia a já enviada', () => {
    const base = { guia: 'G', instrucoes: '', exemplos: [], historico: '', fase: 'abertura' as const, saudacao: 'Bom dia',
      lead: { nome: 'Ana', empresa: null, segmento: 'Padaria', campanha: null, abertura_jessica: false, tentativa: 0 } };
    const pendente = promptCaroline({ ...base, apresentacao: { tipo: 'padaria', url: URL_APRESENTACAO.padaria, enviada: false } });
    expect(pendente.sistema).toContain('APRESENTAÇÃO (OBRIGATÓRIA NESTA RESPOSTA)');
    expect(pendente.sistema).toContain(URL_APRESENTACAO.padaria);
    expect(pendente.sistema).toContain('adiantar a sua vida na padaria');
    const enviada = promptCaroline({ ...base, apresentacao: { tipo: 'padaria', url: URL_APRESENTACAO.padaria, enviada: true } });
    expect(enviada.sistema).toContain('já foi enviado nesta conversa');
    expect(enviada.sistema).not.toContain(URL_APRESENTACAO.padaria);
    expect(promptCaroline(base).sistema).not.toContain('APRESENTAÇÃO');
  });
});
