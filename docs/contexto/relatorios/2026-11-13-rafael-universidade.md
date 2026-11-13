# 13/11/2026: o Rafael estudou a base de conhecimento (Universidade Prosystem)

## Pedido
A Jessica perguntou se o Rafael acessava sozinho a base de conhecimento. A resposta foi não: ele estudava vendas na internet e lia só o material aprovado e o CRM. Pedido dela: "Ele tem que estudar a nossa base de conhecimentos", e depois: "Leia por aqui e passe tudo para ele, coloque direto no conhecimento dele".

## Feito
- `backend/scripts/ler-universidade.ts`: percorre https://universidade.prosystemnet.com/base-conhecimento (site público: índice → categorias → artigos) e grava o texto de cada artigo em `docs/comercial/universidade-prosystem.json`. Resultado: **139 artigos** em 27 categorias, cerca de 330 mil letras, sem o rodapé "Este artigo foi útil?".
- `backend/src/lib/assistente/universidade.ts`:
  - `conhecimentoProduto()` junta o guia comercial e o índice de todos os artigos.
  - `trechosUniversidade()` e `artigosRelacionados()` trazem os artigos completos ligados a um assunto.
- `backend/src/services/especialista.service.ts`:
  - A nova `sistemaRafael()` substitui `QUEM + instrucoesPara` nas 8 chamadas do Rafael, então o conhecimento de produto entra em todas.
  - `pesquisarDuvida` recebe os artigos ligados à dúvida e a regra de usar a Universidade antes da internet, citar o link e não perguntar à Jessica o que a base já responde.
- Documentos atualizados:
  - `docs/produto/01` a `06`;
  - `docs/comercial/manual-de-uso-assistente.md` e `novidades-crm.html`;
  - `docs/contexto/ESTADO.md` e `LEIA-PRIMEIRO.md`.
- Commit e deploy: veja o ESTADO.md (entrada de 13/11, "Rafael estudou a base de conhecimento").

## Verificado
- `npx tsc --noEmit -p . --rootDir .`: nenhum erro nos arquivos mexidos.
- `npx vitest run tests/universidade.test.ts`: 3/3.
- Perguntas reais testadas contra a base, todas achando os artigos certos: iFood, nota fiscal, balança Toledo, Farmácia Popular, backup, entregas.
- Ponto fraco: "relatório de vendas pelo WhatsApp" achou "Avisos via WhatsApp" e uma nota de versão. O resultado é aceitável, mas a busca é por palavras.
- **Deploy `bb363ab` no ar** (backup 465M, banco sem alterações). No servidor: 139 artigos carregados, conhecimento fixo de 12.847 letras, a dúvida de iFood acha o artigo.
- **Tropeço:** o texto da Laya (outra sessão, ainda sem commit) entrou em `e50d2a4`; a limpeza `82e4e7b` saiu depois de a Laya ser commitada (`c9c2c50`) e apagou o texto dela; desfeito em `bb363ab`, árvore idêntica a `c9c2c50`.
- Não verificado: o Rafael respondendo uma dúvida real em produção com a base. Vai aparecer na próxima dúvida ou revisão.

## Decisões e porquês
- **Conteúdo no repositório, não no banco:** não muda a estrutura do banco e o deploy fica simples. O servidor já lê `docs/comercial` (o `guiaComercial` faz isso).
- **Artigos inteiros só por assunto:** o bloco fixo tem cerca de 13 mil letras (guia mais índice); os artigos completos entram só na pesquisa de dúvidas, para não pesar em toda chamada.
- **A base não foi para o `guiaComercial` dos outros agentes:** o pedido era o conhecimento do Rafael. O Rafael repassa o conteúdo aos agentes pelas respostas de dúvidas aprovadas e pelos treinos, que já entram no guia.
- **PDFs não lidos:** os anexos (Manual Geral e manual da Manipulação) ficaram de fora; só o texto das páginas foi lido.

## Pendente
- A releitura não é automática. Quando sair artigo ou versão nova na Universidade, rodar `cd backend && npx tsx scripts/ler-universidade.ts`, depois commit e deploy. Se a Jessica quiser a releitura automática (por exemplo, mensal no servidor), é uma tarefa nova; quem decide é a Jessica.
- Ler os PDFs dos manuais, se a Jessica quiser.

## Próxima sessão
Para atualizar a base: rodar o script, conferir com `tests/universidade.test.ts`, depois commit e deploy (`backend/scripts/deploy-vps.sh`). Para checar o efeito: no Escritório › Rafael, ver se as próximas "Resposta: ..." citam links da Universidade.

## Continuação (mesmo dia): respostas às perguntas pendentes
- **Pedido:** "Todas as perguntas pendentes do Rafael sobre funções do sistema devem ser respondidas agora."
- **Feito:** `responderPendentesPelaUniversidade` + script `rafael-responder-universidade.ts` (`40263c4`, `184024e`). A primeira simulação foi rígida demais (6 respostas), então a regra foi ajustada: responde quando a Universidade confirma o ponto central, e o detalhe vira pergunta curta para a Jessica.
- **Verificado em produção:** 113 abertas → 33 respondidas (32 DICAs aprovadas), 72 não eram função, 8 sem cobertura; 27 perguntas curtas novas; o painel ficou com 107 abertas. Os números estão no ESTADO.md.
- **Decisão:** gravei direto, sem segunda simulação, porque a Jessica pediu "agora" e as respostas da primeira simulação estavam fiéis aos artigos. Uma resposta ruim se arquiva no painel do Rafael.
- **Pendente (Jessica):** fluxo de produto de revenda usado na produção e a parte fiscal disso, PBM no Farma Basic ou só no Pro (divergência entre artigo e guia), planos do Fidelimax, SNGPC na manipulação.
- **Deploy:** o código foi publicado em `40263c4` por esta sessão e depois no deploy de outra sessão (servidor em `46318f9`).

## Continuação 2 (13/11, tarde): segunda rodada pedida pela Jessica
- **Pedido:** "responda as perguntas sobre ferramentas do Rafael com a base de conhecimento".
- **Feito:** simulação em produção (`scripts/rafael-responder-universidade.ts`, sem gravar): 107 perguntas abertas → 18 respondidas pela Universidade, 75 não são função do sistema, 14 sem cobertura. As 18 foram gravadas **exatamente como simuladas** por script temporário (apagado), sem rodar a IA de novo. Ajuste manual: as 2 sobre o Fidelimax se contradiziam ("a partir do Pro" contra "o artigo não informa"); ficou a resposta do artigo (pontos, cashback, prêmios, link) e "não prometa plano", com a pergunta curta do plano para a Jessica.
- **Verificado em produção:** 18 respondidas (DICAs aprovadas, origem `universidade`, e RESPOSTA no mural), 17 perguntas curtas novas (o detalhe que só a Jessica confirma), 0 não encontradas. Perguntas do Rafael abertas: 107 → 106 (PERGUNTA). Somando as DUVIDA, o painel tem 196 abertas.
- **Conferido à mão nos 139 artigos:** não há nada sobre revenda usada na produção (Padaria Guarani), material de construção, nota emitida para outro CNPJ nem grade cor/tamanho para roupas. Essas perguntas ficam com a Jessica.
- **Ponto de atenção:** como cada resposta parcial devolve uma pergunta curta, o total de abertas quase não cai. As perguntas novas são mais objetivas (plano de um recurso, se vale para padaria ou manipulação) e se respondem em 1 frase.
