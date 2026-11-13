# 13/11/2026: Diretoria dos agentes (Vitória CEO, Gustavo e Renata gerentes)

## Pedido
A Jessica pediu:
- "um gerente geral, um CEO, para traçar metas, fazer planejamentos comerciais, analisar resultados no contexto geral, tudo que um CEO faz, pesquise sobre isso";
- "um gerente que é quem vai cobrar todos os agentes caso estejam errando muito";
- "o Rafael deve passar o desempenho de cada um em conjunto com a Laya para que o CEO tome as providências".

Depois acrescentou "quero uma gerente mulher também". Ela escolheu os dois gerentes juntos.

Respostas dela às perguntas:
- liberdade total para a CEO;
- metas para "tudo" (agentes e vendedoras);
- nomes Vitória (CEO) e Gustavo (gerente).

## Feito
- Regras puras em `backend/src/lib/assistente/diretoria.ts`: limites, escada de cobrança, texto da cobrança, catálogo de indicadores, leitura segura do plano e agenda em horário de Brasília.
- Serviço em `backend/src/services/diretoria.service.ts`:
  - números de 7 dias por agente;
  - boletim do Rafael com a Laya;
  - rodada dos gerentes;
  - Vitória semanal e por escalação;
  - aplicar e desfazer providências;
  - medição das metas, painel e estados no Escritório.
- Rotas em `backend/src/routes/diretoria.ts`.
- Mudanças em arquivos existentes:
  - agentes em `escritorio.ts`;
  - setor e ligações em `escritorio-setores.ts`;
  - `REMETENTE` exportado em `escritorio-painel.service.ts`;
  - IA atribuída em `uso-ia-agentes.ts`;
  - boletim e plano fora da lista e do caderno do Rafael (`routes/especialista.ts`, `especialista.service.ts`);
  - agendador e rota em `server.ts`;
  - estados em `escritorio.service.ts`.
- Telas:
  - `frontend/components/escritorio/PainelDiretoria.tsx`;
  - página do Escritório;
  - menu de setores;
  - sala viva: a diretoria senta na sala da Jessica, com `isolation:isolate` na caixa da sala;
  - perfis;
  - `api-client`.
- Testes: `backend/tests/diretoria.test.ts`, ajuste em `tests/escritorio.test.ts` e `frontend/e2e/diretoria.spec.ts`.
- Documentos: os seis de `docs/produto`, o manual, as novidades e o `ESTADO.md`.

## Verificado
- vitest: `diretoria` 12/12 e escritório, setores e uso de IA 28/28.
- `tsc` do backend: nenhum erro nos arquivos mexidos (59 no total, todos antigos).
- `tsc` do frontend: 0 erros.
- Playwright com API simulada: 2/2. Desfazer chama a rota certa, o painel cabe em 390 e 360 px e a sala mostra a diretoria. Prints em `frontend/test-results/diretoria-*.png`.
- Suíte inteira local: 5 falhas, todas em testes que precisam de MySQL (PrismaClientInitializationError). Não têm relação com esta mudança.
- Rodada real com IA em produção: **não verificado**. A primeira é o boletim de sexta, 13/11, às 16h.

## Decisões e porquês
- **Sem tabela nova.** Tudo cabe em `EspecialistaDoc`, `AgenteNota`, `AgenteInstrucao`, `Meta` e `ConfiguracaoIntegracao`. Assim o deploy não esbarra na trava de banco.
- **Gerentes por regra, sem IA:** cobrança previsível e barata. A IA fica com o boletim (Rafael) e com a Vitória.
- **Falha de IA não gera cobrança.** É problema técnico e aparece separada.
- **A Vitória não altera meta lançada à mão pela Jessica**, mesmo com liberdade total. Sobrescrever o trabalho dela não é desfazível de forma limpa.
- **Pausa só para quem conversa com cliente**, com prazo de 1 a 3 dias. Reaproveita a pausa automática que já existe e o agente volta sozinho.
- **Renata no lugar de Beatriz,** por causa da Bia (recepção).
- **Sala:** a diretoria senta na sala da Jessica, para não aumentar a planta.
- **Rodada da diretoria em segundo plano no agendador,** para não atrasar os lembretes de demonstração.

## Pendente
- Acompanhar a primeira semana:
  - se os limites (25%, 40%, nota 6 e 4) cobram demais ou de menos;
  - se a Vitória está criando regra repetida.
- Ajuste em `LIMITES` (`diretoria.ts`) ou no prompt `QUEM_VITORIA` (`diretoria.service.ts`).
- Quem decide os ajustes: a Jessica.

## Próxima sessão
1. Depois de sexta, 16h: ler o boletim no painel da Vitória (aba Boletim).
2. Às 18h: ver as cobranças.
3. Na segunda: ler o plano, conferir as providências aplicadas e se o resumo chegou no WhatsApp.

Skill sugerida: `diagnosing-bugs` se alguma rodada não acontecer. O log no servidor aparece com `[DIRETORIA]`.
