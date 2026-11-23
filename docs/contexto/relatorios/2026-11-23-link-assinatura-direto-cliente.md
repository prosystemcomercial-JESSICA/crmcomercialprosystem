# 23/11/2026: link de assinatura vai direto para o cliente

## Pedido
Jessica: "quando eu colar o link de enviado para a assinatura, a mensagem com o link e instruções deve ir diretamente para o cliente assinar".

## Feito
- `backend/src/routes/contratos-comerciais.ts` (PATCH): link recebido + status final Enviado p/ assinatura ou Aguardando → `enviarLinkAssinatura`; resposta traz `whatsapp: true|false`.
- `backend/src/services/contrato-assinatura.service.ts`: `enviarLinkAssinatura` só envia uma vez por link e contrato (`podeEnviarUmaVez`, chave `contrato_link.<id>.<sha1 12>`), registra ação da Marta. Vale também para o envio pela ZapSign.
- `backend/src/lib/assistente/contrato.ts`: `textoLinkAssinatura` com passo a passo (abrir, conferir nome/CPF, assinar com o dedo, código se pedir).
- `frontend/app/contratos/page.tsx`: mensagem de resultado no painel do contrato e aviso no topo quando o card é arrastado.
- Teste novo em `backend/tests/contrato-assinatura.test.ts`. Documentos de `docs/produto/`, manual e novidades atualizados (seção "Atualização 23/11/2026").

## Verificado
- vitest `tests/contrato-assinatura.test.ts`: 12/12.
- `tsc` backend: nenhum erro novo nos arquivos mexidos (o erro da linha 786 de `contratos-comerciais.ts` é antigo). `tsc` frontend: sem erro em `contratos/page.tsx`.
- Não verificado: envio real a um cliente em produção e a tela no navegador.

## Decisões e porquês
- Dedupe por link (não por contrato): colar o mesmo link de novo não repete (proteção do número), mas um link corrigido chega ao cliente.
- Marcar Assinado direto não envia o link (o cliente já assinou).
- Docs commitados só com a minha seção: havia mudanças de outra sessão (Heitor/Joana) nos mesmos arquivos, deixadas fora do commit.

## Pendente
- Jessica testar com um contrato real e dizer se o texto das instruções está bom.

## Próxima sessão
Se ela pedir ajuste no texto, mexer em `textoLinkAssinatura` (`lib/assistente/contrato.ts`) e no teste. Skills: `graphify`, `relatorio-final`.
