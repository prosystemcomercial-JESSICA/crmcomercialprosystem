# Step 02 — Patrícia Moura (UX Designer)
# Sprint 1: Módulo de Leads — Wireframes e Fluxos

## Telas projetadas

1. Lista de Leads — tabela + filtros laterais colapsáveis + busca
2. Formulário Novo Lead — 3 seções: empresa, responsável, comercial
3. Detalhe do Lead — 2 colunas: dados + ações | timeline abaixo
4. Modal: Registrar Atividade — tipo + resultado + próxima ação
5. Modal: Marcar como Perdido — motivo + observação + recontato

## Fluxo de Navegação

```
Lista de Leads
  ├── [+ Novo Lead] → Formulário → Salvar → Detalhe do Lead
  ├── [Clicar na linha] → Detalhe do Lead
  │     ├── [Editar] → Formulário (modo edição)
  │     ├── [+ Nova atividade] → Modal Atividade → Fechar
  │     └── [Marcar como Perdido] → Modal Perda → Lista (sem lead)
  └── [Filtros] → Painel lateral → Aplicar → Lista filtrada
```

## Componentes do Design System

- DataTable — ordenação, paginação, ações em linha
- FilterPanel — painel colapsável lateral direito
- StatusBadge — cor por status (verde=qualificado, azul=novo, vermelho=perdido)
- TempBadge — 🔥 quente | 🌡 morno | ❄ frio
- ActivityTimeline — histórico cronológico reverso
- ActionModal — base reutilizável para todos os modais
- LeadForm — formulário com validação inline e campos obrigatórios marcados

## Estados por tela

### Lista de Leads
- Vazio: ilustração + CTA "Cadastrar primeiro lead"
- Carregando: skeleton rows
- Com dados: tabela paginada
- Erro: toast de erro + botão "Tentar novamente"

### Detalhe do Lead
- Carregando: skeleton layout 2 colunas
- Com dados: layout completo
- Salvando edição: spinner no botão + campos disabled

## Notas de design
- Cores primárias: Azul ProSystem + branco
- Badge vermelho para leads parados (3+ dias sem atividade)
- Temperatura visível na listagem sem precisar abrir o detalhe
- Próximo contato em destaque no detalhe — cor laranja se vencido
