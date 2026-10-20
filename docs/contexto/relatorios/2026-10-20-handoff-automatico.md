# 20/10/2026: skill handoff adaptada e automática

## Pedido

A Jessica perguntou como a skill `handoff` (mattpocock/skills) ajuda com os agentes e pediu para adaptá-la ao projeto. Depois disse: "não quero ficar ativando a skill o tempo todo, não depende de mim lembrar disso, crie uma regra para que ela seja ativada sozinha".

## Feito

- `137e91c`: `.claude/skills/handoff/SKILL.md` reescrita em português, com estas regras:
  - registra no ESTADO.md antes de resumir;
  - inclui uma seção para os casos dos agentes de conversa, citados pelo id do lead;
  - não copia acessos nem dados de leads;
  - salva em `%LOCALAPPDATA%\Temp\handoffs-crm-comercial\`, fora do repositório;
  - termina com um texto pronto para colar na sessão nova.
- `e34fb52`: handoff automático.
  - A skill não tem mais `disable-model-invocation` e ganhou a seção "Quando rodar sozinho".
  - Regra nova no `CLAUDE.md`.
  - Hook `SessionStart` em `.claude/settings.json`, que roda `.claude/hooks/handoff-recente.mjs`. Ele lista os handoffs dos últimos 7 dias. Depois de uma compactação, ele lembra o agente de gravar o handoff.
- O ESTADO.md (entradas de 20/10) e o arquivo local de acessos foram atualizados.

## Verificado

- O script do hook foi testado com a entrada simulada, nos dois casos: sem handoff, ele não imprime nada (saída 0); com um arquivo de teste e `source: compact`, ele devolve o JSON com a lista e o lembrete. O arquivo de teste foi apagado depois.
- O `.claude/settings.json` continua sendo um JSON válido (lido pelo Node), e o comando do hook roda como está configurado.
- **Não verificado:** o hook disparando de verdade numa sessão nova. Ele só vale a partir da próxima sessão aberta nesta pasta. Também não foi verificado se o agente chama a skill sozinho na prática, porque isso depende do modelo seguir a descrição e a regra.

## Decisões e porquês

- **Hook na abertura da sessão, não antes da compactação:** um hook de comando não consegue fazer o agente escrever um texto. Por isso o lembrete chega logo depois da compactação, na volta da sessão.
- **Configuração do projeto (`.claude/settings.json`), não a local:** assim a regra vale em qualquer perfil que abra esta pasta. O hook não leva nenhum dado sensível.
- **Handoff × relatório final:** o handoff é para a tarefa pela metade e fica guardado fora do Git, de forma temporária. O relatório final (este arquivo) fica salvo de forma permanente no repositório.
- **Cópia do Codex:** a cópia em `.agents/skills/handoff/` (fora do Git) ficou sem mudança.

## Pendente

- **Achado de segurança** em configuração versionada; o detalhe está no arquivo local, seção de 20/10. A Jessica decide a limpeza e a troca de chaves.
- A conta ativa do `gh` neste computador é a `alcancelegalmkt-collab`, que não tem acesso a este repositório. O push foi feito trocando para a `prosystemcomercial-JESSICA` e voltando em seguida.

## Próxima sessão

- **Primeiro passo:** abrir uma sessão nova nesta pasta e ver se o aviso de handoff aparece. Só aparece se houver algum handoff com menos de 7 dias.
- **Skills sugeridas:** `handoff` e `relatorio-final`.
