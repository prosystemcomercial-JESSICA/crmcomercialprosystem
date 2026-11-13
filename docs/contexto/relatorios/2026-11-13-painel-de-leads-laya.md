# Relatório: Painel de Leads da Laya (13/11/2026)

## 1. Pedido
Jessica: "Preciso medir os leads, por qual canal está chegando, funil, desempenho, conversão, o que precisa melhorar, tudo; preciso desse painel no escritório. Quem é o agente responsável por isso, pode ser a Laya e quem mais?" Depois da proposta: "ok, implemente isso".

## 2. Feito
- Commit `4c8affd` (detalhes completos nos 6 docs de `docs/produto/`, seção "Atualização 13/11/2026: Painel de Leads da Laya", e no ESTADO.md de 13/11).
- Divisão: **Laya mede** (aba "Painel de Leads" na janela dela), **Rafael explica o porquê** (sexta 15h ou botão), **Vitória decide** (bloco do painel no contexto da reunião de segunda).
- Arquivos novos: `backend/src/lib/painel-leads.ts`, `backend/src/services/painel-leads.service.ts`, `frontend/components/escritorio/PainelLeads.tsx`, testes `backend/tests/painel-leads.test.ts` e `frontend/e2e/painel-leads.spec.ts`.
- Alterados: `lib/funil-origem.ts` (origens escritas de jeitos diferentes), `routes/complementos.ts` (2 rotas), `lib/assistente/diretoria.ts` e `services/diretoria.service.ts` (agenda `porque` e contexto da Vitória), `lib/assistente/escritorio.ts` (função da Laya), `frontend/app/escritorio/page.tsx` (abas, botão no setor Vendas, `?leads=1`), `frontend/lib/api-client.ts` (2 métodos), manual, novidades, LEIA-PRIMEIRO.

## 3. Verificado
- vitest: `painel-leads` 11/11, `funil-origem` 3/3, `diretoria` 13/13, `placar-comercial` 2/2.
- `tsc` backend sem erro novo (2 erros antigos em `complementos.ts`, só mudaram de linha); frontend 0 erros.
- Playwright `painel-leads.spec.ts` 2/2 e `diretoria.spec.ts` 2/2 (1366, 390 e 360 px).
- Painel rodado contra produção antes do deploy (só leitura, script empacotado com esbuild): 0,2 s para 30 dias, números coerentes.
- CI do `4c8affd` verde. Deploy: ver ESTADO.md (registrado depois do fim do deploy).
- **Não verificado:** a leitura do Rafael com IA de verdade (`POST /comercial/painel-leads/porque`) só foi testada com API simulada; a primeira rodada real é no botão ou na sexta 15h.

## 4. Decisões e porquês
- Sem agente novo: a Laya já lê todas as conversas e mede temperatura; a Vitória já decide metas; o Rafael já lê conversas.
- "O que melhorar" por regras, sem IA (barato, explicável); a IA fica só no porquê do Rafael (1 chamada por semana).
- Funil acumulado: lead que chegou à proposta conta também em demonstração, para as taxas fazerem sentido.
- Achado real: 513 de 617 leads sem contato; o Heitor traz mais leads do que o limite seguro do WhatsApp deixa chamar. A recomendação do painel diz explicitamente para **não** aumentar o limite (regra de proteção do número).
- Commit montado com índice temporário: a outra sessão tinha 2 linhas do Heitor em `api-client.ts` sem commit e ficaram de fora. A outra sessão commitou (`e9357d0`) as minhas 2 linhas das configs do Playwright junto com o carrossel; inofensivo.

## 5. Pendente
- Jessica: ao cadastrar lead à mão, escolher a origem; ao marcar perdido, escrever o motivo (no manual).
- Decisão dela/Vitória: ritmo de captação do Heitor x fila sem contato.

## 6. Próxima sessão
Abrir `/escritorio?leads=1` em produção e clicar em "Pedir ao Rafael agora" para conferir a primeira leitura real. Skills: `diagnosing-bugs` se a leitura falhar; `dataviz` para mudanças nos gráficos.
