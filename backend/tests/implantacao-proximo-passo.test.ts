import { describe, it, expect } from 'vitest';
import { proximoPasso, pendenciasIniciarVirada, pendenciasConcluirVirada, pendenciasValidacao } from '../src/lib/implantacao/portal';

// Demanda nova (depois do recomeço do portal), já designada.
const hoje = new Date('2026-10-05T15:00:00Z');
const base = { modulo: 'IMPLANTACAO', tipo_base: 'CONVERSAO', tecnico_id: 't1', data_assinatura: hoje, coluna: 'A_FAZER' as string | null };
const ob = (feito: boolean) => [{ grupo: 'ONBOARDING', titulo: 'Apresentar-se', feito }, { grupo: 'ONBOARDING', titulo: 'Aprovação do cliente', feito }];
const prep = (feito: boolean) => [
  { grupo: 'INSTALACAO', titulo: 'Configurar Uninfe e Certificado', feito },
  { grupo: 'INSTALACAO', titulo: 'Configurar o Copy (backup) Interno e Externo (Nuvem)', feito },
  { grupo: 'INSTALACAO', titulo: 'Emitir uma nota de saída NFCE em Operação', feito },
  { grupo: 'CONVERSAO', titulo: 'Conversão dos dados do sistema X para Prosystem', feito },
  { grupo: 'CONVERSAO', titulo: 'Validar Produtos (cód. barras, estoque...)', feito },
];
const coleta = { regime_tributario: 'Simples', contato_nome: 'Ana' };

describe('próximo passo da demanda', () => {
  it('sem técnico: a supervisão designa', () => {
    expect(proximoPasso({ ...base, tecnico_id: null }, [], [], 0)).toMatchObject({ chave: 'DESIGNAR', quem: 'GESTAO' });
  });

  it('segue a ordem: onboarding → coleta → preparar → iniciar virada → concluir → treinamento → validação', () => {
    expect(proximoPasso(base, [...ob(false), ...prep(false)], [], 0)).toMatchObject({ chave: 'ONBOARDING', aba: 'onboarding', etapa: 'ONBOARDING', detalhe: '0 de 2 itens do roteiro' });
    expect(proximoPasso(base, [...ob(true), ...prep(false)], [], 0).chave).toBe('COLETA');
    const preparar = proximoPasso({ ...base, coleta }, [...ob(true), ...prep(false)], [], 0);
    expect(preparar.chave).toBe('PREPARAR');
    expect(preparar.pendencias).toContain('Conversão dos dados');
    expect(preparar.pendencias).toContain('Anexar a tela de liberação do Suporte');
    expect(proximoPasso({ ...base, coleta, tela_suporte_arquivo_id: 'a1' }, [...ob(true), ...prep(true)], [], 0).chave).toBe('INICIAR_VIRADA');
    const virando = { ...base, coleta, tela_suporte_arquivo_id: 'a1', virada_inicio_em: hoje };
    expect(proximoPasso(virando, [...ob(true), ...prep(true)], [], 0)).toMatchObject({ chave: 'CONCLUIR_VIRADA', aba: 'virada' });
    const virada = { ...virando, virada_fim_em: hoje, coluna: 'ACOMPANHAMENTO' };
    expect(proximoPasso(virada, [...ob(true), ...prep(true)], [{ realizada_em: hoje }, { realizada_em: null }], 0)).toMatchObject({ chave: 'TREINAMENTO', titulo: 'Treinamento: fase 2 de 2' });
    expect(proximoPasso(virada, [...ob(true), ...prep(true)], [{ realizada_em: hoje }], 1).chave).toBe('CORRECOES');
    expect(proximoPasso(virada, [...ob(true), ...prep(true)], [{ realizada_em: hoje }], 0)).toMatchObject({ chave: 'PEDIR_VALIDACAO', quem: 'TECNICO' });
  });

  it('colunas finais mandam: concluído espera a supervisão, validado espera finalizar', () => {
    expect(proximoPasso({ ...base, coluna: 'CONCLUIDO' }, [], [], 0)).toMatchObject({ chave: 'VALIDAR', quem: 'GESTAO' });
    expect(proximoPasso({ ...base, coluna: 'VALIDADO' }, [], [], 0)).toMatchObject({ chave: 'FINALIZAR', quem: 'GESTAO' });
    expect(proximoPasso({ ...base, coluna: 'FINALIZADO' }, [], [], 0).quem).toBe('NINGUEM');
    expect(proximoPasso({ ...base, status: 'CANCELADA' }, [], [], 0).chave).toBe('CANCELADA');
  });

  it('serviço: executa o checklist e pede validação', () => {
    const s = { ...base, modulo: 'SERVICO', tipo_base: null };
    const itens = [{ grupo: 'SERVICO', titulo: 'Backup do banco', feito: true }, { grupo: 'SERVICO', titulo: 'Validar com o cliente', feito: false }];
    expect(proximoPasso(s, itens, [], 0)).toMatchObject({ chave: 'EXECUTAR', detalhe: '1 de 2 itens do checklist' });
    expect(proximoPasso(s, itens.map(i => ({ ...i, feito: true })), [], 0).chave).toBe('PEDIR_VALIDACAO');
  });
});

describe('etapas que travam', () => {
  it('banco zerado não exige itens de conversão', () => {
    const z = { ...base, tipo_base: 'BANCO_ZERADO', coleta, tela_suporte_arquivo_id: 'a1' };
    const itens = [...ob(true), ...prep(true).filter(i => i.grupo === 'INSTALACAO'), { grupo: 'CONVERSAO', titulo: 'Conversão dos dados', feito: false }];
    expect(pendenciasIniciarVirada(z, itens)).toEqual([]);
  });

  it('item crítico que não existe no card não trava', () => {
    expect(pendenciasIniciarVirada({ ...base, coleta, tela_suporte_arquivo_id: 'a1' }, ob(true))).toEqual([]);
  });

  it('loja virada exige a NFC-e emitida', () => {
    const v = { ...base, virada_inicio_em: hoje };
    expect(pendenciasConcluirVirada(v, prep(false))).toEqual(['Emitir uma NFC-e de saída em operação']);
    expect(pendenciasConcluirVirada(v, prep(true))).toEqual([]);
  });

  it('demanda antiga (antes do portal) não trava a virada', () => {
    const antiga = { ...base, data_assinatura: new Date('2026-09-01T12:00:00Z') };
    expect(pendenciasIniciarVirada(antiga, prep(false))).toEqual([]);
    expect(pendenciasConcluirVirada(antiga, [])).toEqual([]);
  });

  it('validação: implantação precisa de virada, treinamento e correções resolvidas', () => {
    expect(pendenciasValidacao(base, [], [], 0)).toEqual(['Concluir a virada (Loja virada)']);
    const p = pendenciasValidacao({ ...base, virada_fim_em: hoje }, [], [{ realizada_em: null }], 2);
    expect(p).toEqual(['Treinamento: 0 de 1 fases realizadas', 'Resolver 2 correção(ões) aberta(s)']);
    expect(pendenciasValidacao({ ...base, virada_fim_em: hoje }, [], [{ realizada_em: hoje }], 0)).toEqual([]);
  });
});
