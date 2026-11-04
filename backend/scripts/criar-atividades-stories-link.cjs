// Cria as 8 atividades "postar story com link" da Jessica (pedido dela, 04/11/2026).
// Os outros 28 stories saem pela publicação automática; estes levam figurinha de link e
// precisam ser postados pelo app. Página com as imagens: https://claude.ai/artifact/MtYZisF1EKc3gEZrH2YmbC
// Uso no servidor (backend, .env carregado): node scripts/criar-atividades-stories-link.cjs [--gravar]
// Sem --gravar só mostra o que faria. Não duplica: pula se já houver a mesma atividade no mesmo horário.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const PAGINA = 'https://claude.ai/artifact/MtYZisF1EKc3gEZrH2YmbC';

const STORIES = [
  ['2026-11-05', 'Reforma tributária: sua farmácia já tem o preço de 2027?', 'https://prosystemnet.com/blog/simples-nacional-2027-prazo-opcao-ibs-cbs-farmacia-padaria/'],
  ['2026-11-12', 'Pão francês: o preço ainda paga a receita?', 'https://prosystemnet.com/blog/ficha-tecnica-padaria-padronizar-receitas-rendimento/'],
  ['2026-11-25', 'Encomenda de Natal no caderno. E se faltar?', 'https://prosystemnet.com/padaria/'],
  ['2027-01-07', 'Simples Nacional em 2027: o que fazer agora.', 'https://prosystemnet.com/blog/simples-nacional-2027-prazo-opcao-ibs-cbs-farmacia-padaria/'],
  ['2027-01-12', 'Pão que sobra também é prejuízo.', 'https://prosystemnet.com/blog/controle-de-sobras-padaria-ajustar-producao/'],
  ['2027-01-14', 'Receita eletrônica de controlados com numeração do SNCR.', 'https://prosystemnet.com/blog/sncr-receita-eletronica-controlados-farmacia-2026/'],
  ['2027-01-22', 'Cliente ProSystem, conte como é o seu dia a dia.', null],
  ['2027-01-30', 'Carnaval em 9/2. A fornada já está planejada?', 'https://prosystemnet.com/blog/controle-de-sobras-padaria-ajustar-producao/'],
];

function descricao(titulo, link) {
  return [
    `Story do Instagram com figurinha de link: "${titulo}"`,
    `1. Abra ${PAGINA} (parte "Postar pelo app"), segure o dedo na imagem deste dia e salve no celular.`,
    '2. No Instagram, abra um story novo e escolha a imagem.',
    link
      ? `3. Toque em figurinhas > Link e cole: ${link}`
      : '3. No Perfil da Empresa no Google, toque em "Pedir avaliações" e copie o link. Depois, no story: figurinhas > Link e cole esse link.',
    '4. Ponha a figurinha logo abaixo de "Toque no link ↓", na faixa livre da arte, e publique.',
  ].join('\n');
}

(async () => {
  const gravar = process.argv.includes('--gravar');
  const us = await p.usuarioCRM.findMany({
    where: { OR: [{ nome: { contains: 'Jessica' } }, { nome: { contains: 'Jéssica' } }] },
    select: { id: true, nome: true, telefone: true },
  });
  if (us.length !== 1) { console.log('Esperava 1 usuária Jessica, achei:', us.map(u => u.nome)); process.exit(1); }
  const j = us[0];
  console.log(`Responsável: ${j.nome} (${j.id}) · telefone ${j.telefone ? 'cadastrado' : 'FALTANDO (o lembrete no WhatsApp não sai)'}`);
  for (const [dia, titulo, link] of STORIES) {
    const data_prevista = new Date(`${dia}T17:00:00-03:00`);
    const t = `Postar story com link: ${titulo}`;
    const ja = await p.atividade.findFirst({ where: { titulo: t, data_prevista } });
    if (ja) { console.log(`já existe  ${dia} 17h  ${titulo}`); continue; }
    if (gravar) {
      await p.atividade.create({ data: {
        tipo: 'TAREFA', vinculo_tipo: 'MARKETING', vinculo_nome: 'Instagram · stories', titulo: t,
        descricao: descricao(titulo, link), link_externo: link, status: 'PENDENTE',
        responsavel_id: j.id, created_by: j.id, data_prevista, duracao_minutos: 15,
      } });
    }
    console.log(`${gravar ? 'criada    ' : 'criaria   '} ${dia} 17h  ${titulo}`);
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
