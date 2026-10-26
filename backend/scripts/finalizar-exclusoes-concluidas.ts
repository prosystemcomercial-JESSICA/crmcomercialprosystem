// Passa para FINALIZADO os casos de churn que já tinham as duas confirmações do CEO (retirado do suporte e
// cobrança suspensa) antes de existir o status (pedido da Jessica, 26/10/2026). Daqui em diante isso é automático.
// Mesmo fluxo do Kanban (evento na ficha do cliente e linha do tempo), em nome de quem enviou ao CEO.
// Uso (na VPS, pasta backend): npx tsx scripts/finalizar-exclusoes-concluidas.ts            → só mostra
//                              npx tsx scripts/finalizar-exclusoes-concluidas.ts --aplicar  → aplica
import { PrismaClient } from '@prisma/client';
import { STATUS_PODE_ENVIAR, chaveExclusao, lerRegistro, situacaoExclusao, statusAposConfirmacao } from '../src/lib/churn-exclusao';
import { CasoChurnService } from '../src/services/caso-churn.service';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');

(async () => {
  const casos = await prisma.casoChurn.findMany({
    where: { status: { in: STATUS_PODE_ENVIAR } },
    select: { id: true, status: true, cliente: { select: { codigo: true, nome: true } } },
  });
  const regs = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: casos.map(c => chaveExclusao(c.id)) } } });
  const porId = new Map(regs.map(r => [r.chave.replace('churn.exclusao.', ''), lerRegistro(r.valor)]));
  const service = new CasoChurnService(prisma);
  let n = 0;
  for (const c of casos) {
    const r = porId.get(c.id);
    if (!r || statusAposConfirmacao(situacaoExclusao(r), c.status) !== 'FINALIZADO') continue;
    n++;
    console.log(`- ${c.cliente.codigo || '—'} · ${c.cliente.nome}: ${c.status} → FINALIZADO`);
    if (aplicar) await service.update(c.id, { status: 'FINALIZADO' } as any, r.enviado_por);
  }
  console.log(`${n} caso(s) ${aplicar ? 'finalizado(s)' : 'a finalizar (simulação; use --aplicar)'}.`);
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
