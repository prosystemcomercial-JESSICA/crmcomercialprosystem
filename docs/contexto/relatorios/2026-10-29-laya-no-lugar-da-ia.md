# 29/10/2026: Laya no lugar da IA no tira-dúvidas

## Pedido
A Jessica perguntou o que a Laya já pode assumir no lugar da IA e depois pediu: "passe para ela tudo o que ela pode fazer, assim economizamos mais um pouco".

## Feito
- A Laya só classifica, escolhendo entre opções; ela não escreve. O que ela pode decidir já estava ligado e não precisou de mudança:
  - `rotaDaLaya` antes dos agentes e da Clarice;
  - ramo, etiqueta, risco e temperatura, a partir do nível Assistente;
  - o filtro `ehSoConfirmacao` nos agentes de venda.
- Novo no tira-dúvidas da Clarice (`backend/src/services/assistente-ia.service.ts`, `autoResponderDuvida`), antes da IA externa:
  - o filtro "só agradeceu/confirmou";
  - a pergunta nova da Laya `PERGUNTA_ASSUNTO_DUVIDA` (`backend/src/lib/laya.ts`, `layaDispensaTiraDuvidas`; chamada em `assuntoDaDuvida`, `laya-cerebro.service.ts`). Se o assunto for preço, reclamação ou conversa, com confiança ≥ 0,8, a IA não é chamada.
- Cada desvio conta como `evitada`.
- Documentos atualizados: os 6 de `docs/produto/`, o manual, as novidades e o ESTADO.

## Verificado
- `npx vitest run tests/laya.test.ts tests/triagem-laya.test.ts tests/assistente-ia-texto.test.ts`: 20 testes passaram.
- `tsc`: nenhum erro nos arquivos alterados.
- **Não verificado:**
  - o nível real das tarefas da Laya em produção (a leitura do banco foi recusada pela permissão da sessão);
  - o comportamento em produção depois do deploy (o deploy de `05f9af8` foi feito com backup: CI ok, build ok, site e API respondendo).

## Decisões e porquês
- **Laya sem nível no filtro do tira-dúvidas:** um desvio errado só faz a equipe responder, o que já é o caminho normal. O risco é baixo.
- **A rota suporte/financeiro continua exigindo o nível Assistente:** desviar um comprador para o financeiro perderia o lead.
- **Descartados:** substituir a escrita das respostas e o agendamento da demonstração pela Laya, porque ela não redige.

## Pendente
- Biblioteca de respostas prontas aprovadas: depende de a Jessica escrever e aprovar os textos.
- Conferir no Caderno da Laya o nível de cada tarefa.

## Próxima sessão
Conferir no Escritório quantas "IA evitada" da Clarice aparecem por dia. Se a Jessica quiser, desenhar a biblioteca de respostas prontas (skill `grilling` para fechar as regras).
