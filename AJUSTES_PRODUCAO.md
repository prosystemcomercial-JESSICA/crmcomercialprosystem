# CRM Comercial ProSystem — Ajustes para Produção

**Data:** 2026-05-21  
**Objetivo:** Refinamento módulo a módulo antes do deploy em produção.

---

## Status Geral

| # | Módulo | Ajuste | Status |
|---|--------|--------|--------|
| 1 | Contratos / Dashboard | Exclusão de contrato não deve aparecer no dashboard; registrar apenas em auditoria | ✅ Concluído |
| 2 | Relatório Comercial | Módulo de relatório mensal/anual com inserção manual (Jan–Mai) e geração automática do CRM (a partir Jun/2026) — acesso restrito SUPERVISÃO/CEO | ✅ Concluído |
| 3 | Clientes — Importação CSV | Botão "Importar CSV" com modal 3 etapas: upload com drag-and-drop, mapeamento de colunas, preview e resultado. Campo `codigo` adicionado ao cadastro. | ✅ Concluído |
| 4 | Clientes — Ficha Completa | Página de detalhe do cliente com 5 abas: Cadastro (flags, redes, 34 ferramentas checkboxes, grupo, observações), Contatos (múltiplos), Histórico de Solicitações (resumo + tabela + modal nova solicitação), Endereço (busca CEP), Informações Adicionais (responsável + contador). Rows da listagem agora navegam para `/clientes/[id]`. | ✅ Concluído |
| 5 | Usuários e Permissões | Botão "Convidar" → "Cadastrar Usuário". Tabela com cargo/classificação/módulos/status. Formulário completo com cargo, classificação N1/N2/N3 condicional, observações, checklist de 22 módulos com 6 níveis (Ver/Criar/Editar/Excluir/Exportar/Administrar) + alcance (Próprio/Grupo/Todos). Presets por cargo com sugestão automática. Alerta para permissões críticas. Senha aleatória de 5 chars gerada no cadastro. Auditoria de todas as ações. Acesso restrito a CEO e Supervisores. | ✅ Concluído |
| 6 | Funil Comercial | Kanban dinâmico com colunas customizáveis (CRUD), 9 etapas seed, tipos (Andamento/Fechamento/Perdida/Sem perfil/Reativação). Cards ricos com temperatura, valor, origem, cidade. Cards de resumo no topo (leads, pipeline, vendido, meta, bônus, conversão, perdidos). Bloco motivacional com 6 mensagens por faixa de meta. Bloco de bônus trimestral. Modal obrigatório de perda com 12 motivos + observações. Histórico de movimentações. Métricas por papel (vendedor só dele, supervisor/CEO tudo). Controle Total com ranking. Metas mensais e trimestrais. | ✅ Concluído |
| 6b | Funil — Colunas Fixas | As 6 etapas originais (Prospecção, Qualificação, Apresentação, Proposta, Negociação, Fechamento) + "Negócio Perdido" marcadas como `fixo=TRUE` no banco. Backend bloqueia DELETE e alteração de tipo para colunas fixas. Frontend esconde botão "Remover" e trava select de tipo para fixas; exibe ícone 🔒 e rótulo "Coluna fixa do sistema" no modal de configuração. Permite adicionar novas colunas customizadas além das fixas. | ✅ Concluído |

---

## Detalhamento dos Ajustes

### #1 — Contratos: Exclusão não reflete no Dashboard
**Problema:** Ao excluir um contrato, o dashboard continuava exibindo o resultado.  
**Solução:** Soft-delete — campo `deleted_at` no modelo `Contrato`. Todas as queries de dashboard e listagem filtram `deleted_at IS NULL`. A exclusão registra timestamp em `deleted_at` em vez de remover o registro.  
**Arquivos alterados:** `prisma/schema.prisma`, `routes/contratos.ts`, `routes/dashboard-power.ts`

---

*Documento atualizado a cada ajuste recebido.*
