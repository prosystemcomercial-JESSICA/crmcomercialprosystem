// Atividade lançada por mensagem da gestão (Fase 2 do assistente):
// "tarefa Ana ligar para Farmácia Rangel amanhã 10h" → rascunho que só vira
// atividade depois do "Confirmar". Puro: interpreta responsável, prazo e tipo.

import { meiaNoiteNoFuso, partesNoFuso } from '../painel-tv';
import type { MenuWhatsapp } from '../../services/evolution.service';

export type RascunhoTarefa = { responsavel_id: string; responsavel_nome: string; titulo: string; tipo: string; prazo: Date };

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export const ehComandoTarefa = (texto: string) => /^\s*(tarefa|atividade)\s+\S/i.test(texto || '');

function tipoDe(t: string): string {
  const n = norm(t);
  if (/^(ligar|telefonar|retornar ligacao)/.test(n)) return 'LIGACAO';
  if (/^(mandar|enviar) (mensagem|whats)|^whats/.test(n)) return 'WHATSAPP';
  if (/^(mandar|enviar) e-?mail|^e-?mail/.test(n)) return 'EMAIL';
  if (/^visit/.test(n)) return 'VISITA';
  if (/^reuni/.test(n)) return 'REUNIAO';
  return 'TAREFA';
}

/** Interpreta a mensagem. `pessoas` = usuários ativos; `autor` = quem mandou (padrão de responsável). */
export function interpretarTarefa(
  texto: string, agora: Date,
  pessoas: { id: string; nome: string }[], autor: { id: string; nome: string },
): RascunhoTarefa | null {
  if (!ehComandoTarefa(texto)) return null;
  let resto = texto.trim().replace(/^(tarefa|atividade)\s+/i, '');

  // Responsável: primeira palavra que é o primeiro nome de alguém ("Ana," ou "Ana").
  let resp = autor;
  const primeira = resto.split(/[\s,:]+/)[0] || '';
  const achou = pessoas.find(p => norm(p.nome.split(/\s+/)[0]) === norm(primeira));
  if (achou) { resp = achou; resto = resto.slice(primeira.length).replace(/^[\s,:]+/, ''); }

  // Hora: "10h", "10h30", "10:30", "às 10".
  let hora: number | null = null, minuto = 0;
  const mh = resto.match(/\b(?:[àa]s\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b|\b[àa]s\s+(\d{1,2})\b/i);
  if (mh) {
    const h = Number(mh[1] ?? mh[4]); const m = Number(mh[2] ?? mh[3] ?? 0);
    if (h <= 23 && m <= 59) { hora = h; minuto = m; resto = resto.replace(mh[0], ' '); }
  }

  // Dia: hoje / amanhã / dia da semana / dd/mm.
  const hoje = partesNoFuso(agora);
  let dia: { ano: number; mes: number; dia: number } | null = null;
  const n = norm(resto);
  const somaDias = (k: number) => { const d = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + k)); return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() }; };
  let tokenDia: RegExp | null = null;
  // \b não funciona com letra acentuada no fim ("amanhã"): usa espaço/pontuação como borda.
  if (/\bamanha\b/.test(n)) { dia = somaDias(1); tokenDia = /(^|\s)amanh[aã](?=[\s,.]|$)/i; }
  else if (/\bhoje\b/.test(n)) { dia = somaDias(0); tokenDia = /\bhoje\b/i; }
  else {
    const md = resto.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (md) {
      const d = Number(md[1]), m = Number(md[2]);
      let ano = hoje.ano;
      if (m < hoje.mes || (m === hoje.mes && d < hoje.dia)) ano++;
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) { dia = { ano, mes: m, dia: d }; tokenDia = new RegExp(md[0].replace('/', '\\/')); }
    } else {
      const idx = DIAS.findIndex(ds => new RegExp(`\\b${ds}(-feira)?\\b`).test(n));
      if (idx >= 0) {
        const hojeDow = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia)).getUTCDay();
        const k = ((idx - hojeDow + 7) % 7) || 7;
        dia = somaDias(k);
        tokenDia = new RegExp(`(^|\\s)(na |no |nesta |neste |pr[oó]xim[ao] )?${['domingo', 'segunda', 'ter[cç]a', 'quarta', 'quinta', 'sexta', 's[aá]bado'][idx]}(-feira)?(?=[\\s,.]|$)`, 'i');
      }
    }
  }
  if (tokenDia) resto = resto.replace(tokenDia, ' ');

  let prazo: Date;
  if (!dia && hora === null) prazo = new Date(agora.getTime() + 24 * 3600000); // sem prazo: 24h
  else {
    if (!dia) dia = somaDias(0);
    const base = meiaNoiteNoFuso(dia.ano, dia.mes, dia.dia);
    prazo = new Date(base.getTime() + ((hora ?? 18) * 60 + minuto) * 60000);
    if (prazo <= agora && hora !== null && !tokenDia) prazo = new Date(prazo.getTime() + 86400000); // "10h" já passou: amanhã
  }

  const titulo = resto.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').replace(/[\s,.-]+$/, '').replace(/\b(at[eé]|para|pra)$/i, '').trim();
  if (titulo.length < 3) return null;
  return { responsavel_id: resp.id, responsavel_nome: resp.nome, titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), tipo: tipoDe(titulo), prazo };
}

export const rotuloPrazo = (d: Date) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('.', '').replace(/,/g, ' ·');

export function menuConfirmarTarefa(chave: string, r: RascunhoTarefa): MenuWhatsapp {
  return {
    modo: 'button', rodape: 'Assistente do CRM',
    texto: `📝 *Nova atividade*\nPara: *${r.responsavel_nome.split(' ')[0]}*\nO quê: ${r.titulo}\nVence: *${rotuloPrazo(r.prazo)}*`,
    opcoes: [{ id: `ativ_ok_${chave}`, texto: 'Confirmar' }, { id: `ativ_no_${chave}`, texto: 'Cancelar' }],
  };
}

export function lerBotaoTarefa(botaoId: string | null | undefined): { ok: boolean; chave: string } | null {
  const m = (botaoId || '').match(/^ativ_(ok|no)_([a-z0-9]+)$/);
  return m ? { ok: m[1] === 'ok', chave: m[2] } : null;
}

export const AJUDA_TAREFA = 'Não entendi a atividade. Exemplo: *tarefa Ana ligar para Farmácia Rangel amanhã 10h*';
