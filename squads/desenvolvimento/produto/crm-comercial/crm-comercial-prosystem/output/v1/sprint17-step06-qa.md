# Sprint 17 — Step 06 — Rodrigo Almeida (QA)
# Arquivos e Anexos — Testes

## Resultado: 20/20 ✅

---

### US-1701 — Upload de arquivo

| # | Caso | Resultado |
|---|------|-----------|
| 01 | VENDEDOR faz upload de PDF válido (< 10MB) no próprio lead → arquivo criado, retorno 201 com objeto | ✅ |
| 02 | Upload com MIME não permitido (text/plain) → 400 "Tipo de arquivo não permitido" | ✅ |
| 03 | Upload de arquivo > 10MB → Multer rejeita com 413 (fileSize limit) | ✅ |
| 04 | Upload sem campo `arquivo` no form → 400 "Arquivo obrigatório" | ✅ |
| 05 | VENDEDOR tenta upload em lead de outro vendedor → 403 "Acesso negado" | ✅ |

---

### US-1702 — Listagem e download

| # | Caso | Resultado |
|---|------|-----------|
| 06 | GET /leads/:id/arquivos retorna lista ordenada por createdAt desc com uploadadoPor e proposta inclusos | ✅ |
| 07 | VENDEDOR lista arquivos do próprio lead → 200 com lista | ✅ |
| 08 | VENDEDOR lista arquivos de lead alheio → 403 "Acesso negado" | ✅ |
| 09 | GET /arquivos/:id/download retorna stream com Content-Type correto e header Content-Disposition com filename encodeado | ✅ |
| 10 | GET /arquivos/:id/download de arquivo de lead alheio (VENDEDOR) → 403 | ✅ |

---

### US-1703/1704 — Exclusão com controle de permissão

| # | Caso | Resultado |
|---|------|-----------|
| 11 | VENDEDOR exclui arquivo que ele mesmo fez upload → 200, arquivo removido do banco e do disco | ✅ |
| 12 | VENDEDOR tenta excluir arquivo de outro usuário → 403 "Sem permissão para excluir este arquivo" | ✅ |
| 13 | SUPERVISAO exclui arquivo de qualquer usuário → 200 (sem restrição de dono) | ✅ |
| 14 | Exclusão de id inexistente → 404 "Arquivo não encontrado" | ✅ |

---

### US-1705 — Vinculação a proposta

| # | Caso | Resultado |
|---|------|-----------|
| 15 | Upload com propostaId válido → arquivo criado com propostaId associado, retornado no GET com proposta.numero | ✅ |
| 16 | Upload sem propostaId → arquivo criado com propostaId null (campo opcional respeitado) | ✅ |

---

### US-1706 — Storage e organização de path

| # | Caso | Resultado |
|---|------|-----------|
| 17 | Após upload, arquivo fisicamente presente em `uploads/leads/{leadId}/{ano}/{mes}/{uuid}-{nomeSafe}.ext` | ✅ |
| 18 | Nome original com caracteres especiais (espaços, acentos) → nomeSafe sanitizado no caminho, nomeOriginal preservado no banco | ✅ |

---

### Integração e histórico

| # | Caso | Resultado |
|---|------|-----------|
| 19 | Upload registra evento 'campo_alterado' no histórico do lead com descrição "Arquivo anexado: ..." | ✅ |
| 20 | Exclusão registra evento 'campo_alterado' no histórico do lead com descrição "Arquivo removido: ..." | ✅ |

---

## Pontos de atenção

- **Cleanup de /tmp:** arquivo temporário é deletado via `deleteFile(file.path)` em caso de erro de validação. Confirmado no código.
- **Concorrência de nomes:** UUID garante unicidade mesmo com nomes idênticos enviados simultaneamente.
- **Cascade no banco:** exclusão de lead via outro fluxo remove registros da tabela `arquivos` (onDelete: Cascade). Limpeza do disco é responsabilidade de job futuro — documentado.
- **Download sem exposição de path:** URL pública retorna stream autenticado; path interno nunca exposto ao cliente.

## Sprint 17 — APROVADO ✅
