import { describe, it, expect } from 'vitest';
import { desfechoDaReuniao, sinalDeNaoComparecimento } from '../src/lib/reuniao-desfecho';

describe('desfecho da reunião', () => {
  it('reconhece não comparecimento no que foi escrito', () => {
    expect(desfechoDaReuniao('Cliente nao deu retorno da antes da apresentação', []).status).toBe('CLIENTE_NAO_COMPARECEU');
    expect(desfechoDaReuniao('Vamos remarcar para o cliente, ele esta em viagem', []).status).toBe('CLIENTE_NAO_COMPARECEU');
  });
  it('reconhece pela fala do cliente na conversa', () => {
    expect(desfechoDaReuniao('', ['Bom dia', 'Prefiro adiar pois agora me ocupei aqui']).status).toBe('CLIENTE_NAO_COMPARECEU');
    expect(desfechoDaReuniao(null, ['Tudo bem agradeço', 'Deixar pra próxima']).status).toBe('CLIENTE_NAO_COMPARECEU');
  });
  it('mantém realizada quando nada indica o contrário', () => {
    expect(desfechoDaReuniao('Apresentação feita, gostou do módulo de estoque', ['Obrigado, muito bom']).status).toBe('REALIZADA');
    expect(sinalDeNaoComparecimento('')).toBeNull();
  });
});
