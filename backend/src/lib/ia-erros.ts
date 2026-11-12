// Motivo de cada falha das IAs (pedido da Jessica, 12/11/2026: "precisamos desses erros registrados para
// análises futuras"). Antes só havia o contador de falhas por agente e um log sem data. Agora cada falha
// vira uma linha por dia, agente, IA e motivo, com quantidade, primeira e última vez, horas do dia e um
// exemplo da mensagem. Gravado em ConfiguracaoIntegracao 'ia.erros.AAAA-MM-DD'. Funções puras.

export type MotivoIa =
  | 'chave_invalida' | 'sem_credito' | 'limite' | 'tempo_esgotado' | 'resposta_vazia'
  | 'modelo_indisponivel' | 'pedido_recusado' | 'fora_do_ar' | 'outro';

export const TEXTO_MOTIVO: Record<MotivoIa, string> = {
  chave_invalida: 'Chave recusada pela IA',
  sem_credito: 'Sem crédito na conta da IA',
  limite: 'Limite de uso atingido',
  tempo_esgotado: 'IA demorou demais (tempo esgotado)',
  resposta_vazia: 'IA respondeu vazio',
  modelo_indisponivel: 'Modelo não encontrado ou sem acesso',
  pedido_recusado: 'Pedido recusado pela IA',
  fora_do_ar: 'IA fora do ar ou sem conexão',
  outro: 'Outro erro',
};

/** Classifica a mensagem de erro (a nossa ou a da IA). A ordem importa: crédito antes de limite. */
export function classificarErroIa(msg: string): MotivoIa {
  const m = String(msg || '');
  if (/inv[aá]lida|incorrect api key|invalid.{0,20}key|api key not valid|HTTP 401|unauthori[sz]ed/i.test(m)) return 'chave_invalida';
  if (/sem cr[eé]dito|insufficient_quota|HTTP 402|billing|payment/i.test(m)) return 'sem_credito';
  if (/limite|HTTP 429|rate.?limit|too many requests|quota|free-models-per-day/i.test(m)) return 'limite';
  if (/timeout|timed out|aborted|tempo esgotado/i.test(m)) return 'tempo_esgotado';
  if (/vazi[ao]|n[aã]o devolveu|empty/i.test(m)) return 'resposta_vazia';
  if (/HTTP 40[34]|model.{0,30}(not|does not)|model_not_found|modelo/i.test(m)) return 'modelo_indisponivel';
  if (/HTTP 4\d\d|recusad|invalid_request|content_policy/i.test(m)) return 'pedido_recusado';
  if (/HTTP 5\d\d|indispon[ií]vel|n[aã]o respondeu|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|overloaded/i.test(m)) return 'fora_do_ar';
  return 'outro';
}

export type ErroRegistrado = {
  n: number;
  primeiro: string; // ISO
  ultimo: string; // ISO
  exemplo: string; // última mensagem (até 200 caracteres)
  modelo?: string;
  horas: Record<string, number>; // 'HH' (Brasília) → quantidade
};
/** agente → IA → motivo → registro. */
export type ErrosDoDia = Record<string, Record<string, Partial<Record<MotivoIa, ErroRegistrado>>>>;

const horaSP = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).slice(0, 2);

/** Anota uma falha no acumulado do dia (muda `d`). */
export function anotarErro(d: ErrosDoDia, agente: string, provedor: string, msg: string, quando: Date, modelo?: string): MotivoIa {
  const motivo = classificarErroIa(msg);
  const iso = quando.toISOString();
  const porProv = ((d[agente] ||= {})[provedor] ||= {});
  const r = (porProv[motivo] ||= { n: 0, primeiro: iso, ultimo: iso, exemplo: '', horas: {} });
  r.n++;
  if (iso < r.primeiro) r.primeiro = iso;
  if (iso >= r.ultimo) { r.ultimo = iso; r.exemplo = String(msg || 'sem detalhe').replace(/\s+/g, ' ').slice(0, 200); if (modelo) r.modelo = modelo; }
  const h = horaSP(quando);
  r.horas[h] = (r.horas[h] || 0) + 1;
  return motivo;
}

/** Soma dois acumulados (o gravado e o que está em memória) sem mudar nenhum dos dois. */
export function somarErros(a: ErrosDoDia, b: ErrosDoDia): ErrosDoDia {
  const out: ErrosDoDia = JSON.parse(JSON.stringify(a || {}));
  for (const [ag, provs] of Object.entries(b || {})) {
    for (const [pv, motivos] of Object.entries(provs || {})) {
      for (const [mo, r] of Object.entries(motivos || {}) as [MotivoIa, ErroRegistrado][]) {
        const alvo = ((out[ag] ||= {})[pv] ||= {});
        const x = alvo[mo];
        if (!x) { alvo[mo] = JSON.parse(JSON.stringify(r)); continue; }
        x.n += r.n;
        if (r.primeiro < x.primeiro) x.primeiro = r.primeiro;
        if (r.ultimo >= x.ultimo) { x.ultimo = r.ultimo; x.exemplo = r.exemplo; if (r.modelo) x.modelo = r.modelo; }
        for (const [h, n] of Object.entries(r.horas || {})) x.horas[h] = (x.horas[h] || 0) + n;
      }
    }
  }
  return out;
}

export type LinhaErro = { provedor: string; motivo: MotivoIa; texto: string; n: number; primeiro: string; ultimo: string; exemplo: string; modelo?: string; dias: number };

/** Para o painel: por agente, os motivos do período somados, do mais frequente ao menos. */
export function resumoErrosPorAgente(dias: ErrosDoDia[]): Record<string, LinhaErro[]> {
  const mapa = new Map<string, LinhaErro>();
  for (const d of dias) {
    for (const [ag, provs] of Object.entries(d || {})) {
      for (const [pv, motivos] of Object.entries(provs || {})) {
        for (const [mo, r] of Object.entries(motivos || {}) as [MotivoIa, ErroRegistrado][]) {
          const k = `${ag}|${pv}|${mo}`;
          const x = mapa.get(k);
          if (!x) { mapa.set(k, { provedor: pv, motivo: mo, texto: TEXTO_MOTIVO[mo] || mo, n: r.n, primeiro: r.primeiro, ultimo: r.ultimo, exemplo: r.exemplo, modelo: r.modelo, dias: 1 }); continue; }
          x.n += r.n; x.dias++;
          if (r.primeiro < x.primeiro) x.primeiro = r.primeiro;
          if (r.ultimo >= x.ultimo) { x.ultimo = r.ultimo; x.exemplo = r.exemplo; if (r.modelo) x.modelo = r.modelo; }
        }
      }
    }
  }
  const out: Record<string, LinhaErro[]> = {};
  for (const [k, v] of mapa) (out[k.split('|')[0]] ||= []).push(v);
  for (const l of Object.values(out)) l.sort((a, b) => b.n - a.n);
  return out;
}
