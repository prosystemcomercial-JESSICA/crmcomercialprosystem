# Plano de implementação: CRM Comercial Prosystem

Versão 1.0 · 27/09/2026 · o que já está no ar e o que vem a seguir

## 1. Entregue (no ar)

| Entrega | Data |
|---|---|
| WhatsApp da empresa (instância única, pool, assumir, transferir) | 23/09 |
| Triagem automática (Bia), CNPJ na Receita, alarme de lead qualificado | 23–24/09 |
| Painel da TV, contas e visões, comissões, atividades com SLA | 24/09 |
| Resumo executivo (diário e semanal) para a diretoria | 24/09 |
| Assistente fases 1–4: comandos, avisos, proposta pelo WhatsApp, demo marcada pelo lead, IA de texto, pós-venda, campanhas, aprovação de desconto | 24–25/09 |
| Escritório virtual com agentes, agenda, zoom, conversa com agentes | 25/09 |
| Sofia (pesquisas com fonte) e Caderno da Sofia | 25/09 |
| IA com ChatGPT (`gpt-6-luna`), transcrição pela OpenAI, rota para o Grok | 25/09 |
| Caderno da Laya (aprendizado imediato, níveis, cópia diária), Laya age sozinha a partir de Assistente | 25/09 |
| Caroline (SDR), aprovação/ajuste/refazer, termômetro, botões, "Me chama depois" | 25/09 |
| Julio e Luiz Felipe (retomada de propostas) com limite anti-bloqueio único | 25/09 |
| Nenhum lead esquecido (parou de responder, ciclos de 30 dias), horário da vendedora | 25–26/09 |
| Assumir com resumo no WhatsApp, finalizar, observações, farol, criar proposta, opções Pro/Plus | 25/09 |
| Triagem em 3 toques, passagem para a Caroline, cutucão da triagem | 25–26/09 |
| Trava contra mensagens repetidas | 25/09 |
| Contratos automáticos na ZapSign (dados pelo WhatsApp, conferência, link, lembretes, webhook conferido) | 28/09 |

## 2. Próximas fases

### Fase A: primeira semana dos agentes (28/09 a 02/10)
| Item | Responsável | Critério de pronto |
|---|---|---|
| Acompanhar o 1º dia do Julio e do Luiz Felipe (9h de 28/09) | Claude | Sem erro no log, limite respeitado, mensagens aprovadas |
| Ajustar o tom com base nos seus ajustes e refazer | Claude + Jessica | Menos de 30% das mensagens precisando de ajuste |

### Fase B: fechar pendências de configuração
| Item | Depende de |
|---|---|
| Chave PIX no aceite (texto e botão PIX nativo) | Chave PIX |
| Grok nas tarefas simples | Chave da xAI |
| E-mails para clientes (domínio no Resend) | Acesso ao DNS |
| Ligar a Helena (pós-venda) | Decisão |

### Fase C: Laya de verdade (até 14/10)
1. 15 confirmações por dia (lembrete 17h).
2. 14/10: treino geral com o Caderno (≈250 exemplos).
3. Medir níveis; tarefas em Assistente/Titular passam a agir sozinhas; avaliar a Laya na triagem.

### Fase D: leads direto das campanhas
1. Acesso ao Gerenciador de Negócios da Meta.
2. Webhook do Facebook Lead Ads → cria o lead e coloca na fila da Caroline, sem colar.
3. Material por campanha (texto do anúncio + página de destino) no contexto da Caroline.

### Fase E: melhorias de UX
- Contador de "para aprovar" no menu, filtro "Com agente" no WhatsApp, linha do tempo única do lead.

### Fase F: qualidade técnica
- Banco de testes local para os 8 testes que dependem de banco.
- Zerar os erros de tipo antigos (≈80) para o `tsc` virar barreira de deploy.

## 3. Regras de toda implementação

1. Não bagunçar o que existe: agregar, analisar o fluxo inteiro.
2. Commit e push no `main` a cada entrega; deploy com backup.
3. **Atualizar os seis documentos de `docs/produto/` nos mínimos detalhes** (PRD, TRD, App flow, Briefing de UI/UX, Esquema do backend e este plano), além do manual e da página de Novidades.
4. Nunca apagar leads antigos; nunca criar atividades automáticas (exceto demo do lead).
5. Proteger o número do WhatsApp acima de qualquer velocidade.
