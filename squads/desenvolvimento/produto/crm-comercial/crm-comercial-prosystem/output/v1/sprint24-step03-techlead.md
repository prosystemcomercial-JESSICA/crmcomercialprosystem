# Sprint 24 — Step 03 — Daniel Mendes (Tech Lead)
# Módulo de Metas e Comissões — Arquitetura e Schema

---

## Decisões de Arquitetura

### Motor de Comissão como Serviço Isolado

```
src/
  modules/
    metas-comissoes/
      parceiro/
        parceiro.service.ts
        parceiro.routes.ts
      meta/
        meta.service.ts
        meta.routes.ts
      regra-comissao/
        regra-comissao.service.ts
        regra-comissao.routes.ts
      comissao/
        comissao.service.ts       ← motor de cálculo isolado
        comissao.routes.ts
      recebimento/
        recebimento.service.ts
        recebimento.routes.ts
      indicacao-parceiro/
        indicacao-parceiro.service.ts
        indicacao-parceiro.routes.ts
```

**Ponto central:** `comissao.service.ts` expõe:
- `calcularComissaoContrato(contratoId, prisma)`
- `calcularComissaoServico(servicoId, prisma)`
- `calcularComissaoIndicacao(indicacaoId, prisma)`
- `verificarLiberacaoComissoes(recebimentoId, prisma)`

Todos chamados por hooks nos services de Contrato, ServicoContratado, Recebimento e IndicacaoParceiro.

---

## Enums Prisma (schema.prisma — adições)

```prisma
enum TipoMeta {
  CONTRATOS_FECHADOS
  MRR_NOVO
  RECEITA_INSTALACAO
  RECEITA_TOTAL_RECEBIDA
  PROPOSTAS_ENVIADAS
  APRESENTACOES_REALIZADAS
  LEADS_TRABALHADOS
  LEADS_QUALIFICADOS
  SERVICOS_VENDIDOS
  INDICACOES_REALIZADAS
  INDICACOES_CONVERTIDAS
  RECEITA_INDICACOES
  META_PERSONALIZADA
}

enum StatusMeta {
  RASCUNHO
  ATIVA
  PAUSADA
  ENCERRADA
  CANCELADA
  REVISADA
}

enum ExigeRecebimento {
  SIM
  NAO
  APENAS_ENTRADA
  APENAS_PRIMEIRA_MENSALIDADE
  ENTRADA_MAIS_PRIMEIRA_MENSALIDADE
}

enum PermiteComissaoSemMeta {
  SIM
  NAO
  PARCIALMENTE
  DEPENDE_APROVACAO
}

enum TipoComissao {
  PERCENTUAL
  VALOR_FIXO
  PERCENTUAL_POR_FAIXA
  VALOR_FIXO_POR_FAIXA
  MISTA
  MANUAL
  SEM_COMISSAO
}

enum BaseCalculoComissao {
  VALOR_INSTALACAO_VENDIDA
  VALOR_INSTALACAO_RECEBIDA
  VALOR_MENSALIDADE
  MRR_FECHADO
  PRIMEIRA_MENSALIDADE_RECEBIDA
  VALOR_TOTAL_CONTRATO_12M
  VALOR_SERVICO_VENDIDO
  VALOR_SERVICO_RECEBIDO
  VALOR_INDICACAO_CONVERTIDA
  VALOR_FIXO_POR_CONTRATO
  VALOR_FIXO_POR_SERVICO
  VALOR_FIXO_POR_INDICACAO
  PERSONALIZADO
}

enum StatusRegraComissao {
  ATIVA
  INATIVA
  EM_TESTE
  ENCERRADA
  AGUARDANDO_APROVACAO
  CANCELADA
}

enum DependeRecebimento {
  SIM
  NAO
  APENAS_ENTRADA
  APENAS_PRIMEIRA_MENSALIDADE
  ENTRADA_MAIS_PRIMEIRA_MENSALIDADE
  VALOR_TOTAL_RECEBIDO
}

enum StatusComissao {
  PREVISTA
  AGUARDANDO_RECEBIMENTO
  AGUARDANDO_APROVACAO
  LIBERADA
  PAGA
  BLOQUEADA
  CANCELADA
  RECALCULADA
  EM_ANALISE
}

enum TipoReceita {
  INSTALACAO
  MENSALIDADE
  SERVICO
  UPGRADE
  INDICACAO
  OUTRO
}

enum OrigemReceita {
  NOVO_CLIENTE
  CLIENTE_ANTIGO_RETORNANDO
  UPGRADE_PLANO
  LOJA_ADICIONAL
  COMUNICACAO_LOJAS
  SERVICO_AVULSO
  PROJETO_PERSONALIZADO
}

enum FormaPagamento {
  A_VISTA
  ENTRADA_PARCELAS
  CARTAO_CREDITO
  CARTAO_DEBITO
  PIX
  BOLETO
  TRANSFERENCIA
  OUTRO
}

enum StatusRecebimento {
  PENDENTE
  PARCIALMENTE_RECEBIDO
  RECEBIDO
  VENCIDO
  CANCELADO
  DEVOLVIDO
  RENEGOCIADO
  EM_DISPUTA
  CORTESIA
  ISENTO
  AGUARDANDO_COMPENSACAO
}

enum StatusComissaoRecebimento {
  PREVISTA
  AGUARDANDO
  LIBERADA
  PAGA
  BLOQUEADA
}

enum StatusParceiro {
  ATIVO
  INATIVO
  EM_NEGOCIACAO
  SUSPENSO
  BLOQUEADO
  ENCERRADO
}

enum CategoriaParceiro {
  TEF
  CERTIFICADO_DIGITAL
  CONTABILIDADE
  EQUIPAMENTOS
  IMPRESSORAS
  BALANCAS
  ECOMMERCE
  DELIVERY
  PBM
  MARKETING
  TELEFONIA
  INTERNET
  AUTOMACAO_COMERCIAL
  CONSULTORIA
  OUTRO
}

enum TipoIntegracaoParceiro {
  INTEGRACAO_ATIVA
  INTEGRACAO_EM_DESENVOLVIMENTO
  INTEGRACAO_MANUAL
  PARCEIRO_COMERCIAL_SEM_INTEGRACAO
  SEM_INTEGRACAO
  A_DEFINIR
}

enum TipoComissaoParceiro {
  PERCENTUAL
  VALOR_FIXO
  POR_CONVERSAO
  POR_INDICACAO_ENVIADA
  MANUAL
  SEM_COMISSAO
}

enum StatusIndicacao {
  LANCADA
  ENVIADA_AO_PARCEIRO
  AGUARDANDO_RETORNO
  PARCEIRO_ENTROU_EM_CONTATO
  CLIENTE_EM_NEGOCIACAO
  CONVERTIDA
  NAO_CONVERTIDA
  CANCELADA
  COMISSAO_LIBERADA
  COMISSAO_PAGA
}

enum ConfirmacaoParceiro {
  SIM
  NAO
  AGUARDANDO_CONFIRMACAO
}

enum StatusConversao {
  SIM
  NAO
  EM_NEGOCIACAO
  AGUARDANDO_RETORNO
  NAO_INFORMADO
}

enum AprovacaoSupervisao {
  SIM
  NAO
  AGUARDANDO_APROVACAO
  REPROVADO
}
```

---

## Migrations SQL

```sql
-- ────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────
CREATE TYPE "TipoMeta" AS ENUM (
  'CONTRATOS_FECHADOS','MRR_NOVO','RECEITA_INSTALACAO','RECEITA_TOTAL_RECEBIDA',
  'PROPOSTAS_ENVIADAS','APRESENTACOES_REALIZADAS','LEADS_TRABALHADOS',
  'LEADS_QUALIFICADOS','SERVICOS_VENDIDOS','INDICACOES_REALIZADAS',
  'INDICACOES_CONVERTIDAS','RECEITA_INDICACOES','META_PERSONALIZADA'
);

CREATE TYPE "StatusMeta" AS ENUM (
  'RASCUNHO','ATIVA','PAUSADA','ENCERRADA','CANCELADA','REVISADA'
);

CREATE TYPE "ExigeRecebimento" AS ENUM (
  'SIM','NAO','APENAS_ENTRADA','APENAS_PRIMEIRA_MENSALIDADE',
  'ENTRADA_MAIS_PRIMEIRA_MENSALIDADE'
);

CREATE TYPE "PermiteComissaoSemMeta" AS ENUM (
  'SIM','NAO','PARCIALMENTE','DEPENDE_APROVACAO'
);

CREATE TYPE "TipoComissao" AS ENUM (
  'PERCENTUAL','VALOR_FIXO','PERCENTUAL_POR_FAIXA','VALOR_FIXO_POR_FAIXA',
  'MISTA','MANUAL','SEM_COMISSAO'
);

CREATE TYPE "BaseCalculoComissao" AS ENUM (
  'VALOR_INSTALACAO_VENDIDA','VALOR_INSTALACAO_RECEBIDA','VALOR_MENSALIDADE',
  'MRR_FECHADO','PRIMEIRA_MENSALIDADE_RECEBIDA','VALOR_TOTAL_CONTRATO_12M',
  'VALOR_SERVICO_VENDIDO','VALOR_SERVICO_RECEBIDO','VALOR_INDICACAO_CONVERTIDA',
  'VALOR_FIXO_POR_CONTRATO','VALOR_FIXO_POR_SERVICO','VALOR_FIXO_POR_INDICACAO',
  'PERSONALIZADO'
);

CREATE TYPE "StatusRegraComissao" AS ENUM (
  'ATIVA','INATIVA','EM_TESTE','ENCERRADA','AGUARDANDO_APROVACAO','CANCELADA'
);

CREATE TYPE "DependeRecebimento" AS ENUM (
  'SIM','NAO','APENAS_ENTRADA','APENAS_PRIMEIRA_MENSALIDADE',
  'ENTRADA_MAIS_PRIMEIRA_MENSALIDADE','VALOR_TOTAL_RECEBIDO'
);

CREATE TYPE "StatusComissao" AS ENUM (
  'PREVISTA','AGUARDANDO_RECEBIMENTO','AGUARDANDO_APROVACAO','LIBERADA',
  'PAGA','BLOQUEADA','CANCELADA','RECALCULADA','EM_ANALISE'
);

CREATE TYPE "TipoReceita" AS ENUM (
  'INSTALACAO','MENSALIDADE','SERVICO','UPGRADE','INDICACAO','OUTRO'
);

CREATE TYPE "OrigemReceita" AS ENUM (
  'NOVO_CLIENTE','CLIENTE_ANTIGO_RETORNANDO','UPGRADE_PLANO','LOJA_ADICIONAL',
  'COMUNICACAO_LOJAS','SERVICO_AVULSO','PROJETO_PERSONALIZADO'
);

CREATE TYPE "FormaPagamento" AS ENUM (
  'A_VISTA','ENTRADA_PARCELAS','CARTAO_CREDITO','CARTAO_DEBITO',
  'PIX','BOLETO','TRANSFERENCIA','OUTRO'
);

CREATE TYPE "StatusRecebimento" AS ENUM (
  'PENDENTE','PARCIALMENTE_RECEBIDO','RECEBIDO','VENCIDO','CANCELADO',
  'DEVOLVIDO','RENEGOCIADO','EM_DISPUTA','CORTESIA','ISENTO',
  'AGUARDANDO_COMPENSACAO'
);

CREATE TYPE "StatusComissaoRecebimento" AS ENUM (
  'PREVISTA','AGUARDANDO','LIBERADA','PAGA','BLOQUEADA'
);

CREATE TYPE "StatusParceiro" AS ENUM (
  'ATIVO','INATIVO','EM_NEGOCIACAO','SUSPENSO','BLOQUEADO','ENCERRADO'
);

CREATE TYPE "CategoriaParceiro" AS ENUM (
  'TEF','CERTIFICADO_DIGITAL','CONTABILIDADE','EQUIPAMENTOS','IMPRESSORAS',
  'BALANCAS','ECOMMERCE','DELIVERY','PBM','MARKETING','TELEFONIA',
  'INTERNET','AUTOMACAO_COMERCIAL','CONSULTORIA','OUTRO'
);

CREATE TYPE "TipoIntegracaoParceiro" AS ENUM (
  'INTEGRACAO_ATIVA','INTEGRACAO_EM_DESENVOLVIMENTO','INTEGRACAO_MANUAL',
  'PARCEIRO_COMERCIAL_SEM_INTEGRACAO','SEM_INTEGRACAO','A_DEFINIR'
);

CREATE TYPE "TipoComissaoParceiro" AS ENUM (
  'PERCENTUAL','VALOR_FIXO','POR_CONVERSAO','POR_INDICACAO_ENVIADA',
  'MANUAL','SEM_COMISSAO'
);

CREATE TYPE "StatusIndicacao" AS ENUM (
  'LANCADA','ENVIADA_AO_PARCEIRO','AGUARDANDO_RETORNO',
  'PARCEIRO_ENTROU_EM_CONTATO','CLIENTE_EM_NEGOCIACAO','CONVERTIDA',
  'NAO_CONVERTIDA','CANCELADA','COMISSAO_LIBERADA','COMISSAO_PAGA'
);

CREATE TYPE "ConfirmacaoParceiro" AS ENUM (
  'SIM','NAO','AGUARDANDO_CONFIRMACAO'
);

CREATE TYPE "StatusConversao" AS ENUM (
  'SIM','NAO','EM_NEGOCIACAO','AGUARDANDO_RETORNO','NAO_INFORMADO'
);

CREATE TYPE "AprovacaoSupervisao" AS ENUM (
  'SIM','NAO','AGUARDANDO_APROVACAO','REPROVADO'
);

-- ────────────────────────────────────────────────
-- TABELA: Parceiro
-- ────────────────────────────────────────────────
CREATE TABLE "Parceiro" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "nome"                TEXT NOT NULL,
  "cnpj"                TEXT,
  "categoria"           "CategoriaParceiro" NOT NULL,
  "produtoServico"      TEXT NOT NULL,
  "nomeContato"         TEXT,
  "telefone"            TEXT,
  "whatsapp"            TEXT,
  "email"               TEXT,
  "site"                TEXT,
  "cidade"              TEXT,
  "estado"              TEXT,
  "status"              "StatusParceiro" NOT NULL DEFAULT 'ATIVO',
  "tipoIntegracao"      "TipoIntegracaoParceiro" NOT NULL DEFAULT 'SEM_INTEGRACAO',
  "comissaoPadrao"      DECIMAL(10,2),
  "tipoComissaoPadrao"  "TipoComissaoParceiro" NOT NULL DEFAULT 'VALOR_FIXO',
  "observacoes"         TEXT,
  "criadoPorId"         TEXT NOT NULL,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Parceiro_criadoPorId_fkey" FOREIGN KEY ("criadoPorId")
    REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "Parceiro_cnpj_key" ON "Parceiro"("cnpj") WHERE "cnpj" IS NOT NULL;
CREATE INDEX "Parceiro_categoria_idx" ON "Parceiro"("categoria");
CREATE INDEX "Parceiro_status_idx" ON "Parceiro"("status");

-- ────────────────────────────────────────────────
-- TABELA: Meta
-- ────────────────────────────────────────────────
CREATE TABLE "Meta" (
  "id"                          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "vendedorId"                  TEXT NOT NULL,
  "supervisorId"                TEXT,
  "mes"                         INTEGER NOT NULL CHECK ("mes" BETWEEN 1 AND 12),
  "ano"                         INTEGER NOT NULL,
  "tipoMeta"                    "TipoMeta" NOT NULL,
  "valorMeta"                   DECIMAL(12,2),
  "quantidadeMeta"              INTEGER,
  "valorRealizado"              DECIMAL(12,2) NOT NULL DEFAULT 0,
  "quantidadeRealizada"         INTEGER NOT NULL DEFAULT 0,
  "percentualAtingido"          DECIMAL(6,2) NOT NULL DEFAULT 0,
  "status"                      "StatusMeta" NOT NULL DEFAULT 'ATIVA',
  -- flags de controle
  "metaPrincipal"               BOOLEAN NOT NULL DEFAULT FALSE,
  "contaParaComissao"           BOOLEAN NOT NULL DEFAULT TRUE,
  "contaParaRanking"            BOOLEAN NOT NULL DEFAULT TRUE,
  "permiteComissaoSemMeta"      "PermiteComissaoSemMeta" NOT NULL DEFAULT 'NAO',
  "exigeRecebimento"            "ExigeRecebimento" NOT NULL DEFAULT 'SIM',
  "exigeContratoAssinado"       BOOLEAN NOT NULL DEFAULT FALSE,
  "exigePagamentoEntrada"       BOOLEAN NOT NULL DEFAULT FALSE,
  "observacoes"                 TEXT,
  "criadoPorId"                 TEXT NOT NULL,
  "createdAt"                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Meta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Meta_vendedorId_fkey" FOREIGN KEY ("vendedorId")
    REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "Meta_supervisorId_fkey" FOREIGN KEY ("supervisorId")
    REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "Meta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId")
    REFERENCES "User"("id") ON DELETE RESTRICT
);

-- uma meta por vendedor por mês/ano/tipo (regra de negócio crítica)
CREATE UNIQUE INDEX "Meta_vendedor_mes_ano_tipo_key"
  ON "Meta"("vendedorId", "mes", "ano", "tipoMeta");
CREATE INDEX "Meta_vendedorId_idx" ON "Meta"("vendedorId");
CREATE INDEX "Meta_mes_ano_idx" ON "Meta"("mes", "ano");
CREATE INDEX "Meta_status_idx" ON "Meta"("status");

-- ────────────────────────────────────────────────
-- TABELA: RegraComissao
-- ────────────────────────────────────────────────
CREATE TABLE "RegraComissao" (
  "id"                        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "nome"                      TEXT NOT NULL,
  "tipoComissao"              "TipoComissao" NOT NULL,
  "vendedorId"                TEXT,
  "aplicarParaTodos"          BOOLEAN NOT NULL DEFAULT FALSE,
  "baseCalculo"               "BaseCalculoComissao" NOT NULL,
  -- valores
  "percentual"                DECIMAL(6,4),
  "valorFixo"                 DECIMAL(10,2),
  "comissaoMinima"            DECIMAL(10,2),
  "comissaoMaxima"            DECIMAL(10,2),
  -- condições de cálculo
  "calculaSobreValorBruto"    BOOLEAN NOT NULL DEFAULT TRUE,
  "considerarDesconto"        BOOLEAN NOT NULL DEFAULT FALSE,
  -- condições de liberação
  "dependeRecebimento"        "DependeRecebimento" NOT NULL DEFAULT 'SIM',
  "dependeContratoAssinado"   BOOLEAN NOT NULL DEFAULT FALSE,
  "dependeImplantacao"        BOOLEAN NOT NULL DEFAULT FALSE,
  "dependeAprovacaoSupervisao" BOOLEAN NOT NULL DEFAULT FALSE,
  -- validade
  "dataInicio"                DATE NOT NULL,
  "dataFim"                   DATE,
  "status"                    "StatusRegraComissao" NOT NULL DEFAULT 'ATIVA',
  "observacoes"               TEXT,
  "criadoPorId"               TEXT NOT NULL,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "RegraComissao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegraComissao_vendedorId_fkey" FOREIGN KEY ("vendedorId")
    REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "RegraComissao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId")
    REFERENCES "User"("id") ON DELETE RESTRICT
);

-- apenas 1 regra ativa por vendedor por base de cálculo
-- (vendedorId NULL = regra global)
CREATE UNIQUE INDEX "RegraComissao_vendedor_base_ativa_key"
  ON "RegraComissao"("vendedorId", "baseCalculo")
  WHERE "status" = 'ATIVA';

CREATE INDEX "RegraComissao_vendedorId_idx" ON "RegraComissao"("vendedorId");
CREATE INDEX "RegraComissao_baseCalculo_idx" ON "RegraComissao"("baseCalculo");
CREATE INDEX "RegraComissao_status_idx" ON "RegraComissao"("status");

-- ────────────────────────────────────────────────
-- TABELA: Comissao
-- ────────────────────────────────────────────────
CREATE TABLE "Comissao" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "vendedorId"            TEXT NOT NULL,
  "regraId"               TEXT,
  -- origem (apenas um dos três será preenchido)
  "contratoId"            TEXT,
  "servicoId"             TEXT,
  "indicacaoId"           TEXT,
  "recebimentoId"         TEXT,
  -- cálculo
  "valorBase"             DECIMAL(12,2) NOT NULL,
  "percentualAplicado"    DECIMAL(6,4),
  "valorFixoAplicado"     DECIMAL(10,2),
  "valorComissao"         DECIMAL(10,2) NOT NULL,
  -- status e histórico
  "status"                "StatusComissao" NOT NULL DEFAULT 'PREVISTA',
  "motivoBloqueio"        TEXT,
  "aprovadoPorId"         TEXT,
  "dataAprovacao"         TIMESTAMPTZ,
  "dataLiberacao"         TIMESTAMPTZ,
  "dataPagamento"         TIMESTAMPTZ,
  "observacoes"           TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Comissao_vendedorId_fkey" FOREIGN KEY ("vendedorId")
    REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "Comissao_regraId_fkey" FOREIGN KEY ("regraId")
    REFERENCES "RegraComissao"("id") ON DELETE SET NULL,
  CONSTRAINT "Comissao_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId")
    REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "Comissao_vendedorId_idx" ON "Comissao"("vendedorId");
CREATE INDEX "Comissao_status_idx" ON "Comissao"("status");
CREATE INDEX "Comissao_contratoId_idx" ON "Comissao"("contratoId");
CREATE INDEX "Comissao_servicoId_idx" ON "Comissao"("servicoId");
CREATE INDEX "Comissao_indicacaoId_idx" ON "Comissao"("indicacaoId");
CREATE INDEX "Comissao_createdAt_idx" ON "Comissao"("createdAt");

-- ────────────────────────────────────────────────
-- TABELA: Recebimento
-- ────────────────────────────────────────────────
CREATE TABLE "Recebimento" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "vendedorId"              TEXT NOT NULL,
  "clienteNome"             TEXT NOT NULL,
  "clienteCNPJ"             TEXT,
  "tipoReceita"             "TipoReceita" NOT NULL,
  "origemReceita"           "OrigemReceita" NOT NULL DEFAULT 'NOVO_CLIENTE',
  -- vínculos opcionais
  "contratoId"              TEXT,
  "servicoId"               TEXT,
  -- valores
  "valorVendido"            DECIMAL(12,2) NOT NULL,
  "valorDesconto"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "valorRecebido"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "saldoPendente"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "formaPagamento"          "FormaPagamento" NOT NULL DEFAULT 'A_VISTA',
  "statusRecebimento"       "StatusRecebimento" NOT NULL DEFAULT 'PENDENTE',
  -- parcelas
  "qtdParcelas"             INTEGER NOT NULL DEFAULT 1,
  "valorEntrada"            DECIMAL(10,2),
  "dataVencimentoEntrada"   DATE,
  "entradaRecebida"         BOOLEAN NOT NULL DEFAULT FALSE,
  "dataEntradaRecebida"     DATE,
  "parcelaAtual"            INTEGER NOT NULL DEFAULT 0,
  "valorParcela"            DECIMAL(10,2),
  "proximoVencimento"       DATE,
  -- comissão
  "comissaoPrevista"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "comissaoLiberada"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "comissaoPaga"            DECIMAL(10,2) NOT NULL DEFAULT 0,
  "statusComissao"          "StatusComissaoRecebimento" NOT NULL DEFAULT 'PREVISTA',
  "dataLiberacaoComissao"   TIMESTAMPTZ,
  "observacoes"             TEXT,
  "criadoPorId"             TEXT NOT NULL,
  "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Recebimento_vendedorId_fkey" FOREIGN KEY ("vendedorId")
    REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "Recebimento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId")
    REFERENCES "User"("id") ON DELETE RESTRICT
);

CREATE INDEX "Recebimento_vendedorId_idx" ON "Recebimento"("vendedorId");
CREATE INDEX "Recebimento_statusRecebimento_idx" ON "Recebimento"("statusRecebimento");
CREATE INDEX "Recebimento_proximoVencimento_idx" ON "Recebimento"("proximoVencimento");
CREATE INDEX "Recebimento_tipoReceita_idx" ON "Recebimento"("tipoReceita");
CREATE INDEX "Recebimento_createdAt_idx" ON "Recebimento"("createdAt");

-- ────────────────────────────────────────────────
-- TABELA: IndicacaoParceiro
-- ────────────────────────────────────────────────
CREATE TABLE "IndicacaoParceiro" (
  "id"                        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "vendedorId"                TEXT NOT NULL,
  "parceiroId"                TEXT NOT NULL,
  -- cliente indicado
  "clienteNome"               TEXT NOT NULL,
  "clienteCNPJ"               TEXT,
  "clienteLeadId"             TEXT,
  "clienteBaseId"             TEXT,
  "segmento"                  TEXT,
  "responsavelNome"           TEXT,
  "telefone"                  TEXT,
  "whatsapp"                  TEXT,
  "email"                     TEXT,
  "cidade"                    TEXT,
  "estado"                    TEXT,
  -- produto/serviço indicado
  "produtoServico"            TEXT NOT NULL,
  "observacao"                TEXT,
  "valorEstimado"             DECIMAL(12,2),
  "valorConfirmado"           DECIMAL(12,2),
  -- comissão da indicação
  "tipoComissao"              "TipoComissaoParceiro" NOT NULL DEFAULT 'VALOR_FIXO',
  "percentualComissao"        DECIMAL(6,4),
  "valorFixoComissao"         DECIMAL(10,2),
  "comissaoPrevista"          DECIMAL(10,2) NOT NULL DEFAULT 0,
  "comissaoConfirmada"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "comissaoLiberada"          DECIMAL(10,2) NOT NULL DEFAULT 0,
  "comissaoPaga"              DECIMAL(10,2) NOT NULL DEFAULT 0,
  "dataPrevistaPagamento"     DATE,
  "dataPagamento"             DATE,
  -- status e validação
  "status"                    "StatusIndicacao" NOT NULL DEFAULT 'LANCADA',
  "parceiroConfirmouRecebimento" "ConfirmacaoParceiro" NOT NULL DEFAULT 'AGUARDANDO_CONFIRMACAO',
  "dataConfirmacaoParceiro"   DATE,
  "clienteFechouComParceiro"  "StatusConversao" NOT NULL DEFAULT 'NAO_INFORMADO',
  "dataConversao"             DATE,
  "aprovadoPorSupervisao"     "AprovacaoSupervisao" NOT NULL DEFAULT 'AGUARDANDO_APROVACAO',
  "aprovadoPorId"             TEXT,
  "dataAprovacao"             TIMESTAMPTZ,
  "observacoesComerciais"     TEXT,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "IndicacaoParceiro_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IndicacaoParceiro_vendedorId_fkey" FOREIGN KEY ("vendedorId")
    REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "IndicacaoParceiro_parceiroId_fkey" FOREIGN KEY ("parceiroId")
    REFERENCES "Parceiro"("id") ON DELETE RESTRICT,
  CONSTRAINT "IndicacaoParceiro_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId")
    REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "IndicacaoParceiro_vendedorId_idx" ON "IndicacaoParceiro"("vendedorId");
CREATE INDEX "IndicacaoParceiro_parceiroId_idx" ON "IndicacaoParceiro"("parceiroId");
CREATE INDEX "IndicacaoParceiro_status_idx" ON "IndicacaoParceiro"("status");
CREATE INDEX "IndicacaoParceiro_createdAt_idx" ON "IndicacaoParceiro"("createdAt");
```

---

## Arquitetura do Motor de Comissão

```
                  ┌──────────────────────────────────────────┐
                  │          Motor de Comissão               │
                  │        comissao.service.ts               │
                  └────────────────┬─────────────────────────┘
                                   │
          ┌───────────────┬────────┴──────────┬───────────────┐
          │               │                   │               │
   ┌──────▼──────┐ ┌──────▼──────┐  ┌────────▼──────┐ ┌─────▼──────────────┐
   │calcularCom- │ │calcularCom- │  │calcularCom-   │ │verificarLiberacao-  │
   │issaoContrato│ │issaoServico │  │issaoIndicacao │ │Comissoes(recebId)   │
   └──────┬──────┘ └──────┬──────┘  └────────┬──────┘ └─────┬──────────────┘
          │               │                   │               │
          └───────────────┴───────────────────┘               │
                          │                                    │
              ┌───────────▼───────────────────┐               │
              │  buscarRegraAtiva(            │               │
              │    vendedorId, baseCalculo)   │               │
              │  → RegraComissao (ou null)    │               │
              └───────────┬───────────────────┘               │
                          │                                    │
              ┌───────────▼───────────────────┐               │
              │  calcularValorComissao(       │               │
              │    regra, valorBase)          │               │
              │  → valorComissao: number      │               │
              └───────────┬───────────────────┘               │
                          │                                    │
              ┌───────────▼───────────────────┐  ┌───────────▼──────────────┐
              │  INSERT Comissao              │  │  UPDATE Comissao.status  │
              │  status: PREVISTA            │  │  PREVISTA → LIBERADA     │
              └──────────────────────────────┘  └──────────────────────────┘
```

### Lógica de busca de regra

```
1. Buscar RegraComissao WHERE:
   - status = ATIVA
   - baseCalculo = <base aplicável>
   - dataInicio <= hoje AND (dataFim IS NULL OR dataFim >= hoje)
   - (vendedorId = :vendedorId) OU (aplicarParaTodos = TRUE)
   - Prioridade: regra específica do vendedor > regra global

2. Se nenhuma regra encontrada → não gera Comissao (sem erro, log apenas)
3. Se regra.tipoComissao = SEM_COMISSAO → não gera Comissao
```

### Lógica de cálculo

```typescript
function calcularValorComissao(regra: RegraComissao, valorBase: number): number {
  let valor = 0
  switch (regra.tipoComissao) {
    case 'PERCENTUAL':
      valor = valorBase * (regra.percentual ?? 0)
      break
    case 'VALOR_FIXO':
      valor = regra.valorFixo ?? 0
      break
    case 'PERCENTUAL_POR_FAIXA':
    case 'VALOR_FIXO_POR_FAIXA':
    case 'MISTA':
      // lógica de faixas implementada no service (Sprint 25 completo)
      // Sprint 24: usa percentual/valorFixo como fallback
      valor = regra.percentual
        ? valorBase * regra.percentual
        : (regra.valorFixo ?? 0)
      break
    case 'MANUAL':
      valor = 0 // será preenchido manualmente pela supervisão
      break
  }
  if (regra.comissaoMinima && valor < regra.comissaoMinima) valor = regra.comissaoMinima
  if (regra.comissaoMaxima && valor > regra.comissaoMaxima) valor = regra.comissaoMaxima
  return Math.round(valor * 100) / 100
}
```

### Status da comissão — transições válidas

```
PREVISTA
  → AGUARDANDO_RECEBIMENTO  (quando regra.dependeRecebimento != NAO e recebimento não confirmado)
  → AGUARDANDO_APROVACAO    (quando regra.dependeAprovacaoSupervisao = TRUE)
  → LIBERADA                (todas as condições satisfeitas)
  → BLOQUEADA               (ação manual da supervisão)
  → CANCELADA               (venda cancelada)

AGUARDANDO_RECEBIMENTO
  → LIBERADA                (recebimento confirmado via verificarLiberacaoComissoes)
  → BLOQUEADA

AGUARDANDO_APROVACAO
  → LIBERADA                (aprovação manual)
  → BLOQUEADA               (reprovação)

LIBERADA
  → PAGA                    (FechamentoMensal — Sprint 25)
  → BLOQUEADA               (exceção)

BLOQUEADA
  → LIBERADA                (desbloqueio manual)
  → CANCELADA
```

---

## Permissões Adicionais (usePermission)

```typescript
// Adicionar ao hook usePermission:
'gerenciarParceiros'          // SUPERVISAO, CEO, ADMIN
'gerenciarMetas'              // SUPERVISAO, CEO, ADMIN
'gerenciarRegrasComissao'     // SUPERVISAO, CEO, ADMIN
'verTodasComissoes'           // SUPERVISAO, CEO, ADMIN, FINANCEIRO
'aprovarComissao'             // SUPERVISAO, CEO, ADMIN
'bloquearComissao'            // SUPERVISAO, CEO, ADMIN
'gerenciarRecebimentos'       // FINANCEIRO, SUPERVISAO, CEO, ADMIN
'verPropriosRecebimentos'     // VENDEDOR (filtro server-side)
'lancarIndicacao'             // VENDEDOR, SUPERVISAO, CEO, ADMIN
'verTodasIndicacoes'          // SUPERVISAO, CEO, ADMIN
'aprovarIndicacao'            // SUPERVISAO, CEO, ADMIN
```

---

## Rotas (Fastify) — visão geral

```
GET    /parceiros                      → listar (TODOS; VENDEDOR vê só ATIVO)
GET    /parceiros/:id
POST   /parceiros                      → SUPERVISAO+
PATCH  /parceiros/:id                  → SUPERVISAO+
DELETE /parceiros/:id                  → ADMIN

GET    /metas                          → SUPERVISAO+: todos; VENDEDOR: seus
GET    /metas/:id
POST   /metas                          → SUPERVISAO+
PATCH  /metas/:id                      → SUPERVISAO+
DELETE /metas/:id                      → ADMIN
POST   /metas/recalcular               → SUPERVISAO+ (recalcula valorRealizado)

GET    /regras-comissao                → SUPERVISAO+
GET    /regras-comissao/:id
POST   /regras-comissao               → SUPERVISAO+
PATCH  /regras-comissao/:id           → SUPERVISAO+
DELETE /regras-comissao/:id           → ADMIN

GET    /comissoes                      → SUPERVISAO+: todos; VENDEDOR: suas
GET    /comissoes/:id
PATCH  /comissoes/:id/liberar         → SUPERVISAO+
PATCH  /comissoes/:id/bloquear        → SUPERVISAO+
PATCH  /comissoes/:id/aprovar         → SUPERVISAO+

GET    /recebimentos                   → FINANCEIRO/SUPERVISAO+: todos; VENDEDOR: seus
GET    /recebimentos/:id
POST   /recebimentos                   → FINANCEIRO, SUPERVISAO+
PATCH  /recebimentos/:id              → FINANCEIRO, SUPERVISAO+

GET    /indicacoes                     → SUPERVISAO+: todos; VENDEDOR: suas
GET    /indicacoes/:id
POST   /indicacoes                     → VENDEDOR, SUPERVISAO+
PATCH  /indicacoes/:id/status         → SUPERVISAO+
PATCH  /indicacoes/:id/aprovar        → SUPERVISAO+
```

---

## Cron Jobs

```typescript
// Já existe cron horário — adicionar dois jobs diários:

// 00:05 — marcar recebimentos vencidos
cron.schedule('5 0 * * *', async () => {
  await prisma.recebimento.updateMany({
    where: {
      proximoVencimento: { lt: new Date() },
      statusRecebimento: { notIn: ['RECEBIDO', 'CANCELADO', 'DEVOLVIDO', 'CORTESIA', 'ISENTO'] }
    },
    data: { statusRecebimento: 'VENCIDO', updatedAt: new Date() }
  })
})

// 00:10 — recalcular valorRealizado de metas do mês corrente
cron.schedule('10 0 * * *', async () => {
  const hoje = new Date()
  const metas = await prisma.meta.findMany({
    where: { mes: hoje.getMonth() + 1, ano: hoje.getFullYear(), status: 'ATIVA' }
  })
  for (const meta of metas) {
    await recalcularRealizadoMeta(meta.id, prisma)
  }
})
```

---

## Sprint 24 — TECH LEAD PRONTO ✅
