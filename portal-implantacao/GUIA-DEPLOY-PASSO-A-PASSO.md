# 🚀 Guia completo — Colocar o Portal de Implantação no ar (Railway)

> Para leigos. Cada passo tem o que clicar. Nada aqui afeta o CRM comercial que
> você já usa — estamos só adicionando 3 coisas novas ao lado: 1 banco e 2 apps.

## Visão geral (o que vamos criar)
1. **Um banco de dados** novo (só do portal).
2. **O backend do portal** (o "motor", invisível).
3. **O frontend do portal** (as telas que você vê).
4. **Ligar o CRM comercial ao portal** (2 ajustes no que já existe).

Guarde estes 2 segredos que vamos usar (anote num bloco de notas):
- **PONTE_TOKEN** = `9b6f4b1acd019ddd772f91307c78a3c97b561c31f90d241f`
- **JWT_SECRET** = (vamos copiar do seu CRM atual no Passo 0)

---

## PASSO 0 — Pegar o JWT_SECRET do CRM atual (1 minuto)
Isso é o que faz o "login único" funcionar (você entra no portal já logada).

1. Acesse **railway.app** e faça login.
2. Abra o seu projeto do CRM (onde já estão o backend e o frontend atuais).
3. Clique no serviço do **backend do CRM** (o que NÃO tem "frontend" no nome).
4. Clique na aba **Variables** (Variáveis).
5. Procure a linha **`JWT_SECRET`**. Clique nela para revelar/copiar o valor.
6. **Cole esse valor no seu bloco de notas** (vamos usar no Passo 2).

> Se NÃO existir um `JWT_SECRET` ali, me avise — eu te ajudo a criar um.

---

## PASSO 1 — Criar o banco de dados do portal (2 minutos)
1. No Railway, dentro do mesmo projeto, clique em **+ New** (canto superior direito).
2. Escolha **Database** → **Add MySQL**.
3. Espere ~30s. Vai aparecer um bloco "MySQL".
4. Clique nesse bloco MySQL → aba **Variables**.
5. Procure **`DATABASE_URL`** (ou `MYSQL_URL`). Clique para copiar o valor.
6. **Cole no bloco de notas** como "DATABASE_URL DO PORTAL".

> Esse é um banco SEPARADO. O banco do CRM comercial continua intacto.

---

## PASSO 2 — Criar o BACKEND do portal (5 minutos)
1. No projeto, clique **+ New** → **GitHub Repo**.
2. Escolha o mesmo repositório do CRM (`crmcomercialprosystem`).
3. Vai criar um serviço novo. Clique nele → aba **Settings**.
4. Em **Root Directory** (Diretório raiz), escreva exatamente:
   ```
   portal-implantacao/backend
   ```
   e salve.
5. Vá na aba **Variables** e adicione estas variáveis (botão **+ New Variable**),
   uma por uma (Nome = Valor):
   - `DATABASE_URL` = (o valor do Passo 1)
   - `JWT_SECRET` = (o MESMO valor do Passo 0 — tem que ser idêntico!)
   - `PONTE_TOKEN` = `9b6f4b1acd019ddd772f91307c78a3c97b561c31f90d241f`
   - `NODE_ENV` = `production`
   - `FRESHDESK_URL` = `https://suporteprosystem.freshdesk.com/support/home`
   - (opcional, para os e-mails automáticos funcionarem) `SMTP_HOST`, `SMTP_PORT`,
     `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `GESTOR_EMAIL` — use os MESMOS valores
     que já existem no backend do CRM comercial (copie de lá). Se não copiar, os
     e-mails ficam só "simulados" (registrados no log) e o resto funciona normal.
6. Aba **Settings** → seção **Networking** → clique **Generate Domain**.
   Vai gerar um endereço tipo `portal-backend-production-xxxx.up.railway.app`.
   **Copie e cole no bloco de notas** como "URL DO BACKEND DO PORTAL".
7. O Railway vai fazer o "deploy" sozinho (uns 2-3 min). Quando ficar verde,
   teste: abra `SUA-URL-DO-BACKEND/health` no navegador. Deve aparecer
   `{"status":"ok","portal":"implantacao",...}`.

---

## PASSO 3 — Criar o FRONTEND do portal (4 minutos)
1. No projeto, clique **+ New** → **GitHub Repo** → o mesmo repositório.
2. Clique no serviço novo → aba **Settings** → **Root Directory**:
   ```
   portal-implantacao/frontend
   ```
   e salve.
3. Aba **Variables** → adicione:
   - `NEXT_PUBLIC_PORTAL_API_URL` = (a "URL DO BACKEND DO PORTAL" do Passo 2)
4. Aba **Settings** → **Networking** → **Generate Domain**. Vai gerar algo como
   `portal-frontend-production-xxxx.up.railway.app`.
   **Copie** como "URL DO PORTAL" (essa é a que você e a equipe vão acessar).
5. Espere o deploy (o frontend demora um pouco mais, ~5 min). Quando ficar verde,
   abra a "URL DO PORTAL" no navegador — deve abrir o Portal de Implantação.

---

## PASSO 4 — Avisar o backend do portal qual é o frontend (1 min)
1. Volte ao serviço do **backend do portal** → **Variables**.
2. Adicione: `FRONTEND_URL` = (a "URL DO PORTAL" do Passo 3).
3. Isso libera a comunicação entre as telas e o motor (CORS). O deploy refaz sozinho.

---

## PASSO 5 — Ligar o CRM comercial ao portal (3 minutos)
Agora o CRM passa a mostrar o botão do portal e a criar projetos automaticamente.

No serviço do **backend do CRM comercial** → **Variables**, adicione:
- `PORTAL_PONTE_URL` = (a "URL DO BACKEND DO PORTAL" do Passo 2)
- `PONTE_TOKEN` = `9b6f4b1acd019ddd772f91307c78a3c97b561c31f90d241f` (o mesmo!)

No serviço do **frontend do CRM comercial** → **Variables**, adicione:
- `NEXT_PUBLIC_PORTAL_URL` = (a "URL DO PORTAL" do Passo 3)

Os dois serviços do CRM vão refazer o deploy sozinhos (uns minutos).

---

## PASSO 6 — Testar tudo (5 minutos)
1. Abra o CRM comercial, faça login normal.
2. No menu lateral (grupo "Clientes & Base") vai aparecer **"Implantação & Onboarding"**.
   Clique → abre o Portal em nova aba, já logada (sem pedir senha de novo).
3. No Portal, clique **"+ Novo projeto"**, preencha um cliente de teste e salve.
   Ele aparece no kanban do funil.
4. Abra o card → marque um item do checklist → mova de fase. Veja o SLA.
5. Vá na aba **Dashboard** do portal: os indicadores aparecem.
6. (Opcional) No CRM, aceite uma proposta de teste → em segundos, um projeto novo
   nasce sozinho no Portal (na fase Kick-off).

---

## Se algo der errado
- **Build vermelho/falhou:** clique no serviço → aba **Deployments** → clique no
  deploy → veja o "log". Me mande o texto do erro que eu corrijo.
- **"Application failed to respond":** confira se a `DATABASE_URL` (backend) e a
  `NEXT_PUBLIC_PORTAL_API_URL` (frontend) estão certas.
- **Login pede senha de novo no portal:** o `JWT_SECRET` do portal está diferente
  do CRM. Corrija para ser idêntico (Passo 0 = Passo 2).
- **Botão do portal não aparece no CRM:** falta a `NEXT_PUBLIC_PORTAL_URL` no
  frontend do CRM (Passo 5), ou o deploy ainda não terminou.

> Resumo do que você vai colar no bloco de notas e reutilizar:
> - JWT_SECRET (do CRM) · DATABASE_URL (do portal) · PONTE_TOKEN ·
>   URL DO BACKEND DO PORTAL · URL DO PORTAL (frontend)
