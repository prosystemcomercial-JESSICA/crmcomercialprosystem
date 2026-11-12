# Agenda do técnico com alerta no WhatsApp (12/11/2026)

## Pedido

A Jessica: "incluir no portal técnico um agendador de tarefas, inclusive nos cards do cliente, para que o técnico possa colocar e marcar horários e reuniões com o cliente e que ele receba o alerta no WhatsApp quando for o dia e hora desse contato".

## Feito

- **Backend:** tabela `AgendaTecnico` (`backend/prisma/schema.prisma`), regras puras `backend/src/lib/implantacao/agenda-tecnico.ts`, rotas `backend/src/routes/agenda-tecnico.ts` (`/agenda-tecnico`), alertas em `backend/src/services/agenda-tecnico.service.ts` com agendador de 1 minuto em `server.ts` (`iniciarSchedulerCronometro`). `avisarTecnico` ganhou `forcarWhatsapp` e `url`. O quadro (`GET /implantacoes/quadro`) traz `proximo_compromisso` em cada card.
- **Frontend:** `frontend/components/implantacao/Agenda.tsx` (menu Agenda, formulário, seção do card), ligado em `app/portal-tecnico/page.tsx` (aba `agenda`, também por `?tab=agenda`) e `components/implantacao/Portal.tsx` (seção "Agenda com o cliente" em Visão geral; etiqueta 🗓 no card do quadro). Métodos `agendaTecnico*` em `lib/api-client.ts`.
- **Docs:** os 6 de `docs/produto/` (entrada "12/11/2026 (7)"), `docs/comercial/manual-de-uso-assistente.md`, `docs/comercial/novidades-crm.html`, `docs/contexto/ESTADO.md`.
- Commit `55fee79` (código e docs), enviado ao GitHub. **Não publicado ainda** (ver Pendente).

## Verificado

- `npx vitest run tests/agenda-tecnico.test.ts`: 13/13.
- `tsc` do backend e do frontend: nenhum erro nos arquivos mexidos.
- Playwright com API simulada (`frontend/e2e/agenda-tecnico.spec.ts`, config `playwright.quadro.config.ts`): 4/4 (lista e agendamento em 1366 px conferindo o que vai para o servidor; etiqueta no card do quadro; formulário a 390 e 360 px sem rolagem lateral). Fotos olhadas.
- **Não verificado:** o envio real do WhatsApp ao técnico em produção (depende de um compromisso marcado por alguém e do celular no cadastro).

## Decisões e porquês

- Agendador próprio de 1 minuto: a rodada do portal é de 10 min, imprecisa para "na hora".
- Alerta reservado com `updateMany` (`alerta_em: null`) antes de enviar: nunca duplica. Alerta atrasado só sai até 60 min depois do horário (servidor parado não manda lembrete velho).
- `forcarWhatsapp`: o técnico pediu o alerta, então vale mesmo com a preferência de WhatsApp desligada.
- Sem mensagem ao cliente (protege o número da empresa; regra do projeto). Nada é criado sozinho.
- Sem chave estrangeira para `Implantacao`: compromisso pode ser com cliente sem card.
- Texto do alerta conta o tempo real que falta (marcado em cima da hora com aviso de "1 dia antes" não diz "amanhã").

## Pendente

- **Publicar (decide a Jessica):** criar a tabela na produção e rodar o deploy. Diferença do banco já conferida no servidor (só `CREATE TABLE AgendaTecnico`; o `DROP TABLE UsuarioPerfil` antigo nunca se aplica). A criação foi bloqueada pelo controle de permissões da sessão. Passos: backup (`mysqldump` para `/root/backups-deploy/pre-agenda-<data>.sql.gz`), `prisma migrate diff --script` sem a linha do `UsuarioPerfil`, aplicar com `mysql`, depois `deploy-vps.sh <commit>`.
- A Jessica (ou um técnico) testar marcando um compromisso para daqui a alguns minutos e conferir o WhatsApp.
- Cadastros de técnico sem celular não recebem no WhatsApp (o alerta fica no portal): conferir em Usuários.
- Ideias não pedidas: convite no Google Agenda, mostrar a agenda no "Meu dia", lembrete ao cliente (só se ela pedir).

## Próxima sessão

Primeiro: com a autorização da Jessica, criar a tabela e publicar (passos em Pendente). Conferir no log do `comercial-backend` que a rota `agenda-tecnico` carregou e que não há `[AGENDA] Erro`.

Se ela relatar que o alerta não chegou: ler `AgendaTecnico.alerta_status` do compromisso em produção (script só de leitura, ver `CONTEXTO-CRM-COMERCIAL-LOCAL.md`) e o log `[AGENDA]` do `comercial-backend`. Skill sugerida: `diagnosing-bugs`.
