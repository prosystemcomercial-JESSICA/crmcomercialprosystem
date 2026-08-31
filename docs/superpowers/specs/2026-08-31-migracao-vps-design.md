# Migração do CRM Comercial: Railway → VPS próprio

## Contexto

O CRM Comercial Prosystem roda hoje inteiramente no Railway (backend Fastify,
frontend Next.js, MySQL), com deploy automático a cada push em `main`. O
usuário quer migrar o sistema inteiro (banco + backend + frontend) para um VPS
próprio (`179.199.134.177`, Ubuntu 24.04, MySQL 8 já instalado), com o domínio
novo `comercial.prosystemnet.com`, mantendo o sistema no ar durante a
migração (sem janela de manutenção) e concluindo ainda hoje.

O mesmo VPS já hospeda dois outros projetos ativos e não relacionados a este
trabalho, que não podem ser afetados:
- `/var/www/crm-prosystem` (PM2: `crm-backend`, `crm-frontend`) — outro CRM,
  de atendimento, banco `db_atendimento`, domínio `crm.prosystemnet.com`
  (SSL válido via Let's Encrypt).
- `/var/www/universidade-prosystem` (PM2: `universidade`) — banco
  `db_universidade`, domínio `universidade.prosystemnet.com`.

Inspeção do servidor confirmou: Ubuntu 24.04 LTS, Node v20.20.2, npm 10.8.2,
MySQL 8.0.46, Nginx 1.24.0, PM2 já instalado e em uso, certbot já configurado
para os dois domínios existentes, `ufw` (firewall) inativo, 184GB livres em
disco, 13GB RAM disponível.

## Nomenclatura (evita qualquer colisão com os projetos existentes)

- Pasta: `/var/www/comercial-prosystem/` (com `backend/` e `frontend/`)
- Banco: `db_comercial`, com um usuário MySQL dedicado (não usar root do
  MySQL na string de conexão da aplicação)
- Processos PM2: `comercial-backend`, `comercial-frontend`
- Site Nginx: `comercial-prosystem` (novo arquivo em
  `/etc/nginx/sites-available/`, sem tocar nos existentes)
- Domínio: `comercial.prosystemnet.com` + `www.comercial.prosystemnet.com`,
  certificado Let's Encrypt próprio (mesmo mecanismo já usado para os outros
  dois domínios: certbot com o plugin nginx)

## Estratégia de corte

Sistema permanece no ar no Railway durante toda a migração. O VPS é montado e
validado em paralelo; o corte real acontece só na etapa final, quando o DNS
de `comercial.prosystemnet.com` (ou o link que os usuários acessarem) passa a
apontar para o VPS. Antes disso, um dump final do banco Railway é reaplicado
no VPS para capturar qualquer dado criado durante a janela de montagem —
minimizando a janela de inconsistência a poucos minutos no fim, não o tempo
todo da migração.

## Fases

### 1. Preparar o VPS
- Criar banco `db_comercial` no MySQL local do VPS.
- Criar usuário MySQL dedicado (não root) com privilégios apenas sobre
  `db_comercial`.
- Criar `/var/www/comercial-prosystem/` e clonar o repositório
  (`crmcomercialprosystem`) nele.
- Confirmar Node 20.x é compatível com o `package.json` de ambos os
  subprojetos (já usado nos outros dois projetos do mesmo servidor, portanto
  compatível).
- Criar site Nginx novo (`comercial-prosystem`) primeiro em HTTP simples
  (porta 80), replicando o mesmo padrão de `location`s (proxy `/api/` e
  `/socket.io/` para a porta do backend, resto para a porta do frontend, como
  no site `crm-prosystem` existente) — mas com portas próprias, distintas das
  usadas por `crm-backend`/`crm-frontend` (que ocupam 3000/3001), para não
  colidir. Ex.: backend novo na porta 3011, frontend novo na 3010.
- Rodar certbot para emitir o certificado de `comercial.prosystemnet.com` (só
  funciona depois que o DNS do domínio já apontar para o IP do VPS — esta
  sub-etapa depende de o usuário/DNS já estar configurado; se não estiver,
  reportar e seguir com HTTP até o DNS propagar).

### 2. Copiar schema e dados
- Rodar `npx prisma db push` do projeto backend contra `db_comercial` (vazio)
  para criar todo o schema a partir do `schema.prisma` atual.
- Fazer um dump dos dados atuais do banco Railway (mesmo mecanismo do
  `backup-diario.cjs`/`backend/src/lib/backup.ts`: iterar tabelas via
  `information_schema` e exportar) ou, se disponível no ambiente, um dump SQL
  direto via `mysqldump`/`mysql` client apontando para o proxy Railway.
  Importar esse dump em `db_comercial`.
- Isso roda em paralelo ao Railway em produção — não tira o sistema do ar.

### 3. Subir a aplicação no VPS
- Configurar `.env` do backend com `DATABASE_URL` apontando para
  `db_comercial` local (`mysql://<usuario>:<senha>@localhost:3306/db_comercial`),
  mais as demais variáveis necessárias (mesmas do Railway, exceto o que for
  específico da plataforma).
- Build do backend (`npx prisma generate`) e do frontend (`next build`,
  com `NEXT_PUBLIC_API_URL` apontando para `https://comercial.prosystemnet.com/api`
  uma vez que o domínio estiver ativo, ou a porta local durante testes).
- Subir os dois processos via PM2 (`comercial-backend`, `comercial-frontend`),
  configurados para reiniciar sozinhos (`pm2 startup` + `pm2 save`, seguindo o
  padrão já usado por `universidade`/`crm-backend` nesse mesmo servidor).
- Validar localmente antes de expor: `curl localhost:<porta-backend>/health`
  e checar que o frontend responde na porta local.

### 4. Validação end-to-end
- Acessar `comercial.prosystemnet.com` externamente (uma vez DNS+SSL
  prontos), testar login e uma ação real de leitura de dados (ex.: lista de
  clientes, propostas) comparando contagens/amostras com o Railway para
  confirmar fidelidade da cópia.

### 5. Corte final
- Rodar um dump incremental de última hora do Railway e reaplicar no VPS
  (capturando qualquer dado criado durante as fases 1-4).
- A partir daqui, `comercial.prosystemnet.com` (VPS) é a fonte de verdade.
  Confirmar com o usuário qual link a equipe vai passar a usar.

### 6. Backups no VPS
- Atualizar o botão de backup manual (`backend/src/routes/backups.ts`) e o
  job local (`backend/scripts/backup-diario.cjs`, Task Scheduler) para
  apontar `DATABASE_URL` para `db_comercial` no VPS em vez do Railway — só
  troca de string de conexão, sem mudança de lógica.

### 7. Firewall (etapa isolada, sequenciada com cuidado)
- Ativar `ufw` liberando **primeiro** SSH (22) e HTTP/HTTPS (80/443).
- Confirmar que a conexão SSH atual continua funcionando antes de qualquer
  bloqueio adicional (evita lockout do servidor).
- Restringir a porta MySQL (3306) para aceitar apenas conexões locais
  (`bind-address = 127.0.0.1` já deve ser o padrão do MySQL 8 — confirmar; o
  firewall reforça isso para qualquer outra porta exposta sem necessidade).
- Não alterar regras que afetem os dois projetos existentes.

### 8. Pós-migração
- Railway (banco, backend, frontend) permanece pausado/intacto por um
  período como rede de segurança — não cancelar nem apagar nada agora.
- Deploy contínuo passa a ser manual via SSH: `git pull` + build + `pm2
  restart` no VPS, até uma automação (CI/CD) ser desenhada separadamente no
  futuro.

## Fora de escopo

- Deploy automático (GitHub Actions/webhook) — fica para depois.
- Backup adicional rodando diretamente no VPS (cron + mysqldump local) — os
  dois mecanismos existentes (botão manual + job local) são suficientes por
  ora, só reapontados para o banco novo.
- Qualquer alteração nos projetos `crm-prosystem`/`db_atendimento` ou
  `universidade-prosystem`/`db_universidade`.
- Migração do fluxo de deploy automático do Railway.

## Riscos e mitigações

- **Perda de dados na cópia**: mitigado por rodar o dump/import em duas
  passadas (inicial + incremental final) e validar contagens antes do corte.
- **Colisão com projetos existentes**: mitigado pela nomenclatura própria
  (pastas, processos PM2, portas, banco, site Nginx) — nada reaproveita nomes
  já em uso.
- **Lockout do servidor ao ativar firewall**: mitigado por liberar SSH antes
  de qualquer bloqueio e validar a conexão continua ativa antes de prosseguir.
- **Exposição de credenciais**: o `.env` do VPS não deve ser commitado; senhas
  do MySQL geradas para o usuário dedicado, distintas da senha root já
  compartilhada.
