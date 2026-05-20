# Sprint 19 — Step 01 — André Vieira (PM)
# Integrações — WhatsApp Business, E-mail SMTP e Telefonia

## Contexto

O CRM precisa se comunicar com leads via canais externos diretamente da interface, sem sair do sistema. Este sprint conecta três canais: WhatsApp Business API (mensagens individuais e campanhas), e-mail SMTP avançado (configuração por empresa, templates, + canal adicional para Campanhas do Sprint 18), e registro de ligações telefônicas (log manual + integração futura com softphone).

## User Stories

**US-1901:** Como Vendedor, quero enviar uma mensagem WhatsApp diretamente da ficha do lead (botão "Enviar WhatsApp"), para registrar e iniciar conversas sem sair do CRM.

**US-1902:** Como Supervisora/Admin, quero configurar as credenciais de integração (WhatsApp Business API token + phone_number_id, SMTP servidor/usuário/senha) no painel de Configurações, para que toda a equipe use os mesmos canais.

**US-1903:** Como Vendedor, quero registrar uma ligação feita para um lead (data, duração, resultado, notas), para manter o histórico de contato completo.

**US-1904:** Como sistema, quero que toda mensagem WhatsApp enviada pelo CRM seja registrada no histórico do lead automaticamente.

**US-1905:** Como usuário, quero que as Campanhas do Sprint 18 possam usar WhatsApp como canal, além de e-mail, disparando mensagens individuais via API para cada destinatário.

**US-1906:** Como Supervisora/Admin, quero ver um log de todas as mensagens enviadas pelo CRM (WhatsApp + e-mail) com status de entrega, para auditoria.

## Critérios de aceite

- **US-1901:** Botão "💬 WhatsApp" na ficha do lead (aba Atividades ou action bar). Abre modal com template de mensagem pré-preenchida (nome + vendedor). Envia via WhatsApp Business Cloud API. Resposta da API indica se foi aceita pelo Meta.
- **US-1902:** Página Configurações > Integrações com formulários: (a) WhatsApp: phone_number_id, access_token, template_name padrão; (b) SMTP: host, port, secure, user, pass, from. Campos sensíveis exibidos como `••••••`. Botão "Testar conexão" para cada canal.
- **US-1903:** Modal "Registrar ligação" acessível da ficha do lead: data/hora (default: agora), duração em minutos, resultado (select: conectou/não atendeu/caixa postal/agendou retorno), notas livres. Registra no histórico do lead.
- **US-1904:** Toda chamada à API WhatsApp → evento no HistoricoLead (tipoEvento: 'whatsapp_enviado', descricao: primeiros 100 chars da mensagem).
- **US-1905:** CampanhaDestinatario recebe campo `whatsappPhone` (capturado do lead.telefone no snapshot). Disparo WhatsApp usa template da API (texto fixo + variáveis). Canal WhatsApp disponível na Campanha (CanalCampanha enum estendido).
- **US-1906:** Tabela `log_mensagens` com: canal, destinatario (email ou phone), assunto/template, status (enviado/falha/pendente), erro, campanhaId?, leadId?, criadoEm.

## Regras

- Configurações de integração armazenadas no banco (tabela `config_integracao`), não em env vars — permite reconfigurar via UI sem redeploy
- `SMTP_*` env vars do Sprint 18 continuam como fallback; config do banco tem prioridade
- WhatsApp Business Cloud API (Meta): endpoint `POST https://graph.facebook.com/v19.0/{phone_number_id}/messages`
- Mensagens WhatsApp usam templates pré-aprovados pelo Meta (tipo `template`); texto livre só em janela de 24h (não implementado neste sprint)
- Ligações são registros manuais — sem integração automática com PABX neste sprint
- Telefonia avançada (softphone, gravação) marcada como "Fase 3"

## Acesso por perfil

| Ação | VENDEDOR | SUPERVISAO | CEO | ADMIN |
|------|----------|------------|-----|-------|
| Enviar WhatsApp (lead próprio) | ✅ | ✅ | ✅ | ✅ |
| Registrar ligação | ✅ | ✅ | ✅ | ✅ |
| Configurar integrações | ❌ | ❌ | ✅ | ✅ |
| Ver log de mensagens | ❌ | ✅ | ✅ | ✅ |
| Campanhas WhatsApp (criar/disparar) | ❌ | ✅ | ✅ | ✅ |

## Fora do escopo (Fase 3)

- Recebimento de mensagens WhatsApp (webhook inbound)
- Softphone integrado / gravação de chamadas
- SMS
- Integração com provedores de telefonia (Twilio, Zendesk Talk)
