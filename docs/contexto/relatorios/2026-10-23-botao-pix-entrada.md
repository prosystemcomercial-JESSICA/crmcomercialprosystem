# 23/10/2026: botão "Copiar chave Pix" na entrada e caso do desconto da Ronaira

## 1. Pedido

- "Esse botão não envia a proposta no WhatsApp?" Era o botão Enviar, travado na proposta de 64.163.743 Ronaira (desconto de 42,1%, acima do limite de 30%).
- "Aprovei no WhatsApp, mas não mudou nada ali." Depois: "Não envia também para o WhatsApp? Com nenhum texto?"
- "Preciso incluir o botão do Pix da empresa para cobrança do valor de entrada da proposta aceita." Modelo enviado pela Jessica: cartão "Solution Desenvolvimento · CNPJ: 09.559.678/0001-83 · Copiar chave Pix".

## 2. Feito

- **Caso do desconto (sem código):** o "Aprovar" foi tocado na conversa do WhatsApp da empresa. No banco, ficou como mensagem de saída para o número da Jessica. O CRM só aceita a resposta vinda do celular de quem aprova. Ela aprovou pelo celular às 10h16 (Brasília) e a proposta saiu às 10h17, com texto e botões (conferido no banco).
- **Botão Pix:** detalhes em `docs/contexto/ESTADO.md` (23/10) e nas seções "Atualização 23/10/2026" de `docs/produto/01` a `06`.
  - `backend/src/services/evolution.service.ts`: `enviarBotaoPix` (UAZAPI `POST /send/pix-button`).
  - `backend/src/lib/assistente/proposta.ts`: `chavePixParaBotao`, `textoCobrancaEntrada` e `textoPosAceite(..., comBotao)`.
  - `backend/src/services/assistente-proposta.service.ts`: `enviarPosAceite`, `posAceitePeloLink`, `cobrarEntradaWhatsapp`; as propostas aceitas entram na lista da conversa.
  - `backend/src/routes/propostas-comerciais.ts`: aceite pelo link manda o pós-aceite quando a proposta foi pelo WhatsApp.
  - `backend/src/routes/whatsapp.ts`: `via_whatsapp` no aceite pelo botão, rota `cobrar-entrada` e `pix_nome` na config.
  - Frontend: `EnviarPropostaWpp.tsx` (botão "Cobrar entrada (Pix)"), `AssistenteWhatsapp.tsx` (campo "Nome de quem recebe") e `api-client.ts`.
  - Manual (`docs/comercial/manual-de-uso-assistente.md`) e novidades (`docs/comercial/novidades-crm.html`).

## 3. Verificado

- `npx vitest run tests/assistente-proposta.test.ts tests/assistente-desconto.test.ts`: 15 de 15 passaram.
- `npx tsc --noEmit` no backend: nenhum erro nos trechos alterados (os erros que aparecem são antigos, em outras linhas). No frontend: nenhum erro nos 3 arquivos alterados.
- Contrato da UAZAPI conferido na documentação oficial (docs.uazapi.com, endpoints `send~pix-button` e `send~request-payment`).
- **Não verificado:** o envio real do botão a um cliente. Ainda não houve aceite com a chave cadastrada.
- Deploy: ver o commit e o ESTADO.md. Se o deploy não tiver sido feito nesta sessão, ele fica pendente.

## 4. Decisões e porquês

- Usei `/send/pix-button` (o cartão do modelo da Jessica) e não `/send/request-payment` ("Revisar e pagar" com valor), que é um fluxo mais pesado. O valor da entrada vai no texto logo antes do cartão.
- O tipo da chave é descoberto pelo formato, para não criar mais um campo. Com 11 dígitos, vira CPF se o dígito verificador confere; senão, celular.
- Se o botão falhar, a chave vai em texto: o cliente nunca fica sem ela.
- O aceite pelo link só manda mensagem se a proposta foi enviada pelo WhatsApp (`wpp_conversa_id`), e só no primeiro aceite. O aceite pelo botão passa `via_whatsapp` para não sair mensagem duplicada.
- O clique feito no WhatsApp da empresa continua ignorado para aprovar desconto. Mensagem da própria empresa não prova quem aprovou.

## 5. Pendente

- **Jessica:** em Configurações › Assistente no WhatsApp, preencher Chave PIX `09.559.678/0001-83` e Nome de quem recebe `Solution Desenvolvimento` e salvar. A chave estava vazia, e a gravação direta no banco foi bloqueada pela permissão do Claude.
- Conferir, no primeiro aceite real, se o cartão chegou certo no celular do cliente.

## 6. Próxima sessão

- Ver no banco se `assistente.pix_chave` e `assistente.pix_nome` estão preenchidas (script de leitura, como no LEIA-PRIMEIRO).
- Se houve aceite: procurar na conversa a mensagem "[Botão PIX]" e, no log de erro, `[PROPOSTA-WPP] botão PIX`.
- Skill sugerida: `diagnosing-bugs` se o botão não chegar.

---

## Continuação no mesmo dia: erro da ZapSign no "Enviar para assinatura"

1. **Pedido:** "Está dando erro na chave API do ZapSign, consegue verificar? Preciso enviar o link de assinatura, além de por e-mail, também através do WhatsApp." Erro na tela: `Unexpected token 'É', "É obrigató"... is not valid JSON`.
2. **Feito:** `lerRespostaZapSign` e `telefoneZapSign` em `backend/src/routes/contratos-comerciais.ts`; uso em `enviar-zapsign`, `gerar-e-enviar` e `services/implantacao-termo.service.ts`; teste `backend/tests/zapsign-resposta.test.ts`. Detalhes: ESTADO.md e "Correção 23/10/2026" nos docs de produto.
3. **Verificado:** em produção, a chave lê documentos (`GET /docs/` = 200). O `POST /docs/` sem arquivo responde 402 "É obrigatório contratar um Plano de API para utilizá-la em modo produção." O PDF do contrato 55/2026 é gerado normalmente (64 KB). E-mail e telefone do signatário estão em formato válido. 4 de 4 testes passaram. O deploy do botão Pix (7eb0d3c) terminou com build ok e frontend e backend no ar.
4. **Decisões:** não troquei para o sandbox, porque documento de teste não vale como assinatura. O envio do link pelo WhatsApp não mudou, porque já existia e depende de a ZapSign criar o documento.
5. **Pendente (Jessica):** contratar o Plano de API da ZapSign, ou pedir o envio manual (colar o link do Painel ZapSign e o CRM mandar pelo WhatsApp).
6. **Próxima sessão:** com o plano ativo, clicar em "Enviar para assinatura" no 55/2026 e conferir `zapsign_signing_url` e a mensagem do link na conversa da proposta.

---

## Continuação (tarde): botão "Enviar chave Pix"

1. **Pedido:** "Quero um botão no WhatsApp para enviar a chave Pix quando não é enviado automático."
2. **Feito:** botão **Enviar chave Pix** no painel da conversa (`frontend/components/whatsapp/EnviarPropostaWpp.tsx`); rota `POST /whatsapp/conversas/:id/enviar-pix` (`backend/src/routes/whatsapp.ts`) e `enviarPixConversa` (`backend/src/services/assistente-proposta.service.ts`), que reusa `enviarChavePix`.
3. **Verificado:** checagem de tipos sem erro novo (backend e frontend). Deploy: ver o commit seguinte no ESTADO.md. **Não verificado:** o envio real, que depende da chave cadastrada.
4. **Decisões:** o botão fica fora da lista de propostas e manda só o cartão, sem valor, para servir a qualquer contato. A cobrança com valor continua em "Cobrar entrada (Pix)".
5. **Pendente (Jessica):** cadastrar a chave e o nome em Configurações › Assistente no WhatsApp.
6. **Próxima sessão:** depois do cadastro, testar o botão numa conversa interna e conferir a mensagem "[Botão PIX]" na conversa.
