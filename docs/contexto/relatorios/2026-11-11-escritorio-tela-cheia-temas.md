# Escritório: tela cheia, visitas, conversas casuais e temas de feriado (11/11/2026)

## Pedido
A Jessica pediu para aprimorar o escritório virtual: abrir em tela cheia, visitar os setores, ver conversas casuais (filmes,
novelas e outros assuntos nas horas livres) e ter temas conforme os feriados (Páscoa, Natal, Ano Novo), tudo funcionando.

## O que mudou
- **`frontend/components/escritorio/sala-temas.ts` (novo):** os temas (Natal, Ano Novo, Carnaval, Páscoa, Festa Junina), as
  26 conversas casuais, o cálculo do domingo de Páscoa, a escolha do tema pela data e o sorteio das conversas.
- **`frontend/components/escritorio/SalaViva.tsx`:**
  - barra no canto de cima da sala: **Tela cheia**, **Tema** e, na visita, **← Escritório inteiro**;
  - tela cheia: a sala cobre a janela e pede a tela cheia do navegador; Esc sai;
  - botão **🔍 Visitar** em cada sala: a câmera aproxima e a boneca "Você" anda até a sala (e volta ao sair);
  - conversas de 3 ou 4 falas entre dois agentes parados no café (uma por vez, sem repetir a anterior);
  - tema do dia: enfeites, destaque no café, varal no corredor, partículas, chapéu nos bonecos e conversas da data.
- **`frontend/app/escritorio/page.tsx`:** a dica abaixo da sala cita a tela cheia, a visita e o café.
- **`backend/tests/sala-temas.test.ts` (novo):** datas da Páscoa, tema por data, sorteio e tamanho das falas.
- Documentos: os seis de `docs/produto/`, o manual, as novidades e o `ESTADO.md`.

## Decisões
- Tudo no navegador, com roteiro fixo: sem rota, sem banco, sem IA, e nada vai para cliente.
- Agente trabalhando não vai ao café para conversar: o estado mostrado na sala continua sendo o real.
- Além dos três feriados pedidos, entraram Carnaval e Festa Junina. O seletor **Tema** permite ver qualquer tema fora de época.
- A escolha manual do tema fica guardada só naquele navegador.

## Conferência
- Tipos do frontend (`npx tsc --noEmit -p .`): sem erros. Lint dos dois arquivos da sala: sem erros.
- `npx vitest run tests/sala-temas.test.ts`: 3 testes passaram.
- Prévia isolada da sala (sem o servidor do Next, que não cabia no disco: 83 MB livres), aberta no Edge com 17 agentes de exemplo: tela cheia, visita ao Café e a Vendas com a "Você" andando até lá, temas Natal e Páscoa e conversas casuais apareceram, sem erro no console. **Não conferido dentro da página real do CRM, com login.**

## Fora desta entrega
- Conversas casuais no painel "Agora no escritório".
- A TV do escritório (`/tv/escritorio`).
- Outros feriados (Dia das Mães, Black Friday etc.).
