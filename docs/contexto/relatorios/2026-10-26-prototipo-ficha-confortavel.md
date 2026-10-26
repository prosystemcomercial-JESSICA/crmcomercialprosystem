# Protótipo da ficha da demanda confortável (26/10/2026)

## Pedido
A Jessica mandou um print da ficha da implantação (aba Execução › Onboarding técnico) e pediu: "melhorar a experiência de uso dessas janelas, está tudo muito compacto e de difícil acesso". São telas de preenchimento, acompanhamento e checklist. Pediu também skills do skills.sh para a refatoração e um projeto visual para ver **antes** de aplicar.

## Feito
- Protótipo navegável (dados fictícios, nada grava no CRM): `docs/prototipos/ficha-demanda-confortavel.html`, publicado como artifact privado: https://claude.ai/artifact/L9q1EGrmLXDQrDxWc3jiYF
- Mostra: cabeçalho de uma linha (nome, etapa atual, Play/Espera); menu lateral com as 18 seções agrupadas (Agora, Execução, Cliente, Registros) no lugar das abas em 2 níveis; as 15 perguntas uma por linha (Sim/Não em botões, números com − e +, sugestões prontas, salvamento automático, rodapé fixo com "Próxima sem resposta"); roteiro do onboarding em seções que abrem e fecham, linhas de 52px, quem marcou à direita, "Esconder feitos"; seção travada mostrando o motivo; painel da direita com próximo passo, prazo e contatos. Seletores de largura (monitor, notebook, celular) e densidade (confortável, compacto). Aba "O que muda e por quê" com 8 mudanças, decisões pendentes e as skills.
- **Código do CRM não foi alterado.** A tela real é `FichaDemanda` e as abas em `frontend/components/implantacao/Portal.tsx` (linhas ~228-340, `AbaOnboarding` ~574, `PerguntasPrimeiroContato` ~623, `AbaChecklist` ~711).

## Verificado
- Artifact publicado (versão 1). Não verificado: aparência real em navegador (não houve captura de tela) nem uso pela equipe.

## Decisões e porquês
- Protótipo em HTML puro com as cores do tema do CRM (`frontend/app/globals.css`), para ficar parecido com o sistema sem mexer nele.
- Dados fictícios ("Drogaria Exemplo Vila Velha Ltda") porque o arquivo vai para o Git.
- Skills sugeridas (skills.sh): `vercel-labs/agent-skills` (web-design-guidelines), `lovropodobnik/refactoring-ui-skill` (ui-refactor), `pbakaus/impeccable`. **Não instaladas**: esperam o OK da Jessica.

## Pendente (decide a Jessica)
1. Agrupar as 15 perguntas (como no protótipo) ou manter a ordem em que o técnico pergunta.
2. Salvar sozinho a cada resposta ou manter o botão "Salvar respostas".
3. Densidade padrão (confortável ou compacta, ou escolha por usuário).
4. Aplicar primeiro na ficha da implantação e depois nas outras janelas de preenchimento?
5. Instalar ou não as skills sugeridas.

## Próxima sessão
Com as respostas, refatorar `FichaDemanda`/`Gaveta` em `Portal.tsx` sem mudar regras (bloqueio do onboarding, cronômetro, `salvarColeta`, `marcarChecklistImplantacao`). Salvamento automático precisa de debounce sobre `apiClient.salvarColeta`. Skills: `dev-frontend`, `frontend-design`, `webapp-testing` para conferir. Atualizar os 6 documentos de `docs/produto/`, o manual e `novidades-crm.html` quando aplicar.

---

## Continuação (26/10/2026, tarde): aplicado no CRM

### Pedido
Respostas da Jessica: "1 mantenha; 2 salva sozinho e reforço abaixo no botão; Confortável sempre será usado em desktop, então precisa ser espaçoso e não compacto, será usado o dia todo... Pode aplicar em todos".

### Feito
- `frontend/components/implantacao/Portal.tsx`: `FichaDemanda` em 3 colunas (menu de seções, conteúdo, painel de próximo passo e contatos), `CSS_FICHA`, `useAutoSalvar`, `RodapeSalvar`, `CampoColeta`, `ItemChecklist`; perguntas do primeiro contato uma por linha na ordem original; ficha de coleta em grupos com salvamento automático; roteiro e checklist com linhas grandes e "Esconder os itens já feitos"; botões e cartões um pouco maiores.
- `frontend/app/globals.css`: estilo da classe `.ps-input` (não existia) e tamanho mínimo confortável de campos, listas e caixinhas em todas as janelas.
- `backend/src/routes/implantacao-portal.ts`: anotação "Ficha de coleta atualizada" agrupada (1 por pessoa a cada 30 min).
- Documentos: os 6 de `docs/produto/`, manual e novidades.

### Verificado
- `npx tsc --noEmit -p .` do frontend sem erros; backend sem erros no arquivo mudado; `next build` ok.
- Fotos com Playwright e API simulada (dados fictícios) em 1600, 1180 e 400px: ficha, rolagem até a próxima pergunta, salvamento automático ("Salvo automaticamente às…") e checklist. Ajustes feitos depois das fotos (etapas em linha própria, telefone sem quebra, celular empilhado).
- Não verificado: uso real em produção (não publicado) e as outras 75 janelas uma a uma (só recebem a base comum dos campos).

### Decisões e porquês
- Texto salva ao sair do campo, não a cada tecla: o "Sistema anterior" acrescenta itens de conversão ao checklist e gravaria nome pela metade.
- "Aplicar em todos": layout completo só na ficha (é a janela com 18 seções); nas outras 75 janelas, conforto pela base comum (campos com borda, 40px, caixinhas de 18px) para não reescrever tudo de uma vez.
- Base em `@layer base` com `:where()`: tamanhos que cada tela já define continuam valendo.

### Pendente
- **Publicar (Jessica decide):** a `main` tem o `f017b30` da outra sessão, que exige criar a coluna `WhatsappConversa.fora_do_funil_em` antes do deploy (o script recusa sem ela).
- Próximas janelas com o layout completo: lead (`app/leads/page.tsx`), proposta (`app/propostas-comerciais/page.tsx`), cliente (`app/clientes/[id]/page.tsx`).

### Próxima sessão
Com o OK da Jessica: backup + `ALTER TABLE` da coluna + `deploy-vps.sh <commit>`; conferir o card de uma implantação real. Depois, aplicar o padrão na ficha do lead. Skills: `dev-frontend`, `webapp-testing`.
