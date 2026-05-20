# Sprint 31 — Step 01 — André Vieira (PM)
# App Mobile — React Native iOS + Android

## Contexto

O CRM Comercial ProSystem existe como aplicação web. Os vendedores precisam de acesso mobile para consultar leads, registrar atividades e receber notificações push quando estão em campo (visitas, ligações externas). Este sprint entrega o app React Native com as funcionalidades essenciais do dia a dia do vendedor.

## Escopo do App

### O que entra (MVP mobile):
1. **Autenticação** — Login JWT + biometria (Face ID / Touch ID)
2. **Dashboard** — Resumo do dia: leads, atividades, agenda
3. **Leads** — Lista, busca, ficha completa, edição básica
4. **Funil** — Visualização kanban simplificada com swipe entre etapas
5. **Atividades** — Registrar ligação/visita/e-mail, ver histórico
6. **Agenda** — Ver eventos do dia, criar evento rápido
7. **WhatsApp** — Ver conversas e responder mensagens
8. **Notificações Push** — Alertas de atividades vencidas, evento próximo, nova mensagem WA

### O que fica para versão posterior:
- Relatórios e exportação
- Metas e comissões completo
- Portal do cliente
- Cadastro de novos leads (apenas edição no MVP)

## User Stories

**US-3101:** Como Vendedor, quero fazer login no app com meu e-mail e senha, e na próxima vez usar biometria (Face ID / Touch ID), para acesso rápido e seguro.

**US-3102:** Como Vendedor, quero ver na tela inicial do app um resumo do meu dia: leads ativos, atividades para hoje, próximo evento na agenda e mensagens não lidas no WhatsApp.

**US-3103:** Como Vendedor, quero ver a lista dos meus leads com busca por nome, filtro por etapa do funil e indicadores de última atividade, para priorizar com quem falar.

**US-3104:** Como Vendedor, quero abrir a ficha de um lead e ver todas as informações: dados de contato, etapa atual, histórico de atividades, propostas e últimas mensagens WhatsApp.

**US-3105:** Como Vendedor, quero mover um lead de etapa no funil com um swipe ou tap, sem precisar abrir a ficha completa.

**US-3106:** Como Vendedor, quero registrar uma atividade (ligação, visita, e-mail) em um lead diretamente pelo app, com campo de resultado e próximo contato.

**US-3107:** Como Vendedor, quero ver minha agenda do dia e criar um evento rápido (reunião com lead) pelo app.

**US-3108:** Como Vendedor, quero ver as conversas WhatsApp dos meus leads e responder mensagens diretamente no app.

**US-3109:** Como Vendedor, quero receber notificações push quando: (a) uma atividade vence hoje, (b) um evento começa em 15 minutos, (c) chega uma mensagem WhatsApp de um lead meu.

**US-3110:** Como Supervisora, quero ver no app a lista de todos os leads da equipe com filtro por vendedor, e o dashboard com os KPIs do time.

## Critérios de Aceite

**US-3101:**
- Tela de login com campos e-mail + senha
- JWT armazenado de forma segura com `expo-secure-store`
- Após primeiro login bem-sucedido: prompt para ativar biometria
- Biometria via `expo-local-authentication` — fallback para senha
- Refresh token automático em background (interceptor Axios)
- Logout limpa token do secure store

**US-3102:**
- Dashboard home com 4 cards: "Leads Ativos", "Atividades Hoje", "Próximo Evento", "WA Não Lidas"
- Pull-to-refresh para atualizar
- Tap em cada card navega para a seção correspondente
- Dados reais da API (reutiliza endpoints existentes do web)

**US-3103:**
- Lista com FlatList virtualizada (performance)
- Busca local + remote (debounce 400ms) por nome/empresa
- Chip de filtro rápido por etapa (scroll horizontal)
- Cada item: nome, empresa, etapa badge colorido, tempo desde última atividade
- Indicador visual: leads parados 3d+ (amarelo), 7d+ (vermelho)

**US-3104:**
- Ficha do lead em tela completa com tabs: Dados | Histórico | Propostas | WA
- Botões rápidos: "Ligar" (abre discador nativo), "E-mail" (abre app de e-mail), "WhatsApp" (abre aba WA)
- Edição inline do status e etapa
- Histórico de atividades em lista cronológica

**US-3105:**
- Tela Funil: cards de leads em colunas por etapa (ScrollView horizontal)
- Tap no card do lead → ficha; long-press → bottom sheet para mover etapa
- Apenas etapas com leads são mostradas (sem colunas vazias)

**US-3106:**
- FAB (Floating Action Button) na ficha do lead → "Nova Atividade"
- Bottom sheet: tipo (ligação/visita/e-mail), resultado (textarea), próximo contato (DateTimePicker)
- Envio otimista: item aparece na lista imediatamente

**US-3107:**
- Tela Agenda: lista do dia atual + scroll lateral para dias seguintes
- FAB → "Novo Evento": título, lead (busca), data/hora, tipo
- Evento com link Google Meet exibe botão "Entrar na Reunião" (abre browser)

**US-3108:**
- Tela Conversas: lista de conversas do vendedor (mesmos dados do web)
- Thread com mensagens em bolhas (inbound cinza, outbound azul)
- Caixa de texto com botão enviar; validação de janela 24h
- Badge de não lidas sincronizado com web

**US-3109:**
- Integração com Expo Push Notifications (`expo-notifications`)
- Backend envia push via Expo Push API quando: atividade vencida (cron 08:00), evento próximo (cron +05min), nova mensagem WA (realtime no webhook handler)
- Toque na notificação navega para o item correspondente (deep link)
- Permissão solicitada na primeira abertura

**US-3110:**
- Supervisora/CEO: seletor de vendedor no topo da tela de Leads
- Dashboard adicional para supervisora: cards de equipe (total leads, atividades atrasadas, conversões)

## Acesso por Perfil

| Tela | VENDEDOR | SUPERVISAO | CEO |
|------|----------|------------|-----|
| Dashboard pessoal | ✅ | ✅ | ✅ |
| Dashboard equipe | ❌ | ✅ | ✅ |
| Leads próprios | ✅ | ✅ | ✅ |
| Todos os leads | ❌ | ✅ | ✅ |
| Funil | ✅ | ✅ | ✅ |
| Atividades | ✅ | ✅ | ✅ |
| Agenda | ✅ | ✅ | ✅ |
| WhatsApp | ✅ (próprios) | ✅ | ✅ |
| Push notifications | ✅ | ✅ | ✅ |

## Stack Mobile

- **Framework:** React Native com Expo SDK 51 (managed workflow)
- **Navegação:** Expo Router (file-based routing, similar ao Next.js)
- **UI:** NativeWind (Tailwind para React Native) + React Native Paper para componentes
- **Estado/Cache:** TanStack Query (mesmo do web, reaproveitamento de types)
- **HTTP:** Axios com interceptors (token refresh automático)
- **Storage seguro:** expo-secure-store
- **Push:** expo-notifications
- **Biometria:** expo-local-authentication
- **Calendario:** @react-native-community/datetimepicker
- **Backend:** Mesma API REST do web (zero alterações de rotas; apenas novo endpoint para push tokens)

## Fora do Escopo

- Modo offline / sincronização offline
- Camera para upload de documentos
- Gravação de chamadas
- Integração com agenda do celular (apenas Google Calendar via web)
