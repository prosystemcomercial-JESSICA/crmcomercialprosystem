# Sprint 12 — Step 02 — Patrícia Moura (UX)
# Importação de Leads — Wireframes

## Fluxo: wizard 5 steps com stepper visual no topo

TELA 0: Lista de importações anteriores + botão nova importação
STEP 1: Drag-and-drop de arquivo + download de template
STEP 2: Mapeamento coluna-a-coluna com detecção automática + salvar mapeamento
STEP 3: Validação — 3 cards (válidos/erro/duplicatas) + preview 10 linhas + lista de erros
STEP 4: Distribuição — radio buttons: manual | round-robin | por segmento | por coluna
STEP 5: Resumo + botão importar + progress bar em tempo real + relatório final

## UX decisions
- Stepper com steps concluídos marcados (✓) e step atual realçado
- Erros e duplicatas: não bloqueiam — usuário decide continuar ignorando-os
- Progress bar em tempo real usando WebSocket (ou SSE)
- Ao concluir: botão "Ver leads importados" filtra a lista de leads pela importação
