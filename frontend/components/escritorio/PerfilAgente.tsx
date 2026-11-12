'use client';

// Perfil do agente (12/11/2026, pedido da Jessica): retrato 3/4 desenhado com a mesma aparência do boneco da sala
// (pele, cor e comprimento do cabelo, cor da roupa), personalidade e o que cada um faz com maestria.

import { VISUAL } from './SalaViva';

type Perfil = { jeito: string; maestria: string[] };

export const PERFIS: Record<string, Perfil> = {
  bia: { jeito: 'Acolhedora e rápida. Recebe todo mundo com simpatia e não deixa ninguém esperando na porta.',
    maestria: ['Triagem de novos contatos', 'Descobrir o que o lead quer logo na primeira mensagem', 'Encaminhar para a pessoa certa'] },
  lurdinha: { jeito: 'Organizada e caprichosa, a memória da equipe. Não esquece um compromisso.',
    maestria: ['Marcar demonstrações', 'Lembretes na hora certa', 'Manter a agenda sem conflito'] },
  clarice: { jeito: 'Curiosa e paciente. Gosta de explicar com calma até a dúvida sumir.',
    maestria: ['Responder dúvidas com IA', 'Transcrever áudios', 'Traduzir assunto técnico em palavras simples'] },
  luiz_felipe: { jeito: 'Persistente e cordial. Insiste sem ser chato e sabe a hora de voltar a falar.',
    maestria: ['Follow-up de propostas', 'Reaquecer negociação parada', 'Tirar a última objeção antes do fechamento'] },
  zequinha: { jeito: 'Animado e comunicativo, o mais falante do escritório.',
    maestria: ['Campanhas pelo WhatsApp', 'Mensagens curtas que chamam atenção', 'Respeitar limite e intervalo de envio'] },
  helena: { jeito: 'Calorosa e atenciosa. Faz o cliente se sentir bem cuidado depois da compra.',
    maestria: ['Boas-vindas aos clientes novos', 'Pesquisa de satisfação', 'Perceber cedo quem está insatisfeito'] },
  laya: { jeito: 'Observadora e analítica. Lê tudo, fala pouco e aprende sempre.',
    maestria: ['Analisar conversas', 'Achar padrões do que funciona e do que não funciona', 'Proteger o número do WhatsApp'] },
  marta: { jeito: 'Firme, discreta e de confiança, o braço direito da gestão.',
    maestria: ['Executar comandos da gestora', 'Avisos importantes no tempo certo', 'Conferir e completar contratos'] },
  sofia: { jeito: 'Estudiosa e inquieta. Sempre tem uma novidade do mercado para contar.',
    maestria: ['Pesquisar o setor', 'Separar notícia relevante de barulho', 'Resumir tendências para a equipe'] },
  caroline: { jeito: 'Confiante e simpática, abre conversa com qualquer pessoa.',
    maestria: ['Primeiro contato com leads das campanhas', 'Qualificar rápido', 'Levar o lead até a demonstração'] },
  julio: { jeito: 'Metódico e incansável. Vai do lead mais novo ao mais antigo sem pular ninguém.',
    maestria: ['Retomar a base de leads', 'Recuperar contato esquecido', 'Saber a hora de encerrar com educação'] },
  rafael: { jeito: 'Experiente e exigente, o professor do time.',
    maestria: ['Vendas de software', 'Escrever POPs e processos', 'Revisar conversas e apontar melhorias'] },
  olivia: { jeito: 'Atenta e estratégica. Conhece a concorrência como a palma da mão.',
    maestria: ['Monitorar concorrentes de PDV/ERP para farmácias e padarias', 'Ler avaliações e reclamações', 'Mostrar onde a Prosystem ganha'] },
  heitor: { jeito: 'Desbravador e determinado. Gosta de chegar primeiro.',
    maestria: ['Prospectar leads novos', 'Juntar o máximo de informação de cada empresa', 'Achar o contato certo do decisor'] },
  mila: { jeito: 'Próxima e cuidadosa. Lembra da história de cada cliente.',
    maestria: ['Acompanhar clientes da base', 'Renovações e ofertas de upgrade', 'Evitar cancelamento antes que aconteça'] },
  otavio: { jeito: 'Prático e técnico, resolve sem complicar.',
    maestria: ['Acompanhar instalações e treinamentos', 'Avisar o técnico na hora certa', 'Tirar dúvidas de implantação'] },
  joana: { jeito: 'Criativa e caprichosa com as palavras. Transforma pesquisa em leitura gostosa.',
    maestria: ['Escrever o Informativo Prosystem', 'Contar a notícia de um jeito claro', 'Transformar as pesquisas da Sofia em texto'] },
};

/** Retrato 3/4 (rosto virado um pouco para a esquerda), no mesmo estilo chapado dos bonecos. */
export function Retrato({ id, cor, tamanho = 112 }: { id: string; cor: string; tamanho?: number }) {
  const [cabelo, longo, pele = '#f1c27d'] = VISUAL[id] || ['#3f2a1d', false];
  return (
    <svg width={tamanho} height={tamanho * 1.25} viewBox="0 0 120 150" role="img" aria-label="Retrato" style={{ flex: '0 0 auto', borderRadius: 14, background: `${cor}1f` }}>
      {longo && <path d="M26 58 Q22 110 34 128 L88 128 Q100 110 94 58 Z" fill={cabelo} />}
      <path d="M14 150 Q16 112 60 106 Q104 112 106 150 Z" fill={cor} />
      <path d="M50 106 L60 120 L70 106" fill="#fff" opacity=".85" />
      <rect x="51" y="88" width="18" height="20" rx="6" fill={pele} />
      <ellipse cx="82" cy="68" rx="6" ry="9" fill={pele} />
      <ellipse cx="58" cy="64" rx="27" ry="31" fill={pele} />
      <path d={longo ? 'M30 66 Q26 30 60 30 Q92 30 88 62 Q76 44 46 46 Q36 52 30 66 Z' : 'M32 58 Q30 30 60 31 Q90 31 87 58 Q78 42 50 44 Q38 46 32 58 Z'} fill={cabelo} />
      <ellipse cx="46" cy="66" rx="3" ry="4" fill="#1f2937" />
      <ellipse cx="66" cy="66" rx="3" ry="4" fill="#1f2937" />
      <path d="M41 58 Q46 55 51 58 M62 58 Q67 55 72 58" stroke={cabelo} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M54 70 Q51 77 56 78" stroke="#00000033" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M47 84 Q55 90 64 84" stroke="#9f1239" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="78" r="4" fill="#f43f5e" opacity=".18" /><circle cx="72" cy="78" r="4" fill="#f43f5e" opacity=".18" />
    </svg>
  );
}

export default function PerfilAgente({ a }: { a: { id: string; nome: string; funcao?: string; cor: string } }) {
  const p = PERFIS[a.id];
  return (
    <section className="esc-cartao" aria-label={`Perfil de ${a.nome}`} style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Retrato id={a.id} cor={a.cor} />
      <div style={{ flex: '1 1 240px', minWidth: 0, display: 'grid', gap: 6 }}>
        <b style={{ fontSize: 18, color: 'var(--t-text-primary)' }}>{a.nome}</b>
        {a.funcao && <span style={{ fontSize: 13, color: a.cor, fontWeight: 700 }}>{a.funcao}</span>}
        {p && <>
          <p style={{ fontSize: 13, color: 'var(--t-text-secondary, var(--t-text-primary))', margin: 0 }}><b>Personalidade:</b> {p.jeito}</p>
          <div style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>
            <b>Faz com maestria:</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, display: 'grid', gap: 2 }}>{p.maestria.map(m => <li key={m}>{m}</li>)}</ul>
          </div>
        </>}
      </div>
    </section>
  );
}
