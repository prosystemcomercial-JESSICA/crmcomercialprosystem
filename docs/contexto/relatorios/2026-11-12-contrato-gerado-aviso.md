# 12/11/2026 — Contrato gerado pela Marta: coluna Gerado e aviso grande

**Pedido:** "Quando o agente gerar, tem que enviar para a coluna GERADO e me avisar, tanto no painel da TV do escritório como um aviso grande (assim como quando o cliente aceita uma proposta). Faça isso com esse, com efeito sonoro para que eu possa testar, e deixe em torno de 7 segundos na tela."

**O que mudou**
- `backend/src/services/contrato-assinatura.service.ts`: a conferência da Marta, ao terminar sem pendências um contrato em A gerar, passa o contrato para Gerado (`gerado_at` = agora) e emite `contrato_gerado` só para a gestão. Uma conferência simultânea não repete o aviso, porque a troca usa `updateMany` filtrando por A_GERAR.
- `backend/src/services/whatsapp-eventos.service.ts`: o novo tipo de evento.
- `backend/src/services/tv-escritorio.service.ts`: a TV recebe `contratos_gerados` (gerados hoje e ainda em Gerado).
- `frontend/components/dashboard/DashboardLayout.tsx`: cartão grande no centro, com som, por 7 s, e botões "Abrir Contratos" e "Fechar".
- `frontend/app/tv/escritorio/page.tsx`: aviso grande azul "Contrato gerado", com o mesmo som, por 7 s.
- Documentos: os seis de `docs/produto/`, o manual, as novidades e o ESTADO.md.

**Teste com o contrato 56/2026:** pelo registro de hoje, ele está em A gerar e sem pendências. Depois de publicar, abra a TV do Escritório e o CRM (como gestão) e clique em "Conferir com a Marta" no contrato 56. Ele vai para Gerado e os dois avisos aparecem. A TV precisa estar aberta antes do clique, porque na primeira carga ela só memoriza o que já existe.

**Verificação:** a checagem de tipos não mostrou erro nos arquivos alterados, no backend e no frontend. `tests/contrato-assinatura.test.ts` com 9 testes passando. Não há teste automático para a troca de status, porque ela depende do banco. O aviso e o som não foram vistos na tela, porque a publicação depende de aprovação.
