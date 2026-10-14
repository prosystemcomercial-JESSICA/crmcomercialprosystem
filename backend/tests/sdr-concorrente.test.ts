import { describe, it, expect } from 'vitest';
import { sinaisDeNaoLoja, ehRespostaAutomatica, ehSoConfirmacao, lerRespostaCaroline, fichaDoLead } from '../src/lib/assistente/sdr';

// Caso real de 14/10/2026: "Prosyst Mentorias" entrou pela campanha de farmácia, o robô dele não foi reconhecido,
// o agente marcou conversa sem confirmar a loja e respondeu a um "Até".
describe('possível concorrente ou consultor', () => {
  it('desconfia do nome do WhatsApp e da empresa', () => {
    expect(sinaisDeNaoLoja({ perfil: 'Prosyst Mentorias', empresa: 'raimundo.santos.cc@gmail.com' })).toHaveLength(2);
    expect(sinaisDeNaoLoja({ perfil: 'Tech Sistemas Ltda' })[0]).toContain('sistemas');
    expect(sinaisDeNaoLoja({ perfil: 'Consultoria Gestão Farma Pro' })).toHaveLength(0); // tem farm: é loja/ramo
  });
  it('não desconfia de loja comum nem da própria Prosystem citada', () => {
    expect(sinaisDeNaoLoja({ perfil: 'Drogaria Bem Viver', empresa: 'Drogaria Bem Viver' })).toEqual([]);
    expect(sinaisDeNaoLoja({ perfil: 'Ana Souza', textos: ['Usamos o Prosystem há anos'] })).toEqual([]);
  });
  it('lê o perfil e a loja confirmada que a IA registra', () => {
    const r = lerRespostaCaroline({ mensagens: ['Qual é a farmácia e a cidade?'], acao: 'continuar', dados: { perfil: 'consultor', loja_confirmada: null } })!;
    expect(r.dados.perfil).toBe('consultor');
    expect(fichaDoLead({ dados: { sinais_nao_loja: ['nome parecido com o da Prosystem'] } })).toContain('confirme qual é a loja');
  });
});

describe('robô e despedida do caso Prosyst', () => {
  it('reconhece o robô dele', () => {
    expect(ehRespostaAutomatica('‎Prosyst Mentorias agradece seu contato, assim que possível responderei sua mensagem. Obrigado')).toBe(true);
    expect(ehRespostaAutomatica('Agradecemos sua mensagem. Não estamos disponíveis no momento, mas responderemos assim que possível.')).toBe(true);
  });
  it('"Até" é só despedida; pergunta com "até" não é', () => {
    for (const t of ['Até', 'até mais', 'Até sexta!', 'Tchau', 'abs']) expect(ehSoConfirmacao(t), t).toBe(true);
    expect(ehSoConfirmacao('Até quando vale a proposta?')).toBe(false);
  });
});
