# Sprint 31 — Step 05 — Isabela Costa (Frontend)
# App Mobile — Componentes React Native

## app/_layout.tsx (root)

```tsx
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { AuthProvider } from '@/contexts/auth'
import '../global.css' // NativeWind

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2 * 60 * 1000, retry: 1 } },
})

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    // Deep link ao tocar na notificação
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any
      if (data?.screen === 'leads' && data?.leadId) router.push(`/(app)/leads/${data.leadId}`)
      else if (data?.screen === 'conversas' && data?.leadId) router.push(`/(app)/conversas/${data.leadId}`)
      else if (data?.screen === 'agenda') router.push('/(app)/agenda')
    })
    return () => sub.remove()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

## app/(auth)/login.tsx

```tsx
'use client'
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'
import { api } from '@/lib/api'
import { registrarPushToken } from '@/lib/push'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const podeUsarBiometria = async () => {
    const [compativel, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ])
    const token = await SecureStore.getItemAsync('access_token')
    return compativel && enrolled && !!token
  }

  const loginComBiometria = async () => {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autentique-se para entrar no CRM',
      cancelLabel: 'Usar senha',
      fallbackLabel: 'Usar senha',
    })
    if (resultado.success) {
      router.replace('/(app)')
    }
  }

  const loginComSenha = async () => {
    if (!email.trim() || !senha) return
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), senha })
      await SecureStore.setItemAsync('access_token', data.accessToken)
      await SecureStore.setItemAsync('refresh_token', data.refreshToken)
      await SecureStore.setItemAsync('usuario', JSON.stringify(data.usuario))

      // Registrar push token
      await registrarPushToken()

      router.replace('/(app)')
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.error ?? 'Falha ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white justify-center px-6"
    >
      <View className="items-center mb-10">
        <Text className="text-3xl font-bold text-blue-700">CRM</Text>
        <Text className="text-lg text-gray-500">Comercial ProSystem</Text>
      </View>

      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base"
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 mb-5 text-base"
        placeholder="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
      />

      <TouchableOpacity
        onPress={loginComSenha}
        disabled={loading}
        className="bg-blue-700 rounded-xl py-4 items-center mb-4"
      >
        <Text className="text-white font-semibold text-base">
          {loading ? 'Entrando...' : 'Entrar'}
        </Text>
      </TouchableOpacity>

      {/* Biometria — mostrar se disponível */}
      <BiometriaButton onPress={loginComBiometria} verificar={podeUsarBiometria} />
    </KeyboardAvoidingView>
  )
}

function BiometriaButton({ onPress, verificar }: any) {
  const [disponivel, setDisponivel] = useState(false)
  useEffect(() => { verificar().then(setDisponivel) }, [])
  if (!disponivel) return null
  return (
    <TouchableOpacity onPress={onPress} className="items-center py-3">
      <Text className="text-blue-600 text-sm">🔑 Usar Face ID / Touch ID</Text>
    </TouchableOpacity>
  )
}
```

## app/(app)/_layout.tsx (Tab Bar)

```tsx
import { Tabs } from 'expo-router'
import { View, Text } from 'react-native'
import { Home, Users, TrendingUp, Calendar, MessageCircle } from 'lucide-react-native'
import { useContagemWA } from '@/hooks/use-conversas'

export default function AppLayout() {
  const { data: naoLidas = 0 } = useContagemWA()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1a56db',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Home size={22} color={color} /> }} />
      <Tabs.Screen name="leads/index" options={{ title: 'Leads', tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="funil" options={{ title: 'Funil', tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} /> }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: ({ color }) => <Calendar size={22} color={color} /> }} />
      <Tabs.Screen
        name="conversas/index"
        options={{
          title: 'WhatsApp',
          tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} />,
          tabBarBadge: naoLidas > 0 ? naoLidas : undefined,
        }}
      />
    </Tabs>
  )
}
```

## app/(app)/index.tsx (Dashboard)

```tsx
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function HomeScreen() {
  const { usuario } = useAuth()
  const router = useRouter()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard-mobile'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View className="bg-blue-700 px-5 pt-14 pb-6">
        <Text className="text-white/80 text-sm capitalize">{hoje}</Text>
        <Text className="text-white text-2xl font-bold mt-1">
          Bom dia, {usuario?.nome?.split(' ')[0]}! 👋
        </Text>
      </View>

      {/* Cards KPI */}
      <View className="flex-row flex-wrap px-4 pt-4 gap-3">
        <KpiCard title="Leads Ativos" value={data?.leadsAtivos ?? '—'} onPress={() => router.push('/(app)/leads')} />
        <KpiCard title="Atividades Hoje" value={data?.atividadesHoje ?? '—'} onPress={() => router.push('/(app)/leads')} />
        <KpiCard title="Próximo Evento" value={data?.proximoEvento ?? '—'} small onPress={() => router.push('/(app)/agenda')} />
        <KpiCard title="WA Não Lidas" value={data?.waNaoLidas ?? 0} danger={data?.waNaoLidas > 0} onPress={() => router.push('/(app)/conversas')} />
      </View>

      {/* Atividades do dia */}
      <View className="px-4 mt-6">
        <Text className="text-base font-semibold text-gray-800 mb-3">Atividades para hoje</Text>
        {data?.atividadesHojeList?.length === 0 && (
          <Text className="text-gray-400 text-sm">Nenhuma atividade para hoje 🎉</Text>
        )}
        {data?.atividadesHojeList?.map((a: any) => (
          <TouchableOpacity
            key={a.id}
            onPress={() => router.push(`/(app)/leads/${a.leadId}`)}
            className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-gray-100"
          >
            <Text className="font-medium text-gray-900">{a.tipo === 'LIGACAO' ? '📞' : a.tipo === 'VISITA' ? '🤝' : '✉️'} {a.lead?.nome}</Text>
            <Text className="text-sm text-gray-500 mt-0.5">{a.lead?.empresa}</Text>
            <Text className={`text-xs mt-1 ${a.vencida ? 'text-red-500' : 'text-gray-400'}`}>
              {a.vencida ? 'Venceu ontem 🔴' : `Hoje ${format(new Date(a.dataVencimento), 'HH:mm')}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

function KpiCard({ title, value, onPress, small = false, danger = false }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-1 min-w-[45%]"
    >
      <Text className={`font-bold text-2xl ${danger ? 'text-red-600' : 'text-blue-700'}`}>{value}</Text>
      <Text className="text-gray-500 text-xs mt-1">{title}</Text>
    </TouchableOpacity>
  )
}
```

## app/(app)/leads/index.tsx (Lista Leads)

```tsx
import { useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDebounce } from '@/hooks/use-debounce'
import { ETAPAS_FUNIL } from '@/constants/etapas'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function LeadsScreen() {
  const [busca, setBusca] = useState('')
  const [etapaFiltro, setEtapaFiltro] = useState<string | null>(null)
  const router = useRouter()
  const buscaDebouncada = useDebounce(busca, 400)

  const { data: leads = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['leads-mobile', buscaDebouncada, etapaFiltro],
    queryFn: () =>
      api.get('/leads', { params: { q: buscaDebouncada || undefined, etapa: etapaFiltro || undefined, limit: 50 } })
        .then((r) => r.data),
    staleTime: 60_000,
  })

  const diasSemAtividade = (lead: any) => {
    if (!lead.dataUltimoContato) return 99
    return Math.floor((Date.now() - new Date(lead.dataUltimoContato).getTime()) / 86400000)
  }

  const renderLead = useCallback(({ item: lead }: any) => {
    const dias = diasSemAtividade(lead)
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(app)/leads/${lead.id}`)}
        className="bg-white mx-4 mb-2 rounded-xl p-4 shadow-sm border border-gray-100"
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="font-semibold text-gray-900">{lead.nome}</Text>
            <Text className="text-sm text-gray-500">{lead.empresa ?? '—'}</Text>
          </View>
          <View className={`px-2 py-1 rounded-full ${ETAPAS_FUNIL[lead.etapa]?.cor ?? 'bg-gray-100'}`}>
            <Text className="text-xs font-medium">{lead.etapa}</Text>
          </View>
        </View>
        <Text className={`text-xs mt-2 ${dias >= 7 ? 'text-red-500' : dias >= 3 ? 'text-yellow-600' : 'text-gray-400'}`}>
          ⏰ {dias === 0 ? 'hoje' : `há ${dias} dias`}
          {dias >= 7 ? ' 🔴' : dias >= 3 ? ' 🟡' : ''}
        </Text>
      </TouchableOpacity>
    )
  }, [router])

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pt-14 pb-3 shadow-sm">
        <Text className="text-xl font-bold text-gray-900 mb-3">Leads</Text>
        <TextInput
          className="bg-gray-100 rounded-xl px-4 py-2.5 text-sm"
          placeholder="🔍 Buscar por nome ou empresa..."
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      {/* Chips de etapa */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-3 px-4">
        {['Todos', ...Object.keys(ETAPAS_FUNIL)].map((etapa) => (
          <TouchableOpacity
            key={etapa}
            onPress={() => setEtapaFiltro(etapa === 'Todos' ? null : etapa)}
            className={`mr-2 px-3 py-1.5 rounded-full border ${
              (etapa === 'Todos' && !etapaFiltro) || etapaFiltro === etapa
                ? 'bg-blue-700 border-blue-700'
                : 'bg-white border-gray-200'
            }`}
          >
            <Text className={`text-xs font-medium ${
              (etapa === 'Todos' && !etapaFiltro) || etapaFiltro === etapa ? 'text-white' : 'text-gray-600'
            }`}>
              {etapa}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        renderItem={renderLead}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-gray-400">Nenhum lead encontrado</Text>
          </View>
        }
      />
    </View>
  )
}
```

## hooks/use-auth.ts

```typescript
import { useState, useEffect, createContext, useContext } from 'react'
import * as SecureStore from 'expo-secure-store'

interface Usuario { id: string; nome: string; perfil: string; email: string }
interface AuthContextType { usuario: Usuario | null; logout: () => Promise<void> }

export const AuthContext = createContext<AuthContextType>({ usuario: null, logout: async () => {} })
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync('usuario').then((json) => {
      if (json) setUsuario(JSON.parse(json))
    })
  }, [])

  const logout = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('access_token'),
      SecureStore.deleteItemAsync('refresh_token'),
      SecureStore.deleteItemAsync('usuario'),
    ])
    setUsuario(null)
  }

  return <AuthContext.Provider value={{ usuario, logout }}>{children}</AuthContext.Provider>
}
```

## hooks/use-conversas.ts (Mobile)

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useConversasMobile() {
  return useQuery({
    queryKey: ['conversas-mobile'],
    queryFn: () => api.get('/conversas').then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useContagemWA() {
  return useQuery({
    queryKey: ['wa-nao-lidas'],
    queryFn: () => api.get('/conversas/nao-lidas/contagem').then((r) => r.data.total),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useMensagensMobile(leadId: string) {
  return useQuery({
    queryKey: ['mensagens-mobile', leadId],
    queryFn: () => api.get(`/conversas/${leadId}`).then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 15_000, // polling leve no mobile (sem SSE)
  })
}
```

## package.json (dependências mobile)

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-secure-store": "~13.0.0",
    "expo-local-authentication": "~14.0.0",
    "expo-notifications": "~0.28.0",
    "expo-device": "~6.0.0",
    "expo-linking": "~6.3.0",
    "react-native": "0.74.0",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "date-fns": "^3.0.0",
    "lucide-react-native": "^0.378.0",
    "react-native-toast-message": "^2.2.0",
    "@react-native-community/datetimepicker": "^7.7.0"
  }
}
```
