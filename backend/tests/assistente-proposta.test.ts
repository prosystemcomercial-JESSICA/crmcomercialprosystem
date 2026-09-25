import { describe, it, expect } from 'vitest';
import {
  textoResumoProposta, menuAceite, lerBotaoProposta, opcoesPlanos, mensalidadeDe, textoPosAceite, decidirFollowup, textoFollowup, segmentoChave, linkProposta,
  type PropostaResumo,
} from '../src/lib/assistente/proposta';

const p: PropostaResumo = {
  id: 'p1', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'Pão Quente', responsavel_nome: 'Carlos Souza',
  plano_selecionado: 'PRO', mensalidade_pro: 330, mensalidade_plus: 430, valor_final: 1200, valor_implantacao: 1500,
  entrada: 400, parcelas: 3, valor_parcela: 400, validade: '2026-10-05T12:00:00Z', vendedor_nome: 'Jessica Cardoso', segmento: 'Padaria',
};

describe('proposta pelo WhatsApp', () => {
  it('resumo traz plano, mensalidade, implantação negociada, entrada e link', () => {
    const t = textoResumoProposta(p, 'https://x/p/tok?modo=cliente');
    expect(t).toContain('Olá, Carlos!');
    expect(t).toContain('*Pão Quente*');
    // Proposta com Pro e Plus: mostra as duas opções, com o recomendado marcado.
    expect(t).toMatch(/\*Loja Pro\*: R\$\s?330,00 ⭐ recomendado/);
    expect(t).toMatch(/\*Loja Plus\*: R\$\s?430,00/);
    expect(t).toMatch(/Implantação: \*R\$\s?1\.200,00\*/);
    expect(t).toMatch(/Entrada: R\$\s?400,00 \+ 2x de R\$\s?400,00/);
    expect(t).toContain('Válida até 05/10/2026');
    expect(t).toContain('https://x/p/tok?modo=cliente');
  });
  it('botões e leitura da resposta', () => {
    expect(menuAceite('p1').opcoes.map(o => o.id)).toEqual(['prop_ok_p1', 'prop_duv_p1']);
    expect(lerBotaoProposta('prop_ok_p1')).toEqual({ acao: 'aceitar', id: 'p1' });
    expect(lerBotaoProposta('prop_duv_abc')).toEqual({ acao: 'duvida', id: 'abc' });
    expect(lerBotaoProposta('cnpj_sim')).toBeNull();
  });
  it('após aceite: com chave PIX, sem chave e sem entrada', () => {
    expect(textoPosAceite(p, 'pix@prosystem.com')).toContain('Chave PIX: *pix@prosystem.com*');
    expect(textoPosAceite(p, '')).toContain('financeiro vai te enviar a cobrança da entrada');
    expect(textoPosAceite({ ...p, entrada: null }, 'x')).toContain('próximos passos');
  });
  it('link público', () => {
    expect(linkProposta('https://crm.com/', 'abc')).toBe('https://crm.com/p/abc?modo=cliente');
  });
});

describe('decidirFollowup', () => {
  const enviada = new Date('2026-09-20T12:00:00Z');
  const base = { status: 'ENVIADA', enviada_em: enviada, etapa: 0, ultima_entrada_em: null };
  const dia = (d: number) => new Date(enviada.getTime() + d * 86400000);
  it('dias 2, 5 e 7', () => {
    expect(decidirFollowup({ ...base, agora: dia(1) })).toBeNull();
    expect(decidirFollowup({ ...base, agora: dia(2) })).toBe(1);
    expect(decidirFollowup({ ...base, etapa: 1, agora: dia(4) })).toBeNull();
    expect(decidirFollowup({ ...base, etapa: 1, agora: dia(5) })).toBe(2);
    expect(decidirFollowup({ ...base, etapa: 2, agora: dia(7) })).toBe(3);
    expect(decidirFollowup({ ...base, etapa: 3, agora: dia(20) })).toBeNull();
  });
  it('para se o cliente respondeu ou a proposta saiu de aberta', () => {
    expect(decidirFollowup({ ...base, ultima_entrada_em: dia(1), agora: dia(3) })).toBe('parar');
    expect(decidirFollowup({ ...base, status: 'CONTRATO_EM_GERACAO', agora: dia(3) })).toBe('parar');
    expect(decidirFollowup({ ...base, ultima_entrada_em: new Date(enviada.getTime() - 1000), agora: dia(2) })).toBe(1);
  });
  it('textos por etapa e segmento', () => {
    expect(segmentoChave('Farmácia de Manipulação')).toBe('farmacia');
    expect(textoFollowup(2, p, 'L')).toContain('balança integrada');
    expect(textoFollowup(3, p, 'L')).toContain('vale até 05/10/2026');
  });
});

describe('proposta com Pro e Plus', () => {
  const p: any = { id: 'p9', razao_social: null, nome_fantasia: 'Farmácia Exemplo', responsavel_nome: 'João Silva', plano_selecionado: 'Farma Plus',
    mensalidade_pro: 350, mensalidade_plus: 450, valor_final: 1550, valor_implantacao: 1550, entrada: 550, parcelas: 4, valor_parcela: 250,
    validade: null, vendedor_nome: 'Jessica', segmento: 'Farmácia' };
  it('nome livre do plano ("Farma Plus") pega a mensalidade certa', () => {
    expect(mensalidadeDe(p)).toBe(450);
    expect(mensalidadeDe({ ...p, plano_selecionado: 'Farma Pro' })).toBe(350);
  });
  it('mensagem mostra as duas opções com o valor de cada uma', () => {
    const t = textoResumoProposta(p, 'L');
    expect(t).toMatch(/\*Farma Pro\*: R\$\s350,00/);
    expect(t).toMatch(/\*Farma Plus\*: R\$\s450,00 ⭐ recomendado/);
    expect(t).not.toContain('💳 Mensalidade');
  });
  it('um botão de aceite por plano, que devolve o plano no clique', () => {
    const m = menuAceite('p9', opcoesPlanos(p));
    expect(m.opcoes.map(o => o.id)).toEqual(['prop_ok_PRO_p9', 'prop_ok_PLUS_p9', 'prop_duv_p9']);
    expect(m.opcoes.map(o => o.texto)).toEqual(['Aceitar Farma Pro', 'Aceitar Farma Plus', 'Tenho dúvidas']);
    expect(lerBotaoProposta('prop_ok_PLUS_p9')).toEqual({ acao: 'aceitar', id: 'p9', plano: 'PLUS' });
    expect(lerBotaoProposta('prop_ok_p9')).toEqual({ acao: 'aceitar', id: 'p9' });
  });
});
