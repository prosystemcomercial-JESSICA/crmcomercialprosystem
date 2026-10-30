# Relatório: Reunião semanal com a diretoria (30/10/2026)

## Pedido

A Jessica pediu "um relatório completo de como foi a semana, hoje tenho reunião e preciso apresentar as atividades e números da semana e do mês".

## Feito

1. Script `backend/scripts/relatorio-reuniao-semanal.cjs` copiado e rodado no servidor de produção com a data `2026-10-26` (início da semana).
2. Relatório completo publicado no Claude Docs: https://claude.ai/artifact/BMxFFK573xn1qQLKoPf9zK — com as 11 seções do guia `docs/contexto/reuniao-semanal.md`.
3. Link registrado na tabela de relatórios em `docs/contexto/reuniao-semanal.md`.
4. Entrada adicionada no `docs/contexto/ESTADO.md` (registro de mudanças) e na tabela de documentos.

Números-chave do relatório:
- Semana: 164 leads, 114 contatos, 59 responderam, 7 avançaram, 3 demos realizadas, 3 propostas, 0 contratos
- Mês (outubro): 723 leads, 395 contatos, 5 propostas, 3 contratos (R$ 962/mês), 14 casos de churn
- Ano: 24 contratos (R$ 8.010/mês), 82 propostas, 47 casos de churn
- 17 melhorias entregues no CRM na semana

## Verificado

- Dados de produção coletados às 09h41 UTC de 30/10/2026 via script no servidor (saída JSON completa, ~39 KB).
- Somas conferidas: origens da semana (150+6+4+4 = 164 = total de leads), status dos contatados (102+5+4+2+1 = 114), contratos do mês (280+380+302 = 962).
- Documento publicado e acessível no link.
- ESTADO.md e reuniao-semanal.md atualizados.
- **Não verificado:** commit e push (não solicitado pela Jessica nesta sessão; há mudanças não commitadas de outras sessões no working tree).

## Decisões e porquês

- Usei o formato das 11 seções do guia (`reuniao-semanal.md`), igual aos relatórios anteriores.
- Agrupei motivos de churn manualmente (texto livre no banco) em 6 categorias; a soma pode não fechar exatamente com o total por sobreposição de motivos.
- Propostas "para reativar": listei as 10 mais relevantes (recentes + alto valor) das 24 abertas/expiradas, para não poluir a apresentação.
- Destaquei o padrão da rede "Farmácias Preço Baixo" (churn e contrato ao mesmo tempo) como ponto de atenção para a diretoria.

## Pendente

- **Commit e push** deste relatório e das atualizações em ESTADO.md e reuniao-semanal.md — com a Jessica.
- **Decisões da diretoria** listadas na seção 11 do relatório: meta de novembro, Programa de Ativos, verba de campanha, ZapSign, chaves expostas.
- **Rafa Farma** (proposta visualizada, R$ 350/mês): a mais quente para fechar.
- **2 contratos "a gerar"** (Farmácias Preço Baixo e Gurifarma): pendentes desde 05/10.

## Próxima sessão

Primeiro passo: commitar as mudanças desta sessão (relatório, ESTADO.md, reuniao-semanal.md) e fazer push. Se a Jessica trouxer decisões da reunião, registrar no ESTADO.md e ajustar o CRM conforme necessário. Skill sugerida: `handoff` se a sessão mudar no meio de implementações.
