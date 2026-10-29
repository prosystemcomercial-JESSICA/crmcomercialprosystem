# 29/10/2026: card da implantação sem repetição (roteiro do onboarding marcado pela ficha)

## Pedido
A Jessica perguntou se o Onboarding técnico não repetia a Ficha de coleta, e depois decidiu:
- "As 15 perguntas ficam em uma aba só", no Onboarding.
- "O checklist precisa ser marcado sozinho com o preenchimento das informações."
- "Revise todas as abas desses cards… deixar mais organizado e menos repetitivo."

## Feito
- **Perguntas do primeiro contato:** ficam só no Onboarding técnico. A Ficha de coleta esconde esses campos e mostra "X de N respondidas" com o botão "Abrir as perguntas". As respostas continuam em `Implantacao.coleta`.
- **Roteiro automático:** `ONBOARDING_PELA_FICHA` liga 15 itens do roteiro aos campos da ficha, e o item das perguntas também entra.
  - As funções novas ficam em `backend/src/lib/implantacao/portal.ts`: `camposDoItemOnboarding`, `itemPelaFicha`, `dadosDaFicha` e `rotuloCampoColeta`.
  - A sincronização é `sincronizarOnboardingPelaFicha`, em `backend/src/services/implantacao-portal.service.ts`. Roda ao salvar a ficha, ao abrir o card, na designação do técnico e no realinhamento ao perfil.
  - Marcar ou desmarcar à mão contra a ficha é recusado em `backend/src/routes/implantacoes.ts`.
- **Na tela** (`frontend/components/implantacao/Portal.tsx`):
  - o item automático fica com a caixinha travada e mostra "falta na ficha:" com links;
  - cada link usa `focarCampo` para abrir a seção certa, rolar até o campo e destacá-lo;
  - as perguntas aparecem mesmo antes de o técnico ser designado.
- **Outras arrumações:**
  - a Tela do Suporte saiu da Ficha de coleta e foi para Virada e cobrança (`TelaSuporte`);
  - "Ficha do cliente" passou a se chamar "Cadastro do cliente".
- **Documentos:** os seis de `docs/produto/`, o manual de uso, as novidades e o ESTADO.md. Os detalhes técnicos estão no bloco "Atualização 29/10/2026: card da implantação sem repetição".

## Verificado
- `npx tsc` sem erros no backend (nos arquivos alterados) e no frontend (0 linhas).
- `vitest` com os 10 arquivos de teste de implantação: 77 testes passando, incluindo o novo `backend/tests/implantacao-onboarding-ficha.test.ts`.
- **Não verificado nesta etapa:** a tela no navegador e o comportamento com dados de produção. O deploy está registrado no ESTADO.md.

## Decisões e porquês
- **Desmarcar automático:** só desmarca o que a ficha marcou (`feito_por = "Ficha de coleta (automático)"`), mais o item das perguntas, como já era antes. Nada que o técnico marcou à mão se perde.
- **Onboarding concluído:** nunca desmarca nada, para uma implantação em andamento não travar de novo se apagarem um dado da ficha.
- **Itens de ação continuam à mão:** apresentar-se, etapas e prazos, razão social e CNPJ, computadores e Windows, pendências e a aprovação do cliente.
- **Endereço:** o item "IE, regime e endereço" se marca só com IE e regime, porque o endereço não está na ficha (vem do cadastro).
- **Cards já abertos:** são ajustados ao abrir o card, sem script em produção.
- **Bug corrigido de passagem:** antes, a marcação automática das perguntas não fechava o onboarding (`onboarding_concluido_em`). Agora fecha.
- **Ficou de fora:** a repetição pequena entre os tempos da Visão geral e a seção Tempos, de propósito, porque a Visão geral é um resumo.

## Pendente
- **Jessica:** dizer se quer que algum item de ação também seja automático, ou que algum automático volte a ser marcado à mão.
- **Ideia, não decidida:** preencher a ficha com a IE, o regime e o contato que já estão no cadastro do cliente.

## Próxima sessão
Abrir um card de implantação em onboarding no portal técnico e conferir os itens "automático" e os links "falta na ficha". Skills: `run` ou `webapp-testing` para ver a tela.
