# Step 12 — Rodrigo Almeida (QA Engineer)
# Sprint 2: Usuários e Permissões — Resultado dos Testes

## Resultado: 16/16 APROVADOS ✅ — MÓDULO HOMOLOGADO

TC-101 Login válido → JWT + refreshToken ✅
TC-102 Senha errada → contador incrementa ✅
TC-103 5 tentativas → bloqueio 15 min ✅
TC-104 Conta inativa → 401 ✅
TC-105 Refresh válido → novo JWT ✅
TC-106 Refresh revogado → 401 ✅
TC-107 Logout → token revogado ✅
TC-108 Rota sem token → redirect /login ✅
TC-109 Admin cria usuário → e-mail enviado ✅
TC-110 E-mail duplicado → 409 ✅
TC-111 Vendedor em /api/usuarios → 403 ✅
TC-112 Supervisão cria usuário → 403 ✅
TC-113 Usuário inativo → bloqueado ✅
TC-114 Primeiro acesso → redefinir senha ✅
TC-115 can() retorna false para perfil sem permissão ✅
TC-116 Sidebar oculta itens sem permissão ✅

## Nenhum bug encontrado. Aprovado para deploy.
