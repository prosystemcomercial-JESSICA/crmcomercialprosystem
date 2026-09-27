# Briefing de design UI/UX: CRM Comercial Prosystem

Versão 1.0 · 27/09/2026

## 1. Para quem desenhamos

- **Supervisora (Jessica):** passa o dia no CRM, alterna entre WhatsApp, Escritório virtual e propostas. Precisa ver **o que exige ação agora** e decidir em um clique (aprovar, assumir, refazer).
- **Vendedora e SDR:** precisam de contexto rápido: quem é o cliente, termômetro, dor, o que falta.
- **Diretoria:** consome números, principalmente fora do CRM (e-mail e WhatsApp).
- **Cliente final:** só vê o WhatsApp e a página pública da proposta: tudo deve parecer escrito por uma pessoa, sem cara de robô.

## 2. Princípios

1. **Ação primeiro:** o que precisa de decisão aparece em cima ("O que fazer agora", "✋ Para você aprovar", pendências da Laya).
2. **Quem está atendendo está sempre visível:** farol rosa com o nome do agente; "Sem dono" em amarelo; dono pelo nome.
3. **Nada some sem rastro:** tudo o que um agente fez aparece na conversa, na agenda e no histórico do lead.
4. **Linguagem do usuário:** botões dizem o que acontece ("Aprovar e enviar", "🔄 Refazer", "✅ Finalizar", "↩ Reabrir"). Sem jargão técnico.
5. **Janela inteira:** as páginas usam toda a largura (sem margens largas); responsivo até o celular.
6. **Tom humano nas mensagens ao cliente:** frases curtas, sem travessão, no máximo um emoji, uma pergunta por vez.

## 3. Sistema visual

- **Fonte:** Inter (`--font-sans`), mono Geist Mono.
- **Temas:** azul (padrão), laranja e verde, cada um com modo claro e escuro (`[data-theme]` + `.dark`). Componentes usam tokens, nunca cores fixas de fundo:
  - `--t-content-bg` (fundo da página), `--t-card-bg`, `--t-card-border`, `--t-card-shadow`;
  - `--t-text-primary`, `--t-text-secondary`, `--t-text-muted`;
  - `--t-error-*` para erros.
- **Cor de ação principal:** azul `#2E6EAB`; sucesso `#15803d`/`#16a34a`; alerta `#ea580c`; erro `#dc2626`.
- **Cor por agente** (crachá, borda do painel, farol): Bia `#e11d74`, Lurdinha `#f59e0b`, Clarice `#8b5cf6`, Luiz Felipe `#2563eb`, Zequinha `#16a34a`, Helena `#0891b2`, Laya `#db2777`, Marta `#7c3aed`, Sofia `#ea580c`, Caroline `#be123c`, Julio `#0d9488`.
- **Temperatura do lead:** 🔥 Muito quente `#dc2626`, 🟠 Quente `#ea580c`, 🟡 Morno `#ca8a04`, 🔵 Frio `#2563eb`.
- **Selos:** etiqueta (cor da etiqueta), "Sem dono" (`#FEF3C7`/`#92400E`), farol do agente (`#FCE7F3`/`#BE185D`, bolinha `#EC4899` pulsando, respeita `prefers-reduced-motion`).

## 4. Telas-chave

### 4.1 WhatsApp (3 colunas)
- **Esquerda:** abas Minhas / Sem dono / Todas / Finalizadas; "O que fazer agora"; lista com selos.
- **Centro:** cabeçalho com nome, número, farol, e ações (Assumir, Finalizar, prioridade, etiqueta, transferir); mensagens com balão "Atendimento automático" para robôs.
- **Direita (painel):** Atendimento/SLA, Contato, Triagem, Resumir conversa, **➕ Criar proposta | 📄 Enviar/reenviar**, IA Laya (confirmar/corrigir), Responsável, **📝 Observações**, Mover no funil.

### 4.2 Escritório virtual
- Sala isométrica em estilo LEGO: mesas, café, biblioteca, pebolim, videogame, sala de reunião e sala da Jessica.
- Minifigs com cabelo, acessórios e **tom de pele por agente** (ex.: Helena negra com black power).
- **Interações:** clicar no agente abre a **📅 Agenda**; setas ou clique movem a Jessica; balão de proximidade; zoom (− / + / Ctrl+roda no cursor / arrastar).
- **Abaixo da sala:** painéis da Caroline, do Luiz Felipe e do Julio (cada um com liga/desliga, aprovação, fila, termômetro); Caderno da Laya; Pesquisas da Sofia (3 últimas + 📓 Caderno); cartões dos agentes.

### 4.3 Painel de agente (Caroline / Julio / Luiz Felipe)
- Cabeçalho: título, descrição, "⏰ Começa…", liga/desliga, aprovar antes de enviar, limite do dia.
- Quadro de economia de IA (OpenAI, Grok, Laya, % sem custo).
- **✋ Para você aprovar:** texto editável, "O que mudar?", botões Aprovar/Enviar com meu ajuste e 🔄 Refazer.
- Tabela: lead, situação, termômetro com motivo, dor principal, confirmar temperatura (ensina a Laya).

## 5. Estados

- **Vazio:** sempre com o próximo passo ("Nenhuma pesquisa ainda… clique em Pesquisar agora").
- **Carregando:** texto curto ("Buscando propostas deste contato…").
- **Erro:** diz o que houve e o que fazer ("Não foi possível baixar. Só a gestão pode baixar o Caderno.").
- **Sucesso:** confirma o resultado ("Observação salva. CNPJ consultado na Receita: …").

## 6. Acessibilidade

- Foco visível, `aria-label` nos botões de ícone (zoom, fechar), contraste dos tokens nos dois modos, animações desligadas com `prefers-reduced-motion`.

## 7. Próximas melhorias de UX sugeridas

- Contador de "para aprovar" no menu lateral.
- Linha do tempo do lead unindo WhatsApp, observações, propostas e agentes.
- Filtro "Com agente" na lista de conversas.
