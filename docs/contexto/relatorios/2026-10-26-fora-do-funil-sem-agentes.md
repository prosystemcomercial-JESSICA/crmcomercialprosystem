# 26/10/2026: conversa desvinculada do funil sem nenhum agente

## Pedido
Jessica: "Conversas desvinculadas do funil não devem ter atuação dos agentes".

## Feito
- **Causa:** "Desvincular do funil" só tirava o `lead_id` e desligava o robô naquele momento. Na mensagem seguinte, o webhook (`backend/src/routes/whatsapp.ts`, recebimento) revinculava o lead pelo telefone e rodava toda a fila de agentes (demonstração, CNPJ, Caroline, tira-dúvidas da IA, Laya etc.).
- **Marca permanente:** coluna `WhatsappConversa.fora_do_funil_em` (`backend/prisma/schema.prisma`). Gravada por `dadosSairDoFunil(..., { semAgentes: true })` (`backend/src/services/whatsapp-vinculo.service.ts`) no botão Desvincular e nas etiquetas não comerciais. Também zera a cadência e passa para HUMANO o agente SDR ativo na conversa.
- **Respeitada em:** webhook (sem revincular, sem Laya, só o "SAIR" de campanha), `contatoSemAgentes` (`backend/src/lib/laya.ts`, usado por Caroline, retomadas, lembretes de demonstração, Rafael, indicação), `laya.service.ts`, `routes/leads.ts` (lead da apresentação não revincula a conversa).
- **Volta ao funil:** Identificar › Lead, ou `/whatsapp/abrir` com `lead_id`.
- **Tela:** "· fora do funil, agentes desligados" no cabeçalho (`frontend/app/whatsapp/page.tsx`).
- Docs: 6 de `docs/produto/`, manual, novidades e ESTADO.

## Verificado
- `backend/tests/fora-do-funil.test.ts`: 5 testes passam.
- Suíte inteira: 5 testes falham, e as mesmas falhas aparecem sem esta mudança (testes que dependem de banco).
- `tsc` do backend: nenhum erro novo nos arquivos mexidos. `tsc` do frontend: a página do WhatsApp sem erros.
- **Não verificado:** produção. A sessão não teve permissão para ler o banco, criar a coluna nem publicar.

## Decisões e porquês
- Coluna própria, sem reaproveitar `tipo_contato`/`etiqueta`/`bot_dados`: esses campos têm outro significado e são sobrescritos por outros fluxos.
- Identificar como Cliente **não** marca a conversa, porque o pós-venda deve continuar.
- O "SAIR" de campanha continua valendo (protege o número e o opt-out).

## Pendente
- **Produção (Jessica autoriza ou roda):** 1) backup; 2) `ALTER TABLE WhatsappConversa ADD COLUMN fora_do_funil_em DATETIME(3) NULL;`; 3) `deploy-vps.sh <commit>`. Sem a coluna, o script de deploy recusa a publicação (diferença de esquema), então nada quebra.
- **Conversas já desvinculadas antes desta mudança não têm a marca.** As com etiqueta não comercial e sem lead podem receber a marca com segurança (`UPDATE ... SET fora_do_funil_em=NOW() WHERE lead_id IS NULL AND etiqueta IN ('Financeiro','Renegociação','Serviço','Parceiro','Pessoal','Suporte')`). As desvinculadas pelo botão não dá para identificar com certeza: a Jessica decide se desvincula de novo as que lembrar.
- O card em `novidades-crm.html` está como "Entra no próximo deploy": trocar para "No ar" depois de publicar.

## Próxima sessão
Com permissão na VPS: backup, ALTER, a marca nas conversas com etiqueta não comercial (depois de contar quantas são), deploy do commit desta tarefa, e então trocar o selo das novidades e atualizar o ESTADO.
