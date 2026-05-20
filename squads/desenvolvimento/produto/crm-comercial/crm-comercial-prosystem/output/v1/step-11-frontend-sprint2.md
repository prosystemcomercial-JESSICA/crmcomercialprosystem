# Step 11 — Isabela Costa (Frontend Developer)
# Sprint 2: Usuários e Permissões — Frontend

## Implementado

- middleware.ts: proteção de rotas — redireciona para /login se sem token
- useAuth(): estado de autenticação global
- usePermission(): hook can('acao') para verificar permissão por role
- LoginPage: form + tratamento de erros (bloqueio, senha errada)
- Sidebar: itens condicionais por permissão (Usuários só para Admin)
- Lista de Usuários: badge colorido por perfil, toggle ativo/inativo
- Formulário Usuário: radio buttons de perfil, não dropdown
- Meu Perfil: editar nome e telefone + botão alterar senha
- Redefinir Senha: indicador de força da senha em tempo real

## Segurança frontend

- Token armazenado apenas em memória (não localStorage)
- RefreshToken em cookie httpOnly (não acessível ao JavaScript)
- Axios interceptor: 401 → chama /refresh → se falhar → logout
