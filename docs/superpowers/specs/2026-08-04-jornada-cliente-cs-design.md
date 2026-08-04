# Jornada do Cliente (CS & Ativos) — Design

## Contexto e motivação

O CRM Prosystem já mede *resultado* de retenção — Health Score, Casos de Churn, contatos de Ativos — mas não mostra **em qual fase da jornada** e **em qual ponto de contato específico** a experiência do cliente piorou. Também trata toda a carteira com o mesmo nível de atenção, independente de tamanho ou risco.

Esta feature adapta duas referências de mercado (o Customer Journey Map da Starbucks — fases × pontos de contato acima/abaixo de uma linha de base — e a pirâmide de modelos de CS por nível de "toque") ao contexto real da Prosystem, usando o máximo possível dos dados já existentes no sistema.

Três peças, construídas nesta ordem:

1. **Fases da jornada** — modelo fixo de 7 fases pelas quais todo cliente passa.
2. **Touchpoints por fase** — o que medir em cada fase, majoritariamente de dados já existentes; 2 touchpoints novos (Treinamento, Primeira Operação) via checklist manual.
3. **Nível de CS dinâmico** — Alto toque / Padrão / Baixo toque, recalculado por MRR + tempo de casa + Health Score.

## Peça 1 — Fases da jornada

Fases fixas, nesta ordem, com Risco/Saída como desvios possíveis a partir de qualquer fase:

| # | Fase | Do que se trata | Como o sistema já sabe que o cliente está nela |
|---|------|------------------|--------------------------------------------------|
| 1 | Pré-venda | Lead até proposta aceita | `Lead`, `PropostaComercial` sem contrato assinado |
| 2 | Fechamento | Contrato assinado, aguardando início da implantação | `ContratoComercial.status = ASSINADO`, sem `data_inicio_implantacao` |
| 3 | Implantação | Instalação técnica / migração de dados em andamento | Portal de Implantação (ponte já existente) |
| 4 | Treinamento | Capacitação da equipe do cliente | Novo: `ChecklistJornada` tipo `TREINAMENTO` |
| 5 | Primeira Operação | Cliente realiza as primeiras operações reais no sistema | Novo: `ChecklistJornada` tipo `PRIMEIRA_OPERACAO` |
| 6 | Uso Contínuo | Operação estabilizada, sem eventos relevantes | Default — nenhuma condição das outras fases se aplica |
| 7 | Expansão | Vendas adicionais, upgrade de plano, cross-sell | `VendaAdicional` com `status = CONFIRMADA` nos últimos 90 dias |

**Desvios (não são fases sequenciais, sobrepõem a fase "natural" quando ativos):**

- **Risco** — `CasoChurn` aberto (status NOVO/DIAGNOSTICADO/PLANEJADO/EXECUTANDO) OU `HealthScore.nivel` em RISCO/CRÍTICO.
- **Saída** — `CasoChurn.status` em RECUPERADO/PERDIDO/SISTEMA_REMOVIDO.

A fase "atual" de um cliente é derivada, não armazenada — calculada a partir do estado dos dados relacionados no momento da consulta (ver Peça 1 — cálculo, abaixo). Isso evita um campo de status paralelo que possa dessincronizar da realidade (mesmo padrão de bug que já corrigimos nesta sessão com `Lead.status`/`etapa_comercial`).

### Cálculo da fase atual (ordem de prioridade, primeira que bater vence)

```
1. Se CasoChurn.status IN (RECUPERADO, PERDIDO, SISTEMA_REMOVIDO) → SAÍDA
2. Se CasoChurn aberto OU HealthScore.nivel IN (RISCO, CRITICO) → RISCO
3. Se Lead/Proposta sem contrato assinado → PRÉ-VENDA
4. Se ContratoComercial assinado sem implantação concluída → FECHAMENTO ou IMPLANTAÇÃO
   (IMPLANTAÇÃO se há registro no Portal de Implantação; senão FECHAMENTO)
5. Se ChecklistJornada TREINAMENTO não concluído → TREINAMENTO
6. Se ChecklistJornada PRIMEIRA_OPERACAO não concluído → PRIMEIRA OPERAÇÃO
7. Se VendaAdicional CONFIRMADA nos últimos 90 dias → EXPANSÃO
8. Senão → USO CONTÍNUO
```

## Peça 2 — Touchpoints por fase

| Fase | Touchpoint medido | Fonte | Regra "acima/abaixo da linha de base" |
|------|--------------------|-------|----------------------------------------|
| Pré-venda | Tempo até 1ª resposta ao lead | `Lead.created_at` até 1º registro em `PropostaHistorico` | Abaixo se > 24h |
| Pré-venda | Taxa de proposta aceita | `PropostaHistorico` (status ACEITA vs. total) | Informativo, sem limiar de alerta |
| Fechamento | Tempo entre aceite e assinatura | `PropostaComercial.data_aceite` → `ContratoComercial.created_at` | Abaixo se > 7 dias |
| Implantação | SLA de instalação | Portal de Implantação | Abaixo se atrasado vs. prazo combinado |
| Treinamento | Treinamento concluído + nota do cliente | `ChecklistJornada` (novo, ver abaixo) | Abaixo se nota < 4 ou não realizado em 30 dias após implantação |
| Primeira Operação | 1ª operação real registrada + nota | `ChecklistJornada` (novo) | Abaixo se não registrada em 15 dias após treinamento |
| Uso Contínuo | Health Score, NPS, tickets abertos | `HealthScore`, `PesquisaSatisfacao`, `TicketSuporte` | Abaixo se nível RISCO/CRÍTICO ou ticket aberto há +5 dias |
| Expansão | Vendas adicionais fechadas | `VendaAdicional` | Acima se houve expansão nos últimos 90 dias; neutro caso contrário (não é um "problema" não expandir) |
| Risco | Caso de churn aberto, dias em atraso | `CasoChurn` | Sempre abaixo por definição (é o desvio de risco) |
| Saída | Motivo de perda, MRR perdido | `CasoChurn`, `Cliente.mrr_perdido` | Abaixo se PERDIDO; acima (recuperação) se RECUPERADO |

### Novo: `ChecklistJornada` (model Prisma)

Cobre os 2 touchpoints sem fonte de dado hoje. Um registro por (cliente, tipo, ocorrência) — permite múltiplas tentativas se a primeira falhar (ex.: treinamento remarcado).

```prisma
model ChecklistJornada {
  id         String  @id @default(cuid())
  cliente_id String
  cliente    Cliente @relation(fields: [cliente_id], references: [id], onDelete: Cascade)

  tipo       String  // TREINAMENTO | PRIMEIRA_OPERACAO
  status     String  @default("PENDENTE") // PENDENTE | CONCLUIDO | CANCELADO
  realizado_em DateTime?
  realizado_por String?   // id do técnico/vendedor que registrou
  participantes String?  @db.Text // nomes/cargos do lado do cliente (só TREINAMENTO)

  nota_cliente Int?      // 1-5, opcional — capturado via link público (mesmo padrão de proposta)
  observacoes  String?   @db.Text

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([cliente_id, tipo])
}
```

Preenchimento: o técnico/vendedor marca "Concluído" numa tela simples (dentro da ficha do cliente ou do Portal de Implantação); opcionalmente dispara um link público de avaliação pro cliente dar a nota (reaproveitando o padrão de `public_token` já usado em `PropostaComercial`).

## Peça 3 — Nível de CS dinâmico

Substitui o tratamento uniforme atual por 3 níveis, recalculados automaticamente (mesmo cron/rotina que hoje recalcula `HealthScore`):

| Nível | Critério (combinação) | O que muda na prática |
|-------|------------------------|-------------------------|
| **Alto toque** | MRR no top 20% da base OU (cliente com < 90 dias de casa) OU Health Score em RISCO/CRÍTICO | Prioridade na fila de Ativos (aparece primeiro), frequência de contato maior (meta de cobertura mais agressiva) |
| **Padrão** | Não se encaixa em Alto toque nem Baixo toque | Fluxo atual, sem mudança |
| **Baixo toque** | MRR no bottom 30% da base E tempo de casa > 180 dias E Health Score SAUDÁVEL/EXCELENTE | Contato reativo — só entra na fila de Ativos por gatilho explícito (ticket aberto, queda de Health Score), não por rotina periódica |

Cálculo simples e explicável (sem pesos ocultos), reavaliado a cada recálculo de Health Score:

```
Se Health Score IN (RISCO, CRITICO) → Alto toque
Senão se tempo_de_casa < 90 dias → Alto toque
Senão se MRR >= percentil 80 da base → Alto toque
Senão se MRR <= percentil 30 da base E tempo_de_casa > 180 dias E Health Score IN (SAUDAVEL, EXCELENTE) → Baixo toque
Senão → Padrão
```

Armazenado em `Cliente.nivel_cs` (novo campo `String?`, valores `ALTO_TOQUE | PADRAO | BAIXO_TOQUE`), recalculado em batch — não em tempo real a cada request.

## Telas

### 1. Visão por cliente — "Jornada" (nova aba na ficha do cliente)

Layout inspirado no mapa da Starbucks, adaptado para lista vertical (mais legível em português/nomes longos que o layout de pontos dispersos original):

- Timeline horizontal com as 7 fases, fase atual destacada.
- Abaixo de cada fase, os touchpoints medidos nela: ícone verde (acima da linha de base) ou vermelho (abaixo), com o valor/data que sustenta o julgamento.
- Card lateral: nível de CS atual do cliente + motivo (qual critério bateu).
- Se em Risco/Saída: link direto para o `CasoChurn` aberto/fechado relacionado.

### 2. Visão agregada — expande o Painel da Supervisão (`/ativos`, aba já existente)

- Novo bloco "Carteira por fase da jornada": contagem de clientes em cada uma das 7 fases + quantos em desvio de Risco, num funil horizontal.
- Nova coluna na tabela "Filas por vendedor": nível de CS predominante da fila (quantos Alto/Padrão/Baixo toque).
- Filtro por nível de CS na fila de Ativos, para supervisão priorizar visualmente quem precisa de atenção.

## Fora de escopo (v1)

- Integração automática com o sistema operacional do cliente para detectar "primeira operação" automaticamente — hoje não existe esse canal; fica manual via checklist.
- Reponderação automática de pesos no cálculo de nível de CS (o cálculo é fixo e auditável nesta versão).
- Notificações/alertas proativos quando um touchpoint cai abaixo da linha de base — v1 é só visualização; alertas ficam para uma iteração seguinte.
