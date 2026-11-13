# 13/11/2026: catálogo do agente de oferta com integrações parceiras

## Pedido
A Jessica mandou o print do *Catálogo do agente de oferta* (Portal Técnico → Configurações). Ela quer cadastrar ali os produtos extras e os serviços da Prosystem e também **integrações de empresas parceiras**: a Prosystem só indica o cliente, a empresa parceira faz o contato e fecha o contrato direto com ele (sem vínculo contratual com a Prosystem) e, depois que ele fecha, a Prosystem integra a ferramenta.

## O que mudou
- **Tipo do item:** *Produto Prosystem* ou *Integração parceira*. A integração tem o campo *Empresa parceira*; o preço é opcional ("Preço do parceiro").
- **Mensagem ao cliente:** na integração, o agente diz que é uma indicação de uma empresa parceira que integra com o Prosystem, que a própria parceira entra em contato e fecha com ele e que a Prosystem faz a integração depois. Nunca diz que a Prosystem vende ou cobra. Termina perguntando se pode passar o contato dele ao parceiro. Produto Prosystem continua como antes.
- **Histórico do card:** "🤝 Indicação de integração enviada ao cliente: X (parceiro Y). Se ele aceitar, passe o contato para o parceiro."
- **Tela:** cada item numa linha (faixa azul = produto, roxa = integração), botões *+ Produto ou pacote* e *+ Integração parceira*. Corrigido o layout antigo, que empilhava os campos e transformava o × numa barra vermelha.

## Arquivos
- `backend/src/lib/implantacao/oferta.ts` (novo, regras puras) e `backend/tests/implantacao-oferta.test.ts`
- `backend/src/services/implantacao-portal.service.ts` (`rodarOfertas` e leitura do catálogo)
- `backend/src/routes/implantacao-portal.ts` (validação aceita `tipo` e `parceiro`)
- `frontend/components/implantacao/Portal.tsx` (cartão do catálogo) e `frontend/e2e/catalogo-oferta.spec.ts`
- Seis documentos de `docs/produto/`, manual e novidades

## Banco
Sem tabela nova nem migração. O catálogo continua no JSON `implantacao.portal`; itens antigos sem tipo são lidos como produto.

## Conferência
- vitest `implantacao-oferta` 5/5 e `implantacao-portal` (18 no total) passando
- `tsc` sem erro nos arquivos mexidos (backend e frontend)
- Playwright `catalogo-oferta.spec.ts` 2/2, em 1366 e 390 px, salvando com o tipo e o parceiro

## Pendências
- Jessica: cadastrar os parceiros e ligar o *Agente de oferta* (começa desligado).
- Quando o cliente aceitar, alguém passa o contato ao parceiro (manual). Próximo passo possível: avisar a gestão automaticamente quando o cliente responder "sim".
