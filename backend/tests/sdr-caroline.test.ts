import { describe, it, expect } from 'vitest';
import { lerLeadsColados, horarioComercial, limiteDoDia, intervaloSorteado, deveRetomar, temperaturaDaNota, lerRespostaCaroline, promptCaroline } from '../src/lib/assistente/sdr';

const JOHN = `Lead se Cadastrou em 13/08/2026 21:58:33 na campanha facebook - prosystem_demonstracao_13082026 -

Empresa:



Nome: João

Empresa: Farmácia Exemplo

Telefone: (27) 99999-0001

E-mail: joao.exemplo@email.com

Utms: Origem: facebook e Campanha: prosystem_demonstracao_13082026



URL Farmácia: https://prosystemnet.com/prosystemlpv2/`;

describe('Caroline — leads colados', () => {
  it('lê o formato da plataforma', () => {
    const [l] = lerLeadsColados(JOHN);
    expect(l).toMatchObject({ nome: 'João', empresa: 'Farmácia Exemplo', numero: '5527999990001', email: 'joao.exemplo@email.com', campanha: 'prosystem_demonstracao_13082026', origem: 'facebook', segmento: 'Farmácia', url: 'https://prosystemnet.com/prosystemlpv2/' });
    expect(l.cadastro_em?.toISOString()).toBe('2026-08-14T00:58:33.000Z');
  });
  it('vários de uma vez', () => {
    const dois = JOHN + '\n\n' + JOHN.replace('João', 'Maria').replace('99135-2501', '98888-7777').replace('URL Farmácia', 'URL Padaria');
    const ls = lerLeadsColados(dois);
    expect(ls.map(l => l.nome)).toEqual(['João', 'Maria']);
    expect(ls[1].segmento).toBe('Padaria');
  });
});

describe('Caroline — anti-bloqueio', () => {
  it('horário comercial em Brasília', () => {
    expect(horarioComercial(new Date('2026-09-28T12:00:00Z'))).toBe(true);   // seg 9h
    expect(horarioComercial(new Date('2026-09-28T22:00:00Z'))).toBe(false);  // seg 19h
    expect(horarioComercial(new Date('2026-09-26T16:00:00Z'))).toBe(false);  // sáb 13h
    expect(horarioComercial(new Date('2026-09-27T13:00:00Z'))).toBe(false);  // domingo
  });
  it('limite: 15 nas duas primeiras semanas, depois o configurado (teto 30)', () => {
    const agora = new Date('2026-10-20T12:00:00Z');
    expect(limiteDoDia(new Date('2026-10-15'), 30, agora)).toBe(15);
    expect(limiteDoDia(new Date('2026-09-01'), 30, agora)).toBe(30);
    expect(limiteDoDia(new Date('2026-09-01'), 80, agora)).toBe(30);
  });
  it('intervalo entre 4 e 9 minutos', () => {
    expect(intervaloSorteado(() => 0)).toBe(240_000);
    expect(intervaloSorteado(() => 1)).toBe(540_000);
  });
  it('retomada: 2 dias úteis depois da abertura, 5 depois da segunda, para na terceira', () => {
    const sexta = new Date('2026-09-25T13:00:00Z');
    expect(deveRetomar(1, sexta, new Date('2026-09-28T13:00:00Z'))).toBe(false); // segunda: 1 dia útil
    expect(deveRetomar(1, sexta, new Date('2026-09-29T13:00:00Z'))).toBe(true);
    expect(deveRetomar(2, sexta, new Date('2026-09-30T13:00:00Z'))).toBe(false);
    expect(deveRetomar(3, sexta, new Date('2026-10-30T13:00:00Z'))).toBe(false);
  });
});

describe('Caroline — termômetro e resposta da IA', () => {
  it('faixas de temperatura', () => {
    expect([90, 70, 40, 10].map(temperaturaDaNota)).toEqual(['MUITO_QUENTE', 'QUENTE', 'MORNO', 'FRIO']);
  });
  it('sem dor principal a nota fica no máximo em 59', () => {
    const r = lerRespostaCaroline({ mensagens: ['Entendi!'], acao: 'continuar', nota: 85, dor_principal: null });
    expect(r?.nota).toBe(59);
  });
  it('recusa resposta com preço', () => {
    expect(lerRespostaCaroline({ mensagens: ['O plano fica R$ 199 por mês'], acao: 'continuar', nota: 50 })).toBeNull();
  });
  it('1ª e 2ª retomadas chamam de volta pelo dia a dia; atualidade só em follow-up', () => {
    const base = { guia: 'G', instrucoes: '', exemplos: [], historico: 'Caroline: oi', fase: 'retomada' as const, saudacao: 'Bom dia' };
    const semResposta = promptCaroline({ ...base, lead: { nome: 'A', empresa: null, segmento: 'Farmácia', campanha: null, abertura_jessica: true, tentativa: 1 } });
    expect(semResposta.usuario).toContain('SNGPC');
    expect(semResposta.usuario).toContain('sem notícias, prazos ou impostos');
    const followUp = promptCaroline({ ...base, lead: { nome: 'A', empresa: null, segmento: 'Farmácia', campanha: null, abertura_jessica: true, tentativa: 1, ja_conversou: true } });
    expect(followUp.usuario).toContain('follow-up');
  });
  it('nunca deixa travessão nas mensagens', () => {
    const r = lerRespostaCaroline({ mensagens: ['Boa tarde, João! Aqui é a Caroline — da equipe Prosystem – tudo bem?'], acao: 'continuar', nota: 10 });
    expect(r?.mensagens[0]).toBe('Boa tarde, João! Aqui é a Caroline, da equipe Prosystem, tudo bem?');
  });
  it('ação desconhecida vira continuar e limita a 2 mensagens', () => {
    const r = lerRespostaCaroline({ mensagens: ['a', 'b', 'c'], acao: 'vender', nota: 40, dor_principal: 'caixa não bate' });
    expect(r).toMatchObject({ acao: 'continuar', mensagens: ['a', 'b'], nota: 40 });
  });
  it('prompt usa só o material e a missão da dor', () => {
    const p = promptCaroline({ guia: 'GUIA X', instrucoes: '', exemplos: [{ antes: 'oi', depois: 'olá' }], historico: 'Cliente: oi', fase: 'resposta', lead: { nome: 'João', empresa: 'Farmácia Exemplo', segmento: 'Farmácia', campanha: 'c1', abertura_jessica: true, tentativa: 1 }, saudacao: 'Bom dia' });
    expect(p.sistema).toContain('PROBLEMA PRINCIPAL');
    expect(p.sistema).toContain('GUIA X');
    expect(p.sistema).toContain('Ela enviou: olá');
    expect(p.usuario).toContain('Farmácia Exemplo');
  });
});
