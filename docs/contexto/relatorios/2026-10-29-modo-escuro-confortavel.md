# Modo escuro confortável (29/10/2026)

## Pedido
Jessica: "melhore o modo escuro, procure alguma skill no skills.sh que pode nos ajudar com isso, tem que ser confortável aos olhos humanos, é o dia todo trabalhando olhando para a tela".

## Feito
- Pesquisa no skills.sh: a mais útil foi `dark-mode-design` (owl-listener/designer-skills). Ela é curta e só traz princípios: reduzir a luminância geral, texto quase branco em vez de branco puro, dessaturar cores, contraste ≥ 4,5 e evitar áreas claras grandes. Esses princípios foram aplicados direto no código; a skill não foi instalada. Também foram vistas `agentsorg/benji --skill dark-mode`, com 3 instalações, e `dark-mode-strategist`.
- Diagnóstico com fotos e auditoria (Playwright com API simulada) mostrou estes problemas:
  - a Agenda ficava inteira branca, e o título da semana sumia (branco sobre branco);
  - a área da conversa do WhatsApp ficava clara;
  - o aviso amarelo das Configurações e os selos pastel ficavam claros demais;
  - números e títulos coloridos tinham contraste de 2,4 a 3,5;
  - o logo ficava apagado.
- Causa: as telas têm cerca de 400 classes Tailwind de cor fixa e cerca de 200 cores hex inline.
- Solução central, sem editar as telas:
  - `frontend/scripts/gerar-modo-escuro.mjs` gera `frontend/app/modo-escuro.css`, importado no topo de `globals.css`. Ver a linha "Modo escuro confortável" nos 6 docs de `docs/produto/` para o detalhe das regras.
  - `--t-text-primary` no escuro ficou menos branco nas 6 paletas.
  - O logo foi clareado e as fotos da área de conteúdo foram atenuadas.
  - O bloco antigo de pastéis do `globals.css` foi trocado.
- Também atualizados: o manual (`docs/comercial/manual-de-uso-assistente.md`), as novidades (`novidades-crm.html`) e o `ESTADO.md`.

## Verificado
- Auditoria antes/depois:
  - Agenda: de 7 áreas claras para 0.
  - WhatsApp: de 2 para 0.
  - Configurações: de 8 para 0.
  - Clientes: de 1 para 0.
  - Propostas e Atividades: textos fracos resolvidos. Restam só os números brancos em selos de cor forte, que são iguais no modo claro.
- Fotos conferidas a olho: Agenda, WhatsApp, Configurações e Propostas.
- `next build` passou.
- **Não verificado:**
  - telas que quebram com a API simulada (Painel, Leads, Funil, Metas, Escritório), que precisam ser vistas com dados reais;
  - o modo escuro em produção depois do deploy;
  - o e2e `aparencia.spec.ts`, que usa a porta 3100, ocupada por outro projeto nesta máquina.

## Decisões e porquês
- **CSS gerado em vez de editar mais de 70 telas:** cobre todas as telas de uma vez e não mexe no modo claro. Os seletores procuram a cor dentro do `style` (o navegador grava as cores como `rgb(r, g, b)`), sempre sob `.dark`.
- **Texto colorido só é trocado com contraste abaixo de 6 sobre o card escuro:** as cores que já são legíveis ficam como estão.
- **Fundos médios ou saturados (luminância < 0,5) não mudam:** são botões e selos fortes com texto branco.
- **Seguir o modo escuro do sistema (`prefers-color-scheme`) não foi implementado:** mudaria o padrão de quem nunca escolheu. Fica como pendência.

## Pendente
- A Jessica decide:
  - se o CRM deve seguir sozinho o modo escuro do Windows quando ninguém escolheu um modo;
  - se o logo deve ganhar uma versão própria para fundo escuro (o PNG atual tem margens grandes e fica pequeno).
- Se alguma tela ainda tiver um ponto claro no escuro, rode `node frontend/scripts/gerar-modo-escuro.mjs` de novo. Se a cor vier de uma variável montada em tempo de execução, acrescente-a à mão.

## Próxima sessão
- Abrir o CRM em produção no modo escuro e passar por Painel, Leads, Funil e Escritório com dados reais.
- Skills sugeridas: `impeccable` (polimento), `example-skills:webapp-testing`.
