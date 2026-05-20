# Sprint 31 — Step 03 — Daniel Mendes (Tech Lead)
# App Mobile — Arquitetura

## Estrutura do Projeto Mobile

```
/mobile                          ← raiz do projeto Expo
  app.json                       ← config Expo
  package.json
  tsconfig.json
  tailwind.config.js             ← NativeWind
  app/
    _layout.tsx                  ← root layout (providers)
    (auth)/
      _layout.tsx
      login.tsx
    (app)/
      _layout.tsx                ← tab navigator
      index.tsx                  ← dashboard
      leads/
        index.tsx
        [id].tsx
      funil.tsx
      agenda.tsx
      conversas/
        index.tsx
        [leadId].tsx
  components/
    leads/
    whatsapp/
    agenda/
    shared/
  hooks/
    use-auth.ts
    use-leads.ts
    use-funil.ts
    use-atividades.ts
    use-agenda.ts
    use-conversas.ts
    use-push.ts
  lib/
    api.ts                       ← Axios + interceptors
    auth.ts                      ← token store
    push.ts                      ← expo push helpers
  constants/
    colors.ts
    etapas.ts
```

## Schema Changes (Backend)

```prisma
// Nova tabela para armazenar push tokens dos dispositivos

model PushToken {
  id        String   @id @default(cuid())
  usuarioId String
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  token     String   @unique                // Expo push token
  plataforma String                          // ios | android
  criadoEm  DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  @@index([usuarioId])
}
```

## Migration SQL

```sql
CREATE TABLE "PushToken" (
  "id"           TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuarioId"    TEXT NOT NULL,
  "token"        TEXT NOT NULL UNIQUE,
  "plataforma"   TEXT NOT NULL,
  "criadoEm"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "atualizadoEm" TIMESTAMP NOT NULL,
  CONSTRAINT "PushToken_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE
);
CREATE INDEX "PushToken_usuarioId_idx" ON "PushToken"("usuarioId");
```

## Endpoints Backend Novos (mínimos)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/push-tokens` | Registrar/atualizar token do dispositivo |
| DELETE | `/api/push-tokens/:token` | Remover token (logout) |

Todos os outros endpoints são **reutilizados do web sem alteração**.

## lib/api.ts (Mobile)

```typescript
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.crm.prosystem.com.br'

export const api = axios.create({ baseURL: BASE_URL })

// Injetar token em todas as requisições
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh automático ao receber 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status !== 401) throw error
    try {
      const refresh = await SecureStore.getItemAsync('refresh_token')
      if (!refresh) throw new Error('no refresh')

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: refresh })
      await SecureStore.setItemAsync('access_token', data.accessToken)

      // Retry da requisição original
      error.config.headers.Authorization = `Bearer ${data.accessToken}`
      return api.request(error.config)
    } catch {
      await SecureStore.deleteItemAsync('access_token')
      await SecureStore.deleteItemAsync('refresh_token')
      router.replace('/(auth)/login')
      throw error
    }
  }
)
```

## lib/push.ts

```typescript
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { api } from './api'

export async function registrarPushToken() {
  if (!Device.isDevice) return null

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  })

  // Registrar no backend
  await api.post('/push-tokens', {
    token,
    plataforma: Platform.OS,
  }).catch(() => {}) // não bloquear se falhar

  return token
}
```

## Decisões de Arquitetura

1. **Expo Managed Workflow** — sem código nativo para simplificar o build
2. **Expo Router** — file-based routing idêntico ao Next.js (curva zero para o time)
3. **TanStack Query** — mesmos hooks de cache do web, apenas trocando `fetch` por `axios`
4. **NativeWind v4** — Tailwind para React Native; classes idênticas ao web quando possível
5. **Zero duplicação de lógica** — `types/` compartilhados entre web e mobile via pacote ou copy-on-change
6. **Push via Expo Push API** — backend chama `https://exp.host/--/api/v2/push/send` com o token Expo; sem SDK de push nativo
7. **Deep links** — `expo-linking` mapeia `crm://leads/:id`, `crm://conversas/:leadId` para as notificações

## Configuração Push no Backend

```typescript
// lib/expo-push.ts (backend)
async function enviarPushParaUsuario(usuarioId: string, titulo: string, body: string, data: object, prisma: PrismaClient) {
  const tokens = await prisma.pushToken.findMany({ where: { usuarioId } })
  if (!tokens.length) return

  const messages = tokens.map((t) => ({
    to: t.token,
    title: titulo,
    body,
    data,
    sound: 'default',
  }))

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  }).catch(console.error)
}
```

## Pontos de Integração Push

| Evento | Quando disparar | Dados do deep link |
|--------|----------------|-------------------|
| Atividade vencida | Cron 08:00 (já existe) | `{ screen: 'leads', leadId }` |
| Evento em 15min | Cron a cada hora +05min (já existe) | `{ screen: 'agenda' }` |
| Nova mensagem WA | `processarMensagemInbound()` | `{ screen: 'conversas', leadId }` |
