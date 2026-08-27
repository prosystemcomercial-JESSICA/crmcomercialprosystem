// backend/scripts/seed-sequencia-padarias.ts
// Roda 1x (idempotente — upsert): cria a sequência "Padarias 2026" e as 12 etapas
// com o calendário exato da especificação do usuário (planilha Kanban_Campanha_Email_Padarias_Prosystem.xlsx).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ETAPAS = [
  { numero: 1,  dia_envio: 0,  assunto: 'Sua padaria vende. Mas o lucro aparece?',                          tema: null,                       fase_kanban: 'NUTRICAO_1' },
  { numero: 2,  dia_envio: 3,  assunto: 'Sua padaria está produzindo no escuro?',                           tema: 'Produção / Estoque',       fase_kanban: 'NUTRICAO_1' },
  { numero: 3,  dia_envio: 6,  assunto: 'O produto mais vendido pode ser o menos lucrativo',                tema: 'Custos / Margem',          fase_kanban: 'NUTRICAO_1' },
  { numero: 4,  dia_envio: 9,  assunto: 'O caixa da sua padaria não pode parar',                            tema: 'Caixa / TEF',              fase_kanban: 'NUTRICAO_2' },
  { numero: 5,  dia_envio: 12, assunto: 'Os números da sua padaria avisam quando algo sai do controle?',    tema: 'Gestão / Plus',            fase_kanban: 'NUTRICAO_2' },
  { numero: 6,  dia_envio: 15, assunto: 'Veja a Prosystem aplicada à rotina da sua padaria',                tema: null,                       fase_kanban: 'NUTRICAO_2' },
  { numero: 7,  dia_envio: 20, assunto: 'Quanto dinheiro está parado no seu estoque?',                      tema: 'Estoque / Compras',        fase_kanban: 'NUTRICAO_3' },
  { numero: 8,  dia_envio: 25, assunto: 'Você sabe por que uma venda não aconteceu?',                       tema: 'Vendas perdidas',          fase_kanban: 'NUTRICAO_3' },
  { numero: 9,  dia_envio: 30, assunto: 'Quem autorizou esse desconto ou cancelamento?',                    tema: 'Segurança / Auditoria',    fase_kanban: 'NUTRICAO_3' },
  { numero: 10, dia_envio: 35, assunto: 'Promoção boa gira estoque sem destruir margem',                    tema: 'Promoções',                fase_kanban: 'NUTRICAO_4' },
  { numero: 11, dia_envio: 40, assunto: 'Quanto tempo sua equipe perde separando arquivos fiscais?',        tema: 'Fiscal / Contabilidade',   fase_kanban: 'NUTRICAO_4' },
  { numero: 12, dia_envio: 45, assunto: 'Vamos analisar o que está escapando da sua operação?',             tema: 'Diagnóstico',              fase_kanban: 'NUTRICAO_4' },
];

async function main() {
  const sequencia = await prisma.sequenciaEmail.upsert({
    where: { id: 'seq-padarias-2026' },
    create: {
      id: 'seq-padarias-2026',
      nome: 'Padarias 2026',
      segmento: 'Padaria',
      ativa: true,
      descricao: '12 e-mails de reengajamento e nutrição, D+0 a D+45.',
      created_by: 'system',
    },
    update: {},
  });

  for (const e of ETAPAS) {
    const numeroFormatado = String(e.numero).padStart(2, '0');
    await prisma.sequenciaEmailEtapa.upsert({
      where: { sequencia_id_numero: { sequencia_id: sequencia.id, numero: e.numero } },
      create: {
        sequencia_id: sequencia.id,
        numero: e.numero,
        dia_envio: e.dia_envio,
        assunto: e.assunto,
        template_path: `padarias-sequencia/email-${numeroFormatado}.html`,
        tema: e.tema,
        fase_kanban: e.fase_kanban,
      },
      update: {
        dia_envio: e.dia_envio,
        assunto: e.assunto,
        template_path: `padarias-sequencia/email-${numeroFormatado}.html`,
        tema: e.tema,
        fase_kanban: e.fase_kanban,
      },
    });
  }

  console.log(`Sequência "${sequencia.nome}" (${sequencia.id}) com ${ETAPAS.length} etapas seedadas.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
