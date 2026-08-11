# Portal de Parceiros / Representantes — Design

## Contexto e motivação

A Prosystem quer abrir um novo canal de representação comercial (perfis Indicador, Representante e Franqueado, ver texto institucional abaixo) e hoje não tem nenhuma forma estruturada de captar candidaturas — seria feito por WhatsApp/e-mail avulso, sem rastro nenhum no CRM.

Este design cobre duas peças:

1. **Página pública de candidatura** — formulário sem login, no mesmo domínio do CRM, no design system Prosystem, com o texto institucional de "Venha ser parceiro".
2. **Módulo interno "Representantes"** — kanban no CRM para triar as candidaturas recebidas (Novo → Em Análise → Aprovado → Reprovado), com notificação por e-mail a cada nova candidatura.

As duas peças compartilham um único novo model de dados (`CandidatoRepresentante`): a página pública cria o registro, o módulo interno o gerencia. Não há geração automática de Usuário/Vendedor ao aprovar — isso fica manual, fora do escopo deste módulo (decisão explícita para não acoplar prematuramente a um processo pós-aprovação que ainda não está definido).

## Peça 1 — Página pública `/parceiro`

Rota Next.js nova, **sem `useAuth`/token**, servida no mesmo domínio do CRM (ex.: `https://crm.prosystem.../parceiro`).

**Conteúdo, de cima para baixo:**

1. Cabeçalho institucional com o texto fornecido pelo usuário ("Venha ser parceiro da Prosystem Desenvolvimento de Sistemas — Representação Comercial & Outsourcing", parágrafo de contexto, lista de benefícios).
2. Tabela dos 3 perfis (Indicador / Representante / Franqueado) com a descrição de cada um e o percentual pago (30% instalação / 50% instalação / 50% instalação + 50% mensalidade) — apenas informativo, não editável pelo candidato.
3. Formulário de candidatura.
4. Tela de confirmação pós-envio ("Recebemos sua candidatura, entraremos em contato em breve").

**Campos do formulário (v1 — sujeitos a ajuste quando o usuário enviar o questionário definitivo; ver Riscos):**

| Campo | Tipo | Obrigatório |
|---|---|---|
| Nome completo | texto | sim |
| Telefone / WhatsApp | texto | sim |
| E-mail | e-mail | sim |
| Cidade / Estado | texto | sim |
| Perfil desejado | select: Indicador / Representante / Franqueado | sim |
| Experiência / mensagem | textarea | não |

Estilo visual: reaproveita a paleta e componentes já usados nos e-mails/telas voltadas ao cliente (`#2E6EAB` / `#4B8EC8`, mesma tipografia e cards do restante do CRM) — não é um sistema visual novo, é a aplicação do design system Prosystem já existente a uma página pública.

**Envio:** `POST /api/candidatos-representante` (rota pública, sem `requireAuth`) → valida com zod, grava no banco, dispara e-mail de notificação, retorna sucesso. Rate limiting básico não é necessário no escopo v1 (baixo volume esperado); se abuso for observado depois, trata-se à parte.

## Peça 2 — Módulo interno "Representantes"

Rota autenticada `frontend/app/representantes/page.tsx`, item novo no menu lateral (`DashboardLayout.tsx`), papéis com acesso: os mesmos grupos que já veem Leads/Pipeline Comercial (`COMERCIAL`/gestão comercial — mesma constante `COMERCIAL` usada em `/leads`).

**Kanban com 4 colunas fixas** (não usa o model genérico `KanbanColuna`/`QuadroComercial` do Pipeline Comercial — este módulo não precisa de colunas customizáveis pelo usuário; um enum fixo é suficientemente simples e evita a complexidade de quadros dinâmicos que essa feature não pede):

```
NOVO → EM_ANALISE → APROVADO
                   → REPROVADO
```

- Card mostra: nome, perfil desejado, cidade/estado, data de envio.
- Arrastar card entre colunas atualiza `status` via `PATCH /api/candidatos-representante/:id`.
- Clique no card abre painel de detalhe com todos os campos enviados + campo de **observações internas** (texto livre, não visível ao candidato) + histórico de quem mudou o status e quando.
- Contador de candidaturas com `status = NOVO` exibido como badge no item de menu (mesmo padrão visual já usado em outros contadores do menu).

## Modelo de dados

Novo model Prisma, novo arquivo de rota `backend/src/routes/candidatos-representante.ts`, registrado em `server.ts` na lista `routeModules`.

```prisma
model CandidatoRepresentante {
  id        String   @id @default(cuid())

  nome      String
  telefone  String
  email     String
  cidade    String?
  estado    String?
  perfil_desejado String   // INDICADOR | REPRESENTANTE | FRANQUEADO
  mensagem  String?  @db.Text

  status    String   @default("NOVO") // NOVO | EM_ANALISE | APROVADO | REPROVADO
  observacoes_internas String? @db.Text

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([status])
  @@index([created_at])
}
```

**Endpoints:**

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/candidatos-representante` | pública | Cria candidatura a partir do formulário público; dispara e-mail de notificação |
| GET | `/api/candidatos-representante` | `requireAuth` | Lista candidaturas (filtro opcional por `status`) |
| GET | `/api/candidatos-representante/:id` | `requireAuth` | Detalhe de uma candidatura |
| PATCH | `/api/candidatos-representante/:id` | `requireAuth` | Atualiza `status` e/ou `observacoes_internas` |

## Notificação por e-mail

Reaproveita `backend/src/services/email.service.ts` (já usado para e-mails ao cliente, mesmo transporter SMTP configurado). Novo template simples: nome, perfil desejado, telefone, e-mail, cidade e mensagem do candidato, com um link direto para `/representantes` no CRM.

- Destinatário fixo: `jessica@prosystemnet.com.br`.
- Disparado de forma síncrona no handler do POST público, mas sem bloquear a resposta ao candidato em caso de falha de e-mail — se o envio falhar, a candidatura já foi gravada no banco (é a fonte de verdade) e aparece no módulo mesmo assim; o erro só é logado.

## Erros e validação

- Formulário público valida client-side (campos obrigatórios, formato de e-mail) e novamente no backend via zod — nunca confia só no client.
- CNPJ/CPF não fazem parte do escopo v1 (não estavam nos campos aprovados); se o questionário do usuário trouxer esse campo, é uma mudança isolada no schema/rota, sem impacto no resto do design.

## Riscos / pontos em aberto

- **Campos definitivos do formulário**: o usuário vai enviar um questionário próprio com as perguntas reais. Os 6 campos acima são um placeholder razoável para fechar a arquitetura agora; a troca dos campos é uma alteração isolada (schema Prisma + zod + JSX do form), não muda kanban, e-mail nem o resto do desenho.
- **Destinatário único de e-mail**: hoje só `jessica@prosystemnet.com.br` recebe. Se precisar de múltiplos destinatários ou vincular a um usuário do CRM, é extensão simples do template.
