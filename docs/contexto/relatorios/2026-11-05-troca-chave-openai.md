# 05/11/2026: troca da chave da OpenAI

## Pedido
A Jessica pediu: "Preciso trocar a chave API da Openai, abra o arquivo para que eu faça isso". Depois disse: "faça o teste".

## Feito
- A chave só fica no `.env` da VPS (`/var/www/comercial-prosystem/backend/.env`, linha `OPENAI_API_KEY`), não no repositório nem no computador. Baixei uma cópia temporária, abri no VS Code e a Jessica colou a chave nova.
- Conferi que só a linha da chave mudou e que a chave nova não tinha espaços nem aspas.
- No servidor: fiz o backup `backend/.env.bak-20261105-1627-openai`, enviei o arquivo novo mantendo dono e permissões, e rodei `pm2 restart comercial-backend --update-env`.
- Apaguei as cópias locais do `.env`.
- Não mexi no código. Atualizei o `ESTADO.md`.

## Verificado
- A chave antiga era recusada pela OpenAI ("Incorrect API key"): a camada paga do ChatGPT estava parada antes da troca.
- Chave nova, antes de a Jessica liberar o modelo: só tinha acesso ao `gpt-4o-mini`.
- Depois que ela liberou o modelo: o `gpt-6-luna` aparece na lista e responde "ok" em `/v1/responses`. Em `/v1/chat/completions` continua dando `model_not_found`, mas o CRM não usa essa rota (`ia-gemini.service.ts`, chamada a `api.openai.com/v1/responses`).
- No servidor, depois do reinício: o processo ficou online, o log de inicialização mostra `.env: ... corrigidas: OPENAI_API_KEY`, o teste com o `.env` do servidor respondeu "ok" com `gpt-6-luna`, e não houve erro de OpenAI no log de erros nos 20 s seguintes.
- **Não verificado:** uma resposta real de um assistente em produção usando a OpenAI. Na ordem atual, Groq, OpenRouter e Gemini grátis vêm antes da OpenAI.

## Decisões e porquês
- Mantive o `gpt-6-luna` em vez de trocar para o `gpt-4o-mini`, que era a única opção da chave no início. A Jessica escolheu liberar o modelo no projeto da OpenAI para manter a qualidade das respostas.
- Enviei o arquivo inteiro editado, depois de conferir com diff que só a linha da chave tinha mudado, em vez de editar o arquivo no servidor.

## Pendente
- Nada desta tarefa. O deploy do custo em reais e de outros commits continua esperando a Jessica: o Git do servidor está desalinhado do GitHub (veja a entrada de 05/11 do `ESTADO.md`).

## Próxima sessão
- Se a IA paga voltar a falhar, veja o log com `pm2 logs comercial-backend --err` e teste a chave em `/v1/responses`, não em `/v1/chat/completions`.
- Os backups antigos do `.env` com chaves (`.env.bak-*`) podem ser apagados quando a Jessica quiser.
