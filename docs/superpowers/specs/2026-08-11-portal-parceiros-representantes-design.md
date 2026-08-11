# Portal de Parceiros / Representantes — Design

## Contexto e motivação

A Prosystem quer abrir um novo canal de representação comercial (perfis Indicador, Representante e Franqueado, ver texto institucional abaixo) e hoje não tem nenhuma forma estruturada de captar candidaturas — seria feito por WhatsApp/e-mail avulso, sem rastro nenhum no CRM.

Este design cobre duas peças:

1. **Página pública de candidatura** — formulário sem login, no mesmo domínio do CRM, no design system Prosystem, com o texto institucional de "Venha ser parceiro" e a Ficha de Cadastro e Qualificação do Representante completa (10 seções, fornecida pelo usuário).
2. **Módulo interno "Representantes"** — kanban no CRM para triar as candidaturas recebidas (Novo → Em Análise → Aprovado → Reprovado), com notificação por e-mail a cada nova candidatura.

As duas peças compartilham um único novo model de dados (`CandidatoRepresentante`): a página pública cria o registro, o módulo interno o gerencia. Não há geração automática de Usuário/Vendedor ao aprovar — isso fica manual, fora do escopo deste módulo (decisão explícita para não acoplar prematuramente a um processo pós-aprovação que ainda não está definido).

## Peça 1 — Página pública `/parceiro`

Rota Next.js nova, **sem `useAuth`/token**, servida no mesmo domínio do CRM (ex.: `https://crm.prosystem.../parceiro`).

**Conteúdo, de cima para baixo:**

1. Cabeçalho institucional com o texto fornecido pelo usuário ("Venha ser parceiro da Prosystem Desenvolvimento de Sistemas — Representação Comercial & Outsourcing", parágrafo de contexto, lista de benefícios).
2. Tabela dos 3 perfis (Indicador / Representante / Franqueado) com a descrição de cada um e o percentual pago (30% instalação / 50% instalação / 50% instalação + 50% mensalidade) — apenas informativo, não editável pelo candidato.
3. **Formulário em etapas (wizard)** — 10 passos, um por seção da Ficha de Cadastro e Qualificação (ver abaixo), com barra de progresso e botões Voltar/Avançar. O registro só é gravado no banco (`POST`) ao concluir o último passo — não há salvamento parcial em v1.
4. Tela de confirmação pós-envio ("Recebemos sua candidatura, entraremos em contato em breve").

Estilo visual: reaproveita a paleta e componentes já usados nos e-mails/telas voltadas ao cliente (`#2E6EAB` / `#4B8EC8`, mesma tipografia e cards do restante do CRM) — não é um sistema visual novo, é a aplicação do design system Prosystem já existente a uma página pública.

### Estrutura do formulário — Ficha de Cadastro e Qualificação do Representante

10 passos do wizard, mapeando 1:1 para as seções do questionário fornecido pelo usuário:

**Passo 1 — Dados do representante** (campos-chave, viram colunas próprias no banco — ver Modelo de dados):
nome completo, nome da empresa/razão social, nome fantasia, CNPJ, CPF do responsável, telefone/WhatsApp, e-mail, cidade/UF sede.

**Passo 2 — Estrutura da empresa:**
possui equipe (sim/não), quantidade de pessoas na equipe, pessoas por função (comercial/prospecção, vendas/fechamento, implantação, instalação, suporte, treinamento, administrativo, outros — texto livre por função), quantas pessoas dedicadas à Prosystem, equipe própria ou terceirizada.

**Passo 3 — Estrutura comercial:**
responsável pelas vendas, quantas pessoas em prospecção/venda, realiza visitas presenciais (sim/não), realiza prospecção ativa (sim/não), canais de prospecção (multi-select: visita presencial, telefone, WhatsApp, redes sociais, indicações, tráfego pago, outros — com campo de texto para "outros").

**Passo 4 — Instalação, implantação e treinamento:**
realiza instalação (sim/não), quem realiza, quantas pessoas instalam, experiência com ERP/PDV/sistemas de gestão (sim/não), experiência com configuração de computadores/impressoras/rede/equipamentos PDV (sim/não), realiza implantação e configuração inicial (sim/não), realiza treinamento pós-implantação (sim/não), quantas pessoas treinam.

**Passo 5 — Suporte ao cliente:**
presta suporte pós-venda (sim/não), tipos de suporte (multi-select: presencial, telefone, WhatsApp, acesso remoto, treinamento, suporte técnico básico, outros — com texto para "outros"), responsável pelo suporte, quantas pessoas dão suporte, horário de atendimento, experiência anterior com suporte de software (sim/não).

**Passo 6 — Região de atuação:**
estado(s) em que atua, região principal, **lista dinâmica de cidades** ("+ Adicionar cidade" — cada linha: nome da cidade + toggle Presencial/Remoto, sem limite fixo de 10), atende presencialmente em todas as cidades listadas (sim/não), veículo próprio para visitas (sim/não), distância máxima para atendimento presencial.

**Passo 7 — Experiência no mercado:**
tempo de atuação comercial, já trabalhou com software de gestão (sim/não), experiência com ERP/PDV (sim/não), segmentos com experiência (multi-select: farmácias, drogarias, padarias, mercados, conveniências, outros — texto para "outros"), já possui carteira de clientes nesses segmentos (sim/não), quantidade aproximada de clientes/contatos.

**Passo 8 — Marcas e empresas que representa atualmente:**
representa outras marcas atualmente (sim/não), **lista dinâmica de marcas** ("+ Adicionar marca" — cada linha: marca, produto/serviço, segmento, sem limite fixo de 4), tempo de representação de cada marca, exclusividade (exclusiva/não exclusiva), alguma marca atua com software/ERP/PDV/automação comercial/sistemas para farmácias/sistemas para padarias/tecnologia para varejo (multi-select + "nenhuma das anteriores"), representa concorrente direto ou indireto da Prosystem (sim/não + campo condicional "qual empresa"), existe contrato de exclusividade/restrição territorial/impedimento (sim/não + campo condicional "descreva").

**Passo 9 — Capacidade de atendimento e expansão:**
novos clientes que acredita prospectar por mês, novos clientes que acredita fechar por mês, quantos clientes a estrutura consegue implantar por mês, consegue acompanhar da prospecção ao pós-venda (sim/não), etapas em que a equipe atua diretamente (multi-select: prospecção, demonstração, negociação, fechamento, instalação, implantação, treinamento, suporte, pós-venda).

**Passo 10 — Apresentação da operação:**
texto livre longo (textarea) descrevendo estrutura atual, equipe, região, marcas representadas e plano de desenvolvimento comercial da Prosystem na região. Ao final deste passo, o candidato também escolhe o **perfil desejado** (Indicador / Representante / Franqueado — campo-chave do sistema, não faz parte do questionário original mas é necessário para a triagem).

## Peça 2 — Módulo interno "Representantes"

Rota autenticada `frontend/app/representantes/page.tsx`, item novo no menu lateral (`DashboardLayout.tsx`), papéis com acesso: os mesmos grupos que já veem Leads/Pipeline Comercial (`COMERCIAL`/gestão comercial — mesma constante `COMERCIAL` usada em `/leads`).

**Kanban com 4 colunas fixas** (não usa o model genérico `KanbanColuna`/`QuadroComercial` do Pipeline Comercial — este módulo não precisa de colunas customizáveis pelo usuário; um enum fixo é suficientemente simples e evita a complexidade de quadros dinâmicos que essa feature não pede):

```
NOVO → EM_ANALISE → APROVADO
                   → REPROVADO
```

- Card mostra: nome, nome da empresa, perfil desejado, cidade/estado sede, data de envio.
- Arrastar card entre colunas atualiza `status` via `PATCH /api/candidatos-representante/:id`.
- Clique no card abre painel de detalhe com **todas as 10 seções do questionário**, organizadas em abas ou acordeões (mesma ordem dos passos do wizard), + campo de **observações internas** (texto livre, não visível ao candidato).
- Contador de candidaturas com `status = NOVO` visível na própria coluna "Novo" do kanban (contagem no cabeçalho da coluna, já é o padrão existente no `/leads` — não é adicionado badge novo ao item de menu lateral, escopo deliberadamente enxuto).

## Modelo de dados

Novo model Prisma, novo arquivo de rota `backend/src/routes/candidatos-representante.ts`, registrado em `server.ts` na lista `routeModules`.

Campos-chave (usados para listar, filtrar e exibir no card do kanban) ficam em colunas próprias. O restante das ~60 respostas do questionário (Passos 2–10) fica agrupado em um único campo `Json` — evita uma migration a cada ajuste de pergunta e mantém o kanban simples, ao custo de não poder filtrar/buscar por uma resposta específica no banco (aceitável: a triagem é por card, não por busca estruturada nas respostas).

```prisma
model CandidatoRepresentante {
  id        String   @id @default(cuid())

  // Passo 1 — campos-chave (colunas próprias)
  nome             String
  empresa          String?
  nome_fantasia    String?
  cnpj             String?
  cpf_responsavel  String?
  telefone         String
  email            String
  cidade           String?
  estado           String?

  perfil_desejado  String   // INDICADOR | REPRESENTANTE | FRANQUEADO — escolhido no Passo 10

  // Passos 2–10 — respostas completas do questionário, uma chave por seção
  respostas_detalhadas Json

  status    String   @default("NOVO") // NOVO | EM_ANALISE | APROVADO | REPROVADO
  observacoes_internas String? @db.Text

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([status])
  @@index([created_at])
}
```

Formato de `respostas_detalhadas` (chaves fixas por seção, cada valor é o conjunto de campos daquele passo do wizard):

```json
{
  "estrutura_empresa": { "possui_equipe": true, "qtd_pessoas": 5, "funcoes": { "comercial": "...", "vendas": "...", "implantacao": "...", "instalacao": "...", "suporte": "...", "treinamento": "...", "administrativo": "...", "outros": "..." }, "qtd_dedicada_prosystem": 2, "equipe_propria_ou_terceirizada": "propria" },
  "estrutura_comercial": { "responsavel_vendas": "...", "qtd_prospeccao_venda": 2, "visita_presencial": true, "prospeccao_ativa": true, "canais": ["WHATSAPP", "INDICACOES"], "canal_outros": "" },
  "instalacao_implantacao": { "realiza_instalacao": true, "quem_instala": "...", "qtd_instaladores": 1, "experiencia_erp_pdv": true, "experiencia_config_equipamentos": true, "realiza_implantacao": true, "realiza_treinamento": true, "qtd_treinadores": 1 },
  "suporte": { "presta_suporte": true, "tipos": ["WHATSAPP", "REMOTO"], "tipo_outros": "", "responsavel": "...", "qtd_pessoas": 1, "horario": "...", "experiencia_anterior": true },
  "regiao_atuacao": { "estados": ["ES"], "regiao_principal": "...", "cidades": [{ "nome": "Vitória/ES", "tipo": "PRESENCIAL" }], "atende_todas_presencial": false, "veiculo_proprio": true, "distancia_maxima": "..." },
  "experiencia_mercado": { "tempo_atuacao": "...", "trabalhou_software_gestao": true, "experiencia_erp_pdv": true, "segmentos": ["FARMACIAS", "DROGARIAS"], "segmento_outros": "", "possui_carteira": true, "qtd_clientes_aprox": "..." },
  "marcas_atuais": { "representa_outras": true, "marcas": [{ "marca": "...", "produto_servico": "...", "segmento": "..." }], "tempo_representacao": "...", "exclusividade": "nao_exclusiva", "atua_com": ["ERP"], "representa_concorrente": false, "concorrente_qual": "", "tem_impedimento": false, "impedimento_descricao": "" },
  "capacidade_expansao": { "prospectar_mes": "...", "fechar_mes": "...", "implantar_mes": "...", "acompanha_prospeccao_pos_venda": true, "etapas_atua": ["PROSPECCAO", "FECHAMENTO", "SUPORTE"] },
  "apresentacao_operacao": "texto livre descrevendo a operação..."
}
```

**Endpoints:**

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/candidatos-representante` | pública | Cria candidatura a partir do formulário público (payload completo dos 10 passos); dispara e-mail de notificação |
| GET | `/api/candidatos-representante` | `requireAuth` | Lista candidaturas (filtro opcional por `status`) — retorna apenas os campos-chave, sem `respostas_detalhadas` (payload leve para o kanban) |
| GET | `/api/candidatos-representante/:id` | `requireAuth` | Detalhe completo de uma candidatura (inclui `respostas_detalhadas`) |
| PATCH | `/api/candidatos-representante/:id` | `requireAuth` | Atualiza `status` e/ou `observacoes_internas` |

## Notificação por e-mail

Reaproveita `backend/src/services/email.service.ts` (já usado para e-mails ao cliente, mesmo transporter SMTP configurado). Novo template: nome, empresa, perfil desejado, telefone, e-mail, cidade/UF sede e um resumo curto (estados de atuação + resumo da seção "Apresentação da operação", truncado), com um link direto para `/representantes` no CRM — o corpo do e-mail não replica as ~60 respostas (isso fica só na tela de detalhe do CRM).

- Destinatário fixo: `jessica@prosystemnet.com.br`.
- Disparado de forma síncrona no handler do POST público, mas sem bloquear a resposta ao candidato em caso de falha de e-mail — se o envio falhar, a candidatura já foi gravada no banco (é a fonte de verdade) e aparece no módulo mesmo assim; o erro só é logado.

## Erros e validação

- Wizard público valida client-side por passo (não deixa avançar sem os campos obrigatórios do passo atual: Passo 1 exige nome/telefone/e-mail; os demais passos têm poucos campos obrigatórios — a maioria é informativa) e novamente no backend via zod no momento do envio final — nunca confia só no client.
- Os campos "sim/não com detalhe condicional" (ex.: representa concorrente → qual empresa) são validados apenas client-side quanto à exibição condicional; no backend, o zod aceita o objeto completo de `respostas_detalhadas` sem validação campo-a-campo interna (é `Json` livre) — a única validação de schema no backend é sobre os campos-chave (Passo 1) e `perfil_desejado`.

## Riscos / pontos em aberto

- **Sem salvamento parcial**: se o candidato fechar a aba no meio do wizard, perde o progresso — não há persistência de rascunho em v1. Aceitável para o volume esperado; se virar problema real, é extensão isolada (ex.: salvar em `localStorage` a cada passo).
- **`respostas_detalhadas` como Json livre**: futuras mudanças de pergunta (adicionar/remover campo de uma seção) não exigem migration, mas também não há garantia de schema no banco — o formulário e a tela de detalhe do CRM precisam ser mantidos em sincronia manualmente quanto ao formato esperado desse Json.
- **Destinatário único de e-mail**: hoje só `jessica@prosystemnet.com.br` recebe. Se precisar de múltiplos destinatários ou vincular a um usuário do CRM, é extensão simples do template.
