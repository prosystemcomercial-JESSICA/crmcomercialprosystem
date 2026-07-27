# Tempo de resolução + Reabertura única de caso de churn

## Contexto

O fluxo de `CasoChurn` (`backend/src/services/caso-churn.service.ts`) hoje não guarda quando um caso foi resolvido (RECUPERADO ou PERDIDO) — só `created_at`/`updated_at` (sobrescrito a cada edição). Também não existe forma de reabrir um caso já dado como RECUPERADO se o cliente voltar a apresentar o mesmo problema; a única opção seria criar um caso novo, perdendo o vínculo com o diagnóstico/plano anterior.

Pedido do usuário: registrar o tempo até a resolução, permitir reabertura **uma única vez**, pelo **mesmo motivo original** (travado, não editável), e destacar visualmente o caso reaberto com uma cor própria.

## Escopo

Mudança no `CasoChurn` (schema + service) e na tela `frontend/app/casos/page.tsx`. Não afeta o fluxo de RECUPERADO/PERDIDO existente além de adicionar os novos campos — a lógica de `aplicarPerda()` e a atualização de `risco_atencao` continuam iguais.

## Design

### 1. Schema (`backend/prisma/schema.prisma`, model `CasoChurn`)

Novos campos, todos opcionais (não quebram registros existentes):

```prisma
resolvido_em             DateTime? // 1ª vez que o caso foi RECUPERADO ou PERDIDO
reaberto                 Boolean   @default(false) // liga permanentemente na reabertura, nunca desliga
reaberto_em              DateTime? // quando a reabertura aconteceu
reaberto_motivo_travado  String?   // snapshot do motivo_principal original, travado na reabertura
resolvido_em_2           DateTime? // quando o caso REABERTO foi resolvido (2ª vez)
```

### 2. Backend — `caso-churn.service.ts`

**No `update()`**: ao setar `status` para `RECUPERADO` ou `PERDIDO`, preenche o timestamp de resolução correspondente ao round atual — `resolvido_em` se ainda vazio (1ª resolução), ou `resolvido_em_2` se `reaberto === true` e `resolvido_em_2` ainda vazio (2ª resolução, pós-reabertura). Idempotente: nunca sobrescreve um valor já preenchido, seguindo o padrão já usado em `aplicarPerda()` para `inativado_em`.

**Novo método `reabrir(id: string, novoRelato: string, userId: string)`**:
- Busca o caso via `getById`.
- Valida: `status !== 'RECUPERADO'` → erro `BadRequestError('Só é possível reabrir um caso RECUPERADO')`. `reaberto === true` → erro `BadRequestError('Este caso já foi reaberto uma vez — crie um caso novo para este cliente')`.
- Atualiza: `status: 'EXECUTANDO'`, `reaberto: true`, `reaberto_em: new Date()`, `reaberto_motivo_travado: caso.motivo_principal`, `descricao: novoRelato` (substitui a descrição pelo novo relato da reabertura — o motivo original fica preservado só em `reaberto_motivo_travado`).
- Marca `Cliente.risco_atencao = true` novamente (mesma lógica do `create()`).
- Registra na timeline (`AtualizacaoCaso`): `tipo: 'STATUS', texto: 'Caso reaberto — motivo original: <motivo>'`.
- Retorna o caso atualizado.

### 3. Backend — rota

Nova rota `POST /casos/:id/reabrir` (arquivo de rotas de churn/casos — seguir o padrão de `PATCH /casos/:id` já existente), body `{ relato: string }`, chama `CasoChurnService.reabrir`.

### 4. Frontend — `frontend/app/casos/page.tsx`

- Tipo `Caso` ganha os 5 campos novos (todos opcionais).
- `STATUS_COLORS` continua igual (cor por status), mas a exibição do card/linha aplica um destaque **adicional** de cor laranja (`bg-orange-50 border-orange-300` ou equivalente) quando `caso.reaberto === true`, sobrepondo visualmente a cor do status — o usuário precisa ver "isto foi reaberto" mesmo que o status atual seja EXECUTANDO (roxo).
- Badge/tag pequena "🔄 Reaberto" ao lado do status, visível sempre que `reaberto === true`.
- Botão "Reabrir caso" na tela de detalhe do caso: visível somente quando `status === 'RECUPERADO' && !reaberto`. Ao clicar, abre modal com:
  - Motivo original (somente leitura, motivo_principal atual).
  - Campo de texto obrigatório para o novo relato ("O que aconteceu de novo?").
  - Confirmar → chama `POST /casos/:id/reabrir`.
- Depois de reaberto, o botão desaparece (condição `!reaberto` já cobre isso) — se quebrar de novo, a tela não oferece mais reabertura; o caminho é criar um caso novo via `+ Novo Caso` já existente.

## Testes
- Reabrir um caso RECUPERADO sem reabertura prévia → sucesso, status vira EXECUTANDO, `reaberto=true`.
- Tentar reabrir de novo o mesmo caso → erro, bloqueado.
- Tentar reabrir um caso que não está RECUPERADO (ex.: NOVO, PERDIDO) → erro.
- Resolver o caso reaberto (RECUPERADO ou PERDIDO de novo) → `resolvido_em_2` preenchido, `resolvido_em` original preservado.
- Conferir visualmente no navegador: cor laranja + badge aparecem na lista após reabertura.
