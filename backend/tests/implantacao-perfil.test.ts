import { describe, it, expect } from 'vitest';
import {
  perfilDe, segmentoDoPerfil, perguntasDoPerfil, onboardingItensDoPerfil, checklistDoPerfil, camposColetaDoPerfil,
  realinhamento, perguntasRespondidasDoPerfil, PERGUNTAS_PRIMEIRO_CONTATO, ONBOARDING_ITENS, CHECKLIST_PADRAO,
} from '../src/lib/implantacao/portal';

// Perfil da implantação: segmento do cliente + banco zerado/conversão (pedido da Jessica, 26/10/2026).
describe('perfil da implantação', () => {
  it('classifica o segmento do cadastro', () => {
    expect(segmentoDoPerfil('Farmácia')).toBe('FARMACIA');
    expect(segmentoDoPerfil('Drogaria')).toBe('FARMACIA');
    expect(segmentoDoPerfil('Manipulação')).toBe('FARMACIA');
    expect(segmentoDoPerfil('Padaria')).toBe('PADARIA');
    expect(segmentoDoPerfil('Varejo')).toBe('VAREJO');
    expect(segmentoDoPerfil('Loja de roupas')).toBe('VAREJO');
    expect(segmentoDoPerfil(null)).toBe('FARMACIA'); // sem segmento: como era antes
  });

  it('farmácia em conversão continua igual a antes', () => {
    const p = perfilDe('Farmácia', 'CONVERSAO');
    expect(perguntasDoPerfil(p)).toEqual(PERGUNTAS_PRIMEIRO_CONTATO);
    expect(onboardingItensDoPerfil(p)).toEqual(ONBOARDING_ITENS);
    expect(checklistDoPerfil([], [], 'Farmácia', null, p)).toEqual(CHECKLIST_PADRAO);
  });

  it('varejo banco zerado: sem PBM, SNGPC, Farmácias APP, prescritores, conversão nem sistema anterior', () => {
    const p = perfilDe('Varejo', 'BANCO_ZERADO');
    const perguntas = perguntasDoPerfil(p);
    expect(perguntas).not.toContain('pbms');
    expect(perguntas).not.toContain('sngpc');
    expect(perguntas).toHaveLength(13);
    const tudo = [...onboardingItensDoPerfil(p), ...checklistDoPerfil([], [], 'Varejo', 'Outro', p).flatMap(g => g.itens)].join(' | ');
    expect(tudo).not.toMatch(/PBM|SNGPC|Farmácia|Prescritores|registro MS|medicamentos/);
    expect(checklistDoPerfil([], [], 'Varejo', 'Outro', p).map(g => g.grupo)).toEqual(['INSTALACAO', 'TREINAMENTO']);
    expect(onboardingItensDoPerfil(p)).toContain('Volume aproximado de produtos e quem fará o cadastro inicial (banco zerado)');
    expect(camposColetaDoPerfil(p).map(c => c.key)).not.toEqual(expect.arrayContaining(['pbms', 'sngpc', 'sistema_anterior']));
  });

  it('varejo em conversão tem a conversão, sem itens de farmácia', () => {
    const conv = checklistDoPerfil([], [], 'Varejo', null, perfilDe('Varejo', 'CONVERSAO')).find(g => g.grupo === 'CONVERSAO')!;
    expect(conv.itens).toContain('Validar Cadastro de Empresas');
    expect(conv.itens.join(' ')).not.toMatch(/registro MS|Prescritores/);
  });

  it('perguntas respondidas contam só as do perfil', () => {
    const p = perfilDe('Varejo', 'BANCO_ZERADO');
    const coleta = Object.fromEntries(perguntasDoPerfil(p).map(k => [k, 'x']));
    expect(perguntasRespondidasDoPerfil(coleta, p)).toBe(true);
    expect(perguntasRespondidasDoPerfil(coleta, perfilDe('Farmácia', 'CONVERSAO'))).toBe(false);
  });

  it('realinhamento tira só item padrão não feito e acrescenta o que falta', () => {
    const atuais = [
      { id: '1', grupo: 'TREINAMENTO', titulo: 'PBM', feito: false },
      { id: '2', grupo: 'TREINAMENTO', titulo: 'Controlados / Receitas - Controle SNGPC', feito: true }, // feito: fica
      { id: '3', grupo: 'TREINAMENTO', titulo: 'Item que o técnico criou', feito: false }, // à mão: fica
      { id: '4', grupo: 'CONVERSAO', titulo: 'Instalação do Banco de Dados', feito: false }, // zerado: sai
      { id: '5', grupo: 'ONBOARDING', titulo: 'Controle de lote, validade e medicamentos controlados definido', feito: false },
    ];
    const r = realinhamento(atuais, [
      { grupo: 'ONBOARDING', itens: ['Controle de lote e validade definido (quando o produto exigir)'] },
      { grupo: 'TREINAMENTO', itens: ['Fechamento de caixa'] },
    ]);
    expect(r.remover.sort()).toEqual(['1', '4', '5']);
    expect(r.incluir.map(x => x.titulo)).toEqual(['Controle de lote e validade definido (quando o produto exigir)', 'Fechamento de caixa']);
  });
});
