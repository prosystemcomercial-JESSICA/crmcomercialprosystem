# 12/11/2026: texto de gente, não de folder (escrita dos agentes)

## Pedido
A Jessica mandou um print que compara "texto de folder" com "texto de gente". O pedido: "pegar a funcionalidade e transformar em algo prático para o cliente". Depois ela esclareceu: o print é um exemplo de forma de comunicação, adaptada aos nossos objetivos; "as frases não podem ficar soltas, é um conteúdo de forma natural, conversacional". Também pediu que "as perguntas devem ser retóricas para mostrar que existe ponto fraco na empresa, para criar ganchos para retomar os leads, iniciar com os leads etc."

## Feito
- Regra única `TEXTO_DE_GENTE` em `backend/src/lib/assistente/texto-de-gente.ts`. Ela:
  - proíbe frase de propaganda;
  - pede a situação prática encadeada no que o cliente disse e levando ao próximo passo;
  - usa a pergunta retórica sobre ponto fraco do ramo como gancho no primeiro contato e nas retomadas;
  - limita recurso e detalhe concreto ao material.
- A regra está ligada em três lugares:
  - `promptCaroline` (`backend/src/lib/assistente/sdr.ts`), que vale para todos os perfis de conversa;
  - `REGRAS_COMERCIAIS` (`backend/src/lib/assistente/ia-texto.ts`);
  - Mila (`backend/src/services/mila-upgrade.service.ts`).
- Teste em `backend/tests/texto-de-gente.test.ts`.
- Documentos atualizados: os seis de `docs/produto/`, `docs/comercial/manual-de-uso-assistente.md`, `docs/comercial/novidades-crm.html` e `docs/contexto/ESTADO.md`.

## Verificado
- `npx tsc --noEmit -p . --rootDir .`: nenhum erro nos arquivos mexidos.
- vitest: `texto-de-gente`, `sdr-caroline`, `assistente-ia-texto`, `ia-texto-seguro`, `sdr-restricoes` e `sdr-apresentacao` passaram.
- Os recursos dos exemplos foram conferidos no material:
  - conferência de caixa, estoque mínimo com sugestão de compra e acesso remoto, em `docs/comercial/base-conhecimento-comercial.md`;
  - "não sei quanto realmente sobra", em `docs/comercial/sequencia-padarias/mapa-de-valor-prosystem-padarias.md`.
- Mensagens reais geradas em produção depois do deploy: **não verificado**.

## Decisões e porquês
- A pergunta retórica não conta como pergunta de investigação (há uma regra de "no máximo 2" perguntas desse tipo), e a mensagem continua terminando com uma única pergunta real. Assim não conflita com as regras atuais.
- Na retomada, o gancho usa a dor que o próprio lead contou antes.
- O tom é de quem conhece o balcão, nunca de acusação.
- A Joana ficou de fora: ela escreve um informativo jornalístico e não pode ilustrar com cena inventada.
- O exemplo da padaria trocou "pão que sobra" por "quanto realmente sobrou", porque o material fala de margem, não de sobra de produção.
- `sdr.ts` e `joana.service.ts` tinham mudanças não commitadas de outra sessão (loja nova da Receita, Heitor). O commit levou só as duas linhas desta regra em `sdr.ts`.

## Pendente
- A Jessica pode mandar mais pares de "folder x gente" para virar exemplo.
- Acompanhar as primeiras mensagens no painel do Rafael e as correções da Jessica, que continuam sendo aprendidas.

## Próxima sessão
Ler algumas mensagens de primeiro contato e de retomada geradas depois do deploy. O objetivo é conferir se a pergunta retórica aparece encadeada, sem frase solta e sem detalhe inventado. Skill sugerida: nenhuma específica; para ajustar o tom, edite só `texto-de-gente.ts`.
