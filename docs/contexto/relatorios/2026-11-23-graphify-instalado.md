# 23/11/2026: graphify instalado e grafo do código do CRM

## Pedido
A Jessica escreveu: "procure a ferramenta grafify". Depois escolheu as opções "1, 2": (1) instalar a skill no Claude e (2) gerar o grafo do CRM Comercial.

## Feito
- A ferramenta é o **graphify** (pacote `graphifyy` 0.9.17, https://github.com/safishamsi/graphify). Já estava instalada no Python do computador, com os programas `graphify.exe` e `graphify-mcp.exe` em `C:\Users\prosy\AppData\Local\Python\pythoncore-3.14-64\Scripts\`. O projeto Orbit (`C:\Users\prosy\mktecosystem\graphify-out`) já tinha usado a ferramenta em 05/11.
- A skill foi instalada com `graphify install --platform claude`, que a colocou em `~/.claude-conta-2/skills/graphify`. Depois foi copiada para `~/.claude/skills/graphify`, o outro perfil. O instalador também criou `~/.claude/CLAUDE.md`, com 3 linhas que apontam para a skill.
- No repositório:
  - **novo `.graphifyignore`**: exclui as pastas que não são do CRM;
  - **`.gitignore`**: ganhou a linha `graphify-out/`;
  - **ESTADO.md**: recebeu o registro desta tarefa, com os comandos.
- O grafo foi gerado em `graphify-out/` (fora do git) em dois passos:
  1. `graphify extract . --code-only`;
  2. `graphify cluster-only . --no-label`, com `GRAPHIFY_VIZ_NODE_LIMIT=7000`.

## Verificado
- A extração terminou sem erro: 5.836 nós, 12.799 ligações e 318 grupos. Os arquivos vieram de backend (427), frontend (219), portal-implantacao (26) e mais 3 arquivos avulsos.
- O `graph.html` foi gerado, com cerca de 5,7 MB. **Não verificado:** a abertura e a navegação dele no navegador.
- A consulta `graphify query "como o Heitor envia mensagens no WhatsApp"` respondeu com nós coerentes: `heitor.service.ts`, `whatsappRoutes()` e `evolution.service.ts`.
- O comando `git check-ignore` confirmou que `graphify-out/` fica fora do git.
- **Não verificado:** se o comando `/graphify` aparece numa sessão nova do perfil `.claude`. Na sessão atual, do perfil `conta-2`, a skill já aparece na lista.

## Decisões e porquês
- **Só estrutura (`--code-only`):** a extração completa mandaria subagentes lerem toda a pasta `docs/`, o que gasta muitos tokens. A estrutura do código basta para navegar no CRM.
- **Pastas excluídas:** a primeira rodada pegou `claude-mem`, `claude-plugins-official` e outras pastas de ferramentas e deu 39.710 nós, com 1.908 arquivos só do claude-mem. Essas pastas foram excluídas no `.graphifyignore`.
- **`graphify-out/` fora do git:** a pasta tem cerca de 13 MB, é gerada no computador e pode guardar trechos de arquivos JSON locais com dados de clientes.
- **Grupos sem nome (`--no-label`):** dar nome aos grupos usa IA. Ficou para depois, se a Jessica quiser.
- Não foi rodado `graphify claude install`. Esse comando mexeria no CLAUDE.md do projeto e criaria um hook PreToolUse, e isso não foi pedido.

## Pendente
- A Jessica decide se quer nomear os grupos (`graphify label .`) e se quer o hook do git que atualiza o grafo a cada commit (`graphify hook install`).

## Próxima sessão
- Antes de mexer no código, rode `graphify update .` para atualizar o grafo. Depois use `graphify query "..."`, ou a skill `graphify`, para perguntas de arquitetura.
