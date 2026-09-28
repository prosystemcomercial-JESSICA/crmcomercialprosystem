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
| Mensagem de encerramento depois da 3ª tentativa | 28/09 |
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


### Atualização 28/09/2026: resposta em até 1 minuto e dúvidas
- Quando o lead ou cliente escreve, a resposta do agente (Caroline, Julio, Luiz Felipe) sai **na hora, sem aprovação, em qualquer horário**: o agente espera 20 s para juntar mensagens seguidas e responde em cerca de 30 a 50 s (máximo ~1 min).
- A aprovação ("Aprovar antes de enviar") vale só para o que o agente puxa sozinho: primeiro contato e retomadas. Retomadas de quem já conversou, fora do horário comercial ou no sábado, também saem direto.
- Dúvida do cliente: (1) o agente procura no material e responde; (2) se não entendeu a pergunta, pergunta mais ao cliente; (3) só se o material não cobrir, avisa que confirma com a equipe (acao `duvida_fora_material`).
- Técnico: `caroline.service.ts` (`semAprovacao` inclui toda `fase === "resposta"`, `ESPERA_MS = 20_000`); `lib/assistente/sdr.ts` (regra NÃO INVENTE NADA reescrita). Sem mudança de schema. Regra também gravada como instrução da equipe no Escritório virtual.

### Atualização 28/09/2026: desistência vira "perdido" com motivo + lista News + Instagram
- Quando o cliente diz que não quer, ou que já fechou com outro sistema, o agente se despede com a porta aberta (sem fazer pergunta nessa despedida) e a IA devolve `motivo_perda` (PRECO | JA_TEM_FORNECEDOR | SEM_ORCAMENTO | TIMING | SEM_INTERESSE | FUNCIONALIDADE_AUSENTE | OUTRO, as mesmas chaves do funil e do relatório comercial).
- Quando há proposta (Luiz Felipe) ou o motivo é JA_TEM_FORNECEDOR, `marcarPerdidoNews` (caroline.service.ts) faz o seguinte:
  - Lead: `status/etapa_funil/etapa_comercial = PERDIDO`, `motivo_perda` recebe "CHAVE: o que o cliente disse", e uma linha é gravada em `LeadPerda`. Se a proposta não tiver lead vinculado, o sistema acha o lead pelo celular (últimos 8 dígitos) ou cria um com origem PROPOSTA.
  - Proposta: `status = PERDIDA` e uma linha em `PropostaHistorico` (tipo STATUS, com o motivo).
  - Etiqueta do sistema **News** (roxa, `sistema=true`) aplicada ao lead.
  - Mensagem automática com o Instagram: https://instagram.com/prosystemoficial.
- Campanhas (Zequinha): novo público **NEWS**, que reúne os leads com a etiqueta News e vem com um modelo de informativo que já traz o Instagram. O "SAIR" continua valendo.
- Sem mudança de schema (usa Etiqueta, LeadEtiquetaAplicada, LeadPerda e PropostaHistorico, que já existiam).

### Atualização 28/09/2026: vídeos e suporte vão para o setor de suporte
- Se o cliente pede vídeos (tutoriais, treinamento, "como usar"), ajuda técnica ou suporte, o agente (Caroline, Julio ou Luiz Felipe) usa a nova ação `encaminhar_suporte`, com `mensagens: []`, e não promete enviar vídeos.
- Em seguida o sistema envia o texto padrão `mensagemSuporte(agente)` (lib/assistente/sdr.ts): "O envio de vídeos, treinamentos e o suporte técnico são feitos pelo nosso setor de suporte. Eu sou o Luiz Felipe, do setor comercial…". A mensagem vai com o botão de link "💬 Falar com o suporte" (`LINK_CONTATO_GERAL`, o mesmo usado na triagem) e fica registrada na conversa.
- A função `encaminharSuporte` fica em caroline.service.ts. O lead continua em CONVERSANDO. Não há mudança de schema.

### Atualização 28/09/2026: conversa mais simples, direta e com os desafios da farmácia
- **Menos perguntas:** no máximo 2 perguntas de investigação na conversa inteira, e nunca repetir uma pergunta já respondida. Assim que o cliente diz qual é o problema, mesmo numa palavra ("demora"), o agente mostra em 1 ou 2 frases como o MATERIAL resolve e já oferece a demonstração (`oferecer_demo`, sem esperar a nota 60).
- **Resposta curta** ("nada", "isso") é tratada como sinal de pouca paciência: nada de mais perguntas abertas, o agente vai direto para a solução e a demonstração.
- **Pergunta direta:** "Qual é o maior problema que você quer resolver hoje na farmácia?", com o convite para explicar por áudio (os áudios são transcritos).
- **Dia a dia da farmácia (conhecimento geral)**, usado de forma natural, um exemplo por vez:
  - fila e demora no caixa;
  - estoque furado e remédio vencendo;
  - controlados e receitas (SNGPC);
  - convênios, PBM e Farmácia Popular;
  - fiado e crediário;
  - margem e preço;
  - cliente de uso contínuo que não volta;
  - fechamento de caixa;
  - nota fiscal e impostos.
- A solução para cada um desses problemas só vem do MATERIAL.
- Onde está no código: `promptCaroline` em lib/assistente/sdr.ts. Não há mudança de schema.
