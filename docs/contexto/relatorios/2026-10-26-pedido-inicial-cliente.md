# 26/10/2026: pedido inicial ao cliente da implantação

## Pedido
A Jessica mostrou a mensagem enviada à 64.163.743 Ronaira ("precisamos de: certificado, XMLs, lista de usuários") e pediu para trocar por: certificado A1 (.pfx, senha por telefone), código CSC, dados do contador (nome, CPF ou CNPJ, CRC, e-mail), regime tributário e inscrição estadual. "Não precisa" dos XMLs. A lista de usuários: o técnico pega na ligação de onboarding **ou** um formulário que o técnico envia depois do primeiro contato, com a resposta "organizada campo a campo no portal".

## Feito
- `backend/src/lib/implantacao/portal.ts`: nova `TAREFAS_CLIENTE_PADRAO`, `TAREFAS_CLIENTE_ANTIGAS`, `TAREFA_LISTA_USUARIOS`, catálogo `FORMULARIOS_TAREFA` (campos, descrição para o cliente, detalhe para o WhatsApp, cópia para a ficha de coleta) e `respostaDoFormulario`.
- `backend/src/services/implantacao-portal.service.ts`: configuração salva igual à lista antiga usa a nova; `dadosTarefaCliente` (descrição e "exige arquivo" pelo formulário); mensagem do WhatsApp com o detalhe entre parênteses.
- `backend/src/routes/implantacao-portal.ts`: `lista_usuarios: true` no criar tarefa; página pública devolve os campos; envio aceita `campos`/`linhas`, monta o texto e preenche a ficha de coleta só onde está vazio.
- `frontend/app/acompanhamento/[token]/page.tsx`: componente `FormularioDaTarefa` (campos, seleção de regime, lista com "+ Mais uma pessoa").
- `frontend/components/implantacao/Portal.tsx`: botão "Pedir a lista de usuários" na sub-aba Tarefas do cliente.
- Documentos: os 6 de `docs/produto/`, manual, novidades e ESTADO.md.

## Verificado
- `npx vitest run tests/tarefas-cliente-formulario.test.ts` (4 testes novos) e `implantacao-portal` + `implantacao-proximo-passo` (39): todos passam.
- `tsc` do backend e do frontend: nenhum erro nos arquivos alterados.
- **Não verificado:** a configuração salva em produção (a leitura do banco foi bloqueada pela permissão do Claude) e a página no celular depois do deploy.

- Commit 210518b no main (pipeline cancelado por pushes seguintes; o de f017b30, que o inclui, passou).
- **Deploy não concluído:** `deploy-vps.sh f017b30` parou na trava do banco por causa da coluna `WhatsappConversa.fora_do_funil_em` do commit da outra sessão. Produção segue em 9a46b70 (sem esta mudança).

## Decisões e porquês
- Sem mudança de banco: o formulário é achado pelo título da tarefa. Se alguém renomear o item em Configurações, ele vira resposta livre (texto ou arquivo), sem quebrar.
- Regime com 4 opções (iguais às da ficha de coleta), não só Simples/Lucro Real.
- A resposta do cliente não sobrescreve o que o técnico já preencheu na ficha.
- Lista de usuários: escolhido o formulário pedido pelo técnico (a opção que a Jessica preferiu e que chega organizada), não a ligação.

## Pendente
- **Jessica:** a Ronaira já recebeu o pedido antigo. Decidir se removo os itens XMLs/lista dela e crio os novos (o robô manda uma nova mensagem com os itens novos).
- **Jessica:** se em Configurações › Tarefas do cliente houver uma lista personalizada (diferente da antiga), ela continua valendo; conferir lá.

## Próxima sessão
Primeiro publicar: a sessão do f017b30 libera a coluna (PERMITIDO) e roda o deploy; esta mudança vai junto. Depois: Abrir uma demanda de teste em produção, clicar "Pedir os itens padrão" e conferir a página de acompanhamento no celular. Skills: `run`, `relatorio-final`.
