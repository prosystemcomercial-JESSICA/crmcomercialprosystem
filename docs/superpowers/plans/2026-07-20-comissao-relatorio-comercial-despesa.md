# Comissão gerada a pagar no Relatório Comercial + lançamento automático no Centro de Custos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no Relatório Comercial quanto de comissão (vendedor + supervisão) foi gerada no mês sobre contratos novos e vendas adicionais, e sincronizar automaticamente essas comissões como despesas (categoria COMISSAO) no Centro de Custos — incluindo o retroativo de maio e junho/2026.

**Architecture:** Backend Fastify + Prisma (MySQL via Railway, deploy roda `prisma db push` automaticamente, sem migrations versionadas). Frontend Next.js App Router. Uma função central `sincronizarLancamentosDeComissao` em `backend/src/lib/comissao-fluxo.ts` varre a tabela `Comissao` e garante o `LancamentoFinanceiro` correspondente (idempotente via novo par de campos `origem_tipo`/`origem_id`), evitando instrumentar os ~4 pontos espalhados onde `Comissao` é criada. Um novo bloco de métricas em `metricasReaisDoMes` (relatorio-comercial.ts) alimenta um novo card no frontend.

**Tech Stack:** Fastify, Prisma, Zod, Next.js (App Router), React, Tailwind, Recharts (já em uso na página, não é necessário para este card).

## Global Constraints

- Backend não tem framework de testes automatizado configurado neste diretório (`backend/src/routes`) — verificação é manual via chamadas HTTP/console, seguindo o padrão já usado no projeto (não há `*.test.ts` em `backend/src`).
- Todas as automações de best-effort no código existente usam `.catch(() => {})` para nunca quebrar o fluxo principal — seguir o mesmo padrão.
- Deploy via Railway roda `npx prisma db push --skip-generate` automaticamente (`backend/railway.toml:6`) — alterar `schema.prisma` é suficiente, sem criar migration manualmente.
- Seguir o padrão de commit+push a cada alteração concluída (preferência already registrada do usuário).

---

## File Structure

- **Modify:** `backend/prisma/schema.prisma` — adiciona `origem_tipo`/`origem_id` a `LancamentoFinanceiro` + índice único.
- **Modify:** `backend/src/lib/comissao-fluxo.ts` — nova função `sincronizarLancamentosDeComissao`.
- **Modify:** `backend/src/routes/relatorio-comercial.ts` — novo bloco `comissao_gerada` em `metricasReaisDoMes` + novo endpoint `POST /relatorio-comercial/sincronizar-comissoes`.
- **Modify:** `frontend/lib/api-client.ts` — novo método `sincronizarComissoes`.
- **Modify:** `frontend/app/relatorio-comercial/page.tsx` — novo card "💰 Comissão gerada a pagar".

---

### Task 1: Schema — campos de origem em LancamentoFinanceiro

**Files:**
- Modify: `backend/prisma/schema.prisma:2096-2121` (model `LancamentoFinanceiro`)

**Interfaces:**
- Produces: campos `origem_tipo String?` e `origem_id String?` no model `LancamentoFinanceiro`, com `@@unique([origem_tipo, origem_id], name: "uq_lancamento_origem")`.

- [ ] **Step 1: Editar o model no schema**

Em `backend/prisma/schema.prisma`, localizar o model `LancamentoFinanceiro` (linha 2096) e alterar para:

```prisma
model LancamentoFinanceiro {
  id           String   @id @default(cuid())
  tipo         String   // ENTRADA | SAIDA
  categoria    String   // SALARIO|BENEFICIO|AJUDA_CUSTO|MARKETING|COMISSAO|OUTRO_CUSTO
                        // | MENSALIDADE|INSTALACAO|SERVICO|VENDA|OUTRA_ENTRADA
  descricao    String?
  valor        Decimal  @db.Decimal(12, 2)
  recorrencia  String   @default("MENSAL") // MENSAL|ANUAL|PONTUAL|EXTRAORDINARIO
  // Competência (a que mês/ano o lançamento pertence — base dos filtros).
  competencia_ano  Int
  competencia_mes  Int     // 1-12
  data         DateTime @default(now())  // data do efetivo lançamento
  observacoes  String?  @db.Text
  // Vínculos opcionais (rastreabilidade)
  vendedor_id  String?
  cliente_id   String?
  // Origem automática (ex.: COMISSAO → Comissao.id). Null para lançamentos manuais.
  origem_tipo  String?
  origem_id    String?

  created_by   String?
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  @@index([tipo])
  @@index([categoria])
  @@index([competencia_ano, competencia_mes])
  @@index([recorrencia])
  @@unique([origem_tipo, origem_id], name: "uq_lancamento_origem")
}
```

- [ ] **Step 2: Gerar o client Prisma localmente para validar o schema**

Run: `cd backend && npx prisma generate`
Expected: `Generated Prisma Client` sem erros de sintaxe no schema.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: adiciona origem_tipo/origem_id em LancamentoFinanceiro para lancamentos automaticos idempotentes"
git push origin main
```

Nota: `prisma db push` roda automaticamente no próximo deploy (Railway `preDeployCommand`), aplicando os novos campos ao banco de produção. Não é necessário rodar push manual aqui.

---

### Task 2: Função de sincronização Comissão → LancamentoFinanceiro

**Files:**
- Modify: `backend/src/lib/comissao-fluxo.ts`

**Interfaces:**
- Consumes: `PrismaClient` do `@prisma/client`; model `Comissao` (campos `id, responsavel_id, descricao, valor_comissao, periodo, status, papel`); model `LancamentoFinanceiro` com `origem_tipo`/`origem_id` (Task 1).
- Produces: `export async function sincronizarLancamentosDeComissao(prisma: PrismaClient, filtro?: { periodoDe?: string; periodoAte?: string }): Promise<{ criados: number; jaExistiam: number; removidos: number; semPeriodo: number }>`

- [ ] **Step 1: Adicionar a função ao final de `comissao-fluxo.ts`**

Adicionar ao final do arquivo `backend/src/lib/comissao-fluxo.ts` (após `confirmarImplantacao`):

```ts
// Garante que toda Comissao ativa tenha um LancamentoFinanceiro (SAIDA, categoria
// COMISSAO) correspondente no Centro de Custos, e remove o lançamento de comissões
// que foram canceladas (recuo/distrato). Idempotente — pode rodar quantas vezes
// precisar (ex.: onReady do backend, botão manual, backfill de período).
export async function sincronizarLancamentosDeComissao(
  prisma: PrismaClient,
  filtro?: { periodoDe?: string; periodoAte?: string },
): Promise<{ criados: number; jaExistiam: number; removidos: number; semPeriodo: number }> {
  const where: any = { status: { not: 'CANCELADA' } };
  if (filtro?.periodoDe && filtro?.periodoAte) {
    where.periodo = { gte: filtro.periodoDe, lte: filtro.periodoAte };
  }
  const comissoes = await prisma.comissao.findMany({ where });

  let criados = 0, jaExistiam = 0, semPeriodo = 0;
  for (const c of comissoes) {
    if (!c.periodo || !/^\d{4}-\d{2}$/.test(c.periodo)) { semPeriodo++; continue; }
    const [anoStr, mesStr] = c.periodo.split('-');
    const existente = await prisma.lancamentoFinanceiro.findFirst({
      where: { origem_tipo: 'COMISSAO', origem_id: c.id },
      select: { id: true },
    });
    if (existente) { jaExistiam++; continue; }
    await prisma.lancamentoFinanceiro.create({
      data: {
        tipo: 'SAIDA',
        categoria: 'COMISSAO',
        recorrencia: 'PONTUAL',
        valor: c.valor_comissao,
        competencia_ano: Number(anoStr),
        competencia_mes: Number(mesStr),
        descricao: c.descricao || `Comissão ${c.papel || ''}`.trim(),
        vendedor_id: c.responsavel_id,
        origem_tipo: 'COMISSAO',
        origem_id: c.id,
        created_by: 'system',
      },
    }).catch(() => {});
    criados++;
  }

  // Remove lançamentos cuja comissão de origem foi cancelada (recuo/distrato).
  const canceladasWhere: any = { status: 'CANCELADA' };
  if (filtro?.periodoDe && filtro?.periodoAte) {
    canceladasWhere.periodo = { gte: filtro.periodoDe, lte: filtro.periodoAte };
  }
  const canceladas = await prisma.comissao.findMany({ where: canceladasWhere, select: { id: true } });
  let removidos = 0;
  for (const c of canceladas) {
    const del = await prisma.lancamentoFinanceiro.deleteMany({
      where: { origem_tipo: 'COMISSAO', origem_id: c.id },
    });
    removidos += del.count;
  }

  return { criados, jaExistiam, removidos, semPeriodo };
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: sem novos erros introduzidos por este arquivo (o projeto pode já ter erros pré-existentes em outros arquivos — confirmar que `comissao-fluxo.ts` não aparece na saída).

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/comissao-fluxo.ts
git commit -m "feat: sincronizarLancamentosDeComissao gera despesas de comissao no centro de custos"
git push origin main
```

---

### Task 3: Endpoint de sincronização + rodar no onReady

**Files:**
- Modify: `backend/src/routes/relatorio-comercial.ts`

**Interfaces:**
- Consumes: `sincronizarLancamentosDeComissao` de `backend/src/lib/comissao-fluxo.ts` (Task 2); `requireGestor` de `@/lib/scope` (já importado no arquivo).
- Produces: `POST /relatorio-comercial/sincronizar-comissoes` (query opcional `periodoDe`, `periodoAte`), retornando `{ status: 'success', data: { criados, jaExistiam, removidos, semPeriodo } }`.

- [ ] **Step 1: Importar a função no topo do arquivo**

Em `backend/src/routes/relatorio-comercial.ts`, adicionar ao bloco de imports (após a linha 5):

```ts
import { sincronizarLancamentosDeComissao } from '@/lib/comissao-fluxo';
```

- [ ] **Step 2: Rodar a sincronização completa no onReady (após o seed existente)**

Dentro do hook `fastify.addHook('onReady', ...)` já existente (linha 19-72), ao final do bloco `try`, antes do `catch`, adicionar:

```ts
      console.log('[RELATORIO] Março/2026 seedado.');
    } catch (e: any) { console.error('[RELATORIO] seed:', e?.message); }

    // Garante que toda comissão ativa tenha seu lançamento de despesa correspondente
    // no Centro de Custos (cobre também o backfill de maio/junho/2026 na primeira execução).
    try {
      const r = await sincronizarLancamentosDeComissao(prisma);
      console.log(`[RELATORIO] Sincronização comissão→despesa: ${r.criados} criados, ${r.jaExistiam} já existiam, ${r.removidos} removidos.`);
    } catch (e: any) { console.error('[RELATORIO] sincronizarLancamentosDeComissao:', e?.message); }
  });
```

(Isso substitui o fechamento original do hook `onReady` — o `});` final do hook passa a vir depois do novo bloco try/catch, não logo após o catch do seed.)

- [ ] **Step 3: Adicionar o endpoint manual, após a rota `PUT /relatorio-comercial` (final do arquivo, antes do `}` de fechamento da função)**

```ts

  // Sincroniza manualmente as comissões → despesas do Centro de Custos.
  // Opcional periodoDe/periodoAte ("YYYY-MM") para rodar só um recorte (ex.: backfill).
  fastify.post('/relatorio-comercial/sincronizar-comissoes', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = z.object({ periodoDe: z.string().optional(), periodoAte: z.string().optional() }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ status: 'error', message: 'Query inválida' });
    const resultado = await sincronizarLancamentosDeComissao(prisma, {
      periodoDe: q.data.periodoDe, periodoAte: q.data.periodoAte,
    });
    return reply.send({ status: 'success', data: resultado });
  });
}
```

Remover o `}` de fechamento duplicado que sobrar da rota anterior (o arquivo deve terminar com exatamente um `}` fechando `relatorioComercialRoutes`).

- [ ] **Step 4: Verificar compilação TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: sem novos erros em `relatorio-comercial.ts`.

- [ ] **Step 5: Rodar localmente e testar o endpoint**

Run: `cd backend && npm run dev` (aguardar log `[RELATORIO] Sincronização comissão→despesa: ...` no boot, confirmando que o onReady rodou sem erro)

Em outro terminal, com um usuário gestor autenticado (usar token real do ambiente de dev):
```bash
curl -X POST "http://localhost:3000/relatorio-comercial/sincronizar-comissoes" -H "Authorization: Bearer <token>"
```
Expected: JSON `{"status":"success","data":{"criados":N,"jaExistiam":M,"removidos":0,"semPeriodo":0}}` com `N` > 0 se houver comissões sem lançamento ainda.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/relatorio-comercial.ts
git commit -m "feat: endpoint de sincronizacao comissao-despesa + roda automaticamente no onReady"
git push origin main
```

---

### Task 4: Bloco `comissao_gerada` em metricasReaisDoMes

**Files:**
- Modify: `backend/src/routes/relatorio-comercial.ts` (função `metricasReaisDoMes`, linhas 121-263)

**Interfaces:**
- Consumes: model `Comissao` (`periodo`, `papel`, `tipo`, `valor_comissao`, `status`).
- Produces: campo `comissao_gerada` no retorno de `metricasReaisDoMes`, formato:
  ```ts
  {
    total_geral: number;
    total_vendedor: number;
    total_supervisao: number;
    total_contratos_novos: number;   // tipo CONTRATO
    total_vendas_adicionais: number; // tipo VENDA_ADICIONAL | SUPERVISAO_VENDA_ADICIONAL
  }
  ```

- [ ] **Step 1: Adicionar a consulta dentro de `metricasReaisDoMes`, após o bloco `4b) Comissões...` existente (linha 220-242)**

Inserir logo após o fechamento do objeto `comissoes` (após a linha `};` que fecha `const comissoes = {...}`, por volta da linha 242), antes do comentário `// 5) Entrada × Saída`:

```ts

    // 4c) Comissão GERADA no mês (competência = mês da venda, campo `periodo`),
    // independente do mês em que o financeiro vai pagar. Isso alimenta o card
    // "Comissão gerada a pagar" do relatório — soma contratos novos + vendas adicionais.
    const mesCompetencia = `${ano}-${String(mes).padStart(2, '0')}`;
    const comissoesGeradasMes = await prisma.comissao.findMany({
      where: { periodo: mesCompetencia, status: { not: 'CANCELADA' } },
      select: { papel: true, tipo: true, valor_comissao: true },
    }).catch(() => [] as any[]);
    const vendasAdicionaisTipos = ['VENDA_ADICIONAL', 'SUPERVISAO_VENDA_ADICIONAL'];
    const comissao_gerada = {
      total_geral: Math.round(comissoesGeradasMes.reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_vendedor: Math.round(comissoesGeradasMes.filter((c: any) => c.papel === 'VENDEDOR').reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_supervisao: Math.round(comissoesGeradasMes.filter((c: any) => c.papel === 'SUPERVISAO').reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_contratos_novos: Math.round(comissoesGeradasMes.filter((c: any) => c.tipo === 'CONTRATO').reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
      total_vendas_adicionais: Math.round(comissoesGeradasMes.filter((c: any) => vendasAdicionaisTipos.includes(c.tipo)).reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0)),
    };
```

- [ ] **Step 2: Incluir `comissao_gerada` no objeto de retorno de `metricasReaisDoMes`**

Localizar o `return` da função (linha 254-263):

```ts
    return {
      total_leads: totalLeads,
      fechamentos: { total: totalFechamentos, setup_total: Math.round(setupTotal), setup_medio: setupMedio, mrr_total: Math.round(mrrGanhoTotal), mrr_medio: mrrMedio, lista: fechamentos_lista },
      perdidos: { total: totalPerdidos, mrr_perdido_total: Math.round(mrrPerdidoTotal), lista: perdidos_lista },
      indicacoes: { total: indicacoes_lista.length, lista: indicacoes_lista },
      vendas_adicionais,
      comissoes,
      comissao_gerada,
      entrada_x_saida,
    };
  }
```

- [ ] **Step 3: Incluir `comissao_gerada` também no consolidado anual (`metricasDoAno`, linhas 267-304)**

Em `metricasDoAno`, adicionar ao `somaL`:

```ts
    const comissaoGeradaTotal = somaL(x => x.comissao_gerada?.total_geral || 0);
    const comissaoGeradaVendedor = somaL(x => x.comissao_gerada?.total_vendedor || 0);
    const comissaoGeradaSupervisao = somaL(x => x.comissao_gerada?.total_supervisao || 0);
    const comissaoGeradaContratos = somaL(x => x.comissao_gerada?.total_contratos_novos || 0);
    const comissaoGeradaVendasAdicionais = somaL(x => x.comissao_gerada?.total_vendas_adicionais || 0);
```

E no `return` de `metricasDoAno`, adicionar o campo:

```ts
      comissoes: { total: 0, total_valor: 0, pagas_valor: 0, a_pagar_valor: 0, lista: [] },
      comissao_gerada: {
        total_geral: comissaoGeradaTotal, total_vendedor: comissaoGeradaVendedor,
        total_supervisao: comissaoGeradaSupervisao, total_contratos_novos: comissaoGeradaContratos,
        total_vendas_adicionais: comissaoGeradaVendasAdicionais,
      },
      entrada_x_saida: {
```

(mantendo o restante do objeto `entrada_x_saida` já existente logo abaixo, sem alterar.)

- [ ] **Step 4: Verificar compilação TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: sem novos erros em `relatorio-comercial.ts`.

- [ ] **Step 5: Testar manualmente**

Run: `cd backend && npm run dev`, depois:
```bash
curl "http://localhost:3000/relatorio-comercial?ano=2026&mes=5" -H "Authorization: Bearer <token>" | grep -o '"comissao_gerada":{[^}]*}'
```
Expected: retorna o objeto `comissao_gerada` com valores numéricos (pode ser tudo zero se não houver comissões de período `2026-05` ainda — nesse caso confirmar rodando o mesmo curl para `mes=6` ou o mês corrente).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/relatorio-comercial.ts
git commit -m "feat: bloco comissao_gerada no relatorio comercial (mensal e anual)"
git push origin main
```

---

### Task 5: api-client — método de sincronização manual

**Files:**
- Modify: `frontend/lib/api-client.ts`

**Interfaces:**
- Produces: `apiClient.sincronizarComissoes(periodoDe?: string, periodoAte?: string): Promise<{ data: { data: { criados: number; jaExistiam: number; removidos: number; semPeriodo: number } } }>`

- [ ] **Step 1: Adicionar o método após `getRelatorioSerieAnual` (linha 1241)**

```ts
  // Sincroniza manualmente comissões → despesas do Centro de Custos.
  async sincronizarComissoes(periodoDe?: string, periodoAte?: string) {
    return this.client.post('/relatorio-comercial/sincronizar-comissoes', null, {
      params: { periodoDe, periodoAte },
    });
  }
```

- [ ] **Step 2: Verificar compilação TypeScript do frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem novos erros em `api-client.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api-client.ts
git commit -m "feat: apiClient.sincronizarComissoes"
git push origin main
```

---

### Task 6: Card "Comissão gerada a pagar" no Relatório Comercial

**Files:**
- Modify: `frontend/app/relatorio-comercial/page.tsx`

**Interfaces:**
- Consumes: `d.metricas.comissao_gerada` (formato definido na Task 4); componentes já existentes `Bloco` e `KPI` (linhas 22-49); `apiClient.sincronizarComissoes` (Task 5).

- [ ] **Step 1: Adicionar o card logo após o bloco de Vendas Adicionais (após a linha 374, antes de "Lista de indicações/vendas adicionais")**

Inserir entre o fechamento do bloco de vendas adicionais (linha 374, `})()}`) e o comentário `{/* Lista de indicações/vendas adicionais (nomes) */}` (linha 376):

```tsx

                {/* Comissão gerada no mês (vendedor + supervisão) — vai automaticamente
                    para o Centro de Custos como despesa (categoria COMISSAO). */}
                {(() => {
                  const cg = d.metricas.comissao_gerada;
                  if (!cg || cg.total_geral === 0) return null;
                  return (
                    <Bloco titulo={`💰 Comissão gerada a pagar ${sufPeriodo}`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KPI label="Total gerado" valor={fmt(cg.total_geral)} cor="text-amber-700" />
                        <KPI label="Comissão vendedor" valor={fmt(cg.total_vendedor)} cor="text-blue-700" />
                        <KPI label="Comissão supervisão" valor={fmt(cg.total_supervisao)} cor="text-indigo-700" />
                        <KPI label="Sobre contratos novos" valor={fmt(cg.total_contratos_novos)} cor="text-green-700" />
                        <KPI label="Sobre vendas adicionais" valor={fmt(cg.total_vendas_adicionais)} cor="text-teal-700" />
                      </div>
                      <p className="text-xs  mt-3">
                        Esses valores entram automaticamente como despesa (categoria "Comissão") no Centro de Custos, na competência {SufPeriodo.toLowerCase()}.
                      </p>
                    </Bloco>
                  );
                })()}