# Proposta de agosto refeita no formato atual (23/11/2026)

## Pedido
A Jessica pediu para achar a proposta de 06/08/2026 de uma farmácia de Aracruz/ES (CNPJ no arquivo local) e refazê-la no formato atual, com os dados que já existiam, para continuar a negociação e o cliente aceitar direto no link.

## O que foi encontrado
- Proposta `c81-<CNPJ>`, criada em 06/08/2026 pela Jessica, **EXPIRADA** em 04/09 (validade 17/08). Nunca foi aceita nem enviada pelo WhatsApp do CRM.
- Formato antigo: plano "Farma Pro", mas a mensalidade de R$ 280 estava em `mensalidade_plus`. A página do cliente mostraria o plano Plus com esse valor.

## O que foi feito (só banco de produção, sem código)
- Proposta **nova** `d99-<CNPJ>`, criada com a mesma regra do `POST /propostas-comerciais`: token público novo, comissões de 15% (R$ 135) e 5% (R$ 45), registro de CRIAÇÃO no histórico citando a proposta de origem.
- Status RASCUNHO, validade até 03/12/2026.
- Valores mantidos: Farma Pro R$ 280/mês (`mensalidade_pro`, `plano_selecionado: PRO`), implantação R$ 1.100 com desconto de R$ 200 (R$ 900), entrada de R$ 250 por Pix e 5 parcelas de R$ 130, vencimento no dia 10. Serviços: Dashboard, Treinamento, WhatsApp/Mensageria, Suporte Prioritário.
- Mudanças em relação à antiga: telefone atual da vendedora (27 99752-1370), texto padrão de cobrança das propostas recentes, sem a data de virada antiga (10/08) e sem a condição "Válida por 10 dias", que a validade já cobre.
- A proposta antiga não foi alterada.

## Conferência
- A criação devolveu o ID e o token novos. A página do cliente mostra um plano só (Pro), porque só há preço de Pro.
- O link não foi aberto aqui de propósito: abrir pela API marca a proposta como VISUALIZADA.

## Pendente
- A Jessica conferir no CRM (Propostas Comerciais) e enviar o link "modo cliente" para a responsável.
