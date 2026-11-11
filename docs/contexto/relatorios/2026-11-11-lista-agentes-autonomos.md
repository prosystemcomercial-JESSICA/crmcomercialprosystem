# Lista dos agentes autônomos (11/11/2026)

## Pedido
A Jessica pediu para terminar a lista: Joana (artigo semanal com pesquisa própria e e-mail para os leads), Mila (oferta de
upgrade para clientes da base), Olívia (relatório de perdas para concorrentes e argumento para a Caroline) e as ligações
Helena → Mila e resumo diário da Marta com "Esperando você".

## O que foi feito
- **Joana** (`backend/src/services/joana.service.ts`, `routes/joana.ts`, `PainelJoana.tsx`): edição semanal (quinta de manhã),
  pesquisa própria na internet somada às pesquisas da Sofia, artigo da semana abrindo o e-mail. O e-mail passa a ir para os
  clientes ativos e para os leads em aberto com e-mail (fora perdidos, fechados e descadastrados). A confirmação de aprovar
  mostra quantos recebem. O WhatsApp continua só para a etiqueta Informativo Prosystem.
- **Mila** (`services/mila-upgrade.service.ts`, `lib/assistente/mila-upgrade.ts`): a cada 15 dias, na quarta à tarde, escolhe
  até 30 clientes ativos com 8 meses ou mais, fora do Plus, sem alerta de atenção e sem oferta nos últimos 90 dias. Escreve
  um e-mail de convite sem preço e deixa no Painel da Mila para aprovar. Aprovado, sai em lotes de 20 nos dias úteis e fica
  anotado no cadastro do cliente. Pelo painel, o tema "upgrade" monta a oferta na hora.
- **Olívia** (`relatorioPerdasConcorrentes` em `services/especialista.service.ts`, `lib/assistente/olivia-perdas.ts`): uma vez
  por mês, na sexta de manhã, e a cada pesquisa de concorrência pedida. Conta os leads perdidos para outros sistemas em 90
  dias, por sistema e por segmento (números do CRM), e escreve a leitura e os argumentos para a Caroline. Aprovados, os
  argumentos viram instrução da Caroline. Ligação nova no organograma: Olívia → Caroline.
- **Helena → Mila** (`passarNotaParaMila` em `services/assistente-posvenda.service.ts`): toda nota da pesquisa de satisfação
  passa para a Mila; nota ruim ou regular marca o cliente como "em atenção" na base.
- **Marta** (`resumoDiarioMarta` em `services/escritorio-painel.service.ts`, `textoResumoMarta` em
  `lib/assistente/escritorio-setores.ts`): nos dias úteis, entre 8h e 10h, manda no WhatsApp da gestora o que espera por ela
  e o que precisa de atenção.
- **Documentação:** os seis documentos de `docs/produto/`, o manual e as novidades, incluindo o Escritório vivo de 10/11.

## Conferido
- Tipos do servidor e da tela sem erros nos arquivos alterados.
- Testes: `olivia-perdas` (3), `mila-upgrade` (3) e `escritorio-setores` (5), todos passando.

## Não conferido
- Nenhuma das rotinas rodou com dados reais: a leitura em produção foi bloqueada pelas permissões da sessão. Não sei quantos
  leads têm e-mail nem quantos clientes entram na oferta de upgrade.
- A pesquisa própria da Joana depende de a rota de IA dela aceitar busca na internet. Se falhar, ela usa só as pesquisas da
  Sofia (o erro fica no log como `[JOANA] pesquisa própria`).
- O servidor de e-mail não foi testado com o volume novo de leads.

## Pendências
- O descadastro do Informativo continua sendo "responda SAIR", e ninguém processa essas respostas automaticamente. Com o
  e-mail indo para todos os leads em aberto, vale criar um link de descadastro.
- O disco C: do computador encheu durante o trabalho. Limpei o cache do npm (1,6 GB) para conseguir gravar.
