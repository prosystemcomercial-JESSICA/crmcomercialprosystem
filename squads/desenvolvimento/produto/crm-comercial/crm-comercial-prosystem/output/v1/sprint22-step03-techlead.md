# Sprint 22 — Step 03 — Daniel Mendes (Tech Lead)
# Módulo de Serviços Contratados — Arquitetura e Schema

---

## Decisões Arquiteturais

### 1. Roles — estender enum existente
```sql
ALTER TYPE "Role" ADD VALUE 'FINANCEIRO';
ALTER TYPE "Role" ADD VALUE 'TECNICO';
```
Ou em Prisma: extender o enum no schema.prisma (migration manual).

### 2. Tabelas novas (6 modelos principais)
- `ClienteBase` — base de clientes Prosystem (separada de Lead)
- `TipoServico` — catálogo de tipos de serviço
- `ServicoContratado` — entidade central do módulo
- `ServicoAnexo` — anexos do serviço (mesmo padrão Sprint 17)
- `ServicoComunicacao` — mensagens ao cliente no contexto do serviço
- `HistoricoServico` — auditoria de eventos (mesmo padrão HistoricoLead)

### 3. Numeração automática
- Sequência PostgreSQL `srv_numero_seq` → função trigger gera `SRV-YYYY-NNNNN`

### 4. Cache
- node-cache 5min para listagens filtradas
- Sem cache nas abas do drawer (dados frequentemente editados)

### 5. Padrões reutilizados dos sprints anteriores
- Histórico: `registrarHistoricoServico` análogo a `registrarHistorico`
- Anexos: mesma lógica de stream + multer (Sprint 17)
- Permissão: `usePermission` com novas actions

---

## Schema Prisma (migration SQL)

```sql
-- ═══════════════════════════════════════════════
-- STEP 1: Novos valores no enum Role
-- ═══════════════════════════════════════════════
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FINANCEIRO';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TECNICO';

-- ═══════════════════════════════════════════════
-- STEP 2: ClienteBase
-- ═══════════════════════════════════════════════
CREATE TABLE "ClienteBase" (
  "id"                    TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  "codigoInterno"         TEXT UNIQUE,
  "codigoProsystem"       TEXT UNIQUE,
  "razaoSocial"           TEXT NOT NULL,
  "nomeFantasia"          TEXT,
  "cnpj"                  TEXT UNIQUE NOT NULL,
  "inscricaoEstadual"     TEXT,
  "inscricaoMunicipal"    TEXT,
  "segmento"              TEXT NOT NULL,   -- enum: Farmácia, Mercado, etc.
  "statusCliente"         TEXT NOT NULL DEFAULT 'Ativo',
  "planoAtual"            TEXT,
  "dataInicioCliente"     TIMESTAMP,
  "dataUltimaCadastral"   TIMESTAMP,
  -- Contato
  "nomeResponsavel"       TEXT,
  "cargoResponsavel"      TEXT,
  "telefonePrincipal"     TEXT,
  "whatsappPrincipal"     TEXT,
  "emailPrincipal"        TEXT,
  "emailFinanceiro"       TEXT,
  "emailAvisos"           TEXT,
  "melhorHorarioContato"  TEXT,
  "canalPreferencial"     TEXT,
  -- Endereço
  "cep"                   TEXT,
  "endereco"              TEXT,
  "numero"                TEXT,
  "complemento"           TEXT,
  "bairro"                TEXT,
  "cidade"                TEXT,
  "estado"                TEXT,
  -- Operacional (booleans com tri-state via TEXT)
  "quantidadeLojas"       INTEGER DEFAULT 1,
  "quantidadeMaquinas"    INTEGER,
  "possuiServidor"        TEXT DEFAULT 'Não informado',
  "bancoUnico"            TEXT DEFAULT 'Não informado',
  "bancoPorLoja"          TEXT DEFAULT 'Não informado',
  "comunicacaoEntreLojas" TEXT DEFAULT 'Não informado',
  "usaSngpc"              TEXT DEFAULT 'Não informado',
  "usaFarmaciaPopular"    TEXT DEFAULT 'Não informado',
  "usaManipulacao"        TEXT DEFAULT 'Não informado',
  "usaBalanca"            TEXT DEFAULT 'Não informado',
  "usaImpressoraEtiqueta" TEXT DEFAULT 'Não informado',
  "usaImpressoraTermica"  TEXT DEFAULT 'Não informado',
  "usaEmissaoFiscal"      TEXT DEFAULT 'Não informado',
  "usaNfse"               TEXT DEFAULT 'Não informado',
  -- Controle
  "ativo"                 BOOLEAN NOT NULL DEFAULT true,
  "createdAt"             TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "ClienteBase_cnpj_idx" ON "ClienteBase"("cnpj");
CREATE INDEX "ClienteBase_razaoSocial_idx" ON "ClienteBase"("razaoSocial");
CREATE INDEX "ClienteBase_statusCliente_idx" ON "ClienteBase"("statusCliente");

-- ═══════════════════════════════════════════════
-- STEP 3: TipoServico
-- ═══════════════════════════════════════════════
CREATE TABLE "TipoServico" (
  "id"                      TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome"                    TEXT NOT NULL,
  "categoria"               TEXT NOT NULL,
  "descricaoPadrao"         TEXT,
  "valorPadrao"             DECIMAL(10,2),
  "cobrado"                 TEXT NOT NULL DEFAULT 'Sim', -- Sim/Não/Cortesia/A definir
  "exigeAprovacao"          BOOLEAN NOT NULL DEFAULT false,
  "exigePagamentoAntecipado" TEXT NOT NULL DEFAULT 'Não', -- Sim/Não/Depende do valor/Depende da aprovação
  "exigeDesignacaoTecnica"  BOOLEAN NOT NULL DEFAULT true,
  "exigeAgendamento"        TEXT NOT NULL DEFAULT 'Não', -- Sim/Não/Opcional
  "exigeAnexo"              BOOLEAN NOT NULL DEFAULT false,
  "exigeValidacaoCliente"   BOOLEAN NOT NULL DEFAULT false,
  "prazoPadraoDiasUteis"    INTEGER,
  "tempoMedioExecucao"      TEXT,
  "setorResponsavelPadrao"  TEXT,
  "tecnicoResponsavelId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "statusTipo"              TEXT NOT NULL DEFAULT 'Ativo',
  "observacoesInternas"     TEXT,
  "ativo"                   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"               TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- STEP 4: Sequência de numeração
-- ═══════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS "srv_numero_seq" START 1;

-- ═══════════════════════════════════════════════
-- STEP 5: ServicoContratado (tabela central)
-- ═══════════════════════════════════════════════
CREATE TABLE "ServicoContratado" (
  "id"                    TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "numero"                TEXT UNIQUE NOT NULL,  -- SRV-2026-00001 (gerado pelo backend)

  -- Vinculação
  "clienteBaseId"         TEXT NOT NULL REFERENCES "ClienteBase"("id") ON DELETE RESTRICT,
  "tipoServicoId"         TEXT NOT NULL REFERENCES "TipoServico"("id") ON DELETE RESTRICT,
  "lojaSolicitante"       TEXT,

  -- Identificação da solicitação
  "origemSolicitacao"     TEXT,
  "canalEntrada"          TEXT,
  "prioridade"            TEXT NOT NULL DEFAULT 'Normal',
  "statusGeral"           TEXT NOT NULL DEFAULT 'Rascunho',

  -- Solicitante
  "nomeSolicitante"       TEXT,
  "cargoSolicitante"      TEXT,
  "telefoneSolicitante"   TEXT,
  "whatsappSolicitante"   TEXT,
  "emailSolicitante"      TEXT,
  "responsavelAutorizado" TEXT DEFAULT 'Não informado',
  "melhorHorarioSolicitante" TEXT,
  "observacaoContato"     TEXT,

  -- Detalhamento
  "descricaoSolicitacao"  TEXT,
  "problemaNecessidade"   TEXT,
  "resultadoEsperado"     TEXT,
  "lojasEnvolvidas"       TEXT DEFAULT 'Matriz',
  "envolveMatriz"         BOOLEAN DEFAULT true,
  "envolveFilial"         BOOLEAN DEFAULT false,
  "qtdLojasEnvolvidas"    INTEGER DEFAULT 1,
  "qtdMaquinasEnvolvidas" INTEGER,
  "exigeAcessoRemoto"     TEXT DEFAULT 'A definir',
  "exigeAgendamento"      TEXT DEFAULT 'A definir',
  "exigeParadaOperacao"   TEXT DEFAULT 'A definir',
  "exigeBackup"           TEXT DEFAULT 'A definir',
  "prazoDesejadoCliente"  TIMESTAMP,
  "observacoesGerais"     TEXT,

  -- Comercial
  "valorPadrao"           DECIMAL(10,2),
  "valorNegociado"        DECIMAL(10,2),
  "desconto"              DECIMAL(10,2),
  "motivoDesconto"        TEXT,
  "formaPagamento"        TEXT,
  "aprovadoEmData"        TIMESTAMP,
  "aprovadoPorCliente"    TEXT,
  "comoAprovou"           TEXT,
  "observacoesComerciais" TEXT,

  -- Financeiro
  "statusFinanceiro"      TEXT DEFAULT 'Aguardando cobrança',
  "valorCobrado"          DECIMAL(10,2),
  "dataCobranca"          TIMESTAMP,
  "dataVencimento"        TIMESTAMP,
  "dataPagamento"         TIMESTAMP,
  "valorPago"             DECIMAL(10,2),
  "comprovanteAnexoId"    TEXT,
  "liberadoParaExecucao"  BOOLEAN DEFAULT false,
  "dataLiberacao"         TIMESTAMP,
  "liberadoPorId"         TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "observacoesFinanceiro" TEXT,

  -- Técnico
  "setorResponsavel"      TEXT,
  "tecnicoDesignadoId"    TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "complexidade"          TEXT DEFAULT 'Baixa',
  "statusTecnico"         TEXT DEFAULT 'Aguardando designação',
  "prazoDiasUteis"        INTEGER,
  "dataPrevista"          TIMESTAMP,
  "observacoesTecnicas"   TEXT,

  -- Agendamento
  "dataAgendamento"       TIMESTAMP,
  "canalAgendamento"      TEXT,
  "codigoAcesso"          TEXT,
  "confirmacaoCliente"    TEXT DEFAULT 'Aguardando',
  "dataConfirmacao"       TIMESTAMP,
  "quemConfirmou"         TEXT,
  "observacoesAgendamento" TEXT,

  -- Execução
  "dataInicioExecucao"    TIMESTAMP,
  "dataConclusaoExecucao" TIMESTAMP,
  "descricaoExecutado"    TEXT,
  "pendenciasExecucao"    TEXT,
  "validacaoClienteData"  TIMESTAMP,
  "validacaoClienteQuem"  TEXT,
  "validacaoClienteComo"  TEXT,
  "statusFinalExecucao"   TEXT,

  -- Controle
  "lancadoPorId"          TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt"             TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "ServicoContratado_clienteBaseId_idx" ON "ServicoContratado"("clienteBaseId");
CREATE INDEX "ServicoContratado_statusGeral_idx" ON "ServicoContratado"("statusGeral");
CREATE INDEX "ServicoContratado_lancadoPorId_idx" ON "ServicoContratado"("lancadoPorId");
CREATE INDEX "ServicoContratado_tecnicoDesignadoId_idx" ON "ServicoContratado"("tecnicoDesignadoId");
CREATE INDEX "ServicoContratado_prioridade_idx" ON "ServicoContratado"("prioridade");
CREATE INDEX "ServicoContratado_createdAt_idx" ON "ServicoContratado"("createdAt");

-- ═══════════════════════════════════════════════
-- STEP 6: ServicoAnexo
-- ═══════════════════════════════════════════════
CREATE TABLE "ServicoAnexo" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "servicoId"       TEXT NOT NULL REFERENCES "ServicoContratado"("id") ON DELETE CASCADE,
  "nomeOriginal"    TEXT NOT NULL,
  "nomeArquivo"     TEXT NOT NULL,
  "caminho"         TEXT NOT NULL,
  "mimeType"        TEXT NOT NULL,
  "tamanhoBytes"    INTEGER NOT NULL,
  "categoria"       TEXT,  -- Comprovante/Screenshot/Contrato/etc.
  "visibilidade"    TEXT NOT NULL DEFAULT 'Todos',  -- Todos / Interno
  "uploadadoPorId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "ServicoAnexo_servicoId_idx" ON "ServicoAnexo"("servicoId");

-- ═══════════════════════════════════════════════
-- STEP 7: ServicoComunicacao
-- ═══════════════════════════════════════════════
CREATE TABLE "ServicoComunicacao" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "servicoId"       TEXT NOT NULL REFERENCES "ServicoContratado"("id") ON DELETE CASCADE,
  "remetenteId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "destinatarioNome" TEXT NOT NULL,
  "canal"           TEXT NOT NULL,  -- WhatsApp/Email/Ligação/Reunião
  "mensagem"        TEXT NOT NULL,
  "dataEnvio"       TIMESTAMP NOT NULL DEFAULT NOW(),
  "respostaRecebida" BOOLEAN DEFAULT false,
  "dataResposta"    TIMESTAMP,
  "resumoResposta"  TEXT,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "ServicoComunicacao_servicoId_idx" ON "ServicoComunicacao"("servicoId");

-- ═══════════════════════════════════════════════
-- STEP 8: HistoricoServico
-- ═══════════════════════════════════════════════
CREATE TABLE "HistoricoServico" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "servicoId"       TEXT NOT NULL REFERENCES "ServicoContratado"("id") ON DELETE CASCADE,
  "autorId"         TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "tipo"            TEXT NOT NULL,
  "descricao"       TEXT NOT NULL,
  "campoAlterado"   TEXT,
  "valorAnterior"   TEXT,
  "valorNovo"       TEXT,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "HistoricoServico_servicoId_idx" ON "HistoricoServico"("servicoId");
CREATE INDEX "HistoricoServico_createdAt_idx" ON "HistoricoServico"("createdAt");
```

---

## Geração do número SRV

```typescript
// src/lib/gerar-numero-srv.ts
export async function gerarNumeroServico(prisma: PrismaClient): Promise<string> {
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('srv_numero_seq') as nextval
  `
  const seq = Number(result[0].nextval)
  const ano = new Date().getFullYear()
  return `SRV-${ano}-${String(seq).padStart(5, '0')}`
}
```

---

## Função registrarHistoricoServico

```typescript
// src/lib/historico-servico.ts
import { PrismaClient } from '@prisma/client'

type HistoricoServicoInput = {
  servicoId: string
  autorId: string
  tipo: string
  descricao: string
  campoAlterado?: string
  valorAnterior?: string
  valorNovo?: string
}

export async function registrarHistoricoServico(
  input: HistoricoServicoInput,
  prisma: PrismaClient
) {
  return prisma.historicoServico.create({ data: input })
}
```

---

## Tipos de evento para HistoricoServico

```typescript
const EVENTOS_SERVICO = {
  CRIADO:                'servico_criado',
  STATUS_ALTERADO:       'status_alterado',
  STATUS_TECNICO_ALTERADO: 'status_tecnico_alterado',
  STATUS_FINANCEIRO_ALTERADO: 'status_financeiro_alterado',
  TECNICO_DESIGNADO:     'tecnico_designado',
  AGENDADO:              'agendado',
  AGENDAMENTO_CONFIRMADO: 'agendamento_confirmado',
  EXECUCAO_INICIADA:     'execucao_iniciada',
  EXECUCAO_CONCLUIDA:    'execucao_concluida',
  PAGAMENTO_REGISTRADO:  'pagamento_registrado',
  LIBERADO_PARA_EXECUCAO: 'liberado_para_execucao',
  APROVACAO_CLIENTE:     'aprovacao_cliente',
  ARQUIVO_ANEXADO:       'arquivo_anexado',
  ARQUIVO_EXCLUIDO:      'arquivo_excluido',
  COMUNICACAO_REGISTRADA: 'comunicacao_registrada',
  CAMPO_EDITADO:         'campo_editado',
  PRIORIDADE_ALTERADA:   'prioridade_alterada',
  CANCELADO:             'cancelado',
  REABERTO:              'reaberto',
  VALOR_ALTERADO:        'valor_alterado',
}
```

---

## Permissões por role

| Action | VENDEDOR | FINANCEIRO | TECNICO | SUPERVISAO | CEO | ADMIN |
|--------|----------|------------|---------|------------|-----|-------|
| `lancarServico` | ✅ | — | — | ✅ | ✅ | ✅ |
| `verServicosDoTime` | — | ✅ | — | ✅ | ✅ | ✅ |
| `editarComercial` | — | — | — | ✅ | ✅ | ✅ |
| `editarFinanceiro` | — | ✅ | — | ✅ | ✅ | ✅ |
| `designarTecnico` | — | — | — | ✅ | ✅ | ✅ |
| `editarExecucao` | — | — | ✅ | ✅ | ✅ | ✅ |
| `aprovarCortesia` | — | — | — | ✅ | ✅ | ✅ |
| `gerenciarCatalogo` | — | — | — | — | ✅ | ✅ |
| `gerenciarClienteBase` | — | — | — | ✅ | ✅ | ✅ |
| `importarClienteBase` | — | — | — | ✅ | ✅ | ✅ |
| `verAnexosInternos` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `excluirQualquerAnexoServico` | — | — | — | ✅ | ✅ | ✅ |

---

## Estrutura de diretórios backend

```
src/modules/servicos/
├── servico.routes.ts
├── servico.service.ts
├── cliente-base.routes.ts
├── cliente-base.service.ts
├── tipo-servico.routes.ts
└── tipo-servico.service.ts

src/lib/
├── gerar-numero-srv.ts
└── historico-servico.ts

uploads/servicos/{servicoId}/{ano}/{mes}/{uuid}-{nome}.{ext}
```

---

## Decisões finais

1. **Campos operacionais do ClienteBase:** tri-state via TEXT ('Sim' | 'Não' | 'Não informado' | 'Não se aplica') — evita NULL problems
2. **Todos os status como TEXT:** evita proliferação de enums no Prisma; validação no service layer
3. **ServicoAnexo separado:** permite query específica e controle de visibilidade independente
4. **Sem FK para Lead:** ClienteBase é entidade totalmente separada — integração futura via CNPJ matching
5. **dataPrevista calculada no backend:** `dataLancamento + prazoDiasUteis * 1.4` (fator fins de semana)

---

## Sprint 22 — TECH LEAD PRONTO ✅
