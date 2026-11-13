# 13/11/2026: Denilzo (Drogaria Cariacica) fora do radar e dos agentes

## Pedido
Jessica: "Tire o contato do Denilzo do radar, ele já é um cliente Prosystem. Não entre mais em contato com ele."

## Feito
Só dados de produção, por script avulso no servidor (apagado depois). Sem código, sem deploy, sem mudança de estrutura do banco.
- Conversa do WhatsApp do Denilzo (número `<REMOVIDO>`): `fora_do_funil_em` preenchido, etiqueta "Cliente Prosystem", robô desligado, cadência parada. `contatoSemAgentes` (`backend/src/lib/laya.ts`) passa a barrar qualquer agente nesse número, inclusive se ele escrever.
- Agente (Caroline, `SdrLead`): de AGUARDANDO para SEM_INTERESSE, com `dados.ja_cliente`, `ja_cliente_motivo`, `ja_cliente_em`, `nao_contatar` e `retomar_em: null`.
- Dois leads ligados a ele ("Denilzo", origem WhatsApp, e "Drogaria Cariacica LTDA", prospecção ativa): `etapa_comercial` PERDIDO, `motivo_perda` "Já é cliente Prosystem", `proximo_contato` vazio, observação SISTEMA no histórico. Nenhum lead apagado.
- Não havia mensagem pendente de aprovação para ele.

## Verificado
- Antes de gravar: leitura completa (conversa, agente, leads, pendentes) e confirmação de que a "DROGARIA CARIACICA LTDA" está como cliente ATIVA no cadastro.
- Depois de gravar: releitura mostra conversa com etiqueta e fora do funil, agente SEM_INTERESSE e os 2 leads em PERDIDO.
- Não verificado na tela: a Jessica ver o radar do painel comercial sem ele (o radar filtra `etapa_comercial` fora de FECHADO/PERDIDO, então deve sumir).

## Decisões e porquês
- PERDIDO com motivo "Já é cliente Prosystem" em vez de FECHADO: não foi uma venda nova; o motivo deixa claro nos relatórios.
- `tipo_contato` não virou CLIENTE e a conversa não foi ligada ao cadastro do cliente: evita que rotinas de pós-venda (Ativos, indicações) passem a chamá-lo, contra o "não entre mais em contato".
- Causa: o cadastro do cliente só tem o telefone fixo; `ehClienteAtivo` (`caroline.service.ts`) compara só telefones do cadastro.

## Pendente
- Jessica decide se quer que o CRM reconheça como cliente também os contatos de empresa que já é cliente (por nome/CNPJ), para não repetir o caso.
- Se quiser, cadastrar o celular do Denilzo como contato no cadastro da Drogaria Cariacica (ela decide; isso pode incluí-lo em ações de pós-venda).

## Próxima sessão
Nada a continuar. Se ela aprovar a melhoria, começar por `ehClienteAtivo` em `backend/src/services/caroline.service.ts` (skill `tdd`).
