# 13/11/2026: a Laya mede sozinha a temperatura dos leads

## Pedido
A Jessica: "Preciso que a Laya comece a medir sozinha as temperaturas, ela já aprendeu o suficiente, faça isso com todos que estão pendentes; se necessário pesquise a forma correta de fazer isso com os leads e treine a Laya." (print da coluna "Confirmar temperatura (ensina a Laya)" com vários "Está certo?").

## O que foi encontrado (produção, só leitura)
- 409 leads dos SDRs com nota e sem temperatura confirmada (Caroline 385, Julio 24); 188 sem nenhuma mensagem do cliente.
- 154 confirmações humanas de temperatura: concordaram com a nota do agente em 152 (99%).
- O palpite cru do modelo da Laya (`/v1/systemone`, pergunta "temperatura") acertou 7 de 138 comparações com os agentes e 10 de 80 casos confirmados pela Jessica; reescrever a pergunta piorou (4/80 e 2/80). Ele chama de Quente/Muito quente quem é Frio (confiança ~0,08).
- Esse palpite cru era aplicado no Lead (`aplicarTemperatura`, confiança ≥ 0,6): esquentou 15 leads para Quente/Muito quente em 30 dias.

## Pesquisa (método)
Boas práticas de pontuação de leads: separar perfil, intenção e engajamento; sinais de intenção fortes (pedido de preço/demonstração) pesam mais que interação leve; pontuação negativa para sinais de desqualificação; decaimento por inatividade; validar contra resultados reais. Fontes: breadcrumbs.io (12 regras de lead scoring), pedowitzgroup.com (evitar superpontuar intenção baixa), Agendor (lead frio), payproglobal (BANT), socialhub.pro (qualificação BANT no WhatsApp).

## O que mudou
- `backend/src/lib/laya-temperatura.ts`: termômetro puro (`vereditoTemperatura`, `ehRoboDaLoja`).
- `backend/src/services/laya-temperatura.service.ts`: `rodarTermometroLaya` grava `temperatura_confirmada` + `dados.temperatura_laya`, leva ao Lead (respeitando troca humana), reavalia quando o lead muda; não cria exemplo de treino.
- `backend/src/server.ts`: roda no scheduler de 10 min.
- `backend/src/services/laya.service.ts`: palpite cru só aplicado se a tarefa temperatura sair de Aprendiz.
- `frontend/components/escritorio/PainelCaroline.tsx`: coluna "Temperatura (a Laya mede; corrija se errar)" e "🤖 Laya mediu: motivo".
- Testes `backend/tests/laya-temperatura.test.ts` (9). Sem mudança de banco.

## Treino / validação
Validação contra as 154 confirmações da Jessica (conversa até o momento da confirmação, memória sem o próprio caso): 1ª versão 92%; ajustes ensinados pelos erros (demo marcada pelo agente = Morno; robô de boas-vindas/menu da loja não conta; "semana que vem/me liga" não é pedido) → **147/154 (95%)**. Erros restantes: áudios sem texto e casos de julgamento.
Simulação nos 409 pendentes: cerca de 389 Frio, 12 Morno, 6 Quente.

## Pendências
- Áudios sem transcrição contam só como resposta.
- 16 leads "Muito quente" no CRM; os esquentados pelo palpite cru fora dos SDRs não são reavaliados pelo termômetro (só os ligados a SdrLead).
