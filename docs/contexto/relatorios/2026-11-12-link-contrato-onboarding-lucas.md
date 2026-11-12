# 12/11/2026 — Link do contrato obrigatório e onboarding automático com o Lucas Diniz

**Pedido:** "Após a agente gerar e enviar para Gerado, para mudar para enviado p/ assinatura tem que ser obrigatório que eu coloque o link enviado ao cliente e manter esse link, para que depois eu apenas coloque como assinado e aí ir para o onboarding do cliente. Dar as boas-vindas como já está sendo feito. Avisar a equipe que existe uma nova demanda no contato (WhatsApp da nova demanda) e enviar o link do card no portal técnico destinado ao Lucas Diniz sempre (por enquanto)."

**Feito** (detalhes na seção de 12/11/2026 dos seis documentos de `docs/produto/`)
- `backend/src/routes/contratos-comerciais.ts`: PATCH recusa Enviado/Aguardando/Assinado sem link (`LINK_OBRIGATORIO`); link vazio não apaga o guardado; link só `https://` (`linkValido` em `backend/src/lib/assistente/contrato.ts`).
- `backend/src/services/implantacao-designar.service.ts` (novo): `designarTecnico` (regra do botão "Designar", tirada de `routes/implantacoes.ts`), `encaminharNovaDemandaDoContrato` (designa ao "Lucas Diniz" e manda o aviso com o link do card no WhatsApp `WHATSAPP_NOVA_DEMANDA`), `linkCardPortal`.
- `backend/src/lib/comissao-fluxo.ts`: chama o encaminhamento quando a implantação nasce do contrato assinado.
- `backend/src/services/implantacao-portal.service.ts`: `whats` exportado.
- `frontend/app/contratos/page.tsx`: campo obrigatório do link + "Marcar enviado"; janela pedindo o link ao arrastar/mover sem link; link visível com "copiar".
- `frontend/app/portal-tecnico/page.tsx`: `?demanda=<id>` abre o card no Quadro.
- Boas-vindas: sem mudança (marco CONTRATO do portal, como antes).

**Verificado:** `tests/contrato-assinatura.test.ts` 10 passando; suíte do backend 815 passando e 5 falhas antigas que dependem de banco/rotas (auth, backup, retenção, health-score, leads-previsao), sem relação com o que mudou. Checagem de tipos sem erro nos arquivos alterados (backend e frontend; os dois erros `sups` são antigos). **Não verificado:** a consulta em produção para conferir o cadastro do Lucas Diniz e o telefone dele foi bloqueada pela permissão; o fluxo não foi visto na tela.

**Decisões:** o Lucas é achado pelo nome (cadastro ativo começando com "Lucas Diniz"); sem cadastro, o card fica sem técnico e o aviso diz isso. Se o número da nova demanda for o do Lucas, ele recebe uma mensagem só. A designação foi extraída para um serviço para a rota e a assinatura usarem a mesma regra. Contratos antigos em Enviado sem link pedem o link ao marcar assinado.

**Pendente:** conferir em produção que existe usuário ativo "Lucas Diniz" (Jessica/Claude). Técnico e número fixos no código "por enquanto": quando mudar, trocar `TECNICO_PADRAO_NOME` e `WHATSAPP_NOVA_DEMANDA` ou levar para Configurações.

**Continuação (mesmo dia):** a pedido da Jessica, o aviso de nova demanda virou um resumo (conversão e sistema, máquinas, responsável, contato, link do card) em `backend/src/lib/implantacao/nova-demanda.ts`, com `backend/tests/nova-demanda.test.ts` (5 passando). Dados da proposta; sem ela, do representante do contrato.

**Próxima sessão:** se a Jessica relatar que o card ficou sem técnico, ler `UsuarioCRM` na produção pelo nome e ajustar `TECNICO_PADRAO_NOME`. Skill sugerida: `diagnosing-bugs`.
