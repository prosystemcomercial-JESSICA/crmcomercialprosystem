# Formulário de captação de leads → CRM Comercial

Para quem vai montar o formulário (site, blog ou landing page) e ligar ao CRM.

## Endereço

`POST https://comercial.prosystemnet.com/api/publico/leads/formulario`

- Sem login. Corpo em **JSON** (`Content-Type: application/json`).
- Sites liberados para enviar: qualquer endereço `https://*.prosystemnet.com` (ou `.com.br`). Se o formulário ficar em outro domínio, peça para incluir em `FORMULARIO_ORIGENS` no servidor.

## Campos

| Campo | Obrigatório | Exemplo | Observação |
|---|---|---|---|
| `nome` | sim | `Maria Souza` | nome da pessoa |
| `telefone` | sim | `(27) 99888-7766` | WhatsApp com DDD (qualquer formato) |
| `email` | não | `maria@farma.com` | |
| `empresa` | não | `Farmácia Boa Saúde` | |
| `segmento` | não | `Farmácia` / `Padaria` | |
| `cidade` | não | `Serra/ES` | cidade/UF |
| `origem` | não | `blog` | de onde veio (vira `FORMULARIO_BLOG`) |
| `material` | não | `Guia do SNGPC` | o que a pessoa pediu |
| `mensagem` | não | texto livre | |
| `pagina` | não | URL da página | |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `gclid` | não | | copie da URL da página |
| `site` | **deixar vazio** | | campo **invisível** anti-robô: esconda no HTML; se vier preenchido, o envio é ignorado |

## Respostas

- `201 {"status":"success"}` — recebido.
- `400 {"status":"error","message":"Preencha seu nome e WhatsApp."}` ou `"Informe o WhatsApp com DDD."` — mostre a mensagem para a pessoa.
- `429` — muitos envios do mesmo endereço em 10 minutos.

## Exemplo (JavaScript)

```js
const r = await fetch('https://comercial.prosystemnet.com/api/publico/leads/formulario', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nome, telefone, email, empresa, segmento, cidade,
    origem: 'blog', material: 'Guia do SNGPC', pagina: location.href,
    utm_source: new URLSearchParams(location.search).get('utm_source') || undefined,
    site: document.querySelector('#site')?.value || '', // campo escondido
  }),
});
const j = await r.json();
if (!r.ok) alert(j.message);
```

## O que acontece no CRM

1. O lead entra **Morno**, **sem dono** (em *Leads para Distribuir*), com origem `FORMULARIO_<ORIGEM>` e as UTMs. Mesmo telefone já cadastrado: não duplica, atualiza.
2. A gestão recebe um **aviso no WhatsApp** com os dados.
3. A **Caroline (agente SDR)** faz o **primeiro contato** no WhatsApp da empresa, entregando o que a pessoa pediu — respeitando o limite diário de primeiros contatos e os horários. Ela **não chama** quem já é cliente ativo, número bloqueado para agentes, quem já está em conversa com um agente ou com alguém da equipe (a gestão é avisada).
