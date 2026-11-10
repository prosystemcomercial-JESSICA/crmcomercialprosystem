// Semáforo das IAs (10/11/2026): cada provedor tem um estado. Depois de 3 falhas seguidas (ou uma falha
// grave: chave recusada, sem crédito) o provedor entra em pausa (15 min, depois 30, depois 60) e as
// chamadas seguem direto para o próximo, sem gastar tentativas. Puro; quem chama a IA é
// services/ia-gemini.service. Motivo: o Julio fez até 1.500 tentativas por dia com a chave recusada.

export type ProvedorIa = 'groq' | 'openrouter' | 'openai' | 'grok' | 'gemini';
export const PROVEDORES_IA: ProvedorIa[] = ['groq', 'openrouter', 'openai', 'grok', 'gemini'];
export const PAUSAS_MIN = [15, 30, 60];
export const FALHAS_PARA_PAUSAR = 3;
const GRAVE = /401|402|inválida|invalid|sem crédito|incorrect api key/i;

export type EstadoProvedor = {
  falhas: number; nivel: number; bloqueadoAte: number;
  ultimoErro: string | null; ultimaOk: number | null; ultimaFalha: number | null; chamadas: number;
};

const diaSP = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export class SemaforoIa {
  estados: Partial<Record<ProvedorIa, EstadoProvedor>> = {};
  /** Falhas por dia e provedor (o serviço grava em 'ia.falhas.<dia>' para o quadro de consumo). */
  falhasPorDia: Record<string, Partial<Record<ProvedorIa, number>>> = {};
  constructor(private agora: () => number = Date.now) {}
  private e(p: ProvedorIa): EstadoProvedor {
    return (this.estados[p] ||= { falhas: 0, nivel: 0, bloqueadoAte: 0, ultimoErro: null, ultimaOk: null, ultimaFalha: null, chamadas: 0 });
  }
  bloqueado(p: ProvedorIa): boolean { return this.e(p).bloqueadoAte > this.agora(); }
  /** Minutos até voltar (0 = livre). */
  voltaEm(p: ProvedorIa): number { return Math.max(0, Math.ceil((this.e(p).bloqueadoAte - this.agora()) / 60_000)); }
  sucesso(p: ProvedorIa) {
    const e = this.e(p);
    e.falhas = 0; e.nivel = 0; e.bloqueadoAte = 0; e.ultimaOk = this.agora(); e.chamadas++;
  }
  /** Registra a falha; devolve true quando ela acabou de pausar o provedor (hora de avisar a gestão). */
  falha(p: ProvedorIa, erro: string): boolean {
    const e = this.e(p);
    e.falhas++; e.chamadas++; e.ultimaFalha = this.agora(); e.ultimoErro = String(erro || 'sem detalhe').slice(0, 200);
    const dia = (this.falhasPorDia[diaSP(this.agora())] ||= {});
    dia[p] = (dia[p] || 0) + 1;
    if (e.falhas < FALHAS_PARA_PAUSAR && !GRAVE.test(e.ultimoErro)) return false;
    const min = PAUSAS_MIN[Math.min(e.nivel, PAUSAS_MIN.length - 1)];
    e.bloqueadoAte = this.agora() + min * 60_000;
    e.nivel = Math.min(e.nivel + 1, PAUSAS_MIN.length);
    e.falhas = 0;
    return true;
  }
  /** Para o painel: um item por provedor. */
  resumo(temChave: (p: ProvedorIa) => boolean) {
    return PROVEDORES_IA.map(p => {
      const e = this.e(p);
      const estado = !temChave(p) ? 'sem_chave' : this.bloqueado(p) ? 'pausado' : e.chamadas === 0 ? 'sem_uso' : 'ok';
      return { provedor: p, estado, volta_em_min: this.voltaEm(p), ultimo_erro: e.ultimoErro, ultima_ok: e.ultimaOk ? new Date(e.ultimaOk).toISOString() : null, ultima_falha: e.ultimaFalha ? new Date(e.ultimaFalha).toISOString() : null, falhas_seguidas: e.falhas };
    });
  }
}

export const semaforoIa = new SemaforoIa();
