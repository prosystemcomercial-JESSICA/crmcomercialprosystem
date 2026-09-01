// backend/scripts/seed-resultado-anual-2025.ts
// Roda 1x (idempotente — upsert por ano): grava o fechamento comercial de 2025
// extraído da apresentação "Balanço Crítico 2025" (PDF entregue pela supervisão
// comercial), para servir de base de comparação com 2026 no dashboard.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const resultado = await prisma.resultadoAnualHistorico.upsert({
    where: { ano: 2025 },
    create: {
      ano: 2025,

      meta_contratos: 120,
      meta_receita_setup: 120000,
      meta_receita_servicos: 30000,

      novos_contratos: 53,
      receita_instalacao: 67133,
      ticket_medio_instalacao: 1266.66,
      receita_servicos: 29991,
      ticket_medio_servicos: 335.10,
      receita_recorrente_anual: 213060,
      ticket_medio_mensalidade: 17760 / 53,
      faturamento_direto_total: 97124, // 67.133 (instalação) + 29.991 (serviços) ≈ caixa direto do ano

      contratos_encerrados: 68,
      churn_valor_mensal: 19982,
      churn_valor_anualizado: 239784, // 19.982 * 12 (perda anualizada estimada, conforme slide de planejamento 2026)

      entradas_por_estado: [
        { estado: 'ESPIRITO SANTO', quantidade: 37 },
        { estado: 'PARÁ', quantidade: 4 },
        { estado: 'GOIÁS', quantidade: 2 },
        { estado: 'RIO DE JANEIRO', quantidade: 2 },
        { estado: 'TOCANTINS', quantidade: 1 },
        { estado: 'RONDÔNIA', quantidade: 1 },
        { estado: 'MATO GROSSO', quantidade: 1 },
        { estado: 'PARANÁ', quantidade: 1 },
        { estado: 'MINAS GERAIS', quantidade: 1 },
      ],

      entradas_por_cidade: [
        { cidade: 'São Mateus', quantidade: 7 },
        { cidade: 'Cariacica', quantidade: 4 },
        { cidade: 'Vitória', quantidade: 4 },
        { cidade: 'Vila Velha', quantidade: 4 },
        { cidade: 'Serra', quantidade: 3 },
        { cidade: 'Uruará', quantidade: 2 },
        { cidade: 'Marataízes', quantidade: 2 },
        { cidade: 'Piúma', quantidade: 2 },
        { cidade: 'Bom Jesus do Itabapoana', quantidade: 2 },
        { cidade: 'Goiás', quantidade: 1 },
        { cidade: 'Guarapari', quantidade: 1 },
        { cidade: 'Araguaína', quantidade: 1 },
        { cidade: 'São Sebastião da Boa Vista', quantidade: 1 },
        { cidade: 'Aripuanã', quantidade: 1 },
        { cidade: 'Pedro Canário', quantidade: 1 },
        { cidade: 'Santa Helena de Goiás', quantidade: 1 },
        { cidade: 'Itapemirim', quantidade: 1 },
        { cidade: 'Sooretama', quantidade: 1 },
        { cidade: 'Xinguara', quantidade: 1 },
        { cidade: 'Ponta Grossa', quantidade: 1 },
        { cidade: 'Vargem Alta', quantidade: 1 },
        { cidade: 'Mantena', quantidade: 1 },
        { cidade: 'Ji-Paraná', quantidade: 1 },
        { cidade: 'Brejetuba', quantidade: 1 },
        { cidade: 'Anchieta', quantidade: 1 },
        { cidade: 'Iconha', quantidade: 1 },
        { cidade: 'Itarana', quantidade: 1 },
        { cidade: 'Laranja da Terra', quantidade: 1 },
      ],

      entradas_por_segmento: [
        { segmento: 'DROGARIA', quantidade: 42 },
        { segmento: 'VAREJO', quantidade: 5 },
        { segmento: 'PADARIA/RESTAURANTES', quantidade: 3 },
      ],

      planos_mais_contratados: [
        { plano: 'FARMA PLUS', quantidade: 30 },
        { plano: 'FARMA PRO', quantidade: 15 },
        { plano: 'LOJA PLUS', quantidade: 5 },
        { plano: 'FARMA BASIC', quantidade: 3 },
        { plano: 'LOJA PRO', quantidade: 0 },
        { plano: 'MEI', quantidade: 0 },
        { plano: 'LOJA BASIC', quantidade: 0 },
      ],

      saida_por_segmento: [
        { segmento: 'DROGARIA', quantidade: 59 },
        { segmento: 'VAREJO', quantidade: 7 },
        { segmento: 'PADARIA/RESTAURANTES', quantidade: 2 },
      ],

      motivos_saida: [
        { motivo: 'Loja fechou / Empresa encerrada / Baixa de CNPJ', quantidade: 9 },
        { motivo: 'Venda da loja / Troca de sistema', quantidade: 2 },
        { motivo: 'Desistência / Uso parcial do sistema', quantidade: 3 },
        { motivo: 'Mudança societária', quantidade: 1 },
        { motivo: 'Sem retorno', quantidade: 1 },
      ],

      // Meses com maior volume de saída, conforme observação do slide
      // (o PDF não detalha quantidade exata por mês, apenas destaca os picos)
      saida_por_mes: [
        { mes: 'FEVEREIRO', destaque: true },
        { mes: 'MARÇO', destaque: true },
        { mes: 'MAIO', destaque: true },
        { mes: 'SETEMBRO', destaque: true },
        { mes: 'DEZEMBRO', destaque: true },
      ],

      observacoes:
        'Importado da apresentação "Balanço Crítico 2025" (PDF, supervisão comercial Jessica Cardoso). ' +
        'Motivos de saída são "DADOS PARCIAIS" conforme o próprio slide original (9+2+3+1+1=16 de 68 encerrados). ' +
        'Meta 2025: 120 contratos / R$120k instalação / R$30k serviços — atingido: 53 contratos (44%), ' +
        'R$67.133 instalação (56%), R$29.991 serviços (100%).',

      created_by: 'seed-script',
    },
    update: {},
  });

  console.log('ResultadoAnualHistorico 2025 gravado:', resultado.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
