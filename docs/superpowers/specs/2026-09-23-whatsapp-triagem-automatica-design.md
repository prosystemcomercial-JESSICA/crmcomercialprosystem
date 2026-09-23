# Triagem automática no WhatsApp da empresa — design

Data: 2026-09-23 · Base: branch `feature/whatsapp-instancia-unica` (em produção, comercial.prosystemnet.com)
Aprovado em conversa com a usuária (Jessica, Supervisão Comercial).

## Objetivo

Todo **número novo** que escreve para o WhatsApp da empresa (5527997521370) passa por um robô com botões que
descobre o motivo do contato, qualifica o lead (segmento, relação com a Prosystem, nome, cidade, CNPJ validado na
Receita) e entrega ao time comercial um lead completo na aba **Sem dono**, com **alarme sonoro**. Suporte e Financeiro
são desviados para o contato geral sem ocupar o comercial.

Sucesso = o vendedor recebe o lead já com dados da Receita preenchidos, sem precisar perguntar nada básico, e
ninguém perde um lead novo porque não viu a notificação.

## Decisões da usuária

- Triagem **só para número novo** (primeira conversa com a empresa). Quem já tem conversa não passa pelo robô.
- Número que já é **cliente da base** → pula a triagem e recebe o menu reduzido **Serviços / Suporte / Financeiro**.
- Consulta de CNPJ na Receita (API pública); **pegar tudo que a API devolver**: o que tem campo no lead vai no campo,
  o resto vai em observação no lead.
- CNPJ **baixado/inativo é aceito**, com **aviso em vermelho** na conversa e no lead.
- **Confirmação com botões** do CNPJ ("É a Empresa X, de Cidade/UF?" Sim / Não, digitar de novo).
- **Serviços** vai para Sem dono (oportunidade comercial).
- **Alarme sonoro** toca quando a triagem termina e o lead cai em Sem dono (Quero conhecer ou Serviços).
- Material final ("ferramentas") por segmento ainda não existe → área em Configurações para cadastrar depois.

## Fluxo do robô

Limite do WhatsApp: mensagem com botões aceita no máximo 3 botões; 4+ opções usam **menu de lista**
(`/send/menu` da UAZAPI, `type: list`). Todo menu tem id por opção; o clique chega no webhook no campo
`buttonOrListid` da mensagem.

1. **Menu inicial** (número novo, não cliente) — lista "Ver opções":
   - `conhecer` Quero conhecer · `servicos` Serviços · `suporte` Suporte · `financeiro` Financeiro
   Texto: saudação da Prosystem + "Como podemos te ajudar?".
2. **Menu de cliente da base** (número bate com cliente cadastrado) — 3 botões:
   saudação com o nome do cliente + `servicos` Serviços · `suporte` Suporte · `financeiro` Financeiro.
3. **Suporte** → "Para suporte, fale com nosso atendimento geral: 27 99779-8103." Etiqueta `Suporte`. Fim.
4. **Financeiro** → "Para assuntos financeiros, o contato correto é o geral: 27 99779-8103." Etiqueta `Financeiro`. Fim.
5. **Serviços** → pergunta "Que tipo de serviço você precisa?" (texto livre) → "Recebemos seu pedido! Um consultor
   vai te atender em breve." Grava o pedido na conversa e no lead (observação). Fim com **alarme**.
6. **Quero conhecer**:
   1. Botões `padaria` Padaria · `farmacia` Farmácia.
   2. "Você já é cliente Prosystem?" botões `cliente` Sou cliente · `ex_cliente` Já fui cliente · `nao_conhece` Não conheço a Prosystem.
   3. "Qual é o seu nome?" (texto livre, mínimo 2 letras).
   4. "De qual cidade você está falando?" (texto livre, mínimo 2 letras).
   5. "Qual é o CNPJ da empresa?" → validação (seção CNPJ). Inválido → explica e pede de novo (não avança).
   6. Válido → botões "É a *{razão social ou nome fantasia}*, de *{município}/{UF}*?" `cnpj_sim` Sim · `cnpj_nao` Não, digitar de novo.
      Não → volta ao passo 5. Se a Receita não respondeu (só dígitos conferidos), pula a confirmação.
   7. Mensagem final: "Obrigado, {nome}! Nossa especialista recebeu seu contato e vai retornar o mais breve possível.
      Enquanto isso, aqui estão algumas ferramentas que temos para evoluir com você na sua {farmácia|padaria}:"
      + material do segmento (se cadastrado; se não, só a primeira frase). Fim com **alarme**.
- **Texto em vez de clique** num passo de botões/lista: o robô aceita se o texto casar com uma opção
  (ex.: "farmacia", "2", "suporte"); senão repete a pergunta com "Por favor, escolha uma das opções abaixo".
- **Vendedor interveio**: qualquer mensagem enviada pelo CRM (texto, áudio, arquivo, reunião) ou digitada no
  celular da empresa na conversa desliga o robô daquela conversa na hora.
- Números (grupos/broadcast) já são ignorados antes; robô nunca roda para eles.

## CNPJ

- Normaliza para 14 dígitos; confere dígitos verificadores (rejeita também 14 dígitos iguais).
- Consulta `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}` (timeout 8 s). Falha/indisponível → tenta
  `https://open.cnpja.com/office/{cnpj}` (gratuita). Ambas falham → aceita só com os dígitos conferidos, anota
  "não consultado na Receita".
- 404 em todas as fontes consultadas → "Não encontramos esse CNPJ na Receita" e pede de novo.
- Situação diferente de ATIVA → aceita, marca **aviso vermelho** (conversa e lead) com a situação (BAIXADA, INAPTA, SUSPENSA, NULA).
- Campos do lead preenchidos (sem apagar valor já existente com vazio):
  `cnpj`, `razao_social`, `empresa` (= razão social), `nome_fantasia`, `segmento` (Padaria/Farmácia escolhido),
  `cidade`/`estado` (Receita; se não consultado, a cidade digitada), `endereco` (logradouro, número, complemento,
  bairro, CEP, município/UF), `responsavel_nome` (nome digitado), telefone da Receita se o lead não tiver.
- Observação no lead "Dados da Receita": situação cadastral e data, CNAE principal (código e descrição) e secundários,
  porte, natureza jurídica, data de abertura, capital social, e-mail/telefones da Receita, **sócios (nome e
  qualificação)**, opção pelo Simples/MEI se vier, cidade digitada pelo cliente, relação com a Prosystem
  (cliente / ex-cliente / não conhece) e fonte consultada.

## CRM

- **Aba Sem dono**: conversa aparece desde a primeira mensagem com selo **🤖 Em triagem** enquanto o robô atua.
- **Fim de Quero conhecer / Serviços**: etiqueta do segmento (Padaria/Farmácia) ou `Serviços`; prioridade **CRITICA**
  (alta) se CNPJ ativo, NORMAL caso contrário; lead atualizado; evento SSE `lead_qualificado` para **todos** os
  usuários conectados.
- **Alarme**: o frontend (layout global, qualquer tela) toca um som e mostra aviso "Novo lead qualificado: {empresa} —
  {cidade/UF}" com link para a conversa. Limitação do navegador: só toca depois de alguma interação do usuário na página.
- **Aviso vermelho**: selo "CNPJ {situação} na Receita" no cabeçalho da conversa, no painel lateral e na lista.
- **Configurações → Triagem** (gestão): liga/desliga a triagem; material de **Farmácia** e de **Padaria**, cada um com
  texto (pode ter links), imagem opcional e PDF opcional. Enviados na ordem texto → imagem → PDF.

## Dados (mudanças aditivas)

- `WhatsappConversa.bot_dados Json?` — respostas da triagem (fluxo, segmento, relação, nome, cidade, cnpj, resultado da
  Receita resumido, situação) — e `bot_estado` passa a guardar os estados novos.
- Configuração da triagem e material em `ConfiguracaoIntegracao` (chave/valor), chaves `whatsapp.triagem.*`
  (material pode conter base64; coluna `valor` é TEXT → ampliar para LONGTEXT, aditivo).
- O robô antigo (`processarBot` + `WHATSAPP_BOT_ATIVO`) é substituído pela triagem na instância da empresa.

## Envio (UAZAPI)

- Menus via `POST /send/menu` (`type: button` com `choices: ["Texto|id", ...]`, ou `type: list` com `listButton`
  e seção). Texto via `/send/text`; material via `/send/media`.
- Mensagens do robô gravadas como SAIDA com `enviada_por: 'bot'` (já existe exibição "🤖 Atendimento automático").

## Testes

- Unitários: máquina de estados (cada transição, texto em vez de clique, voltar do "Não, digitar de novo",
  cliente da base, intervenção do vendedor), validação de CNPJ (dígitos, repetidos, formatação), mapeamento da resposta
  da BrasilAPI e da CNPJá para campos do lead + observação, fallback entre fontes, parser do `buttonOrListid`,
  corpo do `/send/menu`. `fetch` sempre mockado.
- Manual em produção: fluxo completo com celular de teste (Farmácia com CNPJ ativo, CNPJ inválido, CNPJ baixado,
  Suporte, Financeiro, Serviços, cliente da base) e alarme.

## Fora de escopo

- Editar os textos do robô pela tela (ficam no código; ajustar é mudança pequena).
- Construtor visual de fluxos, horário de atendimento, resgate automático e biblioteca de mensagens (próximos projetos).
