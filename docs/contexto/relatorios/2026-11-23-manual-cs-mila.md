# 23/11/2026 · Manual de CS da Mila, Agenda do CS e oferta de upgrade corrigida

## Pedido
A Jessica colou os documentos da Mila (DICA, PROCESSO, POP e EXEMPLO de 11/11 a 23/11, "para aprovar") e pediu: "não apenas aprender, mas colocar em prática". Depois: "use também o que puder sobre a jornada do cliente, implantação e treinamento, pesquise mais de tudo, aprimore tudo e ensine a Mila, não apenas o que fazer, mas também como e quando agir" e "use também os POPs da Mila e, se necessário, aprimore". Ela também colou a oferta de upgrade de 11/11, que ainda espera aprovação.

## Feito
- **Achado:** os documentos aprovados da Mila iam para `guiaComercial` (`backend/src/services/assistente-ia.service.ts`), o material de prospecção da Caroline e das vendedoras, e não para o CS. Agora `origem mila` fica fora dele.
- **Manual único:** `docs/comercial/playbook-mila-cs.md`, com 16 seções, calendário de gatilhos, jornada por marcos, implantação, treinamento, saúde da conta, motivos, pesquisas, cancelamento, migração, função ausente, inadimplência, expansão, registro, rotina e fontes. Ele consolida os POPs da Mila sem repetição e corrige o que estava errado: o trecho de vendas (CNPJ não saiu) saiu do CS; a pesquisa ficou só com a Helena; os números divergentes foram tirados.
- **Leitura do manual:** `backend/src/lib/assistente/playbook-mila.ts`. O manual entra no prompt do estudo (`estudarRetencao`), da conversa com a Jessica (`falarComAgente` em `agentes-conversa.service.ts`) e da oferta de upgrade.
- **Agenda do CS:** `backend/src/lib/assistente/mila-agenda.ts` (puro) e `backend/src/services/mila-agenda.service.ts`. Roda toda segunda, 8h–10h, pelo agendador em `especialista.service.ts`.
- **Upgrade:** `backend/src/lib/assistente/mila-upgrade.ts` e `backend/src/services/mila-upgrade.service.ts`. Foram acrescentados bloqueios (caso de churn aberto e grupo de quem saiu), um segmento por oferta, uma loja por CNPJ raiz, "não conhece" só com pesquisa e texto no feminino.
- **Documentação:** os seis documentos de `docs/produto/`, o manual de uso e as novidades (detalhe técnico completo nos documentos de produto, seção "Atualização 23/11/2026"). Também foi atualizado o `ESTADO.md`.
- O commit e o deploy aparecem no `ESTADO.md` e no `git log`.

## Verificado
- `npx vitest run tests/mila-agenda.test.ts tests/mila-upgrade.test.ts`: 11 testes passaram.
- Bateria inteira: 933 testes passaram e 5 falharam. As 5 falhas são de testes de rota que exigem `DATABASE_URL`, que não existe neste computador. Elas não tocam nos arquivos mudados.
- `npx tsc --noEmit -p . --rootDir .`: nenhum erro nos arquivos mudados.
- **Não verificado:** a agenda rodando com dados reais de produção. O primeiro resultado aparece na segunda, 8h–10h. Também não foi verificado quantos clientes ativos têm CNPJ de 14 dígitos, o que afeta a seção de grupo.

## Decisões e porquês
- **Manual em arquivo, não como mais um documento no banco.** Os documentos se repetiam em versões, e o limite de 30 aprovados mais recentes empurrava uns para fora dos outros. O manual é uma regra única e versionada no git.
- **A agenda é um documento ALERTA, sem atividade e sem mensagem.** Segue as regras do projeto: nunca criar atividades automáticas e proteger o WhatsApp. A agenda anterior ainda não vista é arquivada para não acumular.
- **Grupo de lojas pelo CNPJ raiz.** É o dado que existe hoje. Redes de franquia, como a Preço Baixo, têm CNPJs diferentes e não são pegas por ele. Para isso seria preciso um campo de grupo ou sócio.
- **Sem mudança de banco.** A lista fechada de motivos e os campos novos ficam para a decisão da Jessica.
- **A oferta de 11/11 não foi mexida.** Decisão dela, com a recomendação de descartar.

## Pendente
- A Jessica deve descartar a oferta de upgrade de 11/11 e aprovar só a versão mais nova de cada documento da Mila, arquivando as repetidas.
- A Jessica deve decidir a lista de motivos de saída e os campos "confirmado pelo cliente", "recuperável, estrutural ou não confirmado" e "autoriza contato futuro" (muda o banco).
- A Jessica deve dizer se o ERP dá o último acesso ou as últimas vendas por CNPJ (sem isso, não dá para medir queda de uso).
- Definir quem da equipe humana é o dono das notas ruins e dos itens da agenda.
- Health score com duas fórmulas (implantação e cliente ativo), a ser calibrado com dados reais.

## Próxima sessão
Na segunda, 30/11 (ou na primeira segunda depois do deploy), conferir no servidor a "Agenda do CS" gerada: quantidade por seção e se aparece algum item absurdo. Ajustar os prazos em `mila-agenda.ts` e no manual, se for o caso. Skills sugeridas: `graphify` (antes de mexer no código), `relatorio-final`.
