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

  it('segue a ordem: onboarding → coleta → agendar → preparar → iniciar virada → concluir → treinamento → validação', () => {
    expect(proximoPasso(base, [...ob(false), ...prep(false)], [], 0)).toMatchObject({ chave: 'ONBOARDING', aba: 'onboarding', etapa: 'ONBOARDING', detalhe: '0 de 2 itens do roteiro' });
    expect(proximoPasso(base, [...ob(true), ...prep(false)], [], 0).chave).toBe('COLETA');
    expect(proximoPasso({ ...base, coleta }, [...ob(true), ...prep(false)], [], 0).chave).toBe('AGENDAR_VIRADA');
    const agenda = { virada_agendada_para: hoje };
    const preparar = proximoPasso({ ...base, coleta, ...agenda }, [...ob(true), ...prep(false)], [], 0);
    expect(preparar.chave).toBe('PREPARAR');
    expect(preparar.pendencias).toContain('Conversão dos dados');
    expect(preparar.pendencias).toContain('Anexar a tela de liberação do Suporte');
    expect(proximoPasso({ ...base, coleta, ...agenda, tela_suporte_arquivo_id: 'a1' }, [...ob(true), ...prep(true)], [], 0).chave).toBe('INICIAR_VIRADA');
    const virando = { ...base, coleta, ...agenda, tela_suporte_arquivo_id: 'a1', virada_inicio_em: hoje };
    expect(proximoPasso(virando, [...ob(true), ...prep(true)], [], 0)).toMatchObject({ chave: 'CONCLUIR_VIRADA', aba: 'virada' });
    const virada = { ...virando, virada_fim_em: hoje, coluna: 'ACOMPANHAMENTO' };
    expect(proximoPasso(virada, [...ob(true), ...prep(true)], [{ realizada_em: hoje }, { realizada_em: null }], 0, { agora: hoje })).toMatchObject({ chave: 'TREINAMENTO', titulo: 'Treinamento: fase 2 de 2' });
    expect(proximoPasso(virada, [...ob(true), ...prep(true)], [{ realizada_em: hoje }], 1, { agora: hoje }).chave).toBe('CORRECOES');
    const assistidaFeita = { assistida: diasAssistida(hoje).map(dia => ({ dia })), agora: new Date('2026-10-13T20:00:00Z') };
    expect(proximoPasso(virada, [...ob(true), ...prep(true)], [{ realizada_em: hoje }], 0, assistidaFeita)).toMatchObject({ chave: 'PEDIR_VALIDACAO', quem: 'TECNICO' });
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

import { diasAssistida, statusAssistida, checklistDoModelo, extrasDoSistema, colunaIncoerente, etapaDaColuna, CHECKLIST_PADRAO } from '../src/lib/implantacao/portal';

describe('fase 2: operação assistida, agenda, modelos e coluna coerente', () => {
  // Virada numa sexta (09/10/2026 15h de Brasília): os 5 dias úteis vão de segunda 12/10 a sexta 16/10.
  const sexta = new Date('2026-10-09T18:00:00Z');
  const virada = { ...base, coleta, tela_suporte_arquivo_id: 'a1', virada_agendada_para: new Date('2026-10-09T13:00:00Z'), virada_inicio_em: sexta, virada_fim_em: sexta, coluna: 'ACOMPANHAMENTO' };

  it('assistida: 5 dias úteis depois da virada, pulando o fim de semana', () => {
    expect(diasAssistida(sexta)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
  });

  it('assistida: pendentes são os dias que já chegaram e não foram checados', () => {
    const st = statusAssistida(virada, [{ dia: '2026-10-12' }], new Date('2026-10-14T15:00:00Z'))!;
    expect(st.feitos).toBe(1);
    expect(st.pendentes).toEqual(['2026-10-13', '2026-10-14']);
    expect(st.proximo).toBe('2026-10-15');
    expect(st.concluida).toBe(false);
  });

  it('assistida não vale para viradas antes de 03/10/2026', () => {
    expect(statusAssistida({ ...virada, virada_fim_em: new Date('2026-10-02T15:00:00Z') }, [])).toBeNull();
  });

  it('próximo passo: checagem do dia vem antes do treinamento; validação espera os 5 dias', () => {
    const itens = [...ob(true), ...prep(true)];
    expect(proximoPasso(virada, itens, [{ realizada_em: null }], 0, { assistida: [], agora: new Date('2026-10-12T15:00:00Z') })).toMatchObject({ chave: 'ASSISTIDA', aba: 'assistida', etapa: 'ASSISTIDA' });
    expect(proximoPasso(virada, itens, [{ realizada_em: null }], 0, { assistida: [{ dia: '2026-10-12' }], agora: new Date('2026-10-12T15:00:00Z') }).chave).toBe('TREINAMENTO');
    expect(proximoPasso(virada, itens, [{ realizada_em: hoje }], 0, { assistida: [{ dia: '2026-10-12' }], agora: new Date('2026-10-12T15:00:00Z') })).toMatchObject({ chave: 'ASSISTIDA_ANDAMENTO', detalhe: '1 de 5 dias checados · próxima checagem 13/10' });
    const cinco = diasAssistida(sexta).map(dia => ({ dia }));
    expect(proximoPasso(virada, itens, [{ realizada_em: hoje }], 0, { assistida: cinco, agora: new Date('2026-10-16T20:00:00Z') }).chave).toBe('PEDIR_VALIDACAO');
    expect(pendenciasValidacao(virada, itens, [{ realizada_em: hoje }], 0, [{ dia: '2026-10-12' }])).toEqual(['Operação assistida: 1 de 5 dias checados']);
  });

  it('próximo passo: depois da coleta vem agendar a virada', () => {
    const semAgenda = { ...base, coleta };
    expect(proximoPasso(semAgenda, [...ob(true), ...prep(false)], [], 0)).toMatchObject({ chave: 'AGENDAR_VIRADA', aba: 'virada' });
    const agendada = { ...semAgenda, virada_agendada_para: new Date('2026-10-09T13:00:00Z') };
    const p = proximoPasso(agendada, [...ob(true), ...prep(false)], [], 0);
    expect(p.chave).toBe('PREPARAR');
    expect(p.detalhe).toContain('Virada agendada para 09/10');
  });

  it('modelos: segmento do cliente escolhe o checklist; extras do sistema entram na conversão', () => {
    const modelos = [{ segmento: 'Padaria', grupos: { INSTALACAO: ['Configurar balança'], CONVERSAO: [], TREINAMENTO: ['PDV padaria'] } }];
    const g = checklistDoModelo(modelos, [{ sistema: 'Trier', itens: ['Exportar do Trier'] }], 'PADARIA E CONFEITARIA', 'trier v5');
    expect(g.find(x => x.grupo === 'INSTALACAO')!.itens).toEqual(['Configurar balança']);
    expect(g.find(x => x.grupo === 'CONVERSAO')!.itens.at(-1)).toBe('Exportar do Trier');
    expect(g.find(x => x.grupo === 'CONVERSAO')!.itens.length).toBe(CHECKLIST_PADRAO.find(x => x.grupo === 'CONVERSAO')!.itens.length + 1);
    expect(checklistDoModelo(modelos, [], 'Farmácia', null).find(x => x.grupo === 'INSTALACAO')!.itens).toEqual(CHECKLIST_PADRAO.find(x => x.grupo === 'INSTALACAO')!.itens);
    expect(extrasDoSistema([{ sistema: 'Trier', itens: ['x'] }], null)).toEqual([]);
  });

  it('coluna coerente com os marcos e etapa acompanhando a coluna', () => {
    expect(colunaIncoerente({ modulo: 'IMPLANTACAO', virada_fim_em: sexta }, 'EM_ANDAMENTO')).toMatch(/já virou/);
    expect(colunaIncoerente({ modulo: 'IMPLANTACAO' }, 'ACOMPANHAMENTO')).toMatch(/ainda não virou/);
    expect(colunaIncoerente({ modulo: 'IMPLANTACAO', virada_inicio_em: sexta }, 'A_FAZER')).toMatch(/já começou/);
    expect(colunaIncoerente({ modulo: 'SERVICO' }, 'ACOMPANHAMENTO')).toBeNull();
    expect(etapaDaColuna('EM_ANDAMENTO', { tipo_base: 'CONVERSAO' })).toBe('EM_CONVERSAO');
    expect(etapaDaColuna('A_FAZER', { tecnico_id: null })).toBe('AGUARDANDO_DESIGNACAO');
    expect(etapaDaColuna('FINALIZADO', {})).toBe('FINALIZADO');
  });
});

import { saudeDoCard, montarResumoSuporte } from '../src/lib/implantacao/portal';

describe('fase 3: saúde do card e resumo para o suporte', () => {
  const agora = new Date('2026-10-20T15:00:00Z');
  const dia = (n: number) => new Date(agora.getTime() - n * 864e5);
  const ok = { coluna: 'EM_ANDAMENTO', tecnico_id: 't1', designado_em: dia(1), data_assinatura: dia(2), ultima_sessao: dia(0), esperas_abertas: [], correcoes_altas: 0, tarefas_vencidas: 0 };

  it('em dia fica verde', () => { expect(saudeDoCard(ok, agora)).toEqual({ nivel: 'VERDE', motivos: [] }); });
  it('prazo estourado ou correção grave fica vermelho', () => {
    expect(saudeDoCard({ ...ok, sla: { situacao: 'ESTOURADO' } }, agora).nivel).toBe('VERMELHO');
    expect(saudeDoCard({ ...ok, correcoes_altas: 1 }, agora).motivos).toEqual(['1 correção(ões) grave(s) aberta(s)']);
  });
  it('parado sem espera: 3 dias amarelo, 5 dias vermelho; com espera aberta não conta como parado', () => {
    expect(saudeDoCard({ ...ok, ultima_sessao: dia(3), designado_em: dia(4) }, agora)).toEqual({ nivel: 'AMARELO', motivos: ['Ninguém trabalhou há 3 dias'] });
    expect(saudeDoCard({ ...ok, ultima_sessao: dia(6), designado_em: dia(8) }, agora).nivel).toBe('VERMELHO');
    expect(saudeDoCard({ ...ok, ultima_sessao: dia(6), esperas_abertas: [{ inicio: dia(1) }] }, agora).nivel).toBe('VERDE');
  });
  it('espera longa, tarefa do cliente vencida e sem técnico ficam amarelos', () => {
    expect(saudeDoCard({ ...ok, esperas_abertas: [{ inicio: dia(2) }] }, agora).motivos).toEqual(['Parada em espera há 2 dias']);
    expect(saudeDoCard({ ...ok, tarefas_vencidas: 2 }, agora).motivos).toEqual(['2 tarefa(s) do cliente vencida(s)']);
    expect(saudeDoCard({ ...ok, tecnico_id: null }, agora).motivos).toEqual(['Sem técnico há 2 dia(s)']);
  });
  it('fora da execução fica verde', () => { expect(saudeDoCard({ ...ok, coluna: 'CONCLUIDO', sla: { situacao: 'ESTOURADO' } }, agora).nivel).toBe('VERDE'); });

  it('resumo do suporte traz tipo, decisor, como a loja trabalha, correções e observações', () => {
    const r = montarResumoSuporte({
      imp: { cliente_razao_social: 'Farmácia X', modulo: 'IMPLANTACAO', tipo_base: 'CONVERSAO', sistema_anterior: 'Trier', virada_fim_em: new Date('2026-10-09T18:00:00Z'), tecnico_nome: 'Lucas Diniz', coleta: { decisor_nome: 'Ana', decisor_telefone: '27999990000', regime_tributario: 'Simples', caixas: '3' } },
      observacoes: [{ texto: 'Cliente prefere contato à tarde', autor_nome: 'Lucas Diniz' }], correcoes: [{ titulo: 'Estoque negativo', situacao: 'RESOLVIDA' }],
      campos: [{ key: 'regime_tributario', label: 'Regime tributário' }, { key: 'caixas', label: 'Caixas (PDV)' }],
    });
    expect(r).toContain('Implantação conversão de Trier · virada em 09/10/2026 · técnico Lucas Diniz');
    expect(r).toContain('Decisor: Ana · 27999990000');
    expect(r).toContain('• Regime tributário: Simples');
    expect(r).toContain('• Estoque negativo');
    expect(r).toContain('• Cliente prefere contato à tarde (Lucas)');
  });
});
