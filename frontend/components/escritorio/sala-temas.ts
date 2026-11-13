// Temas de feriado e conversas casuais do Escritório vivo (11/11/2026). Só visual: nada aqui é enviado
// a cliente nem gravado. As falas alternam entre as duas pessoas da conversa (1ª, 2ª, 1ª, 2ª…).

export type TemaId = 'nenhum' | 'ano_novo' | 'carnaval' | 'pascoa' | 'junina' | 'natal';
export type Dialogo = string[];
export type Tema = {
  id: TemaId; nome: string; icone: string;
  /** 'gorro' desenha o gorro de Natal; qualquer outro texto é um emoji sobre a cabeça. */
  chapeu: string | null;
  destaque: string; enfeites: string[]; varal: string; particulas: string[];
  /** Fio de luzinhas coloridas piscando no alto da parede de cada sala (Natal, 13/11/2026). */
  pisca?: boolean;
  papo: Dialogo[];
};

export const TEMAS: Record<TemaId, Tema> = {
  nenhum: { id: 'nenhum', nome: 'Sem tema', icone: '🏢', chapeu: null, destaque: '', enfeites: [], varal: '', particulas: [], papo: [] },
  natal: {
    id: 'natal', nome: 'Natal', icone: '🎄', chapeu: 'gorro', destaque: '🎄', enfeites: ['🎁', '⭐', '🔔', '🕯️'], varal: '🎄✨🎁✨', particulas: ['❄️', '❄️', '✨'], pisca: true,
    papo: [
      ['🎁 Já tirou o seu amigo secreto?', 'Tirei! Mas não conto nem sob tortura 🤐', 'Só me diz se a pessoa gosta de chocolate…', '😂 Todo mundo aqui gosta'],
      ['🎄 Quem montou a árvore do café?', 'Fui eu! Ficou torta?', 'Ficou linda. Torta, mas linda 😄'],
      ['🍗 Na sua casa a ceia tem uva-passa no arroz?', 'Tem, e eu defendo! 🙋', 'Então a gente não vai concordar nunca 😂'],
      ['🎬 Todo Natal eu revejo o mesmo filme', 'Aquele do menino sozinho em casa?', 'Esse mesmo! Nunca perde a graça 😄'],
    ],
  },
  ano_novo: {
    id: 'ano_novo', nome: 'Ano Novo', icone: '🎆', chapeu: '🥳', destaque: '🍾', enfeites: ['🎆', '🥂', '✨', '🎇'], varal: '🎆✨🥂✨', particulas: ['🎊', '✨', '🎉'],
    papo: [
      ['🥂 Qual a sua meta para o ano novo?', 'Bater a meta de vendas… e dormir mais 😴', '😂 A segunda eu duvido'],
      ['🎆 Vai passar a virada onde?', 'Na praia, de branco, pulando sete ondas 🌊', 'Pula uma por mim!'],
      ['🍇 Você come lentilha na virada?', 'Lentilha, uva e romã. Não arrisco 😅', 'Faz bem. Ano novo, carteira cheia! 💰'],
      ['✨ Esse ano passou voando', 'Passou! E a gente cresceu bastante', 'Que venha o próximo 🙌'],
    ],
  },
  carnaval: {
    id: 'carnaval', nome: 'Carnaval', icone: '🎭', chapeu: '🎭', destaque: '🥁', enfeites: ['🎭', '🎺', '🪇', '🎉'], varal: '🎭🎊🎺🎊', particulas: ['🎊', '🎉', '🟡', '🟣'],
    papo: [
      ['🎭 Vai pular Carnaval ou descansar?', 'Bloquinho de manhã, sofá à tarde 😄', 'Equilíbrio é tudo'],
      ['🥁 Qual escola você torce?', 'A que tiver o samba que gruda na cabeça 🎶', '😂 Então todas'],
      ['🎉 Já escolheu a fantasia?', 'Vou de planilha. Ninguém vai entender 📊', '😂 Eu vou entender'],
    ],
  },
  pascoa: {
    id: 'pascoa', nome: 'Páscoa', icone: '🐰', chapeu: '🐰', destaque: '🐣', enfeites: ['🥚', '🍫', '🥕', '🐥'], varal: '🥚🌷🐰🌷', particulas: ['🌸', '🥚', '🌷'],
    papo: [
      ['🍫 Ovo de colher ou ovo tradicional?', 'De colher, sem discussão 😋', 'Eu sou do tradicional. A casca é a melhor parte!'],
      ['🐰 Alguém escondeu ovos pelo escritório?', 'Achei um atrás do monitor 👀', 'Era meu! Devolve 😂'],
      ['🥚 Já acabou o seu chocolate da Páscoa?', 'Acabou na sexta. Não me julgue 🙈', '😂 O meu nem chegou no domingo'],
      ['🐟 Sexta-feira teve bacalhau aí?', 'Teve, com muito azeite 😋', 'Assim que eu gosto'],
    ],
  },
  junina: {
    id: 'junina', nome: 'Festa Junina', icone: '🔥', chapeu: '👒', destaque: '🔥', enfeites: ['🌽', '🎈', '🪗', '🥜'], varal: '🚩🏳️🚩🎏', particulas: ['✨', '🎈', '🌽'],
    papo: [
      ['🌽 Pamonha doce ou salgada?', 'Doce! E canjica de sobremesa 😋', 'Vou de milho cozido e quentão'],
      ['🪗 Vai dançar quadrilha este ano?', 'Só se eu for o noivo 🤵', '😂 Olha a cobra! É mentira!'],
      ['🔥 Quem pula a fogueira comigo?', 'Eu fico na barraca do pastel 🥟', 'Guarda um pra mim!'],
    ],
  },
};

/** Conversas de hora livre (café): filmes, novelas, séries, futebol, comida, fim de semana. */
export const PAPO_CASUAL: Dialogo[] = [
  // filmes
  ['🎬 Viu algum filme bom no fim de semana?', 'Vi um de suspense… não dormi direito 😅', 'Me passa o nome! Adoro levar susto', 'Depois não reclama 😂'],
  ['🍿 Cinema ou sofá em casa?', 'Sofá, com pipoca e cobertor 🛋️', 'Eu ainda gosto da tela grande', 'Então sábado a gente vai!'],
  ['🎬 Filme brasileiro está numa fase boa, né?', 'Está! Chorei no último que vi 🥲', 'Eu também. E depois ri no mesmo filme'],
  ['🎞️ Comédia romântica ou filme de ação?', 'Ação! Explosão e perseguição 💥', 'Eu choro em comédia romântica, confesso 🥹', '😂 Seu segredo está guardado'],
  ['🦸 Você ainda acompanha filme de super-herói?', 'Parei… são muitos para lembrar 😵', 'Eu vejo todos, até a cena depois dos créditos'],
  // novelas
  ['📺 Viu a novela ontem?', 'Vi! Não acredito no que a vilã fez 😱', 'E o mocinho que não percebe nada?', 'Novela é assim, só a gente vê 😂'],
  ['📺 Aposto que ela descobre tudo no capítulo de sábado', 'Sábado? Só no último capítulo 😄', 'Verdade, enrolam até o fim'],
  ['💍 Será que o casal da novela fica junto?', 'Fica! Novela sem casamento no final não existe', 'E com todo o elenco na igreja 😂'],
  ['📺 Novela boa era a de antigamente', 'Minha mãe fala a mesma coisa 😄', 'E reprisa tudo de tarde, eu assisto!'],
  // séries
  ['📺 Me indica uma série?', 'Estou vendo uma de investigação, viciei 🔎', 'Quantas temporadas?', 'Cinco. Boa sorte com o seu sono 😂'],
  ['😤 Me deram spoiler do final da série', 'Não! Quem faz uma coisa dessas?', 'Foi no grupo da família…', '😂 Sempre é'],
  ['🎧 Você vê série dublada ou legendada?', 'Dublada, para poder mexer no celular 📱', 'Então você não vê, você escuta 😂'],
  // futebol
  ['⚽ Viu o jogo ontem?', 'Vi… prefiro não comentar 😩', 'Meu time ganhou, estou insuportável hoje 😎', 'Deu para perceber 😂'],
  ['⚽ Esse ano o título vem!', 'Você fala isso todo ano 😄', 'E todo ano eu acredito'],
  ['🏐 Você viu o vôlei no fim de semana?', 'Vi! Que virada no último set 🙌', 'Quase caí do sofá'],
  // comida e café
  ['☕ Esse café está forte hoje', 'Do jeito que eu gosto! Acordei agora 😳', 'Vou colocar mais um pouco de leite'],
  ['🥐 Quem trouxe o pão de queijo?', 'Eu! Ainda está quentinho', 'Você é a melhor pessoa deste escritório 🧡'],
  ['🍕 Sexta combina com pizza ou com hambúrguer?', 'Pizza! Metade calabresa, metade marguerita', 'Fechado. Eu levo o refrigerante 🥤'],
  ['🍰 Tem bolo na copa!', 'De quê?', 'De cenoura com cobertura de chocolate', 'Já estou indo 🏃'],
  // fim de semana, música, dia a dia
  ['🏖️ O que vai fazer no fim de semana?', 'Praia, se o sol ajudar ☀️', 'E se chover?', 'Maratona de série e pipoca 🍿'],
  ['🎶 Que música é essa que você está cantarolando?', 'Grudou na minha cabeça desde cedo 😅', 'Agora grudou na minha também. Obrigado, viu?'],
  ['🐶 Como está o seu cachorro?', 'Comeu meu chinelo de novo 🩴', '😂 Ele tem bom gosto'],
  ['🌧️ Será que chove hoje?', 'Trouxe guarda-chuva, então não chove ☂️', 'A regra nunca falha 😄'],
  ['📚 Está lendo algum livro?', 'Um romance policial, não consigo largar', 'Me empresta quando terminar?', 'Empresto, mas devolve! 😄'],
  ['😴 Segunda-feira pede dois cafés', 'Pede três ☕☕☕', 'Bora, que a semana promete!'],
  ['🎤 Karaokê na confraternização: você canta?', 'Só sertanejo, e só o refrão 😂', 'Eu faço a segunda voz!'],
];

/** Domingo de Páscoa do ano (cálculo de Meeus/Butcher), como [mês, dia]. */
export function pascoa(ano: number): [number, number] {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return [mes, dia];
}

/** Tema do dia (data já no fuso de São Paulo). Mês de 1 a 12. */
export function temaDoDia(ano: number, mes: number, dia: number): TemaId {
  if ((mes === 12 && dia >= 27) || (mes === 1 && dia <= 2)) return 'ano_novo';
  if (mes === 12) return 'natal';
  if (mes === 6 && dia >= 10) return 'junina';
  const [pm, pd] = pascoa(ano);
  const dias = Math.round((Date.UTC(ano, pm - 1, pd) - Date.UTC(ano, mes - 1, dia)) / 86_400_000); // dias até a Páscoa
  if (dias >= 0 && dias <= 7) return 'pascoa';       // Semana Santa
  if (dias >= 46 && dias <= 51) return 'carnaval';   // da sexta à Quarta-feira de Cinzas
  return 'nenhum';
}

/** Sorteia uma conversa: com tema ativo, metade das vezes é sobre a data. Não repete a anterior. */
export function sortearDialogo(tema: TemaId, anterior?: Dialogo): Dialogo {
  const doTema = TEMAS[tema].papo;
  const base = doTema.length && Math.random() < 0.5 ? doTema : PAPO_CASUAL;
  const opcoes = base.filter(d => d !== anterior);
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}
