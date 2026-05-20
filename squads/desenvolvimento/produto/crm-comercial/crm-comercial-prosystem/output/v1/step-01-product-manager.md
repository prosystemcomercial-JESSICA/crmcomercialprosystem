# Step 01 — André Vieira (Product Manager)
# Sprint 1: Módulo de Leads — Escopo e User Stories

## Objetivo
Núcleo central do CRM: cadastro, gestão e acompanhamento de leads do primeiro contato até fechamento/perda.

## User Stories

### US-001 — Cadastrar lead
**Como** vendedor, **quero** cadastrar um novo lead, **para** iniciar o acompanhamento.
- Obrigatórios: empresa/responsável + telefone + origem + segmento + vendedor
- Auto-status: "Novo Lead" ao salvar
- Código interno gerado automaticamente

### US-002 — Listar e filtrar leads
**Como** supervisora, **quero** visualizar leads com filtros avançados, **para** gerenciar a carteira.
- Tabela com paginação (25/página)
- Filtros: vendedor, status, segmento, origem, temperatura, cidade, estado, datas
- Vendedor vê só seus leads; supervisão/CEO veem todos
- Export CSV para supervisão/CEO

### US-003 — Visualizar detalhe do lead
**Como** vendedor, **quero** ver todos os dados em uma tela, **para** ter contexto completo antes de contato.
- Dados empresa + responsável + status + etapa
- Última/próxima atividade + timeline
- Propostas vinculadas + temperatura + tags

### US-004 — Editar lead
**Como** vendedor, **quero** editar dados do lead, **para** manter informações atualizadas.
- Histórico de alterações (quem, o quê, quando)
- Só responsável ou supervisão pode editar

### US-005 — Registrar atividade no lead
**Como** vendedor, **quero** registrar atividade direto na tela do lead.
- Modal: tipo + data/hora + canal + resultado + próxima ação
- Atualiza automaticamente último/próximo contato
- Aparece na timeline imediatamente

### US-006 — Marcar lead como perdido
**Como** vendedor, **quero** marcar lead como perdido com motivo registrado.
- Obrigatórios: motivo + observação + pode recontatar (s/n)
- Se sim: data de recontato obrigatória

### US-007 — Alertas de lead parado
**Como** supervisora, **quero** ser alertada sobre leads sem atividade há 3+ dias.
- Badge vermelho na listagem
- Filtro "Leads parados" disponível

## Campos Obrigatórios por Etapa do Funil

| Etapa | Campos obrigatórios |
|-------|---------------------|
| Novo Lead | empresa + telefone + origem + segmento + vendedor |
| Primeiro Contato | data + canal + é decisor + próxima ação |
| Qualificação | sistema atual + dor principal + plano sugerido + temperatura |
| Apresentação Agendada | data + horário + participantes |
| Proposta Enviada | plano + valores + data envio + próximo follow-up |
| Fechado | plano + mensalidade + instalação + pagamento + implantação |
| Perdido | motivo + observação + pode recontatar |

## Wireframe Brief para UX
Telas: Lista de Leads | Formulário Novo Lead | Detalhe do Lead | Modal Atividade | Modal Perda
