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

## Continuação: regra de uso em tudo
- **Pedido:** "deixe como regra o uso em tudo".
- **Feito:**
  - Regra escrita em `C:\Users\prosy\CLAUDE.md`, que vale para todos os projetos (seção "graphify em todo projeto de código"), e no `CLAUDE.md` do CRM.
  - Hook PreToolUse do graphify (`graphify.exe hook-guard search|read`) adicionado ao `settings.json` dos dois perfis do Claude. O matcher é `Bash|PowerShell` para buscas e `Read|Glob` para leituras. Há backup `settings.json.bak-20261123-graphify` nos dois perfis. O script usado está na pasta temporária da sessão.
- **Verificado:**
  - Pelo Bash, o hook devolve o aviso dentro do CRM e não devolve nada em `C:\Users\prosy`.
  - Nesta sessão, o aviso já apareceu em leituras e buscas de verdade.
  - Pelo PowerShell, o teste não funcionou: o pipe do PowerShell coloca BOM no texto, o JSON falha e o hook fica quieto. Isso não afeta o Claude Code, que manda o JSON sem BOM.
- **Decisões:**
  - O hook ficou nas configurações gerais dos perfis, e não por projeto, para valer em tudo. Ele só age onde já existe grafo.
  - A ferramenta PowerShell entrou no matcher de busca (o padrão do graphify só tem Bash).
- **Não feito:** o hook do git com atualização automática (`graphify hook install`), porque o modo automático negou a permissão. A Jessica pode rodar o comando ela mesma ou liberar a permissão. Enquanto isso, vale a regra do `graphify update .`.
- **Pendente (Jessica):** decidir se quer o grafo já gerado agora em todos os outros projetos (CRM da Letícia, Agenda/Orbit, Ravena e outros). Pela regra, ele é gerado na primeira tarefa de cada projeto.

## Continuação: gatilho do git e grafo em todos os projetos
- **Pedido:** "ESTA AUTORIZADO" (o `graphify hook install`) e "TODOS OS PROJETOS" (gerar o grafo em todos agora).
- **Feito:**
  - Gatilho do git (post-commit e post-checkout) e grafo só da estrutura nos 8 projetos:

    | Projeto | Nós |
    |---|---|
    | CRM Comercial | 5.836 |
    | CRM da Letícia | 4.962 |
    | Agenda/Orbit | 2.274 |
    | Ravena | 51 |
    | mktecosystem | 7.836 (sem `graph.html`, porque passa de 7.000) |
    | Giro | 269 |
    | Rafa Diniz | 1.216 |
    | Site da Rafa | 117 |

  - O script usado está na pasta temporária da sessão, com o nome `grafo_projeto.sh`.
  - Na Agenda, as pastas `clientes/`, `vendas/` e `videos/` ficaram fora do grafo, porque guardam dados e não código.
- **Decisões:**
  - Nos outros repositórios, nada foi para o git, para não disparar deploy (Letícia na VPS, Agenda na Vercel). Tudo ficou na configuração local de cada um (`.git/info/exclude` e `.git/info/attributes`).
  - Na Agenda, o husky fez o gatilho ir para `.husky/post-commit` e `.husky/post-checkout`. Os dois também foram excluídos só no git local.
  - O `.gitattributes` versionado do mktecosystem foi restaurado. A linha do graphify foi para `.git/info/attributes`.
- **Verificado:** nos 8 projetos, `graph.json` existe, `graphify hook status` responde "installed" e o `git status` não mostra arquivo nenhum do graphify.
- **Não verificado:** um commit de verdade disparando o gatilho. Ele roda no próximo commit de cada projeto.

## Próxima sessão
- Antes de mexer no código, rode `graphify update .` para atualizar o grafo. Depois use `graphify query "..."`, ou a skill `graphify`, para perguntas de arquitetura.
