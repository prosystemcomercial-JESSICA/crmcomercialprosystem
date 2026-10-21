# 21/10/2026: Analista de Resultados e plano para 5 contratos

## Pedido

A Jessica pediu "um agente analisador de resultados, que deve ser entregue toda sexta". Ele deve trazer prospecção, números, análise das conversas, leads com chance de conversão, como aumentar o engajamento, como chegar ao menos à proposta, leads por temperatura, ranking dos retornos, decisores conseguidos, sistemas mais citados e "principalmente como converter mais". Contexto dela: "estamos com zero conversões… temos apenas 7 dias úteis para converter 5 leads em contratos", com campanhas para farmácias ou padarias se for preciso.

Durante a tarefa, ela acrescentou:
- o resumo de sexta vai **só para um WhatsApp** (o número que ela indicou; `<REMOVIDO>` aqui);
- quer o relatório como **página web dinâmica**, bem estruturada e já com as ações da próxima semana.

## Feito

- **Primeira análise (manual, dados de produção das 09h19):** documento no Claude Docs https://claude.ai/artifact/HCSDkUnL1KvhgAAHJbwrVv. Traz números, 20 leads com sinal (cada um com link da conversa), 18 propostas para reativar, ranking, decisores, sistemas, o que trava as conversas, plano dia a dia até 29/10, campanhas e decisões. Os números-chave estão no ESTADO.md (21/10).
- **No CRM:**
  - regras em `backend/src/lib/analista-resultados.ts`;
  - serviço em `backend/src/services/analista-resultados.service.ts`, com leitura das 25 conversas com mais sinal pela IA e ações da próxima semana;
  - rotas `GET /comercial/analista` e `POST /comercial/analista/gerar` em `routes/complementos.ts`;
  - rotina de sexta às 16h em `especialista.service.ts › rodarRafael`;
  - página `frontend/app/analista/page.tsx` e item no menu (`DashboardLayout.tsx`), com chamadas em `api-client.ts`.
- **Script de estudo (só leitura):** `backend/scripts/analise-resultados-semana.cjs`.
- **Documentação:** os 6 documentos de `docs/produto/`, o manual, as novidades, o guia `docs/contexto/analista-resultados.md`, o LEIA-PRIMEIRO e o ESTADO.md.

## Verificado

- `npx vitest run tests/analista-resultados.test.ts`: 9 testes passando.
- `tsc` do backend: nenhum erro nos arquivos novos. Os 2 erros de `complementos.ts` (linhas 185 e 198) já existiam antes; conferido com `git stash`.
- `tsc` do frontend: sem erros nos arquivos mudados.
- Build do Next, CI e deploy: **não verificados** no momento em que este relatório foi escrito. Ver o registro de deploy no ESTADO.md ou o complemento abaixo.

## Decisões e porquês

- **Página no CRM em vez de documento solto:** o pedido foi página dinâmica. O link do WhatsApp abre direto nela e os leads abrem a conversa.
- **Relatório em `ConfiguracaoIntegracao`:** evita mudar o banco, porque o deploy recusa mudança fora da lista `PERMITIDO`.
- **Número de destino no banco** (`analista.whatsapp_destino`), não no código: o repositório é público.
- **Temperatura do analista própria**, mais dura que o termômetro do agente: o termômetro marcava 170 frios, 9 mornos e nenhum quente, mesmo com leads pedindo preço.
- **"Prosystem" removido da lista de sistemas:** o cliente escreve "quero o Prosystem", e isso inflava o número de "já usa".
- **Falha da IA não derruba o relatório:** os números saem mesmo assim.

## Pendente

- **Jessica e diretoria:**
  - condição de fechamento até 30/10;
  - divisão das ligações (Jessica com farmácias, Sarah com padarias);
  - aprovar a pergunta "qual sistema vocês usam?" nos agentes;
  - aviso imediato quando o cliente pedir preço ou uma pessoa;
  - cruzar o buscador com a base de clientes;
  - verba e oferta dos anúncios;
  - política de parceria para a entidade do Nivaldo.
- **Atenção:** o número de destino indicado é o próprio número da empresa, que é quem envia. A mensagem deve aparecer na conversa "você mesmo"; conferir na sexta, 23/10, depois das 16h.
- Proposta da Farmácia Amaro com Pro e Plus no mesmo preço (R$ 350): reenviar corrigida.

## Próxima sessão

Na sexta, 23/10, depois das 16h: abrir `/analista`, conferir se o relatório da semana foi gerado e se o resumo chegou ao WhatsApp configurado. Conferir também os logs `[ANALISTA]` em `comercial-backend-error.log`. Em 29/10, contar os contratos contra a meta de 5. Skills: `relatorio-final` e `handoff`.
