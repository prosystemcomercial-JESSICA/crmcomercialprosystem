# Caroline — SDR com IA no WhatsApp da empresa

Data: 25/09/2026 · Aprovado pela Jessica na conversa de 25/09.

## Objetivo

Leads de campanhas do Facebook/Instagram Ads (que hoje chegam por outra plataforma) entram no CRM e recebem o primeiro contato da **Caroline**, uma agente SDR do Escritório virtual. Ela conversa de forma natural pelo WhatsApp da empresa, entende o problema do lead, classifica e termina marcando a demonstração ou passando o lead para a vendedora com um resumo.

## Decisões da Jessica

- Nome: **Caroline**. Se apresenta pelo próprio nome, "da equipe da Jessica na Prosystem".
- Número: o WhatsApp principal/comercial da empresa (instância única UAZAPI, **não oficial**). Todas as conversas saem dele.
- Entrada (fase 1): a Jessica cola o texto do lead no formato da plataforma (exemplo abaixo). Fase 2 (fora deste escopo): receber direto do Facebook Lead Ads.
- Desfecho: opção C. Tenta marcar a demonstração; se o lead não quiser agora, passa para "Leads para Distribuir" com resumo.
- Estilo: maestria, fala pouco e escuta muito, uma pergunta por vez, espelha a linguagem do cliente, empática e comercial na medida, exemplos do dia a dia.
- **Não inventa nada:** solução só a partir do material (guia comercial `docs/comercial/base-conhecimento-comercial.md`, lido por `guiaComercial()`, mais material que a Jessica adicionar). Fora do material, responde "vou confirmar com a equipe" e avisa a gestão.
- Ouve áudios (transcrição) e entende fotos.
- Preço, desconto e contrato: nunca. Encaminha à vendedora.
- Se o lead perguntar sinceramente se é robô/pessoa, não nega (responde com leveza e oferece a Jessica).

## Formato de entrada (exemplo real)

```
Lead se Cadastrou em 13/08/2026 21:58:33 na campanha facebook - prosystem_demonstracao_13082026 -
Nome: John
Empresa: Lisifarma
Telefone: (99) 99135-2501
E-mail: johneriik@hotmail.com
Utms: Origem: facebook e Campanha: prosystem_demonstracao_13082026
URL Farmácia: https://prosystemnet.com/prosystemlpv2/
```

Parser puro (`lib/assistente/sdr-entrada.ts`): aceita vários blocos colados de uma vez (separa por "Lead se Cadastrou"), extrai data do cadastro, campanha, nome, empresa, telefone (normaliza para 55+DDD+número), e-mail, origem, e segmento pela linha "URL <Segmento>:" (Farmácia/Padaria/…). Linhas vazias/duplicadas ("Empresa:" vazio) são ignoradas.

## Fluxo

1. **Passar lead** (Escritório → mesa da Caroline → "Passar leads"): cola → prévia com os campos lidos e alertas (telefone inválido, já existe lead/cliente/conversa com o número) → confirmar.
2. **Criação:** lead com `origem` do Facebook Ads e a campanha em observação/UTM; conversa do WhatsApp da empresa garantida (`garantirConversa`) e marcada `bot_estado = 'SDR'`, `bot_ativo = true`, `bot_dados.sdr = { campanha, cadastro_em, abertura_enviada, tentativas, status }`. Lead existente não é duplicado nem alterado além de vincular.
   - Opção "a Jessica já mandou a abertura": o texto padrão dela (anexo) é registrado como já enviado; a Caroline segue com a retomada.
3. **Fila de envios (anti-bloqueio):** os primeiros contatos entram numa fila. Regras:
   - horário: seg–sex 8h–18h, sáb 8h–12h (SP);
   - no máximo **15 primeiros contatos/dia** nas duas primeiras semanas, depois até **30** (configurável), **somados** aos envios de campanha do Zequinha;
   - intervalo sorteado de **4 a 9 min** entre primeiros contatos;
   - "digitando…" antes de cada mensagem, proporcional ao tamanho (se a UAZAPI suportar presença; senão, só a espera);
   - cada abertura é gerada pela IA com nome/empresa/contexto (nunca texto idêntico);
   - quem pediu SAIR (`optout_campanhas`) nunca recebe;
   - **freio:** se ≥ 3 falhas de envio seguidas, pausa a fila e avisa a gestão.
   - Respostas a quem já está conversando **não** entram no limite (saem na hora, com a espera de digitação).
4. **Conversa:** a cada mensagem do lead (texto, áudio transcrito, foto descrita), a Caroline responde pela IA (ChatGPT, tarefa complexa), com o histórico da conversa, o guia comercial e as instruções gravadas para `caroline`. A resposta é JSON: `{ mensagens: string[] (1–2 curtas), dados: {cidade, sistema_atual, dor, lojas, momento, temperatura}, acao: 'continuar'|'oferecer_demo'|'passar_vendedora'|'sem_interesse'|'duvida_fora_material', motivo? }`.
5. **Desfechos:**
   - `oferecer_demo` → usa o fluxo existente da demonstração (lista de horários, lembrete 2h antes) e avisa a vendedora.
   - `passar_vendedora` → lead para "Leads para Distribuir" com observação-resumo (quem é, sistema atual, dor, momento, temperatura) e aviso `lead_qualificado`.
   - `sem_interesse` → motivo na observação, conversa encerrada pela Caroline, nada apagado.
   - `duvida_fora_material` → responde que vai confirmar e avisa a gestão com a pergunta.
6. **Silêncio:** sem resposta, retoma em ~2 e ~5 dias úteis (mensagens diferentes, curtas); após 3 tentativas para e marca "sem resposta".
7. **Humano assume:** se alguém da equipe responde na conversa, a Caroline sai (mesma regra da triagem).

## Controle

- Liga/desliga em Configurações (começa **desligada**) e modo **aprovar antes de enviar** (padrão ligado): cada mensagem da Caroline aparece para a Jessica aprovar/editar no escritório até ela desligar o modo.
- Escritório: novo agente `caroline` (visual próprio), mesa com contadores (na fila, conversando, responderam, demos marcadas), histórico (👀) e instruções (💬).
- Tudo gravado na conversa como enviado pela Caroline (`enviada_por: 'caroline'`).

## Grau de interesse (termômetro)

**Missão número 1 da Caroline: descobrir o problema principal do cliente.** Antes de falar de solução ou oferecer demonstração, ela investiga a dor principal (o que mais incomoda hoje, desde quando, quanto custa em tempo/dinheiro, o que já tentou). Só oferece a demonstração antes disso se o próprio lead pedir. Ao encontrar a dor, conecta com o que o material diz que resolve.

Nota 0–100, recalculada a cada resposta, gravada com o motivo ("72 · dono, caixa não bate, quer trocar este mês"):

| Sinal | Pontos |
|---|---|
| Dor principal identificada e aprofundada (clara 20; com impacto/custo 35) | até 35 |
| Momento (agora/este mês 25; próximos meses 12; sem pressa 0) | até 25 |
| Fala com quem decide (dono/sócio 15; indica quem decide 8) | até 15 |
| Engajamento (responde, áudio, perguntas, pergunta preço/implantação) | até 15 |
| Encaixe no perfil (segmento, porte, cidade atendida) | até 10 |

Faixas → `lead.temperatura` existente (com histórico via `registrarMudancaTemperatura`): 80–100 MUITO_QUENTE (demo na hora + aviso prioritário), 60–79 QUENTE (oferece demo), 35–59 MORNO (segue conversando; se não marcar, vendedora com resumo), 0–34 FRIO (encerra com gentileza e motivo). Sem dor principal identificada a nota não passa de 59.

## Treino da Laya com os atendimentos da Caroline

- As mensagens dos leads já passam pela análise da Laya (sugestão de segmento/intenção/risco), como qualquer conversa.
- No desfecho, a Caroline grava a classificação dela (segmento, intenção, temperatura, desfecho) como **sugestão** na conversa. A Jessica confirma ou corrige com um clique no escritório/Inbox; só a confirmação humana vira `IaAmostra` (rótulo de treino), com `criado_por` da Jessica e marca `fonte: 'caroline'`. Rótulo gerado só pela IA nunca entra no treino.
- No modo "aprovar antes de enviar", cada mensagem aprovada ou **editada** pela Jessica é guardada como exemplo (original → versão final). Os exemplos editados entram no prompt da Caroline como referência de tom (poucos, os mais recentes), e ficam disponíveis para o treino de 14/10.

## Economia de IA paga (Laya primeiro)

- Classificação (segmento, intenção, sinais do termômetro, SAIR/sem interesse) passa primeiro pela Laya (local, grátis). Só quando a confiança dela fica abaixo do mínimo configurado é que a OpenAI classifica. À medida que a Laya é treinada (14/10 em diante), o mínimo é atingido mais vezes e a OpenAI é menos chamada.
- A OpenAI continua escrevendo as respostas da Caroline (a Laya classifica, não redige), com contexto enxuto: últimas ~12 mensagens + resumo curto do que já se sabe do lead, em vez da conversa inteira.
- Painel de uso: contagem de chamadas OpenAI x Laya por dia na mesa da Caroline, para acompanhar a economia.

## Áudio

Transcrição passa a usar a OpenAI (`gpt-4o-transcribe` ou `whisper-1`) quando `OPENAI_API_KEY` existe; Gemini continua como alternativa. Vale para o Inbox todo.

## Fora do escopo

Integração direta com Facebook Lead Ads (fase 2); API oficial do WhatsApp; preço/proposta pela Caroline.

## Testes

Parser de entrada (vários blocos, telefone, segmento); regras da fila (horário, limite diário somado, intervalo, opt-out, freio); leitura do JSON da IA e desfechos; saída quando humano responde. IA mockada nos testes.

## Anexo — abertura padrão já enviada pela Jessica

> Bom dia, {nome}! Eu sou a Jessica, da Prosystem Sistemas. Recebemos sua inscrição em nossa campanha sobre sistema para farmácias e vou iniciar seu atendimento.
> Para começar, por favor, me informe de qual cidade você é e qual sistema utiliza atualmente. Pode responder por áudio, mensagem ou foto, como preferir.
