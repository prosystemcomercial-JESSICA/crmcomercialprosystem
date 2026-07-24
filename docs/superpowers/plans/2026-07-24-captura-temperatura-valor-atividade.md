# Captura de Temperatura e Valor Estimado no Fechamento de Atividade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar temperatura e valor estimado do lead no modal de "Concluir Atividade" já existente, para que os dados que alimentarão o futuro score de IA comercial deixem de ser 97% vazios/padrão.

**Architecture:** Extensão de um modal React existente (`frontend/app/agenda/page.tsx`) com dois campos novos no form já usado para percepção pós-reunião. Backend: schema Zod do endpoint `POST /atividades/:id/concluir` ganha os dois campos opcionais; a lógica de registrar mudança de temperatura em `LeadObservacao` (hoje duplicada implicitamente só em `leads.ts`) é extraída para uma função compartilhada em `backend/src/lib/lead-temperatura.ts`, usada tanto por `leads.ts` (PATCH direto) quanto por `atividades.ts` (conclusão de atividade).

**Tech Stack:** Fastify + Prisma (backend), Next.js/React (frontend), Zod para validação — mesmo stack já usado no restante do projeto.

## Global Constraints

- Não obrigatório/bloqueante — não impedir a conclusão da atividade se os campos ficarem vazios.
- Toda atualização do lead a partir da conclusão de atividade é best-effort (`.catch(() => {})`), seguindo o padrão já usado em `backend/src/routes/atividades.ts`.
- Não criar `LeadObservacao` de mudança de temperatura quando o valor não mudou (evitar ruído no histórico).
- Reaproveitar as cores de badge de temperatura já usadas no dashboard (`FRIO` azul `#2563eb`, `MORNO` âmbar `#d97706`, `QUENTE` vermelho `#ef4444`, `MUITO_QUENTE` vermelho `#dc2626`) — ver `frontend/app/dashboard/page.tsx` linhas 555-561 (mapa `tempColors` do Top 5 Leads).
- Nenhuma migration de banco necessária — `Lead.temperatura`, `Lead.valor_estimado` e os campos de `LeadObservacao` já existem no schema.

---

## File Structure

- **Create:** `backend/src/lib/lead-temperatura.ts` — função compartilhada `registrarMudancaTemperatura`.
- **Modify:** `backend/src/routes/leads.ts` — troca a lógica inline (linhas 601-613) pela chamada à função compartilhada.
- **Modify:** `backend/src/routes/atividades.ts` — `ConcluirSchema` ganha 2 campos; handler `POST /atividades/:id/concluir` atualiza o lead; rota de listagem inclui `temperatura`/`valor_estimado` no select do lead.
- **Modify:** `frontend/app/agenda/page.tsx` — modal de conclusão ganha os 2 campos; `Atividade.lead` ganha os 2 campos no tipo; `concluirForm` ganha os 2 campos de estado; `handleConcluir` envia os 2 campos.

---

### Task 1: Função compartilhada `registrarMudancaTemperatura`

**Files:**
- Create: `backend/src/lib/lead-temperatura.ts`
- Modify: `backend/src/routes/leads.ts:601-613`

**Interfaces:**
- Produces: `export async function registrarMudancaTemperatura(prisma: PrismaClient, params: { leadId: string; temperaturaAnterior: string | null | undefined; temperaturaNova: string; autorId?: string; autorNome?: string }): Promise<void>` — cria uma `LeadObservacao` tipo SISTEMA com o de-para de temperatura e atualiza `Lead.ultima_obs_at`, **somente se** `temperaturaNova !== temperaturaAnterior`. Se os valores forem iguais, não faz nada (idempotente/silencioso).

- [ ] **Step 1: Criar a função compartilhada**

```ts
// backend/src/lib/lead-temperatura.ts
import { PrismaClient } from '@prisma/client';

// Registra a mudança de temperatura de um lead no histórico (LeadObservacao),
// só quando o valor de fato mudou — evita ruído no histórico quando o
// vendedor apenas confirma o valor já existente sem alterá-lo.
export async function registrarMudancaTemperatura(
  prisma: PrismaClient,
  params: {
    leadId: string;
    temperaturaAnterior: string | null | undefined;
    temperaturaNova: string;
    autorId?: string;
    autorNome?: string;
  },
): Promise<void> {
  const { leadId, temperaturaAnterior, temperaturaNova, autorId, autorNome } = params;
  if (!temperaturaNova || temperaturaNova === temperaturaAnterior) return;

  await prisma.leadObservacao.create({
    data: {
      lead_id: leadId,
      tipo: 'SISTEMA',
      descricao: `Temperatura alterada: ${temperaturaAnterior || '—'} → ${temperaturaNova}`,
      temperatura_anterior: temperaturaAnterior || null,
      temperatura_nova: temperaturaNova,
      created_by: autorId || 'system',
      created_by_name: autorNome || 'Sistema',
    },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { ultima_obs_at: new Date() } });
}
```

- [ ] **Step 2: Trocar a lógica inline em `leads.ts` pela função compartilhada**

Em `backend/src/routes/leads.ts`, adicionar o import no topo do arquivo (junto aos demais imports de `@/lib/*`, por volta da linha 6):

```ts
import { registrarMudancaTemperatura } from '@/lib/lead-temperatura';
```

Localizar o bloco (linhas 601-613):

```ts
      // Auto-register temperature change
      if (before && data.temperatura && data.temperatura !== before.temperatura) {
        await prisma.leadObservacao.create({
          data: {
            lead_id: id, tipo: 'SISTEMA',
            descricao: `Temperatura alterada: ${before.temperatura} → ${data.temperatura}`,
            temperatura_anterior: before.temperatura,
            temperatura_nova: data.temperatura,
            created_by: user?.id || 'system', created_by_name: 'Sistema',
          },
        });
        await prisma.lead.update({ where: { id }, data: { ultima_obs_at: new Date() } });
      }
```

Substituir por:

```ts
      // Auto-register temperature change
      if (before && data.temperatura) {
        await registrarMudancaTemperatura(prisma, {
          leadId: id,
          temperaturaAnterior: before.temperatura,
          temperaturaNova: data.temperatura,
          autorId: user?.id,
          autorNome: user?.nome || 'Sistema',
        });
      }
```

- [ ] **Step 3: Verificar compilação TypeScript**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep -i "lead-temperatura\|routes/leads"`
Expected: sem saída (nenhum erro nos arquivos tocados).

- [ ] **Step 4: Testar manualmente contra o banco (sem passar pela API)**

Rodar localmente (não precisa de servidor rodando, só o Prisma Client):

```bash
cd backend
DATABASE_URL="mysql://root:YIOmtcoslVnthbSIgIqpFTcErsHlqEgw@hayabusa.proxy.rlwy.net:15443/railway" node -e "
const { PrismaClient } = require('@prisma/client');
const { registrarMudancaTemperatura } = require('./dist/lib/lead-temperatura');
" 2>&1 || echo "Esperado falhar sem build — validação real acontece via tsc no Step 3, este passo é só para registrar que não há build step separado necessário neste projeto (roda via tsx)."
```

Expected: o `tsc --noEmit` do Step 3 já é a validação suficiente — este projeto roda TypeScript direto via `tsx`, sem etapa de build separada para o backend em dev.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/lead-temperatura.ts backend/src/routes/leads.ts
git commit -m "refactor: extrai registro de mudanca de temperatura para funcao compartilhada"
```

---

### Task 2: Backend — capturar temperatura/valor na conclusão de atividade

**Files:**
- Modify: `backend/src/routes/atividades.ts:72-79` (schema), `:159` (select do lead na listagem), `:488-514` (handler de conclusão)

**Interfaces:**
- Consumes: `registrarMudancaTemperatura` de `@/lib/lead-temperatura` (Task 1).
- Produces: `POST /atividades/:id/concluir` aceita `temperatura?: 'FRIO'|'MORNO'|'QUENTE'|'MUITO_QUENTE'` e `valor_estimado?: number` no body; `GET` de listagem de atividades retorna `lead.temperatura` e `lead.valor_estimado`.

- [ ] **Step 1: Adicionar o import da função compartilhada**

No topo de `backend/src/routes/atividades.ts`, junto aos demais imports:

```ts
import { registrarMudancaTemperatura } from '@/lib/lead-temperatura';
```

- [ ] **Step 2: Estender o `ConcluirSchema`**

Localizar (linhas 72-79):

```ts
const ConcluirSchema = z.object({
  resultado: z.string().min(1),
  duracao_minutos: z.number().optional(),
  data_realizada: z.string().datetime().optional(),
  percepcao_tags: z.array(z.enum(PERCEPCAO_TAGS)).optional(),
  percepcao_nota: z.number().int().min(1).max(5).optional(),
  percepcao_observ: z.string().optional()
});
```

Substituir por:

```ts
const TEMPERATURAS = ['FRIO', 'MORNO', 'QUENTE', 'MUITO_QUENTE'] as const;

const ConcluirSchema = z.object({
  resultado: z.string().min(1),
  duracao_minutos: z.number().optional(),
  data_realizada: z.string().datetime().optional(),
  percepcao_tags: z.array(z.enum(PERCEPCAO_TAGS)).optional(),
  percepcao_nota: z.number().int().min(1).max(5).optional(),
  percepcao_observ: z.string().optional(),
  temperatura: z.enum(TEMPERATURAS).optional(),
  valor_estimado: z.number().positive().optional()
});
```

- [ ] **Step 3: Incluir `temperatura`/`valor_estimado` no select do lead na listagem**

Localizar (linha 159):

```ts
        include: { lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true } } },
```

Substituir por:

```ts
        include: { lead: { select: { id: true, nome: true, empresa: true, email: true, telefone: true, temperatura: true, valor_estimado: true } } },
```

- [ ] **Step 4: Atualizar o lead dentro do handler de conclusão**

Localizar o handler completo (linhas 488-514):

```ts
  fastify.post('/atividades/:id/concluir', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ConcluirSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    try {
      const data: any = {
        status: 'REALIZADA',
        resultado: body.data.resultado,
        data_realizada: body.data.data_realizada ? new Date(body.data.data_realizada) : new Date()
      };
      if (body.data.duracao_minutos !== undefined) data.duracao_minutos = body.data.duracao_minutos;
      if (body.data.percepcao_tags !== undefined) data.percepcao_tags = body.data.percepcao_tags;
      if (body.data.percepcao_nota !== undefined) data.percepcao_nota = body.data.percepcao_nota;
      if (body.data.percepcao_observ !== undefined) data.percepcao_observ = body.data.percepcao_observ;

      const atividade = await prisma.atividade.update({ where: { id }, data });

      // Registra no card do LEAD que a atividade foi REALIZADA + a observação/resultado.
      await registrarAtividadeNoLead(prisma, atividade, 'REALIZADA', body.data.resultado, request).catch(() => {});

      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });
```

Substituir por:

```ts
  fastify.post('/atividades/:id/concluir', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ConcluirSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Dados inválidos', errors: body.error.errors });

    try {
      const data: any = {
        status: 'REALIZADA',
        resultado: body.data.resultado,
        data_realizada: body.data.data_realizada ? new Date(body.data.data_realizada) : new Date()
      };
      if (body.data.duracao_minutos !== undefined) data.duracao_minutos = body.data.duracao_minutos;
      if (body.data.percepcao_tags !== undefined) data.percepcao_tags = body.data.percepcao_tags;
      if (body.data.percepcao_nota !== undefined) data.percepcao_nota = body.data.percepcao_nota;
      if (body.data.percepcao_observ !== undefined) data.percepcao_observ = body.data.percepcao_observ;

      const atividade = await prisma.atividade.update({ where: { id }, data });

      // Registra no card do LEAD que a atividade foi REALIZADA + a observação/resultado.
      await registrarAtividadeNoLead(prisma, atividade, 'REALIZADA', body.data.resultado, request).catch(() => {});

      // Atualiza temperatura/valor estimado do lead vinculado (best-effort — não
      // bloqueia a conclusão da atividade se o lead não existir ou a escrita falhar).
      if (atividade.lead_id && (body.data.temperatura !== undefined || body.data.valor_estimado !== undefined)) {
        const user = (request as any).user;
        await (async () => {
          const leadAntes = await prisma.lead.findUnique({ where: { id: atividade.lead_id! }, select: { temperatura: true } });
          const leadUpdateData: any = {};
          if (body.data.valor_estimado !== undefined) leadUpdateData.valor_estimado = body.data.valor_estimado;
          if (body.data.temperatura !== undefined) leadUpdateData.temperatura = body.data.temperatura;
          if (Object.keys(leadUpdateData).length > 0) {
            await prisma.lead.update({ where: { id: atividade.lead_id! }, data: leadUpdateData });
          }
          if (body.data.temperatura !== undefined) {
            await registrarMudancaTemperatura(prisma, {
              leadId: atividade.lead_id!,
              temperaturaAnterior: leadAntes?.temperatura,
              temperaturaNova: body.data.temperatura,
              autorId: user?.id,
              autorNome: user?.nome || 'Sistema',
            });
          }
        })().catch(() => {});
      }

      return reply.send({ status: 'success', data: atividade });
    } catch (err: any) {
      if (err.code === 'P2025') return reply.status(404).send({ status: 'error', message: 'Atividade não encontrada' });
      throw err;
    }
  });
```

- [ ] **Step 5: Verificar compilação TypeScript**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep -i "routes/atividades"`
Expected: sem saída.

- [ ] **Step 6: Testar manualmente contra o banco de produção (leitura, sem alterar dado real)**

Confirmar que o schema aceita os campos novos sem quebrar uma chamada real:

```bash
cd backend
DATABASE_URL="mysql://root:YIOmtcoslVnthbSIgIqpFTcErsHlqEgw@hayabusa.proxy.rlwy.net:15443/railway" node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const atividade = await p.atividade.findFirst({ where: { lead_id: { not: null }, status: 'PENDENTE' }, select: { id: true, lead_id: true } });
  console.log('Atividade de teste (não vamos concluir de verdade):', JSON.stringify(atividade));
  const lead = atividade?.lead_id ? await p.lead.findUnique({ where: { id: atividade.lead_id }, select: { temperatura: true, valor_estimado: true } }) : null;
  console.log('Lead vinculado:', JSON.stringify(lead));
  await p.\$disconnect();
})();
"
```

Expected: retorna uma atividade pendente com lead vinculado e os campos `temperatura`/`valor_estimado` do lead (confirma que a query consegue ler esses campos — não estamos chamando o endpoint de verdade neste passo, só validando que a leitura funciona).

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/atividades.ts
git commit -m "feat: captura temperatura e valor estimado ao concluir atividade"
```

---

### Task 3: Frontend — campos no modal de Concluir Atividade

**Files:**
- Modify: `frontend/app/agenda/page.tsx:18-46` (tipo `Atividade`), `:580` (state `concluirForm`), `:782-798` (`handleConcluir`), `:1358` (abertura do modal), `:2019-2119` (JSX do modal)

**Interfaces:**
- Consumes: nenhuma dependência de outro arquivo — mudança isolada nesta página.
- Produces: `Atividade.lead` ganha `temperatura?: string` e `valor_estimado?: number | null`; `concluirForm` ganha `temperatura: string` e `valor_estimado: string`; `apiClient.concluirAtividade` (já existente, sem mudança de assinatura — aceita `any` no body hoje) passa a enviar os 2 campos novos quando preenchidos.

- [ ] **Step 1: Adicionar os campos ao tipo `Atividade`**

Localizar (linhas 18-46), especificamente a linha do campo `lead`:

```ts
  lead?: { id: string; nome: string; empresa?: string; email?: string; telefone?: string } | null;
```

Substituir por:

```ts
  lead?: { id: string; nome: string; empresa?: string; email?: string; telefone?: string; temperatura?: string; valor_estimado?: number | null } | null;
```

- [ ] **Step 2: Adicionar as constantes de opções de temperatura**

Logo após o bloco `TIPO_CONFIG` (linhas 50-58), adicionar:

```ts
const TEMPERATURA_OPCOES: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'FRIO',         label: 'Frio',         color: '#2563eb', bg: 'rgba(37,99,235,0.10)' },
  { value: 'MORNO',        label: 'Morno',        color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  { value: 'QUENTE',       label: 'Quente',       color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  { value: 'MUITO_QUENTE', label: 'Muito Quente', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
];
```

- [ ] **Step 3: Adicionar campos ao state `concluirForm`**

Localizar a declaração do state (por volta da linha 580):

```ts
  const [concluirForm, setConcluirForm] = useState<{
```

Ler as próximas linhas do objeto de tipo para saber os campos existentes, e adicionar `temperatura: string;` e `valor_estimado: string;` à interface do state. O valor inicial (segundo argumento do `useState`) também ganha `temperatura: '', valor_estimado: ''`.

Como o tipo exato das linhas seguintes não é mostrado neste plano (o arquivo pode ter mudado), o padrão a seguir é: adicionar as duas propriedades no mesmo objeto de tipo e no mesmo objeto de valor inicial que já existem para `resultado`, `duracao_minutos`, `percepcao_tags`, `percepcao_nota`, `percepcao_observ` — mesma estrutura, dois campos a mais:

```ts
temperatura: string;   // '' | 'FRIO' | 'MORNO' | 'QUENTE' | 'MUITO_QUENTE'
valor_estimado: string; // string do input numérico, convertida ao enviar
```

- [ ] **Step 4: Pré-preencher os campos ao abrir o modal**

Localizar (linha 1358):

```tsx
                        <button onClick={() => setShowConcluir(a)} style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#16a34a', border: '1.5px solid #86efac' }}>
```

Esse botão só chama `setShowConcluir(a)`. Adicionar o pré-preenchimento do form logo antes, alterando para:

```tsx
                        <button onClick={() => {
                          setConcluirForm(p => ({
                            ...p,
                            temperatura: a.lead?.temperatura || '',
                            valor_estimado: a.lead?.valor_estimado != null ? String(a.lead.valor_estimado) : '',
                          }));
                          setShowConcluir(a);
                        }} style={{ ...btnOutline, padding: '5px 10px', fontSize: 12, color: '#16a34a', border: '1.5px solid #86efac' }}>
```

Repetir o mesmo padrão no outro ponto de abertura do modal (linha 2189, dentro do `onConcluir` do detalhe):

```tsx
            onConcluir={() => { setShowDetail(null); setShowConcluir(showDetail); }}
```

Substituir por:

```tsx
            onConcluir={() => {
              setConcluirForm(p => ({
                ...p,
                temperatura: showDetail?.lead?.temperatura || '',
                valor_estimado: showDetail?.lead?.valor_estimado != null ? String(showDetail.lead.valor_estimado) : '',
              }));
              setShowDetail(null);
              setShowConcluir(showDetail);
            }}
```

- [ ] **Step 5: Adicionar os campos no JSX do modal**

Localizar o bloco do modal (linhas 2019-2119), especificamente logo após o campo de "Duração" e antes do bloco de percepção (entre as linhas 2041 e 2042):

```tsx
            <div>
              <label style={labelStyle}>Duração (minutos)</label>
              <select value={concluirForm.duracao_minutos}
                onChange={e => setConcluirForm(p => ({ ...p, duracao_minutos: e.target.value }))}
                style={inputStyle}>
                <option value="">Não informado</option>
                {DURACAO_OPCOES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {/* Percepção da reunião — só para tipo REUNIAO */}
```

Inserir entre os dois, um bloco novo (só quando a atividade tem lead vinculado):

```tsx
            {showConcluir.lead && (
              <div style={{ background: 'var(--t-primary-light)', border: '1px solid #C3DCFC', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-primary)', marginBottom: 8 }}>
                  Como está o lead agora? (opcional — ajuda a priorizar quem contatar)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {TEMPERATURA_OPCOES.map(opt => {
                    const ativo = concluirForm.temperatura === opt.value;
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setConcluirForm(p => ({ ...p, temperatura: opt.value }))}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '6px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: ativo ? opt.color : opt.bg,
                          color: ativo ? '#fff' : opt.color,
                          border: `1.5px solid ${opt.color}`,
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Valor estimado (R$)</label>
                  <input type="number" min="0" step="0.01"
                    value={concluirForm.valor_estimado}
                    onChange={e => setConcluirForm(p => ({ ...p, valor_estimado: e.target.value }))}
                    placeholder="0,00"
                    style={inputStyle} />
                </div>
              </div>
            )}
            {/* Percepção da reunião — só para tipo REUNIAO */}
```

- [ ] **Step 6: Enviar os campos ao concluir**

Localizar `handleConcluir` (linhas 782-798):

```ts
  const handleConcluir = async () => {
    if (!showConcluir) return;
    setSaving(true);
    try {
      await apiClient.concluirAtividade(showConcluir.id, {
        resultado: concluirForm.resultado,
        duracao_minutos: concluirForm.duracao_minutos ? parseInt(concluirForm.duracao_minutos) : undefined,
        percepcao_tags: concluirForm.percepcao_tags.length > 0 ? concluirForm.percepcao_tags : undefined,
        percepcao_nota: concluirForm.percepcao_nota > 0 ? concluirForm.percepcao_nota : undefined,
        percepcao_observ: concluirForm.percepcao_observ || undefined
      });
      setShowConcluir(null);
      setConcluirForm({ resultado: '', duracao_minutos: '', percepcao_tags: [], percepcao_nota: 0, percepcao_observ: '' });
      load();
    } catch { /* ignore */ }
    setSaving(false);
  };
```

Substituir por:

```ts
  const handleConcluir = async () => {
    if (!showConcluir) return;
    setSaving(true);
    try {
      await apiClient.concluirAtividade(showConcluir.id, {
        resultado: concluirForm.resultado,
        duracao_minutos: concluirForm.duracao_minutos ? parseInt(concluirForm.duracao_minutos) : undefined,
        percepcao_tags: concluirForm.percepcao_tags.length > 0 ? concluirForm.percepcao_tags : undefined,
        percepcao_nota: concluirForm.percepcao_nota > 0 ? concluirForm.percepcao_nota : undefined,
        percepcao_observ: concluirForm.percepcao_observ || undefined,
        temperatura: concluirForm.temperatura || undefined,
        valor_estimado: concluirForm.valor_estimado ? parseFloat(concluirForm.valor_estimado) : undefined
      });
      setShowConcluir(null);
      setConcluirForm({ resultado: '', duracao_minutos: '', percepcao_tags: [], percepcao_nota: 0, percepcao_observ: '', temperatura: '', valor_estimado: '' });
      load();
    } catch { /* ignore */ }
    setSaving(false);
  };
```

- [ ] **Step 7: Verificar compilação TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v "app/perdidos\|.next/dev"`
Expected: sem saída.

- [ ] **Step 8: Build de produção**

Run: `cd frontend && npm run build 2>&1 | tail -15`
Expected: build conclui com sucesso, `/agenda` listada como página gerada.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/agenda/page.tsx
git commit -m "feat: campos de temperatura e valor estimado no modal de concluir atividade"
```

---

### Task 4: Deploy e verificação final

**Files:** nenhum arquivo novo — task de verificação end-to-end.

**Interfaces:** nenhuma.

- [ ] **Step 1: Push para produção**

```bash
git push origin main
```

Expected: dispara deploy automático no Railway (backend + frontend).

- [ ] **Step 2: Aguardar o deploy e confirmar a versão no ar**

Run: `curl -s "https://crmcomercialprosystem-production-945e.up.railway.app/health" -w "\nHTTP_STATUS:%{http_code}\n"`
Expected: `versao` no JSON de resposta bate com o hash do commit do Step 1 (Task 3).

- [ ] **Step 3: Verificação funcional manual**

Abrir `/agenda` no navegador, localizar uma atividade PENDENTE vinculada a um lead, clicar em "Concluir", confirmar:
- Os campos de Temperatura e Valor estimado aparecem no modal.
- Se o lead já tinha temperatura/valor, eles vêm pré-preenchidos.
- Alterar a temperatura e o valor, preencher o resultado (obrigatório) e concluir.
- Reabrir a ficha do lead e confirmar que a temperatura mudou e que há uma nova observação de sistema no histórico com o de-para.

## Self-Review

**Spec coverage:**
- Campos Temperatura e Valor estimado no modal, pré-preenchidos → Task 3 Steps 4-5. ✅
- Não bloqueante para concluir → confirmado, `handleConcluir` continua exigindo só `concluirForm.resultado` (botão `disabled={saving || !concluirForm.resultado}`, inalterado). ✅
- Atualização best-effort do lead, sem duplicar lógica de `LeadObservacao` → Task 1 (função compartilhada) + Task 2 Step 4 (uso via `.catch(() => {})`). ✅
- Não registrar `LeadObservacao` quando o valor não muda → garantido dentro de `registrarMudancaTemperatura` (`if (!temperaturaNova || temperaturaNova === temperaturaAnterior) return;`). ✅
- Cores de badge consistentes com o dashboard → Task 3 Step 2, mesmos hex já usados em `dashboard/page.tsx`. ✅
- Sem migration → confirmado, nenhuma task altera `schema.prisma`. ✅

**Placeholder scan:** nenhum "TBD"/"TODO". O Step 3 da Task 3 tem uma ressalva explícita sobre não conhecer o tipo exato pré-existente do state (arquivo pode ter mudado desde a leitura) — isso é uma instrução operacional clara para o implementador (siga o padrão dos campos vizinhos), não um placeholder vago.

**Type consistency:** `temperatura` como `string` (não union type estrito) no frontend para simplicidade de binding com `<input>`/state, validado como enum estrito só no backend (Zod) — consistente com o padrão já usado para `percepcao_tags` no mesmo arquivo (`string[]` solto no frontend, `z.enum(...)` no backend).
