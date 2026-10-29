# 29/10/2026 — Segmento do cliente em destaque na ficha da implantação

## Pedido
Jessica, com print do cabeçalho da ficha: "vamos destacar o segmento do cliente no cabeçalho com uma etiqueta ou algo assim, no card do portal de implantação".

## Feito
- `frontend/components/implantacao/Portal.tsx`: `SEGMENTO_CAB` + componente `EtqSegmento`; no cabeçalho da `FichaDemanda`, a etiqueta em pílula vem antes do texto azul do tipo da demanda. Cor e emoji pelo perfil (`d.perfil.segmento`: FARMACIA verde 💊, PADARIA âmbar 🥖, VAREJO roxo 🛒); texto exato do cadastro (`d.cliente_ficha.segmento`). Sem segmento no cadastro: "Farmácia (padrão)" com dica no passar do mouse.
- O texto azul (`tipo_demanda`, montado no backend) perde o trecho " · Farmácia" no frontend, para não repetir.
- Documentos: linha "Etiqueta do segmento" nos seis `docs/produto/`, seção no manual (`docs/comercial/manual-de-uso-assistente.md`) e em `docs/comercial/novidades-crm.html`; ESTADO.md.

## Verificado
- `npx tsc --noEmit` no frontend: nenhum erro em `Portal.tsx`.
- Visual no navegador: não verificado (sem abrir a tela localmente). Deploy: ver ESTADO.md / commit desta tarefa.

## Decisões e porquês
- Só frontend: os dados (`perfil`, `cliente_ficha`) já vinham em `GET /implantacoes/:id/portal`; mexer no `tipo_demanda` do backend afetaria outros usos.
- Mostrar "(padrão)" quando o cadastro não tem segmento, porque o portal assume Farmácia nesse caso e isso muda perguntas e checklist; assim o técnico percebe e corrige o cadastro.
- Não alterado: os cards da lista/quadro (só a ficha aberta, que é o que o print mostrava).

## Pendente
- Se a Jessica quiser a mesma etiqueta nos cards do quadro (lista do portal), é o próximo passo (linha ~187 de `Portal.tsx`, ao lado das `Etq`).

## Próxima sessão
Abrir uma ficha em produção e conferir a etiqueta em tema claro e escuro.
