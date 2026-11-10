# Diagnóstico do Escritório Virtual e dos agentes (11/10 a 10/11/2026)

Data: 10/11/2026. Pedido da Jessica: relatório detalhado dos últimos 30 dias dos agentes, pesquisa no skills.sh e no GitHub, proposta de redesenho do escritório (setores, quadros, consumo de IA, personagens, quem trabalha com quem), ecossistema mais autônomo e Laya mais participativa.

Documento completo (Claude Docs): https://claude.ai/artifact/JnpazQUFxbZ4ybowAFxZUQ

## O que foi feito

- Leitura **só de leitura** do banco de produção (autorizada pela Jessica nesta sessão) com um script `.cjs` temporário, apagado do servidor em seguida. Tabelas: WhatsappMensagem, SdrLead, SdrMensagem, AgenteNota, EspecialistaDoc, ConfiguracaoIntegracao (`ia.agentes.*`, `ia.uso.*`, `assistente.*`, `heitor.config`), ProspeccaoLocal, Atividade, PropostaComercial, IaAmostra, PesquisaSetor, CampanhaEnvio.
- Organograma dos 17 agentes lido do código (`caroline.service.ts`, `especialista.service.ts`, `equipe.service.ts`) e conferido com o mural (`AgenteNota`).
- Pesquisa externa: skills.sh (nada de SDR/WhatsApp; servem cold-email, writing-for-agents e as skills de design já instaladas) e GitHub (promptfoo, chanl-eval, Star Office UI, Pixel Agents, Sales Agent Benchmark).
- Nenhuma linha de código do CRM mudou.

## Achados principais (números de produção)

- A Caroline se desligou em 29/10 (3 falhas seguidas, chave OpenAI recusada) e só foi religada em **09/11 às 17h44 UTC**; 11 dias sem primeiro contato. Desde então: 21 e 29 primeiros contatos por dia.
- Caroline em 30 dias: 826 mensagens, 359 leads contatados, 205 responderam (57%), 6 demos. Fila: 575 em FILA, 313 aguardando. Julio: 346 mensagens, 58 contatados, 21 responderam, 0 demo. Luiz Felipe: 48 mensagens.
- Heitor: 2.069 lugares, 658 cadastrados (30/dia), muito acima do que a Caroline contata.
- **Julio em laço de falha** de 29/10 a 05/11: até 1.500 falhas de IA por dia (4.940 no período) sem pausa nem aviso. Total de falhas 29/10 a 10/11: 5.469.
- Aprovação prévia desligada nos 3 SDRs: 968 mensagens ENVIADA_AUTO, 0 editadas/descartadas. Qualidade só vem do Rafael: 621 orientações (nenhuma marcada como aplicada), 102 perguntas à Jessica (87 abertas), 14 revisões diárias PROPOSTAS. Rafael → Laya: 1 nota em 30 dias.
- Erros recorrentes (revisões de 09 e 10/11): responder ao robô da loja; várias mensagens sem esperar; não cumprir o encaminhamento; inventar recurso/preço (fidelidade, cashback, mensalidade); texto/link cortado; insistir após objeção; pós-demo sem data; cliente tratado como lead.
- Reações negativas de leads: 9 em 30 dias (1 "isso é um robô?").
- Sofia: 110 falhas em 97 chamadas; Clarice: 32 falhas em 31 chamadas, 1 resposta no mês. Zequinha: 0 envios. Helena: 0 boas-vindas, 7 pesquisas. Laya: 293 análises, 565 amostras, "evitou IA" 0–1 por dia.
- IA: custo gravado só desde 05/11, US$ 1,45 (Caroline US$ 1,24). OpenRouter bate 50/dia (teto grátis → 429). Gemini sem crédito (402). Groq reserva roda em quase toda chamada (431 x 390 em 10/11): conferir a ordem dos provedores em `ia-rotas`/`ia-gemini.service.ts`. Grok: 0 chamadas.

## Plano proposto (resumo; detalhes no documento)

1. Motor que se cuida: pausa após 3 falhas (15 min, 1 h), religar automático, aviso único no WhatsApp da Jessica, semáforo das IAs, freio do Heitor pela fila (>150).
2. Laya guardiã: porteira de robô, sinal de vez, conferência de saída com as lições do Rafael, memória do combinado, lição vira regra, responde perguntas repetidas do Rafael.
3. Base de verdades (planos, preços, descontos, recursos) preenchida pela Jessica uma vez.
4. Fila "Esperando você" com resposta sugerida; resumo diário da Marta.
5. Ligações novas: Rafael→Laya, Laya→SDRs/Bia, Clarice→Rafael, Helena→Mila, Otávio→Mila, Lurdinha→Caroline, Luiz Felipe→Laya, Sofia→Joana→Zequinha.
6. Escritório novo: menu por setores, faixa de saúde, quadro padrão por agente, personagens com estados (digitando, café, área do erro, mesa vazia), organograma vivo, diário de ontem da Laya, nota de qualidade no personagem, linha do tempo do dia.
7. Consumo de IA: falhas por provedor por dia, custo por resultado, teto mensal com aviso a 80%.
8. Exame dos roteiros com promptfoo usando as conversas corrigidas pelo Rafael.

## Pendências (Jessica)

- Aprovar o plano (seção 6 do documento) e o design (seção 8).
- Preencher a base de verdades.
- Repor crédito do Gemini; reconectar os 2 números de WhatsApp; definir teto mensal de IA.

## Não conferido

- Por que Sofia e Clarice falham: precisa olhar o log do backend (`comercial-backend-error.log`) e a rota configurada.
- Se a reserva do Groq roda de fato em dobro ou se o contador conta diferente.
- Marta não tem registro em banco; não foi avaliada.
