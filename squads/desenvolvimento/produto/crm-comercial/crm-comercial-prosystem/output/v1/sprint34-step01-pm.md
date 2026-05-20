# Sprint 34 — Step 01 — André Vieira (PM)
# Vínculo Manual de Conversa WhatsApp → Lead

## Contexto

O Sprint 20 implementou o recebimento de mensagens WhatsApp (inbound). Quando uma mensagem chega de um número não cadastrado em nenhum lead, a conversa é criada com `leadId = null` — lead desconhecido. O vínculo automático tenta casar pelo telefone, mas falha se:
- O número está formatado diferente no lead (ex.: sem o 9, sem DDD, com espaço)
- O lead ainda não existe no CRM
- O lead tem um número diferente do que usou no WhatsApp

Este sprint entrega a funcionalidade de vínculo **manual**: supervisora ou admin visualiza conversas de desconhecidos, vincula a um lead existente ou cria um novo lead a partir da conversa.

## User Stories

**US-3401:** Como Supervisora/Admin, quero ver na página `/conversas` uma aba ou seção "Desconhecidos" com todas as conversas WhatsApp sem leadId associado, para identificar quem são antes de perder contato.

**US-3402:** Como Supervisora/Admin, quero abrir uma conversa desconhecida e ver todas as mensagens trocadas com aquele número, para entender o contexto antes de vincular.

**US-3403:** Como Supervisora/Admin, quero vincular uma conversa desconhecida a um lead **existente** buscando por nome, CPF/CNPJ, e-mail ou telefone — o histórico da conversa passa a aparecer na ficha daquele lead.

**US-3404:** Como Supervisora/Admin, quero criar um **novo lead** a partir de uma conversa desconhecida: preencho nome e vendedor, o lead é criado e a conversa é automaticamente vinculada a ele.

**US-3405:** Como Supervisora/Admin, quero **arquivar** uma conversa desconhecida (spam, engano) para removê-la da lista de pendências sem criar lead.

**US-3406:** Como sistema, após vincular manualmente, quero que o vendedor responsável pelo lead receba uma notificação SSE informando que chegou uma nova conversa WhatsApp atribuída a ele.

**US-3407:** Como Vendedor, quero ver na aba "Conversas" da minha ficha de lead mensagens que chegaram **antes** do vínculo ser feito — histórico completo preservado.

**US-3408:** Como Supervisora/Admin, quero um contador de badge indicando quantas conversas desconhecidas estão pendentes de vínculo, visível no sidebar.

## Critérios de Aceite

**US-3401:**
- Aba "Desconhecidos" na página `/conversas` visível apenas para SUPERVISAO/CEO/ADMIN
- Lista ordenada por `ultimaMensagemEm` DESC
- Cada item mostra: número de telefone, preview última mensagem, data/hora, total de mensagens
- Badge vermelho no sidebar com contagem de desconhecidos pendentes

**US-3402:**
- Clicar em uma conversa desconhecida abre thread completa
- Thread exibe mensagens em ordem cronológica
- Botões de ação no topo: "Vincular a Lead Existente" | "Criar Novo Lead" | "Arquivar"

**US-3403:**
- Modal "Vincular a Lead" com campo de busca (debounce 300ms, mínimo 3 chars)
- Busca por: nome, e-mail, telefone, empresa
- Resultado mostra: nome, empresa, vendedor, telefone atual
- Confirmar → `PATCH /api/conversas/desconhecidas/:id/vincular` com `{ leadId }`
- Após vínculo: telefone do lead atualizado para o número da conversa (se lead não tiver telefone)
- Conversa some da aba Desconhecidos e aparece na ficha do lead
- HistoricoLead: `conversa_wa_vinculada`

**US-3404:**
- Modal "Criar Lead" com campos: nome* (obrigatório), empresa, e-mail, vendedorId* (obrigatório), telefone pré-preenchido com o número da conversa
- POST cria lead + vincula conversa + atualiza `conversa.leadId`
- HistoricoLead: `lead_criado_via_whatsapp`
- Redireciona para `/leads/:id` após criação

**US-3405:**
- Botão "Arquivar" → modal de confirmação "Esta conversa não será mais exibida como pendente."
- `PATCH /api/conversas/desconhecidas/:id/arquivar` → seta `arquivada = true`
- Conversas arquivadas ficam ocultas por padrão; filtro "Mostrar arquivadas" no header da aba

**US-3406:**
- Após vincular (US-3403 ou US-3404): SSE `conversa_wa_vinculada` enviado ao vendedor responsável
- Payload: `{ tipo, leadId, leadNome, telefone }`
- Toast no frontend: "Nova conversa WhatsApp vinculada: [nome do lead]"

**US-3407:**
- Sem alteração no schema — mensagens já estão na tabela pelo `conversaId`
- `listarMensagens(leadId)` busca por `whatsappConversa.leadId` → retorna histórico completo
- Teste: mensagem recebida às 10h, vínculo feito às 15h → mensagem das 10h aparece na ficha

**US-3408:**
- `GET /api/conversas/desconhecidas/contagem` → `{ total: N }`
- Badge no sidebar ao lado de "Conversas" visível para SUPERVISAO/CEO/ADMIN
- Cache 2min; invalidado ao vincular/arquivar

## Regras de Negócio

- Somente SUPERVISAO/CEO/ADMIN podem vincular/arquivar conversas desconhecidas
- VENDEDOR não vê a aba "Desconhecidos" nem os endpoints de vínculo
- Ao vincular: se o lead já tem `telefone` preenchido, **não sobrescrever** — apenas criar o vínculo
- Ao vincular: se `conversa.telefone` difere do `lead.telefone`, registrar no histórico para auditoria
- Uma conversa pode ser vinculada apenas 1 vez (após vínculo, `leadId` não é null → erro 409 se tentar vincular novamente)
- Arquivar não exclui mensagens — apenas oculta da lista de pendências
- Pode desfazer arquivamento (`PATCH /arquivar` com `{ arquivada: false }`)
- Ao criar lead via US-3404: status inicial = `NOVO`, etapa = `Novo Lead`

## Acesso por Perfil

| Ação | VENDEDOR | SUPERVISAO | CEO | ADMIN |
|------|----------|------------|-----|-------|
| Ver aba Desconhecidos | ❌ | ✅ | ✅ | ✅ |
| Vincular a lead existente | ❌ | ✅ | ✅ | ✅ |
| Criar lead via WhatsApp | ❌ | ✅ | ✅ | ✅ |
| Arquivar conversa | ❌ | ✅ | ✅ | ✅ |
| Ver badge de pendentes | ❌ | ✅ | ✅ | ✅ |
| Ver mensagens do lead vinculado | ✅ (próprio) | ✅ | ✅ | ✅ |

## Fora do Escopo

- Reatribuição de conversa já vinculada para outro lead (desvínculo)
- Fusão de duas conversas do mesmo número
- Detecção automática por ML de quem é o desconhecido
