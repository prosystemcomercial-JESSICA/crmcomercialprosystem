/**
 * O Rafael responde pela Universidade Prosystem as perguntas abertas sobre funções do sistema (13/11/2026).
 * Uso no servidor (pasta backend, com o .env carregado):
 *   npx tsx scripts/rafael-responder-universidade.ts            → só simula e mostra
 *   npx tsx scripts/rafael-responder-universidade.ts --gravar   → grava as respostas e fecha as perguntas
 */
import { PrismaClient } from '@prisma/client';
import { responderPendentesPelaUniversidade } from '../src/services/especialista.service';

const prisma = new PrismaClient();
const gravar = process.argv.includes('--gravar');
responderPendentesPelaUniversidade(prisma, { simular: !gravar })
  .then(r => {
    console.log(JSON.stringify({ modo: gravar ? 'gravado' : 'simulacao', abertas: r.abertas, unicas: r.unicas, respondidas: r.respondidas.length, ficaram: r.ficaram.length }));
    for (const x of r.respondidas) console.log(JSON.stringify({ ok: true, ...x }));
    for (const x of r.ficaram) console.log(JSON.stringify({ ok: false, ...x }));
  })
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(), 3000));
