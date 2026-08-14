# Perfil SDR (Sales Development Representative) — Design

## Contexto e motivação

O CRM hoje tem dois papéis comerciais principais: `VENDEDOR` (dono do lead do início ao fim) e `SUPERVISAO_COMERCIAL` (visão total, distribui trabalho, gera relatórios). Não existe um papel dedicado a quem faz **prospecção ativa e qualificação** sem fechar venda.

A supervisora comercial quer contratar SDRs cuja função é: prospectar/cadastrar leads frios, qualificá-los (levantar dor, decisor, urgência, sistema atual, concorrente), e então a supervisão distribui esses leads qualificados para os vendedores fecharem. Ela precisa, no processo:

1. Medir volume de leads cadastrados por SDR e o quão completo é o cadastro.
2. Ter uma tela de distribuição — ver leads prontos, mandar para um vendedor, ou devolver ao SDR pedindo mais dado.
3. Rastrear o histórico dessa troca de mãos (quem atribuiu, quando, pra quem).
4. Ter visibilidade de inteligência de mercado (objeções, concorrentes, funcionalidades pedidas) agregada a partir do que os SDRs registram.
5. Acompanhar KPIs de funil do SDR (tentativas → contatos → qualificados → reuniões → vendas originadas).

## Decisões já fechadas com a usuária

- **Modelo de posse**: visibilidade compartilhada, não handoff automático de `responsavel_id`. SDR e vendedor podem ver/atuar no mesmo lead; a "troca de mãos" formal é a ação de distribuição feita pela supervisão (bloco 3).
- **Trava de fechamento**: SDR pode mover um lead até `QUALIFICADO`, mas o backend rejeita se um usuário com `role=SDR` tentar mover para `ACEITO` ou `FECHADO`.
- **Qualidade de cadastro**: indicador de % de completude por lead, calculado sobre um conjunto fixo de campos-chave (não um novo campo — é derivado on-the-fly).
- **Distribuição de leads**: reaproveita `atribuido_em`/`atribuicao_vista` já existentes no `Lead`, mas adiciona uma tabela de histórico completo (hoje só existe o último estado). Nova tela dedicada para a supervisão distribuir/devolver.
- **Devolução de lead**: a supervisão pode devolver um lead ao SDR pedindo mais informação, com motivo obrigatório — isso gera uma notificação/pendência para o SDR e conta como métrica de qualidade.
- **Inteligência de mercado**: funcionalidade nova. Novos campos estruturados no `Lead` (`concorrente_atual`, `funcionalidade_solicitada`) e taxonomia fixa para `motivo_perda` (hoje texto livre). Relatório agregado "Sensor de Mercado".
- **Taxonomia de motivo de perda/objeção**: `PRECO | JA_TEM_FORNECEDOR | SEM_ORCAMENTO | TIMING | SEM_INTERESSE | FUNCIONALIDADE_AUSENTE | OUTRO`.
- **KPIs do SDR**: painel dedicado (visão pessoal do próprio SDR + visão agregada da supervisão), **e também** uma seção dentro do `RelatorioComercial`/`/relatorio-comercial` já existente, para consolidar tudo num único relatório para CEO/supervisão.

## Fora de escopo desta spec

- Lead scoring automático/algorítmico (fica para uma iteração futura, se a taxonomia de dados capturados hoje se mostrar suficiente).
- Cadência de follow-up automatizada (sequência de disparo). O SDR usa `Atividade`/`LeadObservacao` como hoje, manualmente.
- Reativação/nutrição automatizada de leads antigos — a spec cobre apenas o cadastro/qualificação/distribuição de leads novos.

---

## Bloco 1 — Role SDR e escopo de dados

### Schema

Não há enum de role no Prisma (`UsuarioCRM.cargo` é `String`). Nenhuma migration de schema é necessária para o valor em si — basta que o backend/frontend passem a reconhecer a string `'SDR'`.

### Backend — `backend/src/lib/scope.ts`

- `ROLES_VISAO_TOTAL` permanece **sem** `SDR` — SDR é escopado como VENDEDOR (só vê o que é seu).
- `OWNER_COLUMNS.Lead` já é `['responsavel_id', 'created_by']` — SDR que cria um lead aparece automaticamente no seu escopo via `created_by`, mesmo que `responsavel_id` aponte para outra pessoa (visibilidade compartilhada, conforme decisão do Bloco de posse). Nenhuma mudança necessária aqui.

### Backend — trava de fechamento (`backend/src/routes/leads.ts`)

Na rota que atualiza `etapa_comercial`/`status_atendimento`/`status` de um lead (mover no kanban), adicionar checagem: se `user.role === 'SDR'` e o novo valor de etapa for `ACEITO` ou `FECHADO`, retornar 403 com mensagem `"SDR não pode fechar leads — encaminhe para um vendedor."`.

Precisa localizar a rota exata de atualização de etapa em `backend/src/routes/leads.ts` (provavelmente um `PATCH /leads/:id` ou `PATCH /leads/:id/etapa`) e inserir a checagem antes do update.

### Frontend — `frontend/components/dashboard/DashboardLayout.tsx`

- Adicionar `SDR` ao array `COMERCIAL` (`['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'VENDEDOR', 'SDR']`) — dá acesso a Pipeline Comercial, WhatsApp, Atividades, Agenda, Clientes.
- **Não** adicionar `SDR` a `GESTAO_COMERCIAL` nem `GESTORES` — sem acesso a Propostas, Contratos, Campanhas, Comissões, relatórios de gestão, Usuários, Importação, Auditoria, Configurações.
- Adicionar novo item de menu (grupo "Comercial" ou novo grupo "Prospecção"):
  ```typescript
  { href: '/sdr/leads-para-distribuir', icon: Send, label: 'Leads para Distribuir', roles: GESTAO_COMERCIAL },
  { href: '/sdr/desempenho', icon: Target, label: 'Meu Desempenho', roles: ['SDR'] },
  ```
- `/comercial` (Radar Comercial) hoje é `roles: ['VENDEDOR']` — decidir se SDR também vê essa tela ou se `/sdr/desempenho` a substitui para esse papel. Recomendação: manter `/comercial` fora do SDR por ora (é uma visão de vendedor com metas de fechamento, que não se aplica) e usar só `/sdr/desempenho`.

---

## Bloco 2 — Qualidade de cadastro (% de completude)

Não requer schema novo — é calculado a partir dos campos já existentes no `Lead`.

### Campos considerados no cálculo (10 campos, pesos iguais, 10% cada)

1. `telefone` ou `responsavel_telefone` (qualquer um preenchido conta)
2. `email` ou `responsavel_email`
3. `segmento`
4. `cidade`
5. `qtd_lojas`
6. `sistema_atual`
7. `responsavel_nome` (decisor)
8. `temperatura` diferente do default `'FRIO'` OU `probabilidade` preenchido (proxy de urgência avaliada)
9. `observacoes_comerciais` ou `motivo_perda`/dor registrada em `LeadObservacao`
10. `concorrente_atual` (novo campo, ver Bloco 4)

### Backend

Nova função utilitária `backend/src/lib/lead-completude.ts`:

```typescript
export function calcularCompletude(lead: {
  telefone?: string | null; responsavel_telefone?: string | null;
  email?: string | null; responsavel_email?: string | null;
  segmento?: string | null; cidade?: string | null;
  qtd_lojas?: number | null; sistema_atual?: string | null;
  responsavel_nome?: string | null; temperatura?: string | null;
  probabilidade?: number | null; observacoes_comerciais?: string | null;
  concorrente_atual?: string | null;
}): number {
  const criterios = [
    !!(lead.telefone || lead.responsavel_telefone),
    !!(lead.email || lead.responsavel_email),
    !!lead.segmento,
    !!lead.cidade,
    !!lead.qtd_lojas,
    !!lead.sistema_atual,
    !!lead.responsavel_nome,
    !!(lead.temperatura && lead.temperatura !== 'FRIO') || !!lead.probabilidade,
    !!lead.observacoes_comerciais,
    !!lead.concorrente_atual,
  ];
  const preenchidos = criterios.filter(Boolean).length;
  return Math.round((preenchidos / criterios.length) * 100);
}
```

Expor esse valor em `GET /leads` e `GET /leads/:id` (campo derivado `completude_pct` no payload de resposta, não persistido).

### Frontend

- Badge de completude na listagem de leads (`frontend/app/leads/page.tsx` ou equivalente do Pipeline): `72% completo`, cor por faixa (verde ≥80%, amarelo 50-79%, vermelho <50%).
- Mesmo badge no card de detalhe do lead.

---

## Bloco 3 — Distribuição de leads (supervisão → vendedor)

### Schema — nova tabela

```prisma
model LeadAtribuicaoHistorico {
  id              String   @id @default(cuid())
  lead_id         String
  lead            Lead     @relation(fields: [lead_id], references: [id], onDelete: Cascade)

  de_usuario_id   String?  // responsavel_id anterior (null se primeira atribuição)
  para_usuario_id String   // responsavel_id novo
  atribuido_por_id String  // quem executou a ação (supervisão)

  tipo            String   @default("DISTRIBUICAO") // DISTRIBUICAO|DEVOLUCAO
  motivo          String?  @db.Text // obrigatório quando tipo=DEVOLUCAO

  created_at      DateTime @default(now())

  @@index([lead_id])
  @@index([para_usuario_id])
  @@index([created_at])
}
```

Adicionar a relação inversa em `Lead`:

```prisma
  atribuicoes_historico LeadAtribuicaoHistorico[]
```

### Backend — novas rotas em `backend/src/routes/leads.ts`

**`POST /leads/:id/distribuir`** — `requireGestor` obrigatório.
Body: `{ para_usuario_id: string }`.
Ação: atualiza `Lead.responsavel_id = para_usuario_id`, `Lead.atribuido_em = now()`, `Lead.atribuicao_vista = false` (dispara o sininho do vendedor, comportamento já existente); cria registro em `LeadAtribuicaoHistorico` com `tipo=DISTRIBUICAO`, `de_usuario_id` = responsavel_id anterior, `atribuido_por_id` = usuário logado.

**`POST /leads/:id/devolver`** — `requireGestor` obrigatório.
Body: `{ motivo: string }` (obrigatório, mín. 5 caracteres via Zod).
Ação: atualiza `Lead.responsavel_id` de volta para `Lead.created_by` (o SDR original), `atribuido_em = now()`, `atribuicao_vista = false`; cria registro em `LeadAtribuicaoHistorico` com `tipo=DEVOLUCAO`, `motivo` preenchido.

**`GET /leads/prontos-para-distribuir`** — `requireGestor` obrigatório.
Retorna leads com `etapa_comercial = 'QUALIFICADO'` (ou `status_atendimento = 'QUALIFICADO'`, confirmar qual campo é o usado operacionalmente no kanban atual antes de implementar) e sem exclusão lógica, ordenados por `created_at`, incluindo `completude_pct` (Bloco 2) e o nome do `created_by` (SDR responsável pelo cadastro).

### Frontend — nova página `frontend/app/sdr/leads-para-distribuir/page.tsx`

- Lista de leads qualificados aguardando distribuição, com: nome da empresa, SDR que cadastrou, % completude, temperatura, tempo desde qualificação.
- Por linha: botão "Distribuir" (abre seletor de vendedor) e botão "Devolver" (abre campo de motivo obrigatório).
- Roles: `GESTAO_COMERCIAL`.

---

## Bloco 4 — Inteligência de mercado

### Schema — novos campos em `Lead`

```prisma
  concorrente_atual        String? // nome do concorrente/sistema que o lead usa hoje, se houver
  funcionalidade_solicitada String? @db.Text // funcionalidades que o lead pediu e não tem hoje
```

(`sistema_atual` já existe e cobre "qual sistema usa" — `concorrente_atual` é redundante com ele. Ver decisão de implementação: **reaproveitar `sistema_atual` como o campo de concorrente**, não criar um novo campo. Ajuste: remover `concorrente_atual` desta spec, usar `sistema_atual` no cálculo de completude do Bloco 2 e no relatório do Bloco 4.)

Campos finais a adicionar:

```prisma
  funcionalidade_solicitada String? @db.Text
```

### Taxonomia de `motivo_perda`

Hoje `motivo_perda` é `String? @db.Text` livre. Não alterar o tipo (mantém liberdade para casos "OUTRO"), mas padronizar o **valor esperado do frontend**: dropdown fixo com as opções abaixo, e um campo de texto livre exibido apenas quando `OUTRO` é selecionado (concatenado como `OUTRO: <texto>` ou guardado em `LeadPerda.motivo_outro`, que já existe para esse propósito).

Categorias: `PRECO`, `JA_TEM_FORNECEDOR`, `SEM_ORCAMENTO`, `TIMING`, `SEM_INTERESSE`, `FUNCIONALIDADE_AUSENTE`, `OUTRO`.

Isso já se alinha ao model `LeadPerda` existente, que tem `motivo` (`VarChar(100)`, cabe as chaves acima) e `motivo_outro` (`Text`, para o detalhamento).

### Backend — novo relatório

**`GET /relatorio-comercial/sensor-mercado`** (ou seção dentro da rota de relatório comercial já existente em `backend/src/routes/relatorio-comercial.ts`).
Query params: `data_inicio`, `data_fim`, `sdr_id` (opcional).
Agrega, sobre `LeadPerda` e `Lead` no período:
- Contagem por `motivo` (objeções mais recorrentes)
- Contagem por `sistema_atual` entre leads com `motivo = 'JA_TEM_FORNECEDOR'` (concorrentes mais mencionados)
- Lista de `funcionalidade_solicitada` não-nulas (texto livre, sem agregação automática — exibido como lista para leitura manual, já que não há taxonomia fixa de funcionalidades)

Roles: `GESTAO_COMERCIAL`.

### Frontend

- Nova seção "Sensor de Mercado" dentro de `/relatorio-comercial`.
- Gráfico de barras: objeções por categoria. Lista: concorrentes mais citados. Lista: funcionalidades pedidas (texto).

---

## Bloco 5 — KPIs do SDR

### Backend — novas rotas

**`GET /sdr/desempenho`** — acessível por `SDR` (vê só o próprio) e `GESTAO_COMERCIAL` (vê agregado ou filtrado por `?sdr_id=`).

Calcula, sobre um período (`data_inicio`/`data_fim`, default mês corrente):

| Métrica | Fonte |
|---|---|
| Leads cadastrados | `COUNT(Lead) WHERE created_by = sdr_id` |
| Tentativas de contato | `COUNT(Atividade) WHERE created_by = sdr_id AND tipo IN ('LIGACAO','WHATSAPP','EMAIL')` |
| Contatos efetivos | idem, `AND status = 'REALIZADA'` |
| Leads qualificados | `COUNT(Lead) WHERE created_by = sdr_id AND etapa_comercial = 'QUALIFICADO'` (contagem por ter atingido essa etapa, não só o estado atual — se o campo não guardar histórico de etapas, usar o estado atual como aproximação e documentar a limitação) |
| Reuniões agendadas | `COUNT(Atividade) WHERE created_by = sdr_id AND tipo = 'REUNIAO'` |
| Reuniões realizadas | idem, `AND status = 'REALIZADA'` |
| Leads distribuídos | `COUNT(LeadAtribuicaoHistorico) WHERE tipo='DISTRIBUICAO' AND lead.created_by = sdr_id` |
| Vendas originadas | leads com `created_by = sdr_id` que hoje têm `etapa_comercial = 'FECHADO'` |

Taxas derivadas (calculadas no backend, retornadas prontas): taxa de contato (contatos efetivos / tentativas), taxa de qualificação (qualificados / leads cadastrados), taxa de comparecimento (reuniões realizadas / agendadas), conversão qualificado→venda (vendas originadas / leads distribuídos).

### Frontend

- Nova página `frontend/app/sdr/desempenho/page.tsx`: cards de KPI + funil visual (Tentativas → Contatos → Qualificados → Reuniões → Vendas), reaproveitando o padrão visual de `painel-ceo`/`ltv` (Recharts já em uso no projeto).
- Nova seção dentro de `/relatorio-comercial`: mesmos dados, mas agregados por todos os SDRs (tabela comparativa), para a supervisão/CEO.

---

## Resumo de arquivos afetados

**Schema:**
- `backend/prisma/schema.prisma`: novo model `LeadAtribuicaoHistorico`; novo campo `Lead.funcionalidade_solicitada`.

**Backend:**
- `backend/src/lib/scope.ts`: nenhuma mudança estrutural (SDR usa o comportamento de VENDEDOR já existente via `OWNER_COLUMNS`).
- `backend/src/lib/lead-completude.ts`: novo arquivo.
- `backend/src/routes/leads.ts`: trava de fechamento para SDR; novas rotas `POST /leads/:id/distribuir`, `POST /leads/:id/devolver`, `GET /leads/prontos-para-distribuir`; expor `completude_pct` em `GET /leads` e `GET /leads/:id`.
- `backend/src/routes/relatorio-comercial.ts`: nova rota/seção `sensor-mercado`.
- `backend/src/routes/sdr.ts` (novo arquivo): rota `GET /sdr/desempenho`.

**Frontend:**
- `frontend/components/dashboard/DashboardLayout.tsx`: adicionar `SDR` a `COMERCIAL`; novos itens de menu.
- `frontend/app/sdr/leads-para-distribuir/page.tsx` (novo).
- `frontend/app/sdr/desempenho/page.tsx` (novo).
- `frontend/app/relatorio-comercial/page.tsx`: nova seção "Sensor de Mercado" + tabela comparativa de SDRs.
- Tela de leads existente (Pipeline Comercial): badge de completude; dropdown de taxonomia para `motivo_perda`.

## Pontos a confirmar durante a implementação (não bloqueiam a spec, mas precisam de checagem pontual)

- Confirmar qual campo (`etapa_comercial` vs `status_atendimento`) é o efetivamente usado pelo kanban de Pipeline Comercial hoje em produção, para aplicar a trava de fechamento e o filtro de "prontos para distribuir" no campo certo — os dois existem no schema com propósitos sobrepostos.
- Confirmar se existe histórico de mudança de etapa do lead (para o cálculo de "leads qualificados" no período, vs. só o estado atual). Se não existir, documentar a limitação no relatório (métrica reflete o estado atual, não o fluxo do período).
