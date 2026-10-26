# 26/10/2026: onboarding e checklist por segmento e por tipo de base

## Pedido
A Jessica mandou o print do card "64.163.743 Ronaira" (varejo, banco zerado) no Portal Técnico: apareciam "Testes de conversão (7)", "PBMs utilizadas" e "SNGPC (controlados)". Palavras dela: "o segmento é varejo, naturalmente o onboarding será diferente de farmácia, correto? Banco zerado é diferente de conversão de dados correto? Preciso que isso seja classificado da forma correta [...] e não marcar coisas que não fazem sentido para o segmento VAREJO." E: "Precisamos organizar isso por segmento."

## Feito
- Commit `5f8e28c`. A regra completa está em `docs/produto/01-PRD.md` (seção "Atualização 26/10/2026: onboarding e checklist por segmento e por tipo de base") e repetida nos outros 5 documentos de produto.
- `backend/src/lib/implantacao/portal.ts`: perfil = segmento do cliente (Farmácia, Padaria, Varejo) + banco zerado/conversão; funções que ajustam perguntas, roteiro, ficha e checklist ao perfil, e `realinhamento` (o que tirar e o que pôr).
- `backend/src/services/implantacao-portal.service.ts`: `segmentoDaImplantacao`, `perfilDaImplantacao`, `realinharAoPerfil`; `TESTES_PADRAO` veio de `routes/implantacoes.ts`.
- `routes/implantacoes.ts`: a designação cria o checklist já no perfil; banco zerado não ganha testes de conversão.
- `routes/implantacao-portal.ts`: o detalhe do card devolve perguntas, roteiro e ficha do perfil e o cabeçalho "Implantação · Varejo · banco zerado". Ao trocar zerado ↔ conversão na ficha, o checklist se realinha.
- `frontend/components/implantacao/Portal.tsx`: a aba Testes de conversão some no banco zerado; o texto "Com as N respondidas" usa o número do perfil.
- `backend/scripts/realinhar-perfil-implantacoes.ts`: corrige as implantações já abertas (sem `--aplicar` só lista).

## Verificado
- `npx tsc` do backend e do frontend: nenhum erro nos arquivos mexidos.
- Vitest: `tests/implantacao-perfil.test.ts` (novo, 6 testes), `implantacao-portal` e `implantacao-proximo-passo`, 45 de 45 passando.
- Push no `main` (pela conta `prosystemcomercial-JESSICA`; a `alcancelegalmkt-collab` levou 403 neste repositório).
- Deploy de `5f8e28c` na VPS: backup feito, "banco sem alterações", build ok, PM2 reiniciado, frontend ok e backend respondendo.
- **Não verificado:** o script `realinhar-perfil-implantacoes.ts` em produção (nem a simulação): a sessão não teve permissão de ler o banco de produção. Os cards já abertos, como o da Ronaira, **continuam com os itens antigos** até o script rodar com `--aplicar`. As implantações designadas a partir de agora já nascem certas.
- **Não verificado:** os valores reais de "segmento" no cadastro de clientes em produção (a leitura do banco foi bloqueada nesta sessão). Se houver segmento escrito de outro jeito (ex.: "Supermercado"), ele cai em Varejo, o que é o esperado.

## Decisões e porquês
- Cliente **sem segmento** fica como Farmácia: é a base principal da Prosystem e mantém o comportamento de antes, sem tirar nada de quem não foi classificado.
- Padaria segue as mesmas regras do Varejo por enquanto (sem itens próprios). Não inventamos itens de varejo/padaria; isso fica para a Jessica e a supervisão em Configurações › Modelos por segmento.
- O ajuste nunca tira item feito nem item criado à mão; testes de conversão saem só os pendentes. Nada de mudança no banco.

## Pendente
- Rodar na VPS (pasta `backend`): `npx tsx scripts/realinhar-perfil-implantacoes.ts` (simulação), conferir a lista e depois o mesmo com `--aplicar`. Precisa da Jessica liberar a permissão de acesso ao banco de produção para o Claude, ou rodar ela mesma.
- Jessica: conferir o segmento correto no cadastro dos clientes com implantação aberta (o perfil depende dele).
- Jessica e supervisão técnica: decidir se Varejo e Padaria precisam de itens próprios (grade de tamanho/cor, balança etiquetadora, produção) e cadastrar em Modelos por segmento.

## Próxima sessão
Rodar o script em simulação e depois com `--aplicar`. Em seguida, Abrir o card da Ronaira no Portal Técnico e conferir que mostra "Varejo · banco zerado", 13 perguntas e sem a aba Testes de conversão. Skills: nenhuma específica.
