# 04/11/2026: stories com link viram atividades da Jessica, com lembrete no WhatsApp

## Pedido
Jessica, com o link https://claude.ai/artifact/MtYZisF1EKc3gEZrH2YmbC: "Preciso que coloque essas postagens como atividade para mim, e me lembre no whatsapp para que eu possa postar".

## Feito
- Entram só os **8 stories com figurinha de link**, porque os outros 28 saem pela publicação automática: 05/11, 12/11, 25/11, 07/01, 12/01, 14/01, 22/01 e 30/01, às 17h.
- Lembrete novo: `lembrarResponsavelAtividades` (`backend/src/services/lembrete-atividade.service.ts`, regras em `backend/src/lib/lembrete-atividade.ts`), chamado no agendador do assistente (`backend/src/server.ts`, logo após `lembrarResponsavelDemo`).
  - Atividade `vinculo_tipo MARKETING` com responsável recebe WhatsApp e push 1 h antes, todos os dias.
  - Envio uma única vez por atividade.
- Script das atividades: `backend/scripts/criar-atividades-stories-link.cjs`. Sem `--gravar` só mostra o que faria; não duplica.
- Documentos: os 6 de `docs/produto/`, o manual, as novidades e o ESTADO.md (entrada de 04/11).

## Verificado
- `tests/lembrete-atividade.test.ts`: 2 testes passando.
- `tsc` sem erros nos arquivos novos.
- O lembrete roda antes da trava de horário comercial, então também funciona no sábado.
- **Não verificado:** produção. O modo automático bloqueou a leitura do banco, então ainda não houve deploy, o script não rodou e o telefone da Jessica no usuário do CRM não foi conferido.

## Decisões e porquês
- Usei um lembrete genérico para atividades de marketing, e não um agendamento local (cron da sessão), que morreria antes de janeiro.
- Fiz o mesmo molde de `lembrarResponsavelDemo`.
- O commit leva só a minha linha do `server.ts`, porque outra sessão tem mudanças do Heitor sem commit nesse arquivo.

## Pendente
- A Jessica autoriza o acesso à produção. Depois: deploy do commit e `node scripts/criar-atividades-stories-link.cjs --gravar --telefone=<REMOVIDO>` no servidor (número no arquivo local), antes das 16h de 05/11.
- Número do lembrete: a Jessica pediu um número próprio para estes avisos. Ele fica na chave `lembrete_atividade.telefone.<usuarioId>`, e o cadastro dela não muda.

## Próxima sessão
- Rodar o script sem `--gravar` no servidor e conferir que acha uma única usuária Jessica com telefone cadastrado.
- Depois, fazer o deploy com `deploy-vps.sh <commit>` e rodar o script com `--gravar`.
