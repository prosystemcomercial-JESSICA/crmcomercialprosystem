# 12/11/2026 — Perfil dos agentes no Escritório

## Pedido
Jessica: "Ao clicar no agente quero um perfil, com uma foto como se fosse uma foto 3/4 do rosto, perfil de cada um,
personalidade e o que cada um faz com maestria. Não é para deixar fotografias realistas, é para colocar a aparência de
cada agente atual." Também pediu para liberar espaço no disco.

## O que mudou
- **`frontend/components/escritorio/PerfilAgente.tsx` (novo):**
  - `Retrato`: SVG do rosto em 3/4, no estilo chapado dos bonecos, com pele, cor e comprimento do cabelo e cor da roupa
    tirados de `VISUAL` (o mesmo mapa que desenha os bonecos na sala). Se a aparência de um boneco mudar, o retrato acompanha.
  - `PERFIS`: personalidade e 3 itens de "faz com maestria" para os 17 agentes, escritos a partir da função de cada um
    (`backend/src/lib/assistente/escritorio.ts`).
  - `PerfilAgente`: cartão que ocupa a largura toda do painel do agente selecionado.
- **`frontend/app/escritorio/page.tsx`:** mostra o `PerfilAgente` no topo do painel ao clicar num agente.
- **`frontend/components/escritorio/SalaViva.tsx`:** `VISUAL` agora é exportado.
- Documentos de produto (01 a 06), manual, novidades e ESTADO atualizados. Banco: sem mudança.

## Conferência
- Tipos do frontend sem erro; lint limpo nos arquivos novos (os 8 erros de lint da `page.tsx` já existiam antes).
- Prévia renderizada dos 17 perfis (print conferido): retratos batem com os bonecos.
- Não conferido na página real com login.

## Disco
O C: tinha chegado a 0 bytes livres na noite anterior. Foi apagada a versão antiga do navegador de testes do Playwright
(`chromium_headless_shell-1208` e `ffmpeg-1011`); o disco ficou com ~12 GB livres.

## Fora desta entrega
- Retratos de pessoas da equipe humana (só os agentes).
- Personalidade editável pela tela (hoje é texto no código, em `PERFIS`).
