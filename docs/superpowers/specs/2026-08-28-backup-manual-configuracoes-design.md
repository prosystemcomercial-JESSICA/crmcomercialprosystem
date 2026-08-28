# Backup manual sob demanda + lista dos últimos 5 (em Configurações)

## Contexto

O CRM já tem um backup diário automático (`backend/scripts/backup-diario.cjs`), mas ele só roda
localmente na máquina do usuário (Task Scheduler, logon + 17h), exportando todas as tabelas do
banco de produção (Railway MySQL) como JSON para uma pasta sincronizada pelo MEGA. Esse job
continua existindo e não é alterado por este trabalho.

O projeto já teve incidentes reais de perda de dados (ver memória
`project_incidente_perda_dados_cliente_churn`) e o banco de produção no Railway não tem nenhum
plano de backup/PITR (`project_sem_backup_banco`). O usuário quer poder disparar um backup manual
a qualquer momento pelo próprio CRM, sem depender do job agendado, e ver os últimos 5 backups
feitos.

## Decisão de arquitetura

O botão fica no frontend em produção (Railway), que só consegue chamar o backend em produção
(também Railway) — não tem como chamar a máquina local do usuário sem um túnel (decidido não
criar um agora). Por isso, o backup disparado pelo botão roda **no backend Railway**, usando a
mesma lógica de export do `backup-diario.cjs` (percorrer `information_schema.TABLES` e fazer
`SELECT *` de cada uma via Prisma), e salva em um **Railway Volume** novo, montado no serviço de
backend — independente da pasta MEGA local.

Isso cria duas trilhas de backup paralelas e independentes (job local + botão manual no Railway),
o que é intencional: se uma falhar, a outra continua funcionando.

## Backend

Novo arquivo `backend/src/routes/backups.ts`, registrado como as demais rotas.

**`POST /backups`**
- Sem restrição de role — qualquer usuário autenticado pode disparar (decidido: qualquer usuário
  logado, não só ADMIN).
- Roda o mesmo export do script local: descobre tabelas via
  `information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`, faz
  `SELECT *` de cada uma com `$queryRawUnsafe`, serializa (tratando `BigInt` como string, igual ao
  script atual).
- Salva em `<VOLUME_PATH>/backups/<timestamp>/<tabela>.json` + `_resumo.json` (mesmo formato do
  script: `{ data, tabelas: { nome: contagem }, erros: [{ tabela, erro }] }`).
- Execução síncrona (aguarda terminar antes de responder) — o volume de dados atual do CRM é
  pequeno o suficiente para isso ser viável; se um dia isso mudar, vira uma limitação conhecida a
  revisitar.
- Após salvar, aplica retenção: mantém só as 5 pastas mais recentes no volume (por nome/timestamp),
  apaga as mais antigas com `fs.rmSync(recursive: true)`.
- Resposta: o mesmo objeto `_resumo.json` gerado, mais o nome da pasta/timestamp.

**`GET /backups`**
- Lista as pastas em `<VOLUME_PATH>/backups`, ordenadas por nome (timestamp) decrescente, no
  máximo 5.
- Para cada uma, lê o `_resumo.json` e retorna: `{ timestamp, data, total_tabelas, total_linhas,
  erros }`.
- Se o volume ainda não tiver nenhum backup (primeira vez), retorna lista vazia.

**Erros:** se uma tabela falhar durante o export, registra em `erros` e continua as demais (igual
ao script local) — o backup não aborta por causa de uma tabela problemática.

## Infraestrutura (Railway)

Precisa criar um **Volume** novo no serviço de backend do Railway, montado por exemplo em `/data`,
e uma variável de ambiente (`BACKUP_VOLUME_PATH=/data`) apontando pra ele. Isso é uma mudança de
configuração de produção — será feita e confirmada como um passo explícito na implementação, não
silenciosamente.

## Frontend

Em `frontend/app/configuracoes/page.tsx`, nova seção "Backup" seguindo o mesmo padrão visual das
seções existentes (`SECOES`, ícone do `lucide-react` — ex. `DatabaseBackup` ou `Save`).

Conteúdo da seção:
- Botão "Fazer backup agora": ao clicar, chama `POST /backups` via `apiClient`, mostra estado de
  carregando (a chamada pode levar alguns segundos, é síncrona), e um toast/feedback de
  sucesso (resumo: nº de tabelas, nº de linhas) ou erro.
- Lista dos últimos 5 backups: busca `GET /backups` ao montar a seção e depois de cada novo backup
  bem-sucedido. Cada item mostra data/hora formatada, nº de tabelas, nº de linhas totais, e um
  indicador visual (⚠️) se `erros.length > 0` naquele backup.

## Fora de escopo

- Restaurar a partir de um backup (o endpoint só exporta; nenhum mecanismo de restore automático).
- Alertas/notificações se um backup (manual ou do job local) falhar.
- Unificar o job local com o backend Railway, ou migrar o job local para rodar no Railway também.
- Paginação/histórico além dos 5 mais recentes na UI (o volume pode reter mais no futuro, se
  necessário, mas por ora a retenção no backend também é 5).

## Testes

- Rodar o backend localmente contra o banco de produção (mesma prática já usada no projeto) e
  verificar que `POST /backups` gera a pasta e os arquivos esperados, e que `GET /backups` reflete
  o resultado.
- Verificar retenção: disparar backup 6 vezes seguidas e confirmar que só 5 pastas permanecem.
- Testar a UI em `/configuracoes` com Playwright (ou manual): clique no botão, aparecimento do
  novo item na lista, estado de erro se a API falhar.
