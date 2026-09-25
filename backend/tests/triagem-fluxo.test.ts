import { describe, it, expect, vi } from 'vitest';
import { iniciarTriagem, avancarTriagem, CONTATO_GERAL, DepsTriagem } from '../src/lib/triagem/fluxo';
import type { DadosReceita } from '../src/lib/cnpj';

const RECEITA: DadosReceita = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
  data_situacao: null, cnae_principal: null, cnaes_secundarios: [], porte: null, natureza_juridica: null,
  data_abertura: null, capital_social: null, email: null, telefones: [], logradouro: null, numero: null,
  complemento: null, bairro: null, cep: null, municipio: 'VILA VELHA', uf: 'ES', socios: [], simples: null, mei: null,
};

function deps(over: Partial<DepsTriagem> = {}): DepsTriagem {
  return {
    consultarCnpj: vi.fn().mockResolvedValue({ status: 'encontrado', dados: RECEITA, fonte: 'BrasilAPI' }),
    temMaterial: () => false,
    ...over,
  };
}

const textos = (acoes: any[]) => acoes.map(a => (a.tipo === 'texto' ? a.texto : a.tipo === 'menu' ? a.menu.texto : `material:${a.segmento}`)).join('\n');

describe('iniciarTriagem', () => {
  it('número novo recebe menu de lista com 4 opções', () => {
    const r = iniciarTriagem({});
    expect(r.estado).toBe('MENU');
    const menu = (r.acoes[0] as any).menu;
    expect(menu.modo).toBe('list');
    expect(menu.botaoLista).toBe('Ver opções');
    expect(menu.opcoes.map((o: any) => o.id)).toEqual(['conhecer', 'servicos', 'suporte', 'financeiro']);
  });
  it('cliente da base recebe 3 botões com o nome', () => {
    const r = iniciarTriagem({ clienteNome: 'Padaria Sol' });
    expect(r.estado).toBe('MENU_CLIENTE');
    const menu = (r.acoes[0] as any).menu;
    expect(menu.modo).toBe('button');
    expect(menu.texto).toContain('Padaria Sol');
    expect(menu.opcoes.map((o: any) => o.id)).toEqual(['servicos', 'suporte', 'financeiro']);
  });
});

describe('suporte e financeiro', () => {
  it('suporte informa o contato geral e encerra', async () => {
    const r = await avancarTriagem('MENU', {}, { texto: 'Suporte', botaoId: 'suporte' }, deps());
    expect(r.estado).toBe('FIM');
    expect(r.desfecho).toBe('suporte');
    expect(textos(r.acoes)).toContain(CONTATO_GERAL);
  });
  it('financeiro a partir do menu de cliente', async () => {
    const r = await avancarTriagem('MENU_CLIENTE', {}, { texto: 'Financeiro', botaoId: 'financeiro' }, deps());
    expect(r.desfecho).toBe('financeiro');
    expect(textos(r.acoes)).toContain(CONTATO_GERAL);
  });
});

describe('serviços', () => {
  it('pergunta o serviço, depois encerra com o pedido', async () => {
    const a = await avancarTriagem('MENU', {}, { texto: 'Serviços', botaoId: 'servicos' }, deps());
    expect(a.estado).toBe('SERVICO');
    const b = await avancarTriagem('SERVICO', a.dados, { texto: 'Preciso de treinamento para 2 caixas' }, deps());
    expect(b.estado).toBe('FIM');
    expect(b.desfecho).toBe('servicos');
    expect(b.dados.servico).toBe('Preciso de treinamento para 2 caixas');
  });
  it('descrição vazia repete a pergunta', async () => {
    const r = await avancarTriagem('SERVICO', { fluxo: 'servicos' }, { texto: '' }, deps());
    expect(r.estado).toBe('SERVICO');
  });
});

describe('quero conhecer — caminho completo', () => {
  it('lead novo em 3 toques: conhecer → segmento → nome → fim (sem cidade nem CNPJ)', async () => {
    const d = deps();
    let r = await avancarTriagem('MENU', {}, { texto: 'Quero conhecer', botaoId: 'conhecer' }, d);
    expect(r.estado).toBe('SEGMENTO');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'Farmácia', botaoId: 'farmacia' }, d);
    expect(r.estado).toBe('NOME');
    expect(r.dados.segmento).toBe('Farmácia');
    r = await avancarTriagem(r.estado, r.dados, { texto: '  Maria  ' }, d);
    expect(r.estado).toBe('FIM');
    expect(r.desfecho).toBe('qualificado');
    expect(r.dados.nome).toBe('Maria');
    expect(r.dados.cnpj).toBeUndefined();
    expect(textos(r.acoes)).toContain('Obrigado, Maria');
  });

  it('conversa que já estava no meio (cidade/CNPJ) continua funcionando', async () => {
    const d = deps();
    let r = await avancarTriagem('CIDADE', { fluxo: 'conhecer', segmento: 'Farmácia', nome: 'Maria' }, { texto: 'Vila Velha' }, d);
    expect(r.estado).toBe('CNPJ');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'é 11.222.333/0001-81' }, d);
    expect(r.estado).toBe('CNPJ_CONFIRMA');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'Sim', botaoId: 'cnpj_sim' }, d);
    expect(r.estado).toBe('FIM');
    expect(r.dados.cnpj).toBe('11222333000181');
  });

  it('com material cadastrado, manda o texto de ferramentas e a ação de material do segmento', async () => {
    const d = deps({ temMaterial: () => true });
    const r = await avancarTriagem('CNPJ_CONFIRMA', { fluxo: 'conhecer', segmento: 'Padaria', nome: 'João', cnpj: '11222333000181', receita: RECEITA }, { texto: 'Sim', botaoId: 'cnpj_sim' }, d);
    expect(textos(r.acoes)).toContain('ferramentas');
    expect(textos(r.acoes)).toContain('padaria');
    expect(r.acoes.some(a => a.tipo === 'material' && a.segmento === 'Padaria')).toBe(true);
  });

  it('"Não, digitar de novo" volta a pedir o CNPJ', async () => {
    const r = await avancarTriagem('CNPJ_CONFIRMA', { fluxo: 'conhecer', cnpj: '11222333000181', receita: RECEITA }, { texto: 'Não', botaoId: 'cnpj_nao' }, deps());
    expect(r.estado).toBe('CNPJ');
    expect(r.dados.cnpj).toBeUndefined();
    expect(r.dados.receita).toBeUndefined();
  });

  it('CNPJ inválido não avança e não consulta', async () => {
    const d = deps();
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer' }, { texto: '11.222.333/0001-82' }, d);
    expect(r.estado).toBe('CNPJ');
    expect(d.consultarCnpj).not.toHaveBeenCalled();
    expect(textos(r.acoes).toLowerCase()).toContain('não parece válido');
  });

  it('CNPJ não encontrado na Receita pede de novo', async () => {
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer' }, { texto: '11222333000181' }, deps({ consultarCnpj: vi.fn().mockResolvedValue({ status: 'nao_encontrado' }) }));
    expect(r.estado).toBe('CNPJ');
    expect(textos(r.acoes)).toContain('Não encontramos');
  });

  it('Receita indisponível: aceita o CNPJ válido e encerra sem confirmação', async () => {
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer', nome: 'Ana', segmento: 'Farmácia' }, { texto: '11222333000181' }, deps({ consultarCnpj: vi.fn().mockResolvedValue({ status: 'indisponivel' }) }));
    expect(r.estado).toBe('FIM');
    expect(r.desfecho).toBe('qualificado');
    expect(r.dados.receita).toBeNull();
    expect(r.dados.cnpj).toBe('11222333000181');
  });

  it('CNPJ baixado é aceito (aviso é interno, não para o cliente)', async () => {
    const baixada = { ...RECEITA, situacao: 'BAIXADA' };
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer' }, { texto: '11222333000181' }, deps({ consultarCnpj: vi.fn().mockResolvedValue({ status: 'encontrado', dados: baixada, fonte: 'BrasilAPI' }) }));
    expect(r.estado).toBe('CNPJ_CONFIRMA');
    expect(textos(r.acoes)).not.toContain('BAIXADA');
  });
});

describe('texto em vez de clique e entradas inválidas', () => {
  it('aceita número da opção e texto sem acento', async () => {
    expect((await avancarTriagem('MENU', {}, { texto: '1' }, deps())).estado).toBe('SEGMENTO');
    expect((await avancarTriagem('SEGMENTO', { fluxo: 'conhecer' }, { texto: 'farmacia' }, deps())).dados.segmento).toBe('Farmácia');
    expect((await avancarTriagem('MENU', {}, { texto: 'quero falar com o suporte' }, deps())).desfecho).toBe('suporte');
  });
  it('resposta que não casa repete o mesmo menu com aviso', async () => {
    const r = await avancarTriagem('SEGMENTO', { fluxo: 'conhecer' }, { texto: 'mercado' }, deps());
    expect(r.estado).toBe('SEGMENTO');
    expect(textos(r.acoes)).toContain('escolha uma das opções');
    expect(r.acoes.some(a => a.tipo === 'menu')).toBe(true);
  });
  it('entrada sem texto (áudio/figurinha) num passo de texto repete a pergunta', async () => {
    const r = await avancarTriagem('NOME', { fluxo: 'conhecer' }, { texto: '[áudio]' }, deps());
    expect(r.estado).toBe('NOME');
  });
  it('estado FIM não gera ação', async () => {
    const r = await avancarTriagem('FIM', { fluxo: 'suporte' }, { texto: 'oi de novo' }, deps());
    expect(r.estado).toBe('FIM');
    expect(r.acoes).toEqual([]);
    expect(r.desfecho).toBeUndefined();
  });
});

describe('RELACAO: negação como palavra isolada vence apelido de outra opção', () => {
  it('"não, nunca fui cliente, mas quero conhecer" → nao_conhece', async () => {
    const r = await avancarTriagem('RELACAO', { fluxo: 'conhecer' }, { texto: 'não, nunca fui cliente, mas quero conhecer' }, deps());
    expect(r.dados.relacao).toBe('nao_conhece');
  });
  it('"já fui cliente" → ex_cliente', async () => {
    const r = await avancarTriagem('RELACAO', { fluxo: 'conhecer' }, { texto: 'já fui cliente' }, deps());
    expect(r.dados.relacao).toBe('ex_cliente');
  });
  it('"sou cliente sim" → cliente', async () => {
    const r = await avancarTriagem('RELACAO', { fluxo: 'conhecer' }, { texto: 'sou cliente sim' }, deps());
    expect(r.dados.relacao).toBe('cliente');
  });
  it('clique real de botão vence o texto: botaoId cliente com texto "Não conheço" → cliente', async () => {
    const r = await avancarTriagem('RELACAO', { fluxo: 'conhecer' }, { texto: 'Não conheço', botaoId: 'cliente' }, deps());
    expect(r.dados.relacao).toBe('cliente');
  });
});

describe('regra do controller: MENU_CLIENTE não repete saudação de cliente', () => {
  it('resposta que não casa em MENU_CLIENTE repete com pergunta neutra, sem "*cliente*"', async () => {
    const r = await avancarTriagem('MENU_CLIENTE', {}, { texto: 'xyz' }, deps());
    expect(r.estado).toBe('MENU_CLIENTE');
    expect(r.acoes.every(a => !(a.tipo === 'texto' && a.texto.includes('*cliente*')) && !(a.tipo === 'menu' && a.menu.texto.includes('*cliente*')))).toBe(true);
  });
});

describe('CNPJ_CONFIRMA: negação vence apelido "certo"', () => {
  const dados = { fluxo: 'conhecer' as const, segmento: 'Padaria' as const, nome: 'João', cnpj: '11222333000181', receita: RECEITA };
  it("'não está certo' volta para CNPJ", async () => {
    expect((await avancarTriagem('CNPJ_CONFIRMA', dados, { texto: 'não está certo' }, deps())).estado).toBe('CNPJ');
  });
  it("'não, não é essa' volta para CNPJ", async () => {
    expect((await avancarTriagem('CNPJ_CONFIRMA', dados, { texto: 'não, não é essa' }, deps())).estado).toBe('CNPJ');
  });
  it("'sim, está certo' finaliza", async () => {
    expect((await avancarTriagem('CNPJ_CONFIRMA', dados, { texto: 'sim, está certo' }, deps())).estado).toBe('FIM');
  });
  it('clique em cnpj_sim vence texto "não"', async () => {
    expect((await avancarTriagem('CNPJ_CONFIRMA', dados, { texto: 'não', botaoId: 'cnpj_sim' }, deps())).estado).toBe('FIM');
  });
});
