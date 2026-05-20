# Step 09 — Daniel Mendes (Tech Lead)
# Sprint 2: Usuários e Permissões — Arquitetura

## Schema

Entidades: User (com enum Role + UserStatus), RefreshToken
Enum Role: VENDEDOR | SUPERVISAO | CEO | ADMIN
Enum UserStatus: ATIVO | INATIVO

## Endpoints

POST /api/auth/login — JWT + refreshToken (cookie httpOnly)
POST /api/auth/refresh — renovar JWT
POST /api/auth/logout — revogar refreshToken
POST /api/auth/redefinir-senha — reset por e-mail
GET  /api/auth/me — perfil do usuário logado

GET    /api/usuarios — lista (Admin only)
POST   /api/usuarios — criar (Admin only)
GET    /api/usuarios/:id — detalhe
PATCH  /api/usuarios/:id — editar
PATCH  /api/usuarios/:id/status — ativar/inativar (Admin only)
PATCH  /api/usuarios/:id/senha — trocar senha (próprio)

## Segurança

- JWT expira em 15 minutos
- RefreshToken dura 7 dias, armazenado em cookie httpOnly
- Bloqueio após 5 tentativas erradas por 15 minutos
- Senha hash com bcrypt (cost 12)
- refreshToken armazenado no banco e revogado no logout
