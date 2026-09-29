# Pesquisa de Satisfação e Painel de NPS

CRM Comercial Prosystem · atualizado em 29/09/2026

Este documento explica como funciona hoje a pesquisa de satisfação que o cliente responde, como a nota é calculada, o que o CRM faz sozinho com cada resposta e como ler o Painel de NPS.

---

## 1. Visão geral

| Peça | Onde fica | Para quem |
|---|---|---|
| **Pesquisa de satisfação** (formulário) | `/pesquisa` (página pública, sem login) | Cliente da base, depois de um atendimento técnico |
| **Respostas da pesquisa** (lista e resumo) | `/pesquisas` | Gestão |
| **Painel de NPS** | `/nps` | Gestão |
| **Pesquisa rápida de chamado/implantação (CSAT)** | Link único por e-mail/WhatsApp (`/csat/public/:token`) | Cliente, após fechar um chamado ou uma implantação |

Existem duas fontes de nota que alimentam o NPS:

1. **Pesquisa de satisfação** (`PesquisaSatisfacao`): o formulário completo, descrito abaixo.
2. **Pesquisa de churn** (`SurveyResposta`): enviada a clientes em risco, com uma nota de 0 a 10 e estrelas.

---

## 2. O formulário que o cliente responde

São 4 etapas curtas, pensadas para o celular:

### Etapa 1: "Como foi sua experiência com a gente? 💙"

- **Razão social da empresa** (obrigatório)
- **Seu nome** (opcional)
- **WhatsApp / celular**
- **Qual é a sua função na empresa?** Opções: dono, gerente, balconista, financeiro ou outro.

### Etapa 2: "⚡ Sobre o atendimento"

- **Qual nota você dá para esse atendimento?** (1 a 5 estrelas)
- **O atendimento resolveu sua solicitação?** Opções: totalmente, parcialmente, não resolveu ou não sei. *É a pergunta de maior peso.*
- **Como você avalia a rapidez do atendimento?** Opções: muito rápido, dentro do esperado, demorou um pouco ou demorou muito.
- **Qual nota você dá para o conhecimento do técnico?** (1 a 5 estrelas)

### Etapa 3: "🏢 Sua experiência com a ProSystem"

- **De modo geral, qual nota você daria para a ProSystem?** (1 a 5 estrelas). *É esta nota que vira o NPS.*
- **Quais dessas ferramentas você já conhece ou utiliza?** Para cada uma, o cliente escolhe *Conheço e uso*, *Conheço, não uso* ou *Não conheço*:
  - Plano Plus
  - Dashboard
  - Mensageria de WhatsApp
  - Gerencial (monitoramento de notas fiscais)
- **Você gostaria que nosso time apresentasse alguma dessas soluções?** Opções: sim, talvez ou não.

### Etapa 4: "💬 Última etapa"

- **Conte para nós o que aconteceu** (opcional): elogio, sugestão, reclamação ou pedido.

---

## 3. A nota de 0 a 100 (score da pesquisa)

Cada resposta recebe uma nota de 0 a 100, calculada no servidor:

| Item | Pontos máximos | Como pontua |
|---|---:|---|
| Nota do atendimento (1–5★) | 25 | proporcional às estrelas |
| O atendimento resolveu? | 20 | totalmente 20 · parcialmente 12 · não sei 8 · não resolveu 3 |
| Rapidez | 15 | muito rápido 15 · esperado 12 · demorou um pouco 7 · demorou muito 2 |
| Conhecimento do técnico (1–5★) | 15 | proporcional às estrelas |
| Nota geral da ProSystem (1–5★) | 15 | proporcional às estrelas |
| Conhece as ferramentas | 10 | 3 ou mais: 10 · 1 ou 2: 7 · nenhuma: 3 |
| **Total** | **100** | |

**Leitura da nota:**
- **90 ou mais:** excelente.
- **80 a 89:** bom.
- **70 a 79:** em atenção.
- **Abaixo de 70:** crítico.

---

## 4. O que o CRM faz sozinho com cada resposta

1. **Salva na hora**, antes de qualquer outra coisa.
2. **Liga ao cliente da base** pelo nome digitado, quando a semelhança é de 90% ou mais e existe **um único** cliente parecido. Se houver dúvida, a resposta fica em **"não casadas"** para a gestão ligar manualmente.
3. **Marca alertas especiais**, mesmo quando a nota é alta, se houver:
   - problema não resolvido;
   - demora grande;
   - nota baixa (1–2★) ou regular (3★);
   - cliente que não conhece nenhuma ferramenta;
   - palavras críticas no comentário.
4. **Marca como crítica** quando:
   - a nota é baixa;
   - o cliente desconhece alguma ferramenta;
   - o problema não foi resolvido;
   - ou o score ficou abaixo de 70.
5. **Atualiza a ficha do cliente:** registra as ferramentas que ele conhece (radar de upsell) e liga "risco de atenção" quando a resposta é crítica.
6. **Abre um caso de churn automaticamente** quando a resposta é crítica, para a gestão agir.
7. **Interesse comercial:** a resposta "sim / talvez / não" à apresentação de soluções fica **registrada na pesquisa**. Hoje ela ainda **não cria** oportunidade nem tarefa automaticamente (veja a sugestão 5 no item 7).

---

## 5. O Painel de NPS (`/nps`)

### Como o NPS é calculado

O NPS usa a **nota geral da ProSystem**. Na pesquisa de satisfação ela vai de 1 a 5 estrelas e é convertida para a escala de 0 a 10 (estrelas × 2). Na pesquisa de churn, a nota já vem de 0 a 10.

| Grupo | Nota (0–10) | Equivale a |
|---|---|---|
| **Promotores** | 9 e 10 | 5★ |
| **Neutros** | 7 e 8 | 4★ |
| **Detratores** | 0 a 6 | 1★ a 3★ |

**NPS = % de promotores − % de detratores**, de −100 a +100.

- **50 ou mais:** excelente (verde).
- **0 a 49:** bom (amarelo).
- **Abaixo de 0:** crítico (vermelho).

### O que o painel mostra

- **Medidor do NPS** com a cor da faixa.
- **Total de respostas**, promotores, neutros e detratores.
- **Média de estrelas.**
- **Distribuição das notas** de 1 a 10.
- **Respostas recentes** (as 10 últimas): cliente, nota, estrelas, se conhece o plano e o comentário.
- **Exportar** as respostas para planilha.

O Dashboard Executivo também mostra um **NPS rápido**, com a mesma conta.

---

## 6. Pesquisa rápida de chamado/implantação (CSAT)

- É criada ao fechar um **chamado técnico** ou uma **implantação**.
- O cliente recebe um **link único**, válido por 7 dias, e dá uma nota de **1 a 5** com comentário opcional.
- As métricas de CSAT (média e respostas) aparecem no **Portal Técnico**.

---

## 7. Pontos de atenção e sugestões

1. **Escala do NPS:** hoje a nota geral é dada em **estrelas (1–5)** e convertida para 0–10. Com isso, **4 estrelas vira "neutro"** e **3 estrelas vira "detrator"**. Isso deixa o NPS mais severo do que o NPS clássico, em que o cliente escolhe de 0 a 10. **Sugestão:** trocar a pergunta final por **"De 0 a 10, quanto você recomendaria a ProSystem a um amigo ou colega?"**, que é o padrão do mercado e permite comparar com outras empresas.
2. **Envio da pesquisa:** o link da pesquisa pode ser enviado automaticamente pelo WhatsApp depois de cada atendimento técnico, pela futura CS **Mila**, com lembrete se o cliente não responder.
3. **Detratores:** todo detrator deveria gerar uma tarefa de contato em até 24 horas (hoje só as respostas críticas abrem caso de churn).
4. **Meta sugerida:** NPS acima de **50** e taxa de resposta acima de **30%** dos atendimentos.
5. **Interesse comercial:** quem responde "sim" ou "talvez" à apresentação de soluções poderia virar automaticamente uma oportunidade de venda adicional para a vendedora.

---

## 8. Resumo em uma frase

O cliente responde em 4 etapas pelo celular, o CRM calcula uma nota de 0 a 100, avisa a gestão quando algo está errado e abre caso de churn nos críticos. A nota geral vira o NPS, que o painel mostra com promotores, neutros, detratores e os comentários mais recentes.
