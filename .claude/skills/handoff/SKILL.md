---
name: handoff
description: Resume a conversa atual num documento de passagem para outra sessão (Claude ou Codex) continuar a tarefa do CRM Comercial de onde parou. Use SOZINHO, sem esperar pedido, quando terminar uma resposta com a tarefa pela metade (esperando a Jessica, bloqueada, ou com próximo passo definido e não feito), logo depois de a conversa ser compactada com tarefa em andamento, ou quando a Jessica disser que vai parar, trocar de sessão ou passar para o Codex.
argument-hint: "Para que a próxima sessão vai ser usada?"
---

## Quando rodar sozinho (regra da Jessica, 20/10/2026)

- **Sim:** tarefa pela metade no fim da resposta; conversa recém-compactada com trabalho em andamento; a Jessica avisa que vai parar ou trocar de sessão.
- **Não:** pergunta simples, tarefa terminada e já registrada no ESTADO.md (aí não há meio de tarefa a guardar), ou nada mudou desde o último handoff desta tarefa.
- **Um arquivo por tarefa:** se já existe handoff desta tarefa (mesmo assunto, aberto nesta sessão ou lido no início), atualize o mesmo arquivo em vez de criar outro.
- Ao rodar sozinho, avise numa linha só no fim da resposta: "Handoff salvo em <caminho>". Não peça licença.

Escreva um documento de passagem (handoff) desta conversa para que uma sessão nova continue o trabalho sem refazer o que já foi feito. Tudo em português do Brasil.

Se a pessoa passou argumentos, eles dizem o foco da próxima sessão: monte o documento em volta disso e deixe de fora o que não ajuda nesse foco.

## 1. Antes de escrever: o registro permanente vem primeiro

O handoff **não substitui** o `docs/contexto/ESTADO.md`. O ESTADO guarda o estado do projeto; o handoff guarda só o meio da tarefa (hipóteses, tentativas, próximo passo).

- Se esta conversa mudou algo que o `ESTADO.md` ainda não registra, atualize-o e faça commit + push antes (regra da Jessica de 15/10/2026). Se envolveu acessos ou casos de leads, atualize também `C:\Users\prosy\CONTEXTO-CRM-COMERCIAL-LOCAL.md`.
- Rode `git status` e `git log --oneline -5`. Outra sessão pode estar trabalhando na mesma pasta: separe o que é desta conversa do que não é.

## 2. O que o documento deve ter

1. **Objetivo** da tarefa, em uma ou duas linhas.
2. **Onde parou:** o que ficou pronto, o que está pela metade e o **próximo passo concreto** (comando, arquivo, teste).
3. **O que já foi tentado e descartado**, com o motivo. Isso evita que a próxima sessão repita o caminho.
4. **Decisões tomadas** nesta conversa e quem decidiu (a Jessica ou o agente).
5. **Estado do código:** commits feitos (hash), arquivos sem commit e de quem são, testes rodados e resultado (`npx vitest run tests/<arquivo>.test.ts`), checagem de tipos (`npx tsc --noEmit -p . --rootDir .`, só os arquivos mexidos), se já foi publicado (`deploy-vps.sh`) ou não.
6. **Pendências da Jessica** que surgiram. Elas vão para o Manual da Jessica, não para respostas soltas.
7. **Se a tarefa é sobre os agentes de conversa** (Caroline, Julio, Luiz Felipe, Rafael, Heitor): qual agente, o caso pelo **id do lead** (nunca nome nem telefone), o comportamento errado e o esperado, e onde mexer (`backend/src/lib/assistente/sdr.ts`, `backend/src/services/caroline.service.ts` ou o serviço do agente) com o arquivo de teste correspondente.
8. **Leitura obrigatória para a próxima sessão:** `docs/contexto/LEIA-PRIMEIRO.md`, `docs/contexto/ESTADO.md` (cite a entrada pela data), `CLAUDE.md` e os arquivos de código com `caminho:linha`.
9. **Skills sugeridas:** quais a próxima sessão deve chamar com a ferramenta Skill, e por quê. Use só nomes que existem em `.claude/skills/` ou na lista de skills da sessão; não invente.
10. **Prompt pronto para colar** na sessão nova, curto, apontando para este arquivo.

Não copie o que já está registrado em outro lugar (ESTADO.md, documentos de `docs/produto/`, commits, diffs, Manual da Jessica): aponte o caminho, o hash ou o link.

## 3. Sigilo (o repositório é público e o handoff vira prompt de outro agente)

- **Acessos:** nunca copie o conteúdo de `C:\Users\prosy\CONTEXTO-CRM-COMERCIAL-LOCAL.md` nem de `C:\Users\prosy\CLAUDE.md`. Escreva só "acesso no arquivo local".
- **Chaves e senhas:** nada de tokens, valores do `.env`, senhas de banco ou de painel.
- **Dados de leads e clientes:** nada de nome, telefone, CNPJ, CPF ou e-mail. Use o id do lead e "dados no arquivo local".

## 4. Onde salvar e como entregar

- Salve **fora do repositório**, em `%LOCALAPPDATA%\Temp\handoffs-crm-comercial\AAAA-MM-DD-HHMM-<assunto-curto>.md`. Crie a pasta se ela não existir.
- Na resposta, dê o **caminho completo** do arquivo e o prompt pronto para colar, por exemplo: `Leia o handoff em <caminho completo> e continue a partir do próximo passo.`
