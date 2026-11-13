# 13/11/2026: tela "Aprovar" sai do menu; aba Decisões no painel do Rafael

## Pedido
A Jessica perguntou para que servia a tela Aprovar (print: "Nada esperando por você") e se ela era necessária. Recomendei tirar e mostrar o histórico do Rafael. Ela respondeu: "não precisa dessa aba sozinha, pode colocar no painel do Rafael e excluir essa seção".

## Feito
- Menu: item "Aprovar" removido (`frontend/components/dashboard/DashboardLayout.tsx`).
- `frontend/app/aprovar/page.tsx`: virou só um redirecionamento para `/escritorio?rafael=decisoes`, para os avisos antigos no celular.
- Nova aba **⚖️ Decisões** no painel do Rafael: `frontend/components/escritorio/DecisoesRafael.tsx`, ligada em `PainelRafael.tsx` e no parâmetro `?rafael=decisoes` de `frontend/app/escritorio/page.tsx`.
- Backend: rota `GET /especialista/decisoes` em `backend/src/routes/especialista.ts` e regra pura `resumirDecisaoRafael` em `backend/src/lib/assistente/rafael-aprovador.ts`, com testes em `backend/tests/rafael-aprovador.test.ts`.
- Avisos no celular que abriam `/aprovar` agora abrem a aba nova: `routes/push.ts`, `services/assistente-gestao.service.ts` e `services/assistente-negociacao.service.ts`.
- Documentação: os seis documentos de `docs/produto/`, o manual e as novidades, na seção "Atualização 13/11/2026: a tela Aprovar saiu do menu".

## Verificado
- vitest `rafael-aprovador`: 10/10.
- `tsc` do backend e do frontend: nenhum erro nos arquivos mexidos.
- **Não verificado:** a aba aberta no navegador com dados reais e a rota em produção. Fazer depois do deploy.

## Decisões e porquês
- A fonte do histórico é `SdrMensagem` com `decidido_por = 'rafael'`. Não foi preciso criar tabela nem mudar o banco.
- O motivo do Rafael só é gravado quando ele manda refazer (`texto_final` "Rafael: …"). Quando ele aprova ou corrige, o motivo não é salvo, então a tela mostra o texto antes e depois.
- O percentual da campanha vem de `SdrLead.dados.desconto_autorizado.impl_pct`, só quando `por = 'Rafael'`.
- A página `/aprovar` foi mantida como redirecionamento, em vez de apagada, para não quebrar as notificações já enviadas.
- `api-client.ts` estava com mudanças de outra sessão. Por isso o componente usa `apiClient.client.get`, padrão que já existe em outras telas.
- Os botões de aprovar no painel da Caroline e no WhatsApp da gestão continuam como estavam.

## Pendente
- Conferir a aba em produção depois do deploy.
- Se o Rafael for desligado algum dia, devolver "Aprovar" ao menu: é uma linha no `DashboardLayout.tsx` e a página volta a partir do histórico do git. Quem decide é a Jessica.

## Próxima sessão
Abrir Escritório › Rafael › ⚖️ Decisões em produção e conferir se os rótulos batem com o que aparece no WhatsApp. Skill sugerida: `run`.
