# Sprint 32 — Step 02 — Patrícia Moura (UX)
# Portal do Cliente — Wireframes

## Estrutura de Rotas do Portal

```
/portal/login                 ← Tela de login do cliente
/portal/alterar-senha         ← Primeiro acesso obrigatório
/portal                       ← Dashboard do cliente
/portal/propostas             ← Lista de propostas
/portal/propostas/:id         ← Detalhe + aprovação
/portal/contratos             ← Lista de contratos
/portal/contratos/:id         ← Detalhe do contrato
/portal/servicos              ← Serviços contratados
/portal/historico             ← Timeline de comunicações
```

## Layout Base do Portal

```
┌──────────────────────────────────────────────────────┐
│  [LOGO ProSystem]           Bem-vindo, João Silva ▾  │  ← header limpo
│                                        [Sair]        │
├──────────┬───────────────────────────────────────────┤
│ Sidebar  │  CONTEÚDO PRINCIPAL                       │
│          │                                           │
│ 🏠 Início│                                           │
│ 📄 Prop. │                                           │
│ 📋 Contr.│                                           │
│ 🔧 Serv. │                                           │
│ 📅 Histór│                                           │
└──────────┴───────────────────────────────────────────┘
```

## Tela: Login do Portal

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              [LOGO ProSystem]                        │
│                                                      │
│         Área do Cliente — ProSystem                  │
│                                                      │
│     ┌──────────────────────────────────────┐        │
│     │  E-mail                              │        │
│     └──────────────────────────────────────┘        │
│     ┌──────────────────────────────────────┐        │
│     │  Senha                           👁  │        │
│     └──────────────────────────────────────┘        │
│                                                      │
│     ┌──────────────────────────────────────┐        │
│     │           ENTRAR                     │        │
│     └──────────────────────────────────────┘        │
│                                                      │
│     Precisa de ajuda? Fale com seu vendedor.         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Tela: Dashboard do Cliente

```
┌──────────────────────────────────────────────────────┐
│  Olá, João! 👋                                       │
│  Empresa: TechCorp Ltda                              │
├──────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │   ⏳  1      │ │   ✅  2      │ │   💰         │ │
│  │  Proposta    │ │  Contratos   │ │ Próx. Venc.  │ │
│  │  Pendente    │ │   Ativos     │ │  15/06 R$500 │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
├──────────────────────────────────────────────────────┤
│  📋 Propostas recentes                               │
│  ┌────────────────────────────────────────────────┐ │
│  │ Proposta #2024-047      🟡 Aguardando aprovação │ │
│  │ R$ 4.500,00 · enviada em 18/05/2026             │ │
│  │              [Ver detalhes →]                   │ │
│  └────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│  👤 Seu Vendedor                                     │
│  Carlos Silva · carlos@prosystem.com.br              │
│  📞 (27) 99999-8888                                  │
└──────────────────────────────────────────────────────┘
```

## Tela: Lista de Propostas

```
┌──────────────────────────────────────────────────────┐
│  📄 Propostas                                        │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐ │
│  │ Proposta #2024-047              [🟡 Pendente]   │ │
│  │ Pacote Empresarial ProSystem                    │ │
│  │ R$ 4.500,00 · Enviada em 18/05/2026            │ │
│  │ [📥 Baixar PDF]     [Ver detalhes →]           │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ Proposta #2024-031             [✅ Aprovada]    │ │
│  │ Módulo Básico ProSystem                        │ │
│  │ R$ 2.200,00 · Aprovada em 01/04/2026           │ │
│  │ [📥 Baixar PDF]     [Ver detalhes →]           │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Tela: Detalhe da Proposta + Aprovação

```
┌──────────────────────────────────────────────────────┐
│  ← Propostas                                         │
│  Proposta #2024-047                                  │
│  Status: 🟡 Aguardando sua aprovação                 │
├──────────────────────────────────────────────────────┤
│  📋 Detalhes                                         │
│  Serviço: Pacote Empresarial ProSystem               │
│  Validade: até 25/05/2026                            │
│  Valor total: R$ 4.500,00 / mês                      │
│  Condições: Contrato 12 meses · Mensal               │
│                                                      │
│  Itens:                                              │
│  • Licença CRM Comercial ..... R$ 2.500,00           │
│  • Suporte Prioritário ........ R$   800,00           │
│  • Treinamento (2 sessões) .... R$ 1.200,00           │
├──────────────────────────────────────────────────────┤
│  [📥 Baixar PDF da Proposta]                         │
├──────────────────────────────────────────────────────┤
│  Versões:                                            │
│  v2 enviada em 18/05 (atual) · v1 enviada em 10/05  │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────────┐ │
│  │   ✅ Aprovar       │  │    ❌ Recusar           │ │
│  └────────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Modal: Confirmar Aprovação

```
┌─────────────────────────────────────────────┐
│  ✅ Aprovar Proposta                         │
│                                              │
│  Ao aprovar, você confirma o interesse       │
│  nos termos da Proposta #2024-047.           │
│                                              │
│  Isso não é um contrato assinado —           │
│  seu vendedor entrará em contato para        │
│  formalizar o acordo.                        │
│                                              │
│  [Cancelar]          [Confirmar Aprovação]  │
└─────────────────────────────────────────────┘
```

## Modal: Recusar Proposta

```
┌─────────────────────────────────────────────┐
│  ❌ Recusar Proposta                         │
│                                              │
│  Motivo (opcional):                          │
│  ┌───────────────────────────────────────┐  │
│  │ Descreva o motivo da recusa...        │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  [Cancelar]              [Confirmar Recusa] │
└─────────────────────────────────────────────┘
```

## Tela: Timeline de Histórico

```
┌──────────────────────────────────────────────────────┐
│  📅 Histórico de Comunicações                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ● 18/05/2026                                        │
│  └─ 📄 Proposta #2024-047 enviada                    │
│                                                      │
│  ● 10/05/2026                                        │
│  └─ 💬 Retorno por WhatsApp                         │
│                                                      │
│  ● 05/05/2026                                        │
│  └─ 📋 Contrato #2024-012 assinado                  │
│                                                      │
│  ● 01/04/2026                                        │
│  └─ ✅ Proposta #2024-031 aprovada                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Design do Portal

- **Cor primária:** Azul corporativo (#1a56db) — diferente do verde do CRM interno
- **Logo:** ProSystem + "Área do Cliente" no header
- **Tipografia:** Inter, limpa e formal
- **Layout:** Sidebar colapsável em mobile
- **Sem elementos do CRM interno** — visual neutro para o cliente final
