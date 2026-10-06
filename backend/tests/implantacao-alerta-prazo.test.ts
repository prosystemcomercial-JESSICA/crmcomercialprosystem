import { describe, it, expect } from 'vitest';
import { alertaPrazoDemanda } from '../src/lib/implantacao/portal';

const d = (s: string) => new Date(`${s}T12:00:00-03:00`);
const agora = d('2026-10-06');
const base = { status: 'AGUARDANDO_INSTALACAO', modulo: 'IMPLANTACAO', data_assinatura: d('2026-10-02'), prazo_virada: d('2026-10-05'), prazo_finalizacao: d('2026-10-20') };

describe('alerta de prazo da implantação (sino)', () => {
  it('demanda de antes do recomeço do portal (02/10/2026) não gera alerta', () => {
    expect(alertaPrazoDemanda({ ...base, data_assinatura: d('2026-06-03'), prazo_virada: d('2026-06-18') }, [], agora)).toBeNull();
  });

  it('virada vencida e não feita: atrasada', () => {
    expect(alertaPrazoDemanda(base, [], agora)).toEqual({ oque: 'virada/instalação', alvo: d('2026-10-05'), dias: -1, atrasada: true });
  });

  it('virada feita no portal (virada_fim_em) olha a finalização, que ainda está longe', () => {
    expect(alertaPrazoDemanda({ ...base, virada_fim_em: d('2026-10-04') }, [], agora)).toBeNull();
  });

  it('finalização perto (até 3 dias) avisa; concluída no portal não avisa', () => {
    const i = { ...base, virada_fim_em: d('2026-10-04'), prazo_finalizacao: d('2026-10-08') };
    expect(alertaPrazoDemanda(i, [], agora)).toEqual({ oque: 'finalização', alvo: d('2026-10-08'), dias: 2, atrasada: false });
    expect(alertaPrazoDemanda({ ...i, concluida_fila_em: d('2026-10-05') }, [], agora)).toBeNull();
  });

  it('colunas finais e canceladas não avisam', () => {
    expect(alertaPrazoDemanda({ ...base, coluna: 'VALIDADO' }, [], agora)).toBeNull();
    expect(alertaPrazoDemanda({ ...base, status: 'CANCELADA' }, [], agora)).toBeNull();
  });

  it('espera do cliente pausa o prazo (igual ao portal)', () => {
    const esperas = [{ tipo: 'CLIENTE', inicio: d('2026-10-03'), fim: d('2026-10-06') }]; // 3 dias
    expect(alertaPrazoDemanda(base, esperas, agora)).toEqual({ oque: 'virada/instalação', alvo: d('2026-10-08'), dias: 2, atrasada: false });
  });

  it('serviço usa só o prazo de conclusão', () => {
    expect(alertaPrazoDemanda({ status: 'AGUARDANDO_INSTALACAO', modulo: 'SERVICO', data_assinatura: d('2026-10-05'), prazo_virada: null, prazo_finalizacao: d('2026-10-08') }, [], agora))
      .toEqual({ oque: 'conclusão do serviço', alvo: d('2026-10-08'), dias: 2, atrasada: false });
  });
});
