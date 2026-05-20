# Sprint 33 — Step 01 — André Vieira (PM)
# Softphone Integrado

## Contexto

Os vendedores da ProSystem fazem ligações comerciais diariamente. Atualmente, precisam usar o celular ou PABX externo e registrar manualmente no CRM o resultado. O Softphone Integrado permite ligar diretamente pelo navegador web (via WebRTC/SIP) com registro automático de chamada no histórico do lead — eliminando o registro manual e capturando tempo de duração e gravação.

## User Stories

**US-3301:** Como Vendedor, quero iniciar uma chamada VoIP para o telefone de um lead com um clique no botão "Ligar" da ficha, sem precisar abrir telefone externo ou digitar o número.

**US-3302:** Como Vendedor, quero ver um softphone flutuante na tela durante a chamada, com: número discado, nome do lead, cronômetro de duração, botões de mudo/encerrar.

**US-3303:** Como sistema, quero registrar automaticamente uma atividade do tipo "Ligação" no histórico do lead ao encerrar a chamada, com duração, status (atendida/não atendida/ocupado) e opção de preencher resultado.

**US-3304:** Como Vendedor, quero ver o histórico de chamadas feitas pelo softphone na ficha do lead, com data, duração e status.

**US-3305:** Como Supervisora/CEO, quero ver um painel de chamadas em tempo real: quais vendedores estão em ligação agora, duração da chamada em andamento.

**US-3306:** Como Supervisora/CEO, quero ver um relatório de chamadas por período: total de chamadas, duração média, taxa de atendimento, por vendedor.

**US-3307:** Como Admin, quero configurar as credenciais SIP do provedor VoIP (host, usuário, senha, codec) via painel de configurações do CRM.

**US-3308:** Como sistema, quero gravar opcionalmente as chamadas e armazená-las vinculadas ao lead para consulta futura.

## Critérios de Aceite

**US-3301:**
- Botão "📞 Ligar" na ficha do lead e na lista de leads (apenas se lead tem telefone)
- Clique inicia conexão SIP via JsSIP ou SIP.js (WebRTC no browser)
- Toca ringback tone enquanto aguarda atendimento
- Permissão de microfone solicitada no primeiro uso

**US-3302:**
- Componente `SoftphoneWidget` fixo no canto inferior direito (z-index alto, não interfere na UI)
- Estados: idle | discando | em chamada | encerrada
- Cronômetro de duração em tempo real (MM:SS)
- Botões: 🔇 Mudo | 📞 Encerrar
- Pill com nome do lead + número discado
- Minimizável para apenas uma barra

**US-3303:**
- Ao encerrar: drawer lateral abre automaticamente com campos pré-preenchidos:
  - Tipo: Ligação (fixo)
  - Duração: calculada automaticamente
  - Status: detectado via SIP (200 OK = Atendida; 486 Ocupado; 408/487 Não Atendida)
  - Resultado: campo livre para o vendedor preencher
  - Próximo contato: DateTimePicker
- Botão "Salvar" cria atividade + POST /atividades
- Botão "Pular" fecha sem criar (chamada registrada sem atividade)

**US-3304:**
- Aba "Chamadas" na ficha do lead (7ª aba)
- Lista com: data/hora, duração, status badge, resultado (se preenchido), ícone de gravação (se existir)
- Gravação: botão play inline que abre player de áudio

**US-3305:**
- Widget no Dashboard da Supervisora: "Chamadas em andamento"
- Lista: foto/nome do vendedor, lead discado, duração atual
- Atualiza via polling 10s

**US-3306:**
- `GET /api/softphone/relatorio?inicio=&fim=&vendedorId=`
- Retorna: totalChamadas, atendidas, naoAtendidas, ocupadas, duracaoMedia (seg), por vendedor
- Export XLSX com detalhe por chamada

**US-3307:**
- Tela `/configuracoes/softphone` (apenas ADMIN)
- Campos: SIP Host, SIP User, SIP Password (mascarado), SIP Port (default 5060), STUN Server, codec preferido (G.711/G.722)
- Test button: valida registro SIP e retorna "Conectado ✅" ou erro

**US-3308:**
- Gravação habilitada via config `SOFTPHONE_GRAVACAO=true`
- Gravação feita no lado do servidor via Asterisk/FreeSWITCH (não no browser)
- Arquivo armazenado em storage (S3 ou local); URL salva em `Chamada.gravacaoUrl`
- Player de áudio na ficha do lead e no relatório

## Modelo de Dados

```
Chamada {
  id, leadId, usuarioId
  numeroDiscado, duracao (seg), status (ATENDIDA|NAO_ATENDIDA|OCUPADO|ERRO)
  gravacaoUrl?, sipCallId (idempotência)
  criadoEm
}
```

## Acesso por Perfil

| Ação | VENDEDOR | SUPERVISAO | CEO | ADMIN |
|------|----------|------------|-----|-------|
| Usar softphone | ✅ | ✅ | ✅ | ✅ |
| Ver histórico de chamadas do lead | ✅ (próprio) | ✅ | ✅ | ✅ |
| Ver painel em tempo real | ❌ | ✅ | ✅ | ✅ |
| Ver relatório de chamadas | ❌ | ✅ | ✅ | ✅ |
| Configurar SIP | ❌ | ❌ | ❌ | ✅ |

## Stack do Softphone

- **WebRTC/SIP:** `jssip` (biblioteca SIP para browser — WebRTC nativo)
- **STUN:** Google STUN (`stun:stun.l.google.com:19302`) como fallback público
- **Servidor VoIP:** Asterisk ou FreeSWITCH (provisionado pelo cliente — o CRM é agnóstico ao servidor)
- **Gravação:** gerenciada pelo servidor VoIP; CRM apenas salva a URL do arquivo
- **Tabela nova:** `Chamada`

## Fora do Escopo

- Receber chamadas entrantes (apenas originação no MVP)
- Transferência de chamada
- Conferência (3 vias)
- Integração com número 0800
