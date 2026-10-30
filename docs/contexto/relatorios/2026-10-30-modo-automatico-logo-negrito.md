# Modo automático, logo do escuro e negrito suave (30/10/2026)

## Pedido
Continuação de `2026-10-29-modo-escuro-confortavel.md`. A Jessica respondeu "sim" às duas pendências:
- o CRM abrir sozinho no escuro quando o Windows estiver escuro, para quem nunca escolheu um modo;
- ter uma versão própria do logo para o fundo escuro.

Durante o trabalho ela mandou um print do Portal de Implantação e disse: "esse branco do modo escuro quando está em negrito fica estourado".

## Feito
- `frontend/lib/theme-context.tsx`:
  - sem `ps-theme-mode` salvo, o modo segue `prefers-color-scheme` e acompanha a troca ao vivo;
  - novos `automatico` e `usarAutomatico()`;
  - `setMode`/`toggleMode` salvam a escolha e desligam o automático.
- `frontend/components/configuracoes/Aparencia.tsx` (+ `aparencia.css` com `flex-wrap`): botão **Automático** e a frase "Seguindo o sistema…".
- Logo:
  - `frontend/public/logo-prosystem-escuro.png` foi gerado com `sharp` a partir do `logo-prosystem-cropped.png`. Os pixels azuis viraram #9cc4ee e o branco do play virou transparente.
  - `DashboardLayout.tsx` e `app/portal-tecnico/page.tsx` usam o logo recortado no claro e o escuro no escuro, com 22px de altura.
  - Saiu o filtro de brilho do `globals.css`.
- `frontend/app/globals.css`: no escuro, cada negrito desce um degrau de peso (a Inter é variável).
- Documentação: os 6 docs de produto, o manual, as novidades e o `ESTADO.md`.

## Verificado
- Playwright com API simulada, 10 de 10 verificações ok:
  - sem escolha e com o sistema escuro, o CRM abre escuro e mostra o logo escuro;
  - o botão Automático aparece marcado;
  - quando o sistema muda para claro, o CRM acompanha e mostra o logo recortado;
  - a escolha manual Escuro vale com o sistema claro, inclusive depois de recarregar;
  - o Automático apaga a escolha salva;
  - quem escolheu Claro continua claro com o sistema escuro.
- Fotos conferidas: Configurações e Propostas com os negritos mais finos.
- `tsc` do frontend limpo.
- **Não verificado:** o card do Portal de Implantação do print com dados reais (deve ser conferido em produção).

## Decisões e porquês
- **Logo recortado também no modo claro:** o PNG antigo de 1920x1080, mostrado com 44px de altura, deixava a marca com uns 10px. O motivo do pedido era o tamanho, e ele vale nos dois modos.
- **Negrito afinado em vez de escurecido:** mudar a cor do negrito afetaria textos coloridos que herdam a cor do elemento pai. Baixar o peso tira o halo sem perder o destaque.
- **Automático como terceiro botão:** sem ele, quem escolhesse Claro ou Escuro não teria como voltar a seguir o Windows.

## Pendente
- Nada aberto. Se algum negrito ainda parecer forte, dá para afinar mais (os pesos estão em `globals.css`, bloco "Negrito no escuro").

## Próxima sessão
- Abrir o Portal de Implantação no escuro em produção e comparar com o print da Jessica.
- Skills sugeridas: `example-skills:webapp-testing`.
