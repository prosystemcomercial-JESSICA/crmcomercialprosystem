# Sprint 18 — Step 01 — André Vieira (PM)
# Campanhas — Envio em Massa Segmentado

## Contexto

Vendedores e supervisores precisam comunicar-se com grupos de leads de forma estruturada — promoções, follow-ups em massa, avisos de contrato, campanhas sazonais. O módulo permite criar campanhas, segmentar destinatários por critérios do CRM e disparar e-mails via SMTP (canal inicial). WhatsApp e telefonia serão adicionados no Sprint 19.

## User Stories

**US-1801:** Como Supervisora/Admin, quero criar uma campanha (nome, descrição, canal, mensagem) e definir quais leads receberão, para comunicar em massa de forma organizada.

**US-1802:** Como usuário, quero segmentar os destinatários da campanha filtrando leads por: etapa do funil, status, vendedor responsável, e/ou tag, para não disparar para todos os leads indiscriminadamente.

**US-1803:** Como usuário, quero pré-visualizar a lista de destinatários antes de disparar, para confirmar o alcance da campanha.

**US-1804:** Como Supervisora/Admin, quero agendar uma campanha para uma data/hora futura, ou dispará-la imediatamente, para ter controle sobre o timing.

**US-1805:** Como usuário, quero acompanhar as métricas da campanha (total destinatários, enviados, falhas) em tempo real durante o envio e após a conclusão.

**US-1806:** Como Vendedor, quero ver somente as campanhas que envolvem meus leads, sem acesso à criação ou disparo.

**US-1807:** Como sistema, quero registrar cada e-mail enviado com status (enviado/falha) por destinatário, para auditoria e reenvio seletivo.

## Critérios de aceite

- **US-1801:** Formulário com: nome (obrigatório), descrição (opcional), canal = email (único canal neste sprint), assunto do e-mail, corpo (editor rich text simples ou textarea com variáveis), status inicial = rascunho.
- **US-1802:** Filtros de segmentação: etapa (multiselect), status (multiselect), vendedorId (multiselect — visível para SUPERVISAO/CEO/ADMIN), tags futuras (placeholder). Preview com contagem de leads resultantes.
- **US-1803:** Listagem de destinatários com nome, empresa, e-mail antes do disparo. Aviso se algum lead não tem e-mail cadastrado.
- **US-1804:** Campo "Agendar para" (datepicker + horário). Se vazio → disparo imediato ao clicar "Disparar". Campanha agendada pode ser cancelada antes do horário.
- **US-1805:** Barra de progresso durante envio (via SSE ou polling). Contador enviados/falhas/total ao final. Status da campanha: rascunho → agendada → enviando → concluída | cancelada.
- **US-1806:** VENDEDOR vê página "Campanhas" em modo somente leitura, filtrado pelos seus leads. Não pode criar, editar, disparar.
- **US-1807:** Tabela `campanha_destinatarios` com status por destinatário: pendente → enviado | falha, com campo erro (motivo da falha).

## Regras

- Campanha só pode ser disparada se tiver ≥ 1 destinatário com e-mail
- Destinatários sem e-mail são marcados como "sem canal" e não entram no envio, mas aparecem no painel
- Edição permitida apenas em status `rascunho`; após disparo, somente leitura
- Cancelamento: permitido em `agendada`; interrompe envio em `enviando` (leads pendentes ficam como `nao_enviado`)
- Variáveis de template suportadas: `{{nome}}`, `{{empresa}}`, `{{vendedor}}`
- Cada campanha = 1 canal; para múltiplos canais → criar campanhas separadas
- SMTP configurado por variável de ambiente (Sprint 19 adiciona WhatsApp)

## Acesso por perfil

| Perfil | Criar | Editar | Disparar | Ver métricas | Ver lista |
|--------|-------|--------|----------|-------------|-----------|
| VENDEDOR | ❌ | ❌ | ❌ | só suas | só suas |
| SUPERVISAO | ✅ | ✅ | ✅ | ✅ | ✅ |
| CEO | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |

## Campos do modelo Campanha

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | cuid | PK |
| nome | string | Nome da campanha |
| descricao | string? | Descrição interna |
| canal | enum | EMAIL (único por ora) |
| assunto | string | Assunto do e-mail |
| corpo | text | Corpo com variáveis |
| status | enum | rascunho / agendada / enviando / concluida / cancelada |
| agendadaPara | DateTime? | Null = disparo imediato |
| criadoPorId | string | FK User |
| filtroEtapas | string[] | Etapas selecionadas |
| filtroStatus | string[] | Status selecionados |
| filtroVendedores | string[] | VendedorIds selecionados |
| totalDestinatarios | int | Calculado no snapshot |
| totalEnviados | int | Acumulado em tempo real |
| totalFalhas | int | Acumulado em tempo real |
| iniciadaEm | DateTime? | Quando o disparo começou |
| concluidaEm | DateTime? | Quando o disparo terminou |
| createdAt | DateTime | |
| updatedAt | DateTime | |
