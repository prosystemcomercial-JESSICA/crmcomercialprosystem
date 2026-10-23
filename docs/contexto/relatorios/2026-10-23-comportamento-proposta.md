# 23/10/2026: comportamento do cliente na proposta

## Pedido
A Jessica perguntou: "Nós monitoramos as propostas? Qual o caminho do cliente, quanto tempo ele fica na proposta, qual o comportamento, quantas vezes abre e fecha". E completou: "Precisamos monitorar isso para entender se o cliente vê tudo ou se ele vai direto para os valores". Depois do plano apresentado, respondeu "Faça", sem escolher os avisos.

## Feito
- Antes desta mudança, o CRM só marcava VISUALIZADA na primeira abertura e mandava o aviso "abriu a proposta".
- **Rastro no link do cliente:** `frontend/lib/proposta-rastro.ts`, injetado em `frontend/app/p/[...token]/route.ts` no deck (só quando `modeLocked`, ou seja, `?modo=cliente`) e no express.
- **Backend:**
  - `backend/src/lib/proposta-visitas.ts`: validação, mapa das telas, resumo e texto do aviso;
  - rotas `POST /p/:token/rastro`, `GET /propostas-comerciais/:id/comportamento` e `GET /propostas-comerciais-visitas` em `backend/src/routes/propostas-comerciais.ts`;
  - aviso novo `proposta_voltou` em `backend/src/lib/assistente/gestao.ts`.
- **Banco:** tabela nova `PropostaVisita` (`backend/prisma/schema.prisma`).
- **Tela:** `frontend/components/propostas/ComportamentoCliente.tsx` (painel e selo), ligado em `frontend/app/propostas-comerciais/page.tsx`. A janela da proposta passou a rolar.
- **Documentos:** os 6 de `docs/produto/`, o manual, as novidades e o `ESTADO.md`. O detalhe técnico está no 02-TRD, na seção "Novidade 23/10/2026".

## Verificado
- `tests/proposta-visitas.test.ts`: 6 testes passando.
- `scripts/checar-tipos.mjs` (backend): nenhum erro novo. `tsc` do frontend: sem erros nos arquivos mudados.
- Simulação do script do navegador num navegador falso: envia sessão, tempo por tela e caminho; com `accessToken` no `localStorage`, não roda.
- SQL da tabela gerado por `prisma migrate diff` do schema anterior para o novo: só um `CREATE TABLE`.
- **Não verificado:** a criação da tabela e o deploy em produção (veja "Publicação"); um teste num navegador real, de ponta a ponta.

## Decisões e porquês
- **Avisos:** a Jessica não escolheu. Ficou só "voltou à proposta" (abertura nova depois de 30 min parada), que é o momento de chamar o cliente. "Muito tempo nos valores" fica como leitura no painel, não como aviso, para não encher o WhatsApp.
- **Equipe fora do rastro:** a equipe é reconhecida pelo login do CRM no navegador (`accessToken`, mesmo domínio). O modo apresentador não grava.
- **Um registro por abertura:** o navegador manda o acumulado, e o servidor só aceita valores que crescem. Assim não há uma linha por segundo e um envio atrasado não apaga o mais novo.
- **Sem chave estrangeira para a proposta,** para a tabela nova não tocar em `PropostaComercial`. As propostas excluídas são só marcadas, nunca apagadas.
- **Abuso:** o link é público. Por isso há teto de 500 aberturas por proposta e limites de tamanho em tudo que chega.

## Pendente
- Jessica: se já personalizou os avisos, marcar "Cliente voltou à proposta" nas preferências.
- Ideias para depois (decisão da Jessica): mandar o aviso também para a vendedora da proposta e levar o comportamento para o Analista de Resultados.

## Próxima sessão
- Depois da publicação, abra o link de uma proposta numa aba anônima (sem login) por 1 min e confira o painel no CRM.
- Skill sugerida: `diagnosing-bugs`, se o painel ficar vazio.

## Publicação
- `dcc0db2` publicado em 23/10. Antes do deploy: backup do banco (383 MB, `/root/backups-deploy/pre-proposta-visita-*.sql.gz`) e criação de `PropostaVisita` com o SQL do `prisma migrate diff` (só `CREATE TABLE`). O deploy confirmou "banco sem alterações", com a pipeline verde.
- Teste de fora: `POST /p/naoexiste/rastro` com corpo inválido deu 400; com proposta inexistente, 404.
- **Falha achada no teste:** `GET /propostas-comerciais-visitas` respondia sem login (devolvia vazio, porque não havia visitas ainda). Corrigido no commit seguinte com o mesmo escopo da lista de propostas (`ownerWhere`), também em `/:id/comportamento`.
- Observação (antiga, fora desta tarefa): `GET /propostas-comerciais/:id` e `/:id/historico` não filtram pelo dono. Quem tem o id de uma proposta consegue ler esses dados sem login. Fica para a Jessica decidir a correção.
