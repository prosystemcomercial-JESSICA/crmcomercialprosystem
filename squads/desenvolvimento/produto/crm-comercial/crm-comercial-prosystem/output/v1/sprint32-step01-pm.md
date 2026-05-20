# Sprint 32 — Step 01 — André Vieira (PM)
# Portal do Cliente

## Contexto

O CRM Comercial ProSystem gerencia toda a jornada comercial internamente. O Portal do Cliente é uma interface pública (acesso por link + senha) onde o cliente final pode consultar suas propostas, contratos, serviços contratados e histórico de interações — sem precisar ligar para o vendedor.

## User Stories

**US-3201:** Como Cliente, quero acessar o portal com meu e-mail e uma senha enviada pelo vendedor, para consultar meus documentos de forma autônoma.

**US-3202:** Como Cliente, quero ver na página inicial um resumo da minha situação: propostas aguardando aprovação, contratos ativos e próximas parcelas a vencer.

**US-3203:** Como Cliente, quero ver e baixar todas as propostas enviadas pela ProSystem, com status atual (aguardando aprovação, aprovada, recusada) e histórico de versões.

**US-3204:** Como Cliente, quero aprovar ou recusar uma proposta diretamente pelo portal, sem precisar responder e-mail ou assinar papel.

**US-3205:** Como Cliente, quero ver os contratos assinados com a ProSystem, com detalhes de valores, vigência e serviços incluídos.

**US-3206:** Como Cliente, quero ver o histórico de serviços contratados e o status de cada um (ativo, suspenso, cancelado).

**US-3207:** Como Cliente, quero ver o histórico de comunicações e interações registradas pelo vendedor (atividades e histórico do lead).

**US-3208:** Como Vendedor/Admin, quero gerar e enviar o convite de acesso ao portal para um cliente (lead/cliente com contrato ativo), com link e senha temporária por e-mail.

**US-3209:** Como Vendedor/Admin, quero ver um log de acessos do cliente ao portal (quando entrou, o que visualizou).

**US-3210:** Como Cliente, quero alterar minha senha no primeiro acesso ao portal.

## Critérios de Aceite

**US-3201:**
- Tela de login separada: `/portal/login`
- Autenticação com e-mail + senha; JWT próprio para o portal (não misturar com JWT do CRM)
- Conta `PortalCliente`: email, senhaHash, leadId, ativo (bool), primeiroAcesso (bool)
- Bloqueio após 5 tentativas erradas (15min); sessão expira em 4h
- Redirect automático para `/portal/alterar-senha` se `primeiroAcesso = true`

**US-3202:**
- Dashboard: cards de propostas pendentes de aprovação, contratos ativos, próxima parcela (data + valor)
- Saudação com nome do cliente; logo ProSystem
- Dados do vendedor responsável (nome + e-mail + telefone) no rodapé do dashboard

**US-3203:**
- Lista `/portal/propostas`: todas as propostas do lead, ordenadas por data DESC
- Status badge: 🟡 Aguardando | ✅ Aprovada | ❌ Recusada | 🔵 Em Negociação
- Download do PDF da proposta (reutiliza o gerador existente)
- Histórico de versões inline (ex.: "v1 enviada em 10/05 · v2 enviada em 15/05")

**US-3204:**
- Botões "Aprovar ✅" e "Recusar ❌" visíveis apenas para propostas com status `AGUARDANDO_APROVACAO`
- Modal de confirmação antes de cada ação
- Recusa exige campo de motivo (opcional, máx 500 chars)
- Ao aprovar: status da proposta → `APROVADA`; HistoricoLead: `proposta_aprovada_portal`
- Ao recusar: status → `RECUSADA`; notificação SSE/push ao vendedor responsável

**US-3205:**
- Lista `/portal/contratos`: contratos com status `ATIVO` ou `ENCERRADO`
- Detalhes: valor total, data início, data fim, modalidade (mensal/anual), serviços incluídos
- Download do PDF do contrato (se existir campo `arquivoUrl`)

**US-3206:**
- Lista `/portal/servicos`: ServicoContratado do cliente
- Status badge: 🟢 Ativo | 🟡 Suspenso | ❌ Cancelado
- Exibir: nome do serviço, valor mensal, data início, data próxima renovação

**US-3207:**
- Timeline `/portal/historico`: eventos públicos do HistoricoLead
- Filtro de eventos exibidos: apenas tipos `mensagem_respondida`, `proposta_enviada`, `proposta_aprovada_portal`, `contrato_criado` (sem expor informações internas de qualificação/venda)
- Sem campo de resultado de atividade exposto

**US-3208:**
- Botão "Enviar Acesso ao Portal" na ficha do lead (web) — visível para VENDEDOR/SUPERVISAO/ADMIN
- Cria `PortalCliente` com senha temporária aleatória (8 chars alfanumérica)
- Envia e-mail com: link do portal, e-mail, senha temporária, nome do vendedor
- Se já existe conta: reseta a senha e marca `primeiroAcesso = true`
- `POST /api/portal-clientes/convidar` com `{ leadId }`

**US-3209:**
- Tabela `PortalAcesso`: userId (do PortalCliente), rota, createdAt
- Log criado a cada request autenticado no portal
- Tela interna (web CRM): `GET /api/portal-clientes/:id/acessos` — lista dos últimos 30 acessos

**US-3210:**
- Formulário em `/portal/alterar-senha`: senha atual (ou "senha temporária"), nova senha (mín 8 chars), confirmação
- Ao salvar: `primeiroAcesso = false`; redireciona para dashboard

## Acesso por Perfil

| Ação | Cliente (Portal) | Vendedor (CRM) | Supervisora | Admin |
|------|-----------------|----------------|-------------|-------|
| Ver próprias propostas | ✅ | — | — | — |
| Aprovar/recusar proposta | ✅ | — | — | — |
| Ver contratos | ✅ | — | — | — |
| Ver serviços | ✅ | — | — | — |
| Ver histórico público | ✅ | — | — | — |
| Gerar convite portal | ❌ | ✅ | ✅ | ✅ |
| Ver log de acessos | ❌ | ✅ | ✅ | ✅ |

## Stack do Portal

- **Frontend portal:** Next.js no mesmo projeto web, mas em rotas `/portal/*` com layout próprio (sem o sidebar do CRM)
- **JWT portal:** token separado, secret diferente (`PORTAL_JWT_SECRET`), expira em 4h
- **E-mail:** nodemailer (integração existente via Sprint 19)
- **2 tabelas novas:** `PortalCliente`, `PortalAcesso`

## Fora do Escopo

- Chat em tempo real com vendedor dentro do portal
- Upload de documentos pelo cliente
- Pagamento online via portal
- Portal para múltiplas empresas do mesmo cliente
