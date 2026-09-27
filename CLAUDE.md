# CRM Comercial Prosystem: regras do projeto

- Falar sempre em português do Brasil.
- Não bagunçar o que existe: agregar e analisar o fluxo inteiro, não só a função.
- A cada entrega: commit e push no `main`, deploy com backup (script de deploy com lista `PERMITIDO` para o banco).
- **A cada nova implementação, atualizar nos mínimos detalhes os seis documentos de `docs/produto/`** (01-PRD, 02-TRD, 03-app-flow, 04-briefing-ui-ux, 05-esquema-backend, 06-plano-implementacao), além de `docs/comercial/manual-de-uso-assistente.md` e `docs/comercial/novidades-crm.html`.
- Nunca apagar leads antigos. Nunca criar atividades automáticas (exceto a demonstração marcada pelo lead).
- Proteger o número do WhatsApp (API não oficial): limite único de primeiros contatos, intervalo, horário, nada repetido.
- Uma pessoa assumiu a conversa: nenhum agente responde mais nela.
- Dados pessoais reais de leads e chaves de API nunca vão para o Git.
- Checagem de tipos real do backend: `npx tsc --noEmit -p . --rootDir .` (o `tsx` de produção não confere tipos).
