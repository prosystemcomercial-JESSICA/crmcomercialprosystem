// Contrato pela ZapSign: leitura dos dados de quem assina (mandados pelo cliente no
// WhatsApp depois do aceite) e textos das mensagens. Puro, sem banco nem rede.

export type Assinante = { nome: string | null; cpf: string | null; email: string | null };

export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

const formatarCpf = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

/**
 * Tira nome, CPF e e-mail de uma mensagem livre ("João da Silva, 123.456.789-09, joao@x.com").
 * Só aceita CPF válido; nome = trecho com 2+ palavras de letras que não é CPF nem e-mail.
 */
export function extrairAssinante(texto: string): Assinante {
  const t = (texto || '').trim();
  const email = t.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0]?.toLowerCase() || null;
  let cpf: string | null = null;
  for (const m of t.matchAll(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g)) {
    if (cpfValido(m[0])) { cpf = formatarCpf(m[0].replace(/\D/g, '')); break; }
  }
  // Palavra por palavra (\b do regex não entende acento: "João" viraria "Joã").
  const RUIDO = new Set(['nome', 'cpf', 'email', 'e-mail', 'meu', 'minha', 'é', 'e', 'sou', 'o', 'a', 'do', 'da']);
  const sobra = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, ' ').replace(/\d[\d.\-/]*/g, ' ')
    .split(/[\n,;|]+/).map(s => {
      const ws = s.replace(/:/g, ' ').split(/\s+/).filter(Boolean);
      while (ws.length && RUIDO.has(ws[0].toLowerCase())) ws.shift(); // tira "Nome:", "meu nome é"…
      return ws.join(' ');
    });
  const nome = sobra.find(s => /^[A-Za-zÀ-ÿ']+(\s+[A-Za-zÀ-ÿ']+)+$/.test(s) && s.length <= 80) || null;
  const capitaliza = (s: string) => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return { nome: nome ? capitaliza(nome) : null, cpf, email };
}

export const faltando = (a: { nome?: string | null; cpf?: string | null; email?: string | null }) =>
  [!a.nome && 'nome completo', !a.cpf && 'CPF', !a.email && 'e-mail'].filter(Boolean) as string[];

const primeiro = (n: string | null | undefined) => (n || '').trim().split(/\s+/)[0] || '';

export const textoDadosRecebidos = (nome: string | null) =>
  `Perfeito${primeiro(nome) ? `, ${primeiro(nome)}` : ''}! Recebi os dados. Assim que o contrato estiver pronto, te mando aqui o link para assinar. 😊`;

export const textoPedeFaltante = (falta: string[]) =>
  `Obrigado! Só falta ${falta.length > 1 ? `${falta.slice(0, -1).join(', ')} e ${falta[falta.length - 1]}` : falta[0]} de quem vai assinar o contrato.`;

export const textoLinkAssinatura = (nome: string | null, link: string) =>
  `${primeiro(nome) ? `${primeiro(nome)}, o` : 'O'} seu contrato com a Prosystem está pronto! ✍️\n\nÉ só abrir o link e assinar pelo celular, leva menos de 2 minutos:\n${link}`;

export const textoLembreteAssinatura = (nome: string | null, link: string) =>
  `Oi${primeiro(nome) ? `, ${primeiro(nome)}` : ''}! Passando pra lembrar do contrato: assim que assinar, já agendamos a sua implantação. 😊\n${link}`;

export const textoAssinado = (nome: string | null) =>
  `Contrato assinado! 🎉 Muito obrigado${primeiro(nome) ? `, ${primeiro(nome)}` : ''}, seja bem-vindo(a) à Prosystem. A nossa equipe de implantação vai falar com você para agendar a instalação.`;
