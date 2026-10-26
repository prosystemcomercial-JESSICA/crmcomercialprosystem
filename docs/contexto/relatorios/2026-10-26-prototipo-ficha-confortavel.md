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
