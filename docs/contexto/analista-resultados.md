# Analista de Resultados: relatório de sexta da prospecção

Pedido da Jessica (21/10/2026): toda sexta, uma análise completa da prospecção, com números, leitura das conversas, leads com chance de conversão, como aumentar o engajamento e chegar à proposta, leads por temperatura, ranking dos retornos, decisores, sistemas citados, como converter mais, campanhas e as ações da próxima semana. Ela quer **página web dinâmica**, não texto solto, e o resumo **só no WhatsApp que ela indicou**.

## Como funciona (automático)

- **Sexta, 16h:** `rodarRafael` chama `gerarAnaliseResultados` (`backend/src/services/analista-resultados.service.ts`). O relatório vai para `ConfiguracaoIntegracao` `analista.relatorio.<segunda da semana>`.
- **WhatsApp:** o resumo sai pela instância da empresa só para o número em `ConfiguracaoIntegracao` `analista.whatsapp_destino` (o número fica no banco, nunca no Git). Sem número, nada é enviado. Não vai para a lista da gestão.
- **Página:** `https://comercial.prosystemnet.com/analista` (gestão comercial). Tem "Gerar agora" e "Imprimir ou salvar PDF".
- **Regras puras e testes:** `backend/src/lib/analista-resultados.ts` e `backend/tests/analista-resultados.test.ts`.

## Quando a Jessica pedir a análise na conversa

1. Abra a página ou rode "Gerar agora" (`POST /comercial/analista/gerar`). Para estudo avulso, use o script só de leitura `backend/scripts/analise-resultados-semana.cjs <segunda> --conversas`, rodado no servidor como manda o arquivo local (seção "Ler dados de produção").
2. Leia as conversas dos leads com mais sinal antes de concluir: o termômetro do agente costuma marcar tudo como frio.
3. Se ela quiser documento para a diretoria, use a reunião semanal (`docs/contexto/reuniao-semanal.md`).

## Armadilhas (já aconteceram)

- **"Responderam" inclui robô de loja.** Em outubro, 66 das 142 respostas eram só robô. Avanço real é o status CONVERSANDO, DEMO, VENDEDORA ou HUMANO.
- **"Prosystem" na conversa não é sistema do lead:** o cliente escreve "quero o Prosystem". Clientes de verdade aparecem em `dados.ja_cliente` e no motivo "já é cliente".
- **"Preço Baixo" é nome de rede de farmácias,** não pedido de preço.
- **Demonstração sem resultado na agenda** (status PENDENTE com data passada) esconde se ela aconteceu.
- **Dados pessoais:** só nome de empresa e primeiro nome. Nunca telefone, CPF ou e-mail no relatório ou no Git.

## Edições

| Semana | Onde |
| --- | --- |
| 19/10/2026 (primeira, manual, com plano de 7 dias úteis para 5 contratos) | https://claude.ai/artifact/HCSDkUnL1KvhgAAHJbwrVv |
| A partir de 23/10/2026 | página `/analista` do CRM |
