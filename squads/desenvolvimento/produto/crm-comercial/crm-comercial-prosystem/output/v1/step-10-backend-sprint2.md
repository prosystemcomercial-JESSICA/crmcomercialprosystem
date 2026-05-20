# Step 10 — Felipe Santos (Backend Developer)
# Sprint 2: Usuários e Permissões — Backend

## auth.service.ts
- Login com verificação de bloqueio (5 tentativas = 15 min bloqueado)
- JWT 15 min + refreshToken 7 dias (cookie httpOnly)
- Reset automático de tentativas após login bem-sucedido
- Logout revoga refreshToken no banco

## usuarios.service.ts
- Criar usuário: valida email único + gera senha temporária + envia por e-mail
- Hash bcrypt cost 12
- Inativar/ativar sem deletar dados
- Admin-only: criar, listar todos, alterar status

## Middleware authenticate
Valida JWT no Authorization header → injeta request.user
Se token expirado → retorna 401 → frontend chama /refresh

## requireRole decorator
Verifica request.user.perfil → 403 se não autorizado
