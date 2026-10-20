# LEIA PRIMEIRO: CRM Comercial Prosystem

Para qualquer perfil do Claude que abrir este projeto. Leia este arquivo, depois [ESTADO.md](ESTADO.md) (o que foi feito e o que falta) e o [CLAUDE.md](../../CLAUDE.md) da raiz (regras).

## O que é

CRM comercial da **Prosystem Sistemas** (ERP e PDV para farmácias, drogarias, manipulação e padarias, Vitória/ES). Usuária principal: **Jessica** (gestora comercial, fala português, não é técnica: respostas claras, sem jargão).

- Código: `C:\Users\prosy\crmcomercialprosystem` · GitHub `prosystemcomercial-JESSICA/crmcomercialprosystem` · branch `main`.
- Produção: `https://comercial.prosystemnet.com` (VPS própria). Acesso SSH e detalhes sensíveis ficam **só neste computador**, fora do Git: veja `C:\Users\prosy\CLAUDE.md` e `C:\Users\prosy\CONTEXTO-CRM-COMERCIAL-LOCAL.md`.
- Backend: Fastify + Prisma (MySQL), roda com `tsx` (sem checagem de tipos em produção). Frontend: Next.js. PM2: `comercial-backend` e `comercial-frontend`.

## Regras que não podem ser quebradas (resumo do CLAUDE.md)

1. Sempre em português do Brasil; analisar o fluxo inteiro antes de mexer.
2. A cada entrega: commit e push no `main` e deploy com backup (`backend/scripts/deploy-vps.sh`, lista `PERMITIDO` para o banco).
3. A cada implementação, atualizar os 6 documentos de `docs/produto/` (01-PRD a 06-plano) + `docs/comercial/manual-de-uso-assistente.md` + `docs/comercial/novidades-crm.html`.
4. Nunca apagar leads antigos. Nunca criar atividades automáticas (exceto a demonstração marcada pelo lead).
5. Proteger o número do WhatsApp (API não oficial): limite único de primeiros contatos, intervalo, horário, nada repetido.
6. Pessoa assumiu a conversa: nenhum agente responde (exceção: até 2 retomadas no contexto se o cliente sumir).
7. Dados pessoais reais de leads e chaves de API **nunca** vão para o Git.
8. Checagem de tipos real do backend: `npx tsc --noEmit -p . --rootDir .` (há cerca de 89 linhas de erros antigos; olhe só os arquivos que você mudou).
9. Preferência da Jessica: tudo o que depende dela vai para um **manual único** ao final da sequência, não espalhado pelas respostas.

## Como trabalhar aqui (aprendido em 14/10/2026)

- **Testes:** `cd backend && npx vitest run tests/<arquivo>.test.ts`. Se `backend/node_modules` estiver vazio: `npm ci && npx prisma generate`.
- **Acessos e chaves ficam só no computador**, nunca no Git: `C:\Users\prosy\CONTEXTO-CRM-COMERCIAL-LOCAL.md` (como entrar no servidor, pastas, comandos exatos de leitura e de deploy).
- **Ler dados de produção:** script `.cjs` só de leitura, rodado no servidor com o `.env` do backend carregado e apagado em seguida. Para usar serviços TypeScript, script `.ts` em `backend/scripts/` rodado com `npx tsx`.
- **Deploy:** `backend/scripts/deploy-vps.sh <commit>` rodado no servidor. Ele faz backup do banco, confere o commit, recusa qualquer mudança de banco fora de `PERMITIDO` e só reinicia depois do build.
- **Atualização imediata (regra da Jessica, 15/10/2026):** toda mudança feita é registrada na hora: `docs/contexto/ESTADO.md` (o que mudou, decisões, pendências), o arquivo local (se envolver acessos ou casos de leads) e commit + push no mesmo passo.
- **Diferença antiga no banco:** o Prisma quer `DROP TABLE UsuarioPerfil` (tabela fora do schema). **Nunca aplicar**; o script já ignora.
- **Outra sessão do Claude pode estar trabalhando na mesma pasta** (aconteceu em 14/10 com a tela do WhatsApp e os temas). Antes de commitar, veja `git status` e `git diff --cached`. Se houver arquivos separados (staged) que não são seus, **não leve junto**: commite só os seus caminhos (`git commit -- <arquivos>`) ou monte o commit com um índice temporário (`GIT_INDEX_FILE`), aplicando suas mudanças sobre a versão publicada.
- **Windows:** use Git Bash; não há `python`. `/tmp` do Bash não é o `/tmp` do Node: passe caminhos com `cygpath -m`. O disco `C:` chegou a 0 bytes livres em 14/10; confira `df -h /c` antes de builds.
- **Documentos da Jessica (Claude Docs, privados da conta dela):** listados em ESTADO.md. Outro perfil/conta pode não enxergar; peça a ela para compartilhar se precisar editar.

## Reunião semanal com a diretoria (desde 20/10/2026)

Claude é o assistente da reunião semanal da Jessica com os superiores: um relatório completo e clicável, com dados de produção. **Siga [reuniao-semanal.md](reuniao-semanal.md)** (seções, script `backend/scripts/relatorio-reuniao-semanal.cjs`, armadilhas e links dos relatórios anteriores).

## Onde está cada coisa (comercial e agentes)

| Assunto | Arquivo |
| --- | --- |
| Motor dos agentes de conversa (Caroline, Julio, Luiz Felipe): fila, primeiro contato, respostas, retomadas, aprovação | `backend/src/services/caroline.service.ts` |
| Roteiro (prompt) e regras puras dos agentes: robô de loja, ficha do lead, quem decide, concorrente | `backend/src/lib/assistente/sdr.ts` |
| Rafael (especialista): estudo, revisão das conversas, treinos, perguntas para a Jessica, rotinas agendadas | `backend/src/services/especialista.service.ts` · `equipe.service.ts` (mural) |
| Chamadas de IA (OpenAI, Grok, Gemini) | `backend/src/services/ia-gemini.service.ts` · `lib/assistente/ia-texto.ts` |
| Placar, interessados esquecidos, propostas paradas, funil por origem, relatório de sexta | `backend/src/services/placar-comercial.service.ts` · `lib/placar-comercial.ts` · `lib/funil-origem.ts` |
| Programa de Ativos, fila do dia, indicações | `backend/src/routes/ativos.ts` · `services/ativos-fila.service.ts` · `services/indicacoes-clientes.service.ts` |
| Prospecção do Heitor (Google Maps) e rodízio de números | `services/heitor.service.ts` · `services/prospeccao-rodizio.service.ts` · `lib/whatsapp-vagas.ts` |
| Telas | `frontend/app/escritorio/page.tsx` (Escritório, placar, painéis) · `frontend/app/ativos/page.tsx` · `frontend/components/escritorio/*` · `frontend/components/ativos/*` |
| Página pública de captação | `frontend/public/conhecer/index.html` (rota `/conhecer`) |
