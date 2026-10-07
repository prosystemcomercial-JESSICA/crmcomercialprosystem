// Números de WhatsApp da empresa (pedido da Jessica, 07/10/2026): o número de hoje continua na
// UAZAPI, mais uma vaga UAZAPI reservada e três vagas na API gratuita (Evolution API na VPS),
// para distribuir a prospecção ativa sem sobrecarregar um número só.
// Cada vaga vira uma linha de WhatsappInstancia com instancia_nome = vaga, criada ao conectar.

export type Vaga = { vaga: string; provedor: 'UAZAPI' | 'GRATIS'; rotulo: string; principal?: true };

export const VAGAS: Vaga[] = [
  { vaga: 'empresa', provedor: 'UAZAPI', rotulo: 'Número principal', principal: true },
  { vaga: 'uazapi-2', provedor: 'UAZAPI', rotulo: 'Número 2 (UAZAPI)' },
  { vaga: 'gratis-1', provedor: 'GRATIS', rotulo: 'Número 3 (API gratuita)' },
  { vaga: 'gratis-2', provedor: 'GRATIS', rotulo: 'Número 4 (API gratuita)' },
  { vaga: 'gratis-3', provedor: 'GRATIS', rotulo: 'Número 5 (API gratuita)' },
];

/** Nomes reservados aos números da empresa: nunca aparecem como instância pessoal de vendedor. */
export const NOMES_NUMEROS_EMPRESA = VAGAS.map(v => v.vaga);

export const vagaPorNome = (nome: string) => VAGAS.find(v => v.vaga === nome) || null;

/**
 * Primeiros contatos por dia de um número novo na prospecção, subindo aos poucos (aquecimento):
 * semana 1 → 10/dia, semana 2 → 20, semana 3 → 30, depois 40. O limite_dia manual vale se for menor.
 */
export function limiteDoDia(aquecimentoDesde: Date | null, limiteManual: number | null, agora = new Date()): number {
  const dias = aquecimentoDesde ? Math.max(0, Math.floor((agora.getTime() - aquecimentoDesde.getTime()) / 864e5)) : 0;
  const pelaIdade = dias < 7 ? 10 : dias < 14 ? 20 : dias < 21 ? 30 : 40;
  return limiteManual != null ? Math.min(limiteManual, pelaIdade) : pelaIdade;
}

export const AVISO_LICENCA_GRATIS =
  'Os números 3, 4 e 5 usam a Evolution API (software livre, licença Apache 2.0 com condições de uso comercial: https://github.com/EvolutionAPI/evolution-api). ' +
  'Por ser uma API não oficial, use com moderação: o WhatsApp pode bloquear números com muitas mensagens para quem não conhece a empresa.';
