# Reunião comercial semanal com a diretoria: como montar o relatório

Pedido da Jessica (20/10/2026): Claude é o **assistente da reunião semanal** dela com os superiores. Em qualquer conta ou perfil do Claude, o relatório sai com a mesma qualidade descrita aqui. Ela costuma pedir pouco antes da reunião, então trabalhe rápido: abra o documento primeiro e preencha seção por seção enquanto ela acompanha.

Palavras dela: "não quero só resumo, quero clicar e passar os dados certos para eles nessa call, mostrar que eu sei do que estou falando, incluindo propostas quentes".

## Relatórios já feitos (use o último como modelo)

| Reunião | Documento |
| --- | --- |
| 20/10/2026 (semana de 13 a 20/10) | https://claude.ai/code/artifact/0646972c-2dda-4af5-bdaa-d231fa14fd34 |
| 14/10/2026 (01 a 14/10) | https://claude.ai/code/artifact/4f0ce3dc-e7be-44da-8e22-9fe996635f21 |

Os documentos são Claude Docs da conta da Jessica. Se esta conta não abrir o link, crie um documento novo nesta conta e avise a Jessica para compartilhar o antigo, se ela quiser comparar.

## Passo a passo

1. **Abra o documento na hora** (Claude Docs): título `Reunião de alinhamento comercial: <dd> a <dd>/<mm>/<aaaa>`, com as seções abaixo como blocos pendentes.
2. **Rode o script de dados em produção** (só leitura). O acesso ao servidor está no arquivo local `C:\Users\prosy\CONTEXTO-CRM-COMERCIAL-LOCAL.md`, seção "Ler dados de produção". O comando, dentro de `backend/` no servidor e com o `.env` carregado, é:
   `node scripts/relatorio-reuniao-semanal.cjs <primeiro dia da semana, AAAA-MM-DD>`
   Se o script ainda não estiver publicado no servidor, copie o arquivo do repositório com `scp`, rode e apague depois, como manda o arquivo local.
3. **Preencha uma seção por chamada**, na ordem abaixo, conferindo cada total (veja "Armadilhas").
4. **No fim:** registre no `ESTADO.md` (data, link do documento e os números-chave), acrescente o link na tabela acima e faça commit e push.

## Seções (em linha lógica, nesta ordem)

1. **Resumo em 1 minuto:** a mensagem central em uma frase e uma tabela com colunas Semana · Mês · Ano. Linhas: leads novos, primeiros contatos, responderam, avançaram, propostas, contratos (com R$/mês). Inclua também o total de leads da base.
2. **Ponto de partida:** o que foi decidido na reunião anterior e as metas da semana (no ESTADO.md e no relatório anterior).
3. **Prospecção da semana:** uma tabela por agente (contatos, respostas, taxa) e outra de "onde estão os contatados" (avançaram, sem interesse, responderam aguardando, sem resposta). As quatro linhas precisam somar o total de contatados.
4. **De onde vêm os leads:** uma tabela de origem × semana, mês, ano e total, com o segmento do mês.
5. **Funil e resultados:** o funil do mês em uma linha (leads → contatos → respostas → avançaram → demonstrações → propostas → contratos), mais uma tabela mês a mês do ano, a lista de contratos recentes com a situação e as vendas adicionais.
6. **Oportunidades quentes (clicáveis):** três tabelas (em conversa · pediram demonstração · com a equipe), cada linha com o link `https://comercial.prosystemnet.com/whatsapp?conversa=<conversaId>`, e mais uma tabela de **propostas expiradas para reativar**, com a soma da mensalidade.
7. **Churn:** casos por situação no ano, motivos agrupados, tabela dos casos do mês (cliente, cidade, motivo, situação, atraso) e os casos antigos ainda abertos. Aponte padrões, como a mesma rede saindo.
8. **Melhorias entregues no CRM:** uma tabela com data · melhoria · efeito para o comercial, tirada do registro do ESTADO.md desde a reunião anterior. Escreva em linguagem de negócio, não técnica.
9. **O que está travando:** uma lista numerada, com o maior gargalo primeiro e sempre com número.
10. **Plano da semana:** uma tabela com ação · meta · responsável · prazo, ligada às metas semanais do placar.
11. **Decisões que pedimos à diretoria:** uma lista de tarefas, terminando com uma linha que diz de onde e de que hora são os dados.

Links úteis do CRM para pôr no texto:
- `/escritorio` (placar);
- `/contratos`;
- `/propostas-comerciais`;
- `/casos` (churn);
- `/churn-ceo` (envio ao CEO);
- `/vendas-adicionais`;
- `/ativos`;
- `/leads-sdr`.

Todos ficam sob `https://comercial.prosystemnet.com`.

## Armadilhas (já aconteceram)

- **"Responderam"** inclui resposta automática de loja (robô). O que mostra avanço real é o status: CONVERSANDO, DEMO, VENDEDORA ou HUMANO. Deixe isso escrito no relatório.
- **O MySQL junta origens sem olhar acento nem maiúscula:** "INDICACAO" e "Indicação" aparecem como uma linha só. Confira se a soma das origens fecha com o total de leads.
- **"Prospecção ativa"** (110 leads, manual) **não é o buscador.** O buscador do Heitor é a origem `PROSPECCAO`, campanha "Prospecção Heitor".
- **Contratos** contam pelo módulo de contratos do CRM, que só passou a ser usado em junho de 2026. Os meses anteriores aparecem zerados. Diga isso no relatório.
- **Propostas:** filtre `deleted_at` nulo. As de status `EXPIRADA` formam a lista de reativação.
- **Motivo de churn** é texto livre. Agrupe à mão (troca de sistema ou concorrente, inadimplência, encerramento, não informou, suporte) e confira se a soma dá o total de casos.
- **Dados pessoais:** só nomes de empresa no documento. Nada de telefone, CPF ou e-mail, e no máximo o primeiro nome de uma pessoa.
- **Números ao vivo mudam:** diga a hora em que os dados foram tirados.
