import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.acaoRetencao.deleteMany();
  await prisma.planoRetencao.deleteMany();
  await prisma.diagnosisChurn.deleteMany();
  await prisma.casoChurn.deleteMany();
  await prisma.credito.deleteMany();
  await prisma.campanhaDisparo.deleteMany();
  await prisma.cliente.deleteMany();

  // Seed Clientes (farmácias, padarias, varejistas - clientes ProSystem)
  const clientes = await Promise.all([
    prisma.cliente.create({
      data: {
        nome: 'João Silva',
        email: 'joao@farmaciacentral.com.br',
        telefone: '(27) 99999-1111',
        empresa: 'Farmácia Central',
        cidade: 'Vitória',
        estado: 'ES'
      }
    }),
    prisma.cliente.create({
      data: {
        nome: 'Maria Santos',
        email: 'maria@padariadoqueijo.com.br',
        telefone: '(27) 99999-2222',
        empresa: 'Padaria do Queijo',
        cidade: 'Vila Velha',
        estado: 'ES'
      }
    }),
    prisma.cliente.create({
      data: {
        nome: 'Carlos Oliveira',
        email: 'carlos@drogariasaude.com.br',
        telefone: '(27) 99999-3333',
        empresa: 'Drogaria Saúde+',
        cidade: 'Serra',
        estado: 'ES'
      }
    }),
    prisma.cliente.create({
      data: {
        nome: 'Ana Costa',
        email: 'ana@padariapaodemel.com.br',
        telefone: '(27) 99999-4444',
        empresa: 'Padaria Pão de Mel',
        cidade: 'Cariacica',
        estado: 'ES'
      }
    }),
    prisma.cliente.create({
      data: {
        nome: 'Pedro Almeida',
        email: 'pedro@varejoexpress.com.br',
        telefone: '(27) 99999-5555',
        empresa: 'Varejo Express',
        cidade: 'Vitória',
        estado: 'ES'
      }
    }),
    prisma.cliente.create({
      data: {
        nome: 'Juliana Mendes',
        email: 'juliana@farmaciapopular.com.br',
        telefone: '(27) 99999-6666',
        empresa: 'Farmácia Popular',
        cidade: 'Guarapari',
        estado: 'ES'
      }
    }),
    prisma.cliente.create({
      data: {
        nome: 'Rodrigo Pereira',
        email: 'rodrigo@padariadelicia.com.br',
        telefone: '(27) 99999-7777',
        empresa: 'Padaria Delícia',
        cidade: 'Vila Velha',
        estado: 'ES'
      }
    }),
    prisma.cliente.create({
      data: {
        nome: 'Beatriz Lima',
        email: 'beatriz@minimercado.com.br',
        telefone: '(27) 99999-8888',
        empresa: 'Mini Mercado Bom Preço',
        cidade: 'Serra',
        estado: 'ES'
      }
    })
  ]);

  console.log(`✅ Created ${clientes.length} clientes`);

  // Seed Casos de Churn com variedade de status e riscos
  const statusList = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO'];
  const motivos = [
    'Preço elevado',
    'Falta de suporte técnico',
    'Sistema lento',
    'Concorrente com melhor proposta',
    'Falta de funcionalidades',
    'Problemas de integração fiscal',
    'Dificuldade de uso',
    'Mudança de fornecedor'
  ];

  const casos: any[] = [];
  for (let i = 0; i < clientes.length; i++) {
    const cliente = clientes[i];
    const status = statusList[i % statusList.length];
    const risk_score = Math.floor(Math.random() * 100);
    const motivo = motivos[i % motivos.length];

    const caso = await prisma.casoChurn.create({
      data: {
        clienteId: cliente.id,
        status,
        risk_score,
        motivo_principal: motivo,
        created_by: 'user-supervisao'
      }
    });
    casos.push(caso);

    // Add diagnosis for some cases
    if (i % 2 === 0 && status !== 'NOVO') {
      await prisma.diagnosisChurn.create({
        data: {
          caso_churn_id: caso.id,
          motivo_principal: motivo,
          risco_score: risk_score,
          fatores: ['Cliente inativo há 30+ dias', 'Pagamento atrasado', 'Reclamações no suporte']
        }
      });
    }

    // Add planos and acoes for PLANEJADO/EXECUTANDO
    if (status === 'PLANEJADO' || status === 'EXECUTANDO') {
      const plano = await prisma.planoRetencao.create({
        data: {
          caso_churn_id: caso.id,
          titulo: `Plano de retenção - ${cliente.empresa}`,
          descricao: 'Plano estratégico para retenção do cliente',
          status: status === 'EXECUTANDO' ? 'ATIVO' : 'RASCUNHO'
        }
      });

      await prisma.acaoRetencao.create({
        data: {
          caso_churn_id: caso.id,
          plano_id: plano.id,
          titulo: 'Contato telefônico de retenção',
          descricao: 'Ligar para o cliente para entender necessidades',
          tipo: 'CONTATO',
          status: 'NOVA'
        }
      });

      await prisma.acaoRetencao.create({
        data: {
          caso_churn_id: caso.id,
          plano_id: plano.id,
          titulo: 'Oferecer desconto especial',
          descricao: 'Aplicar desconto de 15% na renovação',
          tipo: 'DESCONTO',
          status: 'EM_PROGRESSO'
        }
      });
    }
  }

  console.log(`✅ Created ${casos.length} casos de churn`);
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
