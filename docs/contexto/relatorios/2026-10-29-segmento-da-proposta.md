# 29/10/2026 · Segmento da proposta vale até o fim da implantação

## Pedido
Print do Portal de Implantação com a etiqueta "💊 Farmácia" num cliente que é Varejo. Jessica: "Segmento incorreto, o segmento precisa ficar registrado desde a proposta até o final. Segmento é VAREJO."

## Feito
- Causa: o perfil da implantação (etiqueta, perguntas, roteiro, checklist) lia só `Cliente.segmento`; vazio ou errado virava Farmácia. A proposta (`PropostaComercial.segmento`, que tem "Varejo") era ignorada.
- `backend/src/services/implantacao-portal.service.ts`: `segmentoComOrigem` (proposta → lead → cadastro); `segmentoDaImplantacao`/`perfilDaImplantacao` passam por ele (designação, realinhamento e roteiro herdam). `corrigirSegmentoDaProposta`: se o perfil do cadastro diverge do da proposta, realinha o checklist; se o cadastro está vazio, grava nele o segmento da proposta.
- `backend/src/routes/implantacao-portal.ts` (`GET /implantacoes/:id/portal`): roda a correção ao abrir o card (nota no histórico se mudou algo) e devolve `segmento_info`.
- `backend/src/routes/contratos-comerciais.ts` (`gerar-cliente`): segmento em branco usa o da proposta. `frontend/app/contratos/page.tsx`: dica "Em branco = segmento da proposta".
- `frontend/components/implantacao/Portal.tsx`: `EtqSegmento` mostra o segmento da proposta e a origem na dica (e avisa se o cadastro diz outro).
- Docs: os 6 de `docs/produto/`, manual, novidades e ESTADO.md.

## Verificado
- `tsc` do backend e do frontend: nenhum erro novo nos arquivos mexidos (o erro na linha 767 de `contratos-comerciais.ts` é antigo).
- `vitest`: os testes da implantação passam; as falhas restantes (auth, retenção, backup etc.) já existiam antes da mudança (comparado com stash).
- **Não verificado:** dados do cliente do print em produção (a leitura do banco foi bloqueada pela permissão). Não se sabe se a proposta dele tem "Varejo" gravado.

## Decisões e porquês
- Sem coluna nova no banco: a implantação já guarda `proposta_id`, e a proposta não some; dispensa migração.
- O cadastro do cliente só é preenchido quando está vazio; se diz outro segmento, não é sobrescrito (pode ser cliente antigo com dado real), mas a implantação segue a proposta e a dica mostra a divergência.
- Correção dos cards antigos ao abrir, em vez de script em produção (não havia acesso de leitura).

## Pendente
- Depois do deploy, abrir o card do cliente do print e confirmar "🛒 Varejo". Se continuar Farmácia, a proposta dele está sem segmento: corrigir o segmento na proposta ou no cadastro do cliente (Jessica).

## Próxima sessão
Abrir o card no Portal de Implantação em produção e conferir a etiqueta e a nota "Checklist ajustado ao segmento da proposta" no histórico. Skill sugerida: `diagnosing-bugs` se não corrigir.
