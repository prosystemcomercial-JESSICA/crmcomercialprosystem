# Captura de temperatura e valor estimado no fechamento de atividade

## Contexto

Uma auditoria de UX/produto sugeriu adicionar "IA Comercial" ao CRM (score de lead, próxima ação sugerida, resposta automática de WhatsApp, etc.). Antes de construir qualquer score de IA, é necessário dado confiável para alimentá-lo. Uma auditoria direta do banco de produção mostrou:

- 199 de 206 leads ativos (97%) estão com `temperatura = "FRIO"` (o valor padrão do campo) — sinal de que o campo não é atualizado na prática pela equipe.
- 199 de 206 leads ativos (97%) estão com `valor_estimado = null`.

Um score de IA calculado sobre esses dois campos hoje teria pouquíssima variação (quase tudo baixo/vazio) e nenhum valor prático. Este sub-projeto é o pré-requisito: melhorar a captura desses dois campos no momento em que o vendedor tem a informação mais fresca — ao concluir uma atividade (ligação, reunião, visita) vinculada ao lead.

O projeto de IA Comercial (score, próxima ação, resposta automática) fica para depois, como sub-projeto separado, e só deve começar quando esses campos estiverem sendo preenchidos de forma consistente.

## Escopo

Adicionar dois campos opcionais — **Temperatura** e **Valor estimado** — ao modal de "Concluir atividade" já existente em `frontend/app/agenda/page.tsx`, pré-preenchidos com o valor atual do lead, visíveis apenas quando a atividade está vinculada a um lead. Ao confirmar a conclusão, esses valores atualizam `Lead.temperatura` e `Lead.valor_estimado` na mesma operação.

## Fora de escopo

- Score de lead calculado por IA, próxima ação sugerida por IA, melhor horário de contato, resposta automática de WhatsApp — sub-projetos futuros e separados.
- Tornar os campos obrigatórios/bloqueantes para concluir a atividade.
- Higienização retroativa dos 199 leads já com dado desatualizado — o dado melhora organicamente conforme os leads voltam a ser trabalhados.
- Qualquer mudança na tela de Leads/Kanban (o campo de temperatura editável lá já existe e não muda).

## Design

### 1. Frontend — modal de conclusão (`frontend/app/agenda/page.tsx`)

O modal de "Concluir atividade" (state `showConcluir`, form `concluirForm`) já captura resultado, duração e percepção pós-reunião (tags + nota 1-5 estrelas) — é o padrão de UX existente para "pergunta rápida ao fechar a atividade". Este projeto estende o mesmo modal, não cria um novo.

Quando `showConcluir.lead` existir, adicionar uma seção compacta abaixo dos campos de percepção:
- **Temperatura**: um seletor de 4 opções (Frio / Morno / Quente / Muito Quente), pré-selecionado com `showConcluir.lead.temperatura` atual. Reaproveita o mesmo estilo visual de badge colorido já usado na lista de Top Leads do dashboard (`FRIO` azul, `MORNO` âmbar, `QUENTE`/`MUITO_QUENTE` vermelho).
- **Valor estimado (R$)**: campo numérico opcional, pré-preenchido com `showConcluir.lead.valor_estimado` se existir, vazio caso contrário.

Novo estado no form: `concluirForm.temperatura` (string, default = temperatura atual do lead ao abrir o modal) e `concluirForm.valor_estimado` (string, default = valor atual ou vazio). Nenhum dos dois é obrigatório para habilitar o botão de concluir.

### 2. Backend — `POST /atividades/:id/concluir` (`backend/src/routes/atividades.ts`)

`ConcluirSchema` (linha 72-79) ganha dois campos opcionais:
```ts
temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE', 'MUITO_QUENTE']).optional(),
valor_estimado: z.number().positive().optional(),
```

Dentro do handler (linha 488-514), após atualizar a atividade e antes/depois de `registrarAtividadeNoLead`: se a atividade tiver `lead_id` e o body trouxer `temperatura` e/ou `valor_estimado`, atualizar o `Lead` correspondente. Reaproveitar a mesma lógica já existente em `leads.ts:602-608` (`PATCH /leads/:id`) que registra a mudança de temperatura em `LeadObservacao` (`temperatura_anterior`/`temperatura_nova`) — não duplicar essa lógica, extrair para uma função compartilhada `registrarMudancaTemperatura(prisma, leadId, temperaturaAnterior, temperaturaNova, autor)` usada nos dois lugares (`leads.ts` e `atividades.ts`).

Toda a atualização do lead é best-effort (`.catch(() => {})`), seguindo o padrão já estabelecido no arquivo — não deve bloquear a conclusão da atividade se falhar.

### 3. Dados

Nenhuma migration necessária — `Lead.temperatura` e `Lead.valor_estimado` já existem no schema. `LeadObservacao` já tem os campos de rastreamento de mudança de temperatura.

## Testes

- Concluir uma atividade vinculada a um lead, alterando a temperatura: `Lead.temperatura` atualizado, e uma `LeadObservacao` do tipo SISTEMA criada com o de-para.
- Concluir uma atividade vinculada a um lead, preenchendo valor estimado pela primeira vez (lead que tinha `null`): `Lead.valor_estimado` atualizado.
- Concluir uma atividade sem alterar nem temperatura nem valor (deixar os campos como vieram pré-preenchidos): não deve gerar `LeadObservacao` de mudança de temperatura (mesmo valor, sem diff).
- Concluir uma atividade **sem** lead vinculado: modal não mostra os campos novos, comportamento igual ao atual.
- Verificar visualmente que os badges de temperatura no seletor usam as mesmas cores já usadas em outras partes do sistema (consistência visual).
