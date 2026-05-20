# Sprint 12 — Step 06 — Rodrigo Almeida (QA)
# Importação de Leads — Plano de Testes

## Cobertura: US-1201 a US-1206

---

## TC-001 — Upload CSV válido
**US:** 1201
**Pré-condição:** usuário autenticado
**Passos:**
1. Acessar /importacao → clicar "Nova Importação"
2. Arrastar arquivo `leads-validos.csv` (3 linhas, < 5MB) na zona de drop
3. Clicar "Próximo →"

**Resultado esperado:**
- Step 2 carrega com cabecalhos detectados
- `mapeamentoDetectado` preenche selects automaticamente onde há match heurístico
- Badge "auto" aparece nas colunas detectadas
- Importação criada no banco com status PENDENTE
**Status:** ✅ APROVADO

---

## TC-002 — Upload XLSX válido
**US:** 1201
**Passos:**
1. Arrastar arquivo `leads.xlsx` (planilha com 50 linhas)
2. Clicar "Próximo →"

**Resultado esperado:** Mesmo comportamento que TC-001; primeira aba lida.
**Status:** ✅ APROVADO

---

## TC-003 — Upload arquivo inválido (PDF)
**US:** 1201
**Passos:**
1. Tentar arrastar arquivo `.pdf`

**Resultado esperado:**
- Dropzone rejeita o arquivo antes do upload
- Nenhuma requisição enviada ao servidor
**Status:** ✅ APROVADO

---

## TC-004 — Upload arquivo > 5MB
**US:** 1201
**Passos:**
1. Tentar fazer upload de arquivo CSV de 6MB

**Resultado esperado:**
- Multer rejeita na API com HTTP 413
- Frontend exibe toast de erro: "Arquivo muito grande"
**Status:** ✅ APROVADO

---

## TC-005 — Download template CSV
**US:** 1206
**Passos:**
1. Clicar "Baixar template CSV" (link no Step 1)

**Resultado esperado:**
- Download inicia com nome `template-importacao-leads.csv`
- Arquivo tem 3 linhas (header + 2 exemplos)
- Abre corretamente no Excel com caracteres especiais (BOM UTF-8)
**Status:** ✅ APROVADO

---

## TC-006 — Mapeamento manual de colunas
**US:** 1202
**Passos:**
1. Upload de arquivo com coluna "Empresa" (não detectada automaticamente)
2. No Step 2, selecionar manualmente "Nome da Empresa" no select da coluna "Empresa"
3. Clicar "Validar arquivo →"

**Resultado esperado:**
- Mapeamento salvo corretamente no banco
- Validação considera a coluna mapeada
**Status:** ✅ APROVADO

---

## TC-007 — Salvar mapeamento nomeado
**US:** 1202
**Passos:**
1. No Step 2, marcar checkbox "Salvar este mapeamento"
2. Digitar nome "Planilha Comercial"
3. Clicar "Validar arquivo →"

**Resultado esperado:**
- Registro criado em `mapeamentos_colunas`
- No próximo upload, a opção "Planilha Comercial" aparece no dropdown de mapeamentos salvos
**Status:** ✅ APROVADO

---

## TC-008 — Validação: linha sem nomeEmpresa
**US:** 1203
**Passos:**
1. Upload de CSV onde linha 3 tem nomeEmpresa vazio
2. Validar

**Resultado esperado:**
- Card "Com erro" mostra 1
- Lista de erros: "Linha 3 | nomeEmpresa | Nome da empresa é obrigatório"
- Linha 3 não aparece no preview de válidos
**Status:** ✅ APROVADO

---

## TC-009 — Validação: linha sem nenhum identificador
**US:** 1203
**Passos:**
1. Upload de CSV onde linha 5 tem nomeEmpresa preenchido mas whatsapp, email e cnpj vazios

**Resultado esperado:**
- Card "Com erro" conta a linha 5
- Mensagem: "Informe WhatsApp, e-mail ou CNPJ para deduplicação"
**Status:** ✅ APROVADO

---

## TC-010 — Deduplicação por CNPJ
**US:** 1203
**Passos:**
1. Criar lead existente com CNPJ `12.345.678/0001-90`
2. Upload de CSV com mesma linha

**Resultado esperado:**
- Card "Duplicatas" mostra 1
- Lista de duplicatas: "Linha 2 | cnpj | 12.345.678/0001-90"
- Checkbox "Incluir mesmo assim" disponível
**Status:** ✅ APROVADO

---

## TC-011 — Deduplicação por WhatsApp normalizado
**US:** 1203
**Passos:**
1. Lead existente com whatsapp `11999990001`
2. CSV com whatsapp `(11) 9 9999-0001` (formato diferente)

**Resultado esperado:**
- Detectado como duplicata (normalização remove máscara)
**Status:** ✅ APROVADO

---

## TC-012 — Deduplicação por e-mail case-insensitive
**US:** 1203
**Passos:**
1. Lead existente com email `Joao@empresa.com`
2. CSV com email `joao@empresa.com`

**Resultado esperado:** Detectado como duplicata
**Status:** ✅ APROVADO

---

## TC-013 — Continuar ignorando erros
**US:** 1203
**Passos:**
1. Arquivo com 5 válidos e 2 erros
2. Step 3: marcar "Ignorar e continuar"
3. Avançar

**Resultado esperado:**
- Wizard avança normalmente
- Na execução, apenas os 5 válidos são importados
**Status:** ✅ APROVADO

---

## TC-014 — Distribuição manual
**US:** 1204
**Passos:**
1. Selecionar "Manual — atribuir a um vendedor"
2. Selecionar vendedor "Ana Lima"
3. Executar importação

**Resultado esperado:**
- Todos os leads criados com `vendedorId = Ana Lima`
**Status:** ✅ APROVADO

---

## TC-015 — Distribuição round-robin (3 vendedores, 7 leads)
**US:** 1204
**Passos:**
1. Selecionar "Round-robin"
2. Marcar 3 vendedores
3. Executar com 7 leads válidos

**Resultado esperado:**
- Vendedor 1: 3 leads (linhas 1, 4, 7)
- Vendedor 2: 2 leads (linhas 2, 5)
- Vendedor 3: 2 leads (linhas 3, 6)
- Label "~3 por vendedor" aparece no Step 4
**Status:** ✅ APROVADO

---

## TC-016 — Progresso em tempo real (SSE)
**US:** 1205
**Passos:**
1. Executar importação com 200 leads
2. Observar Step 5 durante processamento

**Resultado esperado:**
- Progress bar avança incrementalmente (chunk a chunk, lotes de 50)
- Contador "processados/total" atualiza em tempo real
- Ao concluir: "200 leads importados com sucesso!" aparece
- Botão "Ver leads importados" ativado
**Status:** ✅ APROVADO

---

## TC-017 — Botão "Ver leads importados"
**US:** 1205
**Passos:**
1. Concluir importação
2. Clicar "Ver leads importados →"

**Resultado esperado:**
- Redireciona para `/leads?importacaoId=<id>`
- Badge "Importação filtrada" visível
- Lista exibe apenas os leads daquela importação
**Status:** ✅ APROVADO

---

## TC-018 — Histórico de importações
**US:** 1205
**Passos:**
1. Acessar /importacao (TELA 0)

**Resultado esperado:**
- Lista as importações anteriores com: nome do arquivo, data, status badge, totais
- VENDEDOR vê apenas as suas; SUPERVISAO/CEO veem todas
**Status:** ✅ APROVADO

---

## TC-019 — Sessão de importação expirada
**US:** 1201
**Passos:**
1. Fazer upload (Step 1)
2. Aguardar cache server expirar (restart manual do server simulado)
3. Tentar avançar Step 2 → Validar

**Resultado esperado:**
- API retorna 404 com mensagem "Sessão de importação expirada"
- Toast de erro no frontend com instrução de refazer upload
**Status:** ✅ APROVADO

---

## TC-020 — Arquivo CSV com 5000 linhas (limite)
**US:** 1201
**Passos:**
1. Upload de CSV com exatamente 5000 linhas de dados
2. Validar + Executar

**Resultado esperado:**
- Processamento completo em lotes de 50 sem timeout
- totalImportados = 5000 (sem erros de estrutura)
- Performance: < 30s para importação completa
**Status:** ✅ APROVADO

---

## Resumo

| Total | Aprovados | Reprovados | Bugs |
|-------|-----------|------------|------|
| 20    | 20        | 0          | 0    |

## 20/20 aprovados — zero bugs — Sprint 12 HOMOLOGADO ✅
