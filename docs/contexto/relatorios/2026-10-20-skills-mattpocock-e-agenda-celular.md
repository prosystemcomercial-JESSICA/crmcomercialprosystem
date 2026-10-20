# 20/10/2026: skills do Matt Pocock e agenda no celular

## Pedido

1. "npx skills add …ui-ux-pro-max-skill --skill ui-styling: essa skill pode nos ajudar a melhorar a agenda através do smartphone?" Depois a Jessica corrigiu: "o smartphone não será principal, mas será um meio de uso quando estiver fora do escritório, principal é desktop".
2. "https://www.skills.sh/mattpocock: analise essas skills, instale o que vai nos ajudar e vamos resolver o que existe para ser resolvido".

## Feito

- Skills do Matt Pocock: comparei as 38 skills de `mattpocock/skills` com `.claude/skills/`, e 37 já estavam instaladas desde 03/10. Commit `54ff661`: 11 skills atualizadas pelo original (ask-matt, code-review, diagnosing-bugs, implement, setup-matt-pocock-skills, tdd, to-tickets, wayfinder, claude-handoff, grilling, teach).
- ESTADO.md: entrada de 20/10 sobre a atualização das skills.
- Agenda: só diagnóstico. Nada mudou na tela.

## Verificado

- Conferi cada skill instalada com o original, uma a uma, pela API do GitHub. As diferenças das 11 eram pequenas (37 linhas a mais e 24 a menos).
- Agenda (`frontend/app/agenda/page.tsx`, 2.274 linhas), lida no código:
  - 301 estilos escritos direto no código, 2 classes e nenhum ajuste por tamanho de tela;
  - a semana e o mês usam grade de 7 colunas (`repeat(7, 1fr)`, linhas ~1132–1217);
  - os indicadores ficam em 5 colunas (~1278);
  - os formulários de criação ficam em 2 colunas (~1727, ~1775);
  - a busca tem largura fixa de 180px (~1099);
  - a vista inicial é "semana" (529).
- **Não verificado:** a agenda aberta de verdade num celular (sem captura de tela).

## Decisões e porquês

- **`chief-of-staff` (única não instalada):** é experimental e manda fazer todo o trabalho em subagentes, o que é caro. A memória dela em wiki repete o que o ESTADO.md, o handoff e os relatórios já fazem.
- **Skills de outros repositórios do Matt** (`what-to-test`, `triage-repro`, `write-a-prd`…): são presas aos projetos dele. O que serve já está coberto por `tdd`, `triage` e `to-spec`.
- **Mantidas como estavam:** `domain-modeling` (versão própria do projeto, como no commit de 03/10) e `handoff` (adaptada hoje).
- **`ui-styling`:** já está instalada como `ui-ux-pro-max:ui-styling`, então não precisa do `npx`. Ela trabalha com componentes shadcn/ui e classes do Tailwind. A agenda não usa nenhum dos dois: o estilo está escrito direto em cada elemento, sem como mudar por tamanho de tela. Usar a skill ao pé da letra seria reescrever a tela, o que arrisca mudar o desktop, que é o uso principal.
- **Ferramentas mais adequadas para a agenda:**
  - as regras de uso no celular da `ui-ux-pro-max` (botões de 44px, campos com fonte de 16px, toque);
  - `impeccable`, na parte de adaptar para telas pequenas;
  - `webapp-testing` ou `agent-browser`, para conferir com capturas em 390px (celular) e em 1440px (desktop sem mudança).

## Pendente

Proposta para a agenda no celular, esperando o "pode fazer" da Jessica. O desktop não muda: tudo vale só abaixo de 768px.

1. **Vista inicial:** no celular a agenda abre em "Lista" (hoje e próximos dias), porque a semana em 7 colunas fica ilegível numa tela de 390px. As outras vistas continuam disponíveis.
2. **Janelas:** "Nova atividade", "Concluir" e "Cancelar" ocupam a tela inteira, com formulário em 1 coluna, campos com fonte de 16px (o iPhone não dá zoom) e botões de 44px.
3. **Indicadores e filtros:** indicadores em 2 colunas e busca na largura toda.
4. **Ações rápidas** no cartão de cada atividade: concluir, WhatsApp e abrir o Meet.
5. **Como fazer:** um gancho pequeno (`useIsMobile`) troca só os valores de estilo, sem reescrever a tela.
6. **Testes:** capturas antes e depois em 390px e em 1440px.
7. **Entrega:** atualizar os documentos de `docs/produto/` e o manual, e publicar com backup (regras do projeto).

Outras pendências antigas (do ESTADO.md):
- chaves expostas: decisão da Jessica, detalhe no arquivo local;
- abertura do Julio sem o ramo do lead;
- conferir o primeiro envio pela conta UAZAPI nova;
- conversa de retorno marcada para 28/10.

## Próxima sessão

- **Primeiro passo:** com o "pode fazer", tirar as capturas atuais da agenda em 390px e em 1440px e aplicar o item 1 da proposta.
- **Skills sugeridas:** `ui-ux-pro-max:ui-ux-pro-max`, `impeccable`, `webapp-testing` e `superpowers:verification-before-completion`.
