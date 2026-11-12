# Celular revisado tela por tela (12/11/2026)

## Pedido

Jessica: "Preciso melhorar o uso através do celular, para qualquer smartphone e qualquer tela, principalmente iPhone 17 Pro Max, 17, 11 em diante. Hoje não consigo voltar, às vezes não vejo a parte de cima, que some, ultrapassa a linha, o rodapé some... Teste tela por tela. Só para o smartphone; no computador está perfeito."

## Feito

Só frontend, só abaixo de 768px. Detalhes técnicos na "Atualização 12/11/2026 (3)" dos 6 documentos de `docs/produto/`.

- `frontend/app/celular.css` (novo, importado em `app/layout.tsx`): regras gerais que corrigem todas as telas de uma vez: janelas acima da barra de abas (z 90 > 75), janelas altas rolam em vez de cortar topo e rodapé, `vh` → `dvh`, fileiras de botões quebram linha, tabelas rolam no cartão, grades `repeat(N, 1fr)` → `minmax(0,1fr)`, listas suspensas da barra de cima na largura da tela.
- `frontend/components/mobile/VoltarCelular.tsx` (novo): "‹ Voltar" no lugar do logo em toda tela que não é aba.
- `frontend/components/mobile/CelularTecladoGuarda.tsx` (novo): ao fechar o teclado, a página volta ao topo (a barra de cima sumia).
- `frontend/components/dashboard/DashboardLayout.tsx`: no celular saem da barra de cima o modo escuro (vai para o menu da foto) e o "WhatsApp em nova aba"; `abasDo` exportado de `components/mobile/AppIOS.tsx`.
- Portal Técnico: `components/implantacao/Cronometro.tsx` e `app/portal-tecnico/page.tsx` com cronômetro compacto e sem ✕/modo escuro no celular.
- Manual (`docs/comercial/manual-de-uso-assistente.md`, seção "Usar o CRM pelo celular") e `docs/comercial/novidades-crm.html`.

## Verificado

- Auditoria automática com Playwright (Chromium com tamanho, toque e navegador de iPhone; API simulada com dados fictícios, nenhum dado real) em 68 telas × 6 tamanhos: iPhone 17 Pro Max (440), 11 (414), 17 (402), 11 Pro (375×812), SE (375×667), Android (360). Scripts no scratchpad da sessão (não versionados).
  - Antes (produção): barra de cima passando da borda em 342 de 408 medições (foto/Sair e sino fora da tela, até no 17 Pro Max); 67 com conteúdo passando da borda (Clientes, ficha do cliente, Cross-sell, Comissões, Radar, Suporte, Agenda, Auditoria, WhatsApp, Portal); nenhuma tela interna com voltar.
  - Depois (build local): 0 e 0; voltar em todas as telas internas.
- Formulários "Novo…" de 9 telas (Leads, Clientes, Propostas, Atividades, Agenda, Campanhas, Usuários, Cross-sell, Metas) em 17 Pro Max e SE: antes o "Salvar Proposta" ficava sob a barra de abas; depois, botão final visível e clicável em todos.
- Computador (1440px): logo, modo escuro, menu lateral e barra de cima iguais antes e depois.
- `tsc` sem erro nos arquivos mexidos; ESLint limpo nos arquivos novos (os avisos de `DashboardLayout.tsx`/`Cronometro.tsx` são antigos, em linhas não mexidas).
- **Não verificado:** Safari real num iPhone; 4 telas que não abrem com dados fictícios (Painel da IA, Relatório de Retenção, LTV, Configurações); janelas abertas por botões que não começam com "Novo/Criar/Cadastrar…"; Escritório em tela cheia.

- **Publicado:** commit `29e0d9f`, CI verde, `deploy-vps.sh` com backup (464M), banco sem alterações, site e API respondendo; auditoria repetida na produção (9 telas × 6 tamanhos) sem estouros e o "Salvar Proposta" clicável no 17 Pro Max e no SE.

## Decisões e porquês

- Correção geral por CSS (seletores por classe/estilo) em vez de editar ~70 telas: resolve as telas futuras também e não mexe em arquivos de outras sessões. Tudo dentro de `@media (max-width: 767px)` para não tocar no computador.
- `flex-wrap` só em fileiras compostas apenas de botões: quebrar linha só age quando não cabe, e não afeta linhas com textos truncados.
- Voltar usa o histórico só se a pessoa já navegou dentro do CRM nesta sessão; senão sobe um nível no endereço (evita sair do app).
- Dados fictícios por um "valor universal" (Proxy) injetado no navegador de teste, para as telas abrirem sem dados reais.

## Pendente

- Jessica testar no iPhone dela (principalmente voltar, Nova Proposta e teclado) e mandar print de qualquer tela que ainda estoure.
- Se algum caso aparecer nas 4 telas não medidas, corrigir com print real.

## Próxima sessão

Se vier print de problema no celular: abrir a tela no tamanho do aparelho com a auditoria (Playwright, viewport do iPhone) e preferir regra em `frontend/app/celular.css`. Skills: `diagnosing-bugs`, `webapp-testing`.

## Continuação: app da tela de início continuava com a versão antiga

- **Pedido:** "Ao compartilhar para deixar na tela com atalho, volta e fica da mesma forma que estava antes."
- **Verificado:** o app da tela de início não guarda cópia das telas (`public/sw.js` só cuida de notificações) e o HTML sai com `no-cache`. A produção no modo app (áreas seguras de 59pt/34pt simuladas no teste) mostra a versão nova correta. Causa achada: `/health` com `versao: "dev"`, então o `VersionWatcher` nunca recarregava; e o iPhone retoma o app sem `focus`.
- **Feito:** `backend/src/server.ts` (versão = `git rev-parse --short HEAD`) e `frontend/components/VersionWatcher.tsx` (confere em `visibilitychange`/`pageshow`; recarrega só ao voltar ou em segundo plano).
- **Decisão:** não recarregar com a página na frente pela checagem de 3 min (agora que o recarregamento passa a funcionar de fato, recarregar no meio de uma digitação no computador perderia texto).
- **Pendente:** a Jessica fechar o app por completo uma vez (deslizar para cima no seletor de apps) e abrir de novo; dali em diante ele se atualiza sozinho.
