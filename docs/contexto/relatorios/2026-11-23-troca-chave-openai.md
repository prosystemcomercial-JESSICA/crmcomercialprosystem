# 23/11/2026: nova troca da chave da OpenAI

## Pedido
A Jessica pediu: "quero trocar a chave api da openai". Depois disse: "faça o teste se está funcionando".

## Feito
- Criei um arquivo temporário neste computador, só com a linha `OPENAI_API_KEY=`, e abri no VS Code. A Jessica colou a chave nova nele. Desta vez não baixei o `.env` inteiro, para as outras chaves não passarem pelo computador.
- O arquivo veio como `jam OPENAI_API_KEY=sk-proj-…`. Usei só a chave (`sk-…`, 164 caracteres).
- Testei a chave neste computador antes de mexer no servidor.
- No servidor (`/var/www/comercial-prosystem/backend`): backup `.env.bak-20261123-1211-openai`, troca só da linha `OPENAI_API_KEY` (diff de 1 linha, dono e permissões mantidos) e `pm2 restart comercial-backend --update-env`.
- Apaguei o arquivo local com a chave. Não mexi no código.

## Verificado
- A chave antiga era recusada (HTTP 401). Pelos registros de `ia.erros`, isso vinha acontecendo desde 19/11, com 2 a 3 registros por dia, porque a OpenAI entrava em pausa e as IAs grátis cobriam.
- Chave nova: a lista de modelos respondeu HTTP 200, com `gpt-6-luna` e `gpt-4o-mini` liberados, e o `gpt-6-luna` respondeu "ok" em `/v1/responses`.
- Depois do reinício: `comercial-backend` online, `/api/health` 200, o teste com a chave e o modelo do `.env` do servidor respondeu "ok", e o log mostra `.env: ... corrigidas: OPENAI_API_KEY`. Os erros de chave inválida no log são de 12:11:03, antes do reinício (12:11:56).
- Caroline, Julio e Luiz Felipe continuam com `ativa: true`. Desta vez a chave recusada não os desligou.
- **Não verificado:** uma resposta real de um assistente em produção usando a OpenAI, porque as IAs grátis vêm antes dela na ordem.

## Decisões e porquês
- Usei um arquivo com uma linha só, em vez do `.env` inteiro: assim as outras chaves não passam pelo computador.
- Troquei a linha direto no servidor, a partir do backup, e conferi que só ela mudou.

## Pendente
- Nada desta tarefa. Os backups antigos do `.env` com chaves (`.env.bak-*`) podem ser apagados quando a Jessica quiser.

## Próxima sessão
- Se a OpenAI voltar a falhar, teste a chave em `/v1/responses` com texto sem acento: no Git Bash, o acento quebra o JSON do curl (`invalid_json`).
