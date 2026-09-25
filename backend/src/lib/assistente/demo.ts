// Demonstração marcada pelo próprio lead (Fase 1 do assistente): horários livres
// em janelas fixas no fuso de São Paulo, menu de horários e textos. Puro.

import type { MenuWhatsapp } from '../../services/evolution.service';
import { meiaNoiteNoFuso, partesNoFuso } from '../painel-tv';

export const JANELAS = [[9, 12], [14, 17]] as const; // horas locais (início, fim)
export const DURACAO_MIN = 30;
export const ANTECEDENCIA_MIN = 120;
export const DIAS_A_FRENTE = 7;
export const MAX_OPCOES = 10; // limite da lista do WhatsApp

type Intervalo = { inicio: Date; fim: Date };

const diaSemanaSP = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  .indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(d));

/** Próximos horários livres (seg–sex, janelas fixas), sem conflito com reuniões marcadas. */
export function gerarHorarios(agora: Date, ocupados: Intervalo[], max = MAX_OPCOES): Date[] {
  const minimo = agora.getTime() + ANTECEDENCIA_MIN * 60000;
  const hoje = partesNoFuso(agora);
  const out: Date[] = [];
  for (let d = 0; d <= DIAS_A_FRENTE && out.length < max; d++) {
    const ref = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + d));
    const meiaNoite = meiaNoiteNoFuso(ref.getUTCFullYear(), ref.getUTCMonth() + 1, ref.getUTCDate());
    const dsem = diaSemanaSP(new Date(meiaNoite.getTime() + 12 * 3600000));
    if (dsem === 0 || dsem === 6) continue;
    for (const [ini, fim] of JANELAS) {
      for (let m = ini * 60; m + DURACAO_MIN <= fim * 60 && out.length < max; m += DURACAO_MIN) {
        const inicio = new Date(meiaNoite.getTime() + m * 60000);
        const final = new Date(inicio.getTime() + DURACAO_MIN * 60000);
        if (inicio.getTime() < minimo) continue;
        if (ocupados.some(o => inicio < o.fim && final > o.inicio)) continue;
        out.push(inicio);
      }
    }
  }
  return out;
}

export const rotuloHorario = (d: Date) => {
  const s = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return s.replace('.', '').replace(/,/g, ' ·').replace(/\s+/g, ' ').replace(/^./, c => c.toUpperCase());
};

export function menuHorarios(slots: Date[]): MenuWhatsapp {
  return {
    modo: 'list', botaoLista: 'Ver horários', secao: 'Horários livres', rodape: 'Prosystem Sistemas',
    texto: 'Quer ver o sistema funcionando? 🖥️ Escolha um horário para uma demonstração online de 30 minutos com a nossa especialista:',
    opcoes: slots.map(s => ({ id: `demo_${Math.round(s.getTime() / 60000)}`, texto: rotuloHorario(s) })),
  };
}

export function lerBotaoDemo(botaoId: string | null | undefined): Date | null {
  const m = (botaoId || '').match(/^demo_(\d{7,})$/);
  return m ? new Date(Number(m[1]) * 60000) : null;
}

export const querRemarcar = (texto: string | null | undefined) =>
  /^\s*(remarcar|reagendar|mudar (o )?hor[aá]rio|trocar (o )?hor[aá]rio)\b/i.test(texto || '');

export const textoConfirmacaoDemo = (d: Date) =>
  `✅ Demonstração marcada para *${rotuloHorario(d)}*!\n\nVocê recebe o lembrete 2 horas antes. Se precisar mudar, é só responder *remarcar*.`;

export const textoLembreteDemo = (d: Date, link: string | null) =>
  `⏰ Lembrete: sua demonstração da Prosystem é hoje às *${rotuloHorario(d).split(' · ').pop()}*.${link ? `\nLink da reunião: ${link}` : '\nNossa especialista vai te mandar o link da reunião por aqui.'}`;

export const TEXTO_HORARIO_OCUPADO = 'Esse horário acabou de ser ocupado. 😕 Escolha outro:';
export const TEXTO_SEM_HORARIOS = 'No momento não há horários livres nos próximos dias. Nossa especialista vai te chamar para combinar. 😊';
