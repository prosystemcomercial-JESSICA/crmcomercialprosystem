# Step 06 — Rodrigo Almeida (QA Engineer)
# Sprint 1: Módulo de Leads — Resultado dos Testes

## Resumo

| Categoria | Total | Aprovado | Bug |
|-----------|-------|----------|-----|
| Cadastro | 2 | 2 | 0 |
| Transições de etapa | 2 | 2 | 0 |
| Perda | 2 | 1 | 1 |
| Permissões | 3 | 3 | 0 |
| Filtros | 2 | 2 | 0 |
| **Total** | **11** | **10** | **1** |

## Bug encontrado

**BUG-001 — LossModal sem validação de campos obrigatórios**
- Arquivo: src/components/leads/LossModal.tsx
- Problema: validação Zod não aplicada no submit handler
- Efeito: possível marcar lead como perdido sem motivo
- Severidade: Alta
- Correção: adicionar schema.parse(data) antes do onSubmit

## Casos aprovados (10/11)

TC-001 Cadastrar lead com sucesso ✅
TC-002 Validar campos obrigatórios ✅
TC-003 Transição sem campos obrigatórios retorna 422 ✅
TC-004 Transição com campos completos ✅
TC-005 Marcar como perdido com campos completos ✅
TC-007 Vendedor não vê leads de outros ✅
TC-008 Supervisão vê todos ✅
TC-009 Vendedor sem acesso ao export ✅
TC-010 Filtro leads parados ✅
TC-011 Atividade atualiza datas ✅

## Recomendação
Corrigir BUG-001 antes do deploy em produção.
