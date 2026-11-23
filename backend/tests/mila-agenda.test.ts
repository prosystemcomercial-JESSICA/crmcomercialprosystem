import { describe, it, expect } from 'vitest';
import { montarAgendaCs, agendaEmMarkdown, cnpjRaiz, type DadosAgenda, type ImplantacaoAg } from '../src/lib/assistente/mila-agenda';
import { secoesDoPlaybook } from '../src/lib/assistente/playbook-mila';

const agora = new Date('2026-11-23T11:00:00Z');
const diasAtras = (n: number) => new Date(+agora - n * 864e5);
const impl = (p: Partial<ImplantacaoAg>): ImplantacaoAg => ({ id: 'i', cliente_razao_social: 'Farmácia A', created_at: diasAtras(40), updated_at: diasAtras(1), ...p });
const vazio: DadosAgenda = { implantacoes: [], emAtencao: [], casos: [], inativos: [], ativos: [] };
const secao = (d: DadosAgenda, id: string) => montarAgendaCs(d, agora).find(s => s.id === id)!;

describe('Mila · Agenda do CS', () => {
  it('implantação parada há 10 dias ou mais entra; cancelada, concluída ou antiga não', () => {
    const s = secao({ ...vazio, implantacoes: [
      impl({ id: 'parada', updated_at: diasAtras(12), tecnico_nome: 'João' }),
      impl({ id: 'andando', updated_at: diasAtras(3) }),
      impl({ id: 'cancelada', updated_at: diasAtras(30), status: 'CANCELADA' }),
      impl({ id: 'velha', created_at: diasAtras(400), updated_at: diasAtras(300) }),
      impl({ id: 'servico', modulo: 'SERVICO', updated_at: diasAtras(30) }),
    ] }, 'implantacao_parada');
    expect(s.itens).toHaveLength(1);
    expect(s.itens[0].acao).toContain('João');
  });

  it('cada marco depois da virada cai numa janela de 7 dias (uma vez por marco na agenda semanal)', () => {
    const d = { ...vazio, implantacoes: [3, 8, 31, 92, 20].map((n, k) => impl({ id: `i${k}`, cliente_razao_social: `L${n}`, data_conclusao: diasAtras(n) })) };
    expect(secao(d, 'virada').itens.map(i => i.cliente)).toEqual(['L3']);
    expect(secao(d, 'd7').itens.map(i => i.cliente)).toEqual(['L8']);
    expect(secao(d, 'd30').itens.map(i => i.cliente)).toEqual(['L31']);
    expect(secao(d, 'd90').itens.map(i => i.cliente)).toEqual(['L92']);
  });

  it('caso de churn aberto e parado, saída sem motivo e loja do mesmo grupo de quem saiu', () => {
    const d: DadosAgenda = { ...vazio,
      casos: [{ cliente: 'X', status: 'PLANEJADO', motivo: null, updated_at: diasAtras(9) }, { cliente: 'Y', status: 'RECUPERADO', updated_at: diasAtras(30) }],
      inativos: [{ nome: 'Rede 01', cnpj: '12.345.678/0001-90', motivo: 'migrou para outro sistema', inativado_em: diasAtras(20) }, { nome: 'Z', cnpj: null, motivo: '', inativado_em: diasAtras(5) }],
      ativos: [{ id: 'a', nome: 'Rede 02', cnpj: '12345678000270' }, { id: 'b', nome: 'Outra', cnpj: '99999999000199' }],
    };
    expect(secao(d, 'caso_parado').itens.map(i => i.cliente)).toEqual(['X']);
    expect(secao(d, 'sem_motivo').itens.map(i => i.cliente)).toEqual(['Z']);
    const g = secao(d, 'grupo').itens;
    expect(g.map(i => i.cliente)).toEqual(['Rede 02']);
    expect(g[0].acao).toContain('migrou');
  });

  it('markdown só mostra seções com itens e avisa que nada foi enviado', () => {
    const { md, total } = agendaEmMarkdown(montarAgendaCs({ ...vazio, emAtencao: [{ id: 'c', nome: 'Drogaria C' }] }, agora), agora);
    expect(total).toBe(1);
    expect(md).toContain('Drogaria C');
    expect(md).toContain('nada foi enviado');
    expect(md).not.toContain('Implantação sem avanço');
    expect(cnpjRaiz('123')).toBeNull();
  });

  it('recorta seções do manual e sempre inclui as regras de ouro', () => {
    const t = '# Manual\n\n## 0. Regras\nouro\n\n## 1. Quando\nagenda\n\n## 12. Expansão\nupgrade';
    const r = secoesDoPlaybook(t, [12]);
    expect(r).toContain('ouro');
    expect(r).toContain('upgrade');
    expect(r).not.toContain('agenda');
  });
});
