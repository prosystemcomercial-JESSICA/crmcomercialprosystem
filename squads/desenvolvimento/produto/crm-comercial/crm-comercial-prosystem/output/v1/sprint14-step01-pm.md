# Sprint 14 — Step 01 — André Vieira (PM)
# Previsão de Fechamento (Forecast)

## Contexto

O CRM possui o funil com etapas bem definidas e o potencialMensalidade em cada lead. O módulo de Previsão de Fechamento usa probabilidades configuráveis por etapa para calcular o MRR previsto de fechar no mês atual e nos próximos, gerando um forecast confiável para o CEO e a Supervisão tomarem decisões.

## User Stories

**US-1401:** Como CEO/Supervisora, quero ver o forecast de MRR para o mês atual e os próximos 2 meses, mostrando: MRR já fechado, MRR provável (leads em andamento ponderados por probabilidade), e MRR otimista (soma sem ponderação).

**US-1402:** Como CEO/Supervisora, quero configurar a probabilidade de fechamento por etapa do funil (ex.: Qualificação = 20%, Proposta Enviada = 60%, Negociação = 80%), para que o cálculo reflita a realidade comercial da ProSystem.

**US-1403:** Como CEO/Supervisora, quero ver o forecast quebrado por vendedor, para identificar quem tem mais potencial no pipeline.

**US-1404:** Como CEO/Supervisora, quero um gráfico de barras empilhadas mostrando: MRR fechado + MRR ponderado + gap até a meta para cada um dos 3 meses.

**US-1405:** Como CEO/Supervisora, quero ver a lista de leads que compõem o forecast (os que estão no funil com etapa ≥ Qualificação), com: lead, etapa, vendedor, potencial, probabilidade aplicada e valor ponderado.

**US-1406:** Como CEO/Supervisora, quero exportar o forecast em PDF ou CSV.

## Critérios de aceite

- **US-1401:** Três cards horizontais (Mês atual / Próximo mês / Mês +2) com: MRR Fechado, MRR Provável, MRR Otimista.
- **US-1402:** Tela de configuração de probabilidades por etapa. Padrão sugerido:
  - Qualificação: 15%
  - Apresentação Agendada: 30%
  - Proposta Enviada: 55%
  - Negociação: 75%
  - (Primeiro Contato e etapas iniciais: 5%)
- **US-1403:** Seção abaixo dos cards com ranking de forecast por vendedor (mesmo período do card selecionado).
- **US-1404:** Gráfico Recharts BarChart empilhado: azul escuro = fechado, azul médio = provável, cinza = gap até meta mensal.
- **US-1405:** Tabela paginada dos leads no pipeline com as colunas descritas. Clique no lead abre drawer lateral com detalhes.
- **US-1406:** Export idêntico ao padrão já estabelecido (@react-pdf/renderer + CSV com BOM).

## Regras de negócio

- Lead contribui para o forecast do mês se: `dataProximoContato` está no mês alvo OU etapa ≥ qualificação sem data definida (contribui para o mês atual por padrão)
- Leads com status = 'fechado' contam como MRR Fechado real (não ponderado)
- Leads com status = 'perdido' são excluídos
- MRR Provável = SUM(potencialMensalidade × probabilidadeEtapa)
- MRR Otimista = SUM(potencialMensalidade) sem ponderação
- Probabilidades configuradas por Admin/Supervisão; se não configuradas, usar padrão acima

## Navegação

- /forecast — tela principal (Supervisão/CEO/Admin)
- /forecast/configuracoes — configuração de probabilidades (Admin/Supervisão)

## Acesso

| Perfil | Acesso |
|--------|--------|
| VENDEDOR | Sem acesso (não vê forecast do time) |
| SUPERVISAO | Leitura + configurar probabilidades |
| CEO | Leitura |
| ADMIN | Leitura + configurar probabilidades |
