# Resumo p/ e-mail conta o ciclo desde a primeira proposta (23/11/2026)

## Pedido
A Jessica perguntou quando foi a primeira proposta da farmácia de Aracruz/ES (06/08/2026, expirada). Depois pediu para colocar isso no resumo para o e-mail do contrato, porque o cálculo estava errado. Nesse dia, o cliente foi só reativado e o contrato foi fechado.

## Causa
Em `GET /contratos-comerciais/:id/resumo-assinatura`, o "Início do contato" era a criação do lead. Num cliente reativado, o "Tempo de fechamento" ficava errado.

## O que mudou
- O início agora é a data mais antiga entre o lead, a proposta do contrato e a primeira proposta do mesmo CNPJ (inclusive expirada).
- Se a primeira proposta não é a do contrato, o texto mostra "📄 Primeira proposta: … (reativada em …)".
- Documentação: os seis documentos de `docs/produto/`, o manual, as novidades e o ESTADO.

## Verificação
- Checagem de tipos: nenhum erro novo. O erro na linha ~803 (troca de CNPJ, `$queryRawUnsafe`) já existia.
- Deploy `8ffe330b` feito: a CI passou, o backup (482M) foi conferido, o banco não mudou e o site e a API respondem.
- Dados de produção: o lead foi criado em 23/11/2026 15:23 (antes dava 0 dias), a proposta `c81` é de 06/08/2026 (expirada) e o aceite da `d99` foi em 23/11/2026. O resumo esperado: início 06/08/2026, fechamento 23/11/2026, 109 dias, mais a linha da primeira proposta.
- O texto da API não foi gerado aqui, porque isso exige uma sessão de usuário.

## Pendências
- A Jessica confere o botão Resumo p/ e-mail do contrato.
