# Sprint 11 — Configurações Comerciais — 12/12 HOMOLOGADO

## Modelo: Configuracao
Tabela genérica para: origem | segmento | plano | motivo-perda | tag | alerta
Campo valor: JSON para dados extras (cor da tag, valor padrão do plano, etc.)

## Impacto em outros módulos
LeadForm, PropostaForm, LossModal, ActivityModal → selects migrados de enum hard-coded para useConfiguracoes(tipo) hook com cache 5 min

## Acesso restrito a Admin
Rota /configuracoes bloqueada para outros perfis (middleware requireRole ADMIN)

## 12/12 aprovados — sem bugs
