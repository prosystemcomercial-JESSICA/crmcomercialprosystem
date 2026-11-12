# 12/11/2026 — Nome padrão do contrato e download direto

**Pedido:** "Contrato_56_2026 GARCIA E PERON LTDA" é o padrão de nome quando a Jessica baixar os contratos; "destine sempre para a página de Download por enquanto".

**O que mudou**
- `backend/src/lib/assistente/contrato.ts`: `nomeArquivoContrato(c)` monta `Contrato_<número com _ no lugar da barra> <razão social>` e tira caracteres que o Windows não aceita (`\ / : * ? " < > |`).
- `backend/src/routes/contratos-comerciais.ts`: o PDF (`GET /contratos-comerciais/:id/pdf`) sai com `attachment` (vai direto para Downloads) e com esse nome, com acentos via `filename*`. O nome do documento enviado à ZapSign usa a mesma regra nos dois envios (manual e "Gerar e enviar").
- `backend/src/lib/contrato-pdf.ts`: o título interno do PDF segue o mesmo nome.
- Documentos: os seis de `docs/produto/`, o manual, as novidades e o ESTADO.md.

**Verificação:** `tests/contrato-assinatura.test.ts` com 9 testes passando, incluindo o do nome. O tsc não mostra erro nos arquivos alterados.

**Fica para depois (pedido da Jessica):** estruturar um lugar no CRM para guardar os arquivos e as informações do cliente. O contrato já assinado continua sendo aberto pelo link da ZapSign; o nome dele é o do documento enviado, então só os contratos enviados a partir de agora seguem o padrão.
