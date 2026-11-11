# Escritório vivo (10/11/2026)

## Pedido
A Jessica achou que o Escritório e o painel não ficaram bons. Pediu um design diferente, mais fluido e mais bonito, em que
ela veja os agentes se movimentando, conversando e usando os espaços, e a revisão da tela inteira.

## O que mudou
- **Sala nova (`frontend/components/escritorio/SalaViva.tsx`)**, no lugar da sala isométrica (`SalaIsometrica.tsx`, apagada):
  - planta baixa com uma sala por setor (Entrada de leads, Vendas, Inteligência e treino, Clientes e gestão), Sala de reunião,
    Café e lounge e Sala da Jessica, ligadas por corredores;
  - movimento suave: a posição de cada boneco é escrita direto no elemento a cada quadro (antes a sala inteira era redesenhada
    24 vezes por segundo);
  - quem passa trabalho para outro agente vai até a mesa dele, e os dois trocam balões. A fila sai das conversas registradas
    entre agentes e das passagens de hoje do painel, por exemplo "Leads cadastrados: 30 hoje";
  - quem trabalha digita (braços e reticências) e mostra no balão a última ação; quem está parado vai ao café e conversa;
    desligado cochila; com erro fica com o chão vermelho piscando e um "!"; quem tem algo para aprovar mostra "✋";
  - clicar no nome de uma sala escolhe aquele setor (as outras salas esmaecem); clicar num agente abre o quadro dele;
  - relógio de São Paulo na sala da Jessica e um tom leve de noite depois das 19h.
- **Tela (`app/escritorio/page.tsx`, `components/escritorio/painel/*`)**:
  - cabeçalho com selo "Ao vivo";
  - faixa de saúde compacta;
  - abas horizontais de setores e de gestão no lugar do menu lateral;
  - a sala grande com o painel "Agora no escritório" ao lado (`FeedAoVivo.tsx`), que mostra quantos itens esperam a Jessica,
    quem parou, as últimas ações e quem passou trabalho para quem;
  - ao clicar num agente, o quadro dele e uma linha do tempo do que fez aparecem logo abaixo da sala;
  - depois vêm os quadros do setor.
- Saíram o zoom, o andar com as setas e o balão de proximidade da Jessica.
- "Reunir a equipe", "Chamar à minha sala", a simulação e os balões do treinamento continuam.

## Conferido
- Tipos ok (`tsc`); lint dos arquivos novos sem erros.
- Prévia local com dados de exemplo, no computador (1440 px) e no celular (390 px), sem rolagem lateral da página.
  No celular a sala rola para o lado dentro do quadro dela.
- Vi a visita da Laya à Caroline, a conversa no café e o destaque do setor Vendas.

## Não conferido
- A tela completa com login e dados reais só foi vista depois do deploy (a prévia usou só a sala e o painel ao vivo).
