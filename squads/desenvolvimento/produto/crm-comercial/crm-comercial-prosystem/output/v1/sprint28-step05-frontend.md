# Sprint 28 — Step 05 — Isabela Costa (Frontend)
# Churn e Retenção — Componentes e Páginas React

## Estrutura de Diretórios

```
app/(dashboard)/
├── retencao/
│   ├── page.tsx                    # T1: Dashboard
│   ├── casos/
│   │   ├── page.tsx               # T2: Lista Casos
│   │   └── [id]/
│   │       └── page.tsx           # T3: Detalhe Caso
│   ├── clientes-churned/
│   │   └── page.tsx               # T5: Clientes Perdidos
│   └── layout.tsx                 # Layout shared
│
├── components/
│   ├── retencao/
│   │   ├── DashboardRetencao.tsx
│   │   ├── ListaCasos.tsx
│   │   ├── DetalheCaso.tsx
│   │   ├── ClientesChurned.tsx
│   │   ├── CasoCard.tsx
│   │   ├── KPICard.tsx
│   │   ├── Filters/
│   │   │   ├── CasoFilters.tsx
│   │   │   └── FilterSidebar.tsx
│   │   └── Modals/
│   │       ├── CreateCasoModal.tsx
│   │       ├── TransitionStatusModal.tsx
│   │       ├── CreatePlanoModal.tsx
│   │       ├── CreateAcaoModal.tsx
│   │       └── RelatorioModal.tsx
│   │
│   ├── shared/
│   │   ├── RiskScoreBadge.tsx
│   │   ├── StatusBadge.tsx
│   │   └── LoadingState.tsx
│   │
│   └── charts/
│       ├── TaxaSucessoChart.tsx
│       ├── MotivosChart.tsx
│       ├── StatusDistributionChart.tsx
│       └── TopClientesChart.tsx
│
└── hooks/
    ├── useCasoChurn.ts             # CRUD + mutations
    ├── useDashboardRetencao.ts     # Dashboard query
    ├── useRetencaoAlerts.ts        # WebSocket alerts
    └── useFilters.ts               # Filter state management
```

---

## 1. Custom Hooks

**File:** `hooks/useCasoChurn.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/api/caso-churn';

export const useCasoChurn = (casoId: string) => {
  return useQuery({
    queryKey: ['caso', casoId],
    queryFn: () => api.getCaso(casoId),
    staleTime: 5 * 60 * 1000, // 5min
    retry: 2
  });
};

export const useCasosList = (filters: Record<string, any>, page: number = 0) => {
  return useQuery({
    queryKey: ['casos', filters, page],
    queryFn: () => api.listCasos(filters, page),
    staleTime: 5 * 60 * 1000,
    retry: 2
  });
};

export const useCreateCaso = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateCasoDTO) => api.createCaso(data),
    onSuccess: (caso) => {
      queryClient.invalidateQueries({ queryKey: ['casos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Caso criado: ${caso.clienteId}`);
    },
    onError: (error) => {
      toast.error(`Erro ao criar caso: ${error.message}`);
    }
  });
};

export const useUpdateCaso = (casoId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<CasoChurn>) => api.updateCaso(casoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caso', casoId] });
      queryClient.invalidateQueries({ queryKey: ['casos'] });
      toast.success('Caso atualizado');
    }
  });
};

export const useTransitionCasoStatus = (casoId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {newStatus: string, metadata?: any}) =>
      api.transitionStatus(casoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caso', casoId] });
      queryClient.invalidateQueries({ queryKey: ['casos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Status atualizado');
    }
  });
};

export const useFillDiagnosis = (casoId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: DiagnosisDTO) => api.fillDiagnosis(casoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caso', casoId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Diagnóstico preenchido e risk score calculado');
    }
  });
};

export const useCreateAcao = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateAcaoDTO) => api.createAcao(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acoes'] });
      queryClient.invalidateQueries({ queryKey: ['casos'] });
      toast.success('Ação registrada');
    }
  });
};

export const useCreatePlano = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreatePlanoDTO) => api.createPlano(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Plano de retenção criado');
    }
  });
};
```

**File:** `hooks/useDashboardRetencao.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api/dashboard';

export const useDashboardRetencao = (filters: Record<string, any> = {}) => {
  return useQuery({
    queryKey: ['dashboard', 'retencao', filters],
    queryFn: () => api.getDashboard(filters),
    staleTime: 10 * 60 * 1000, // 10min
    retry: 2,
    refetchInterval: 5 * 60 * 1000 // Refetch every 5min
  });
};
```

**File:** `hooks/useRetencaoAlerts.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWebSocket } from '@/lib/websocket-client';

export const useRetencaoAlerts = () => {
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe } = useWebSocket();
  
  useEffect(() => {
    // Listen for retention alerts
    const unsubscribeCritico = subscribe('retencao:alerta', (data: any) => {
      if (data.tipo === 'caso_critico') {
        toast.error(data.message, {
          duration: 10000,
          action: {
            label: 'Ver Caso',
            onClick: () => {
              window.location.href = `/retencao/casos/${data.casoId}`;
            }
          }
        });
      } else if (data.tipo === 'contato_vencido') {
        toast.warning(`📞 ${data.message}`, {
          action: {
            label: 'Remarcar',
            onClick: () => {
              // Open transition modal
            }
          }
        });
      } else if (data.tipo === 'risk_mudou') {
        toast.info(data.message);
        // Invalidate dashboard cache
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    });
    
    return () => unsubscribeCritico();
  }, [subscribe, queryClient]);
};
```

---

## 2. Componentes Principais

**File:** `components/retencao/DashboardRetencao.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useDashboardRetencao } from '@/hooks/useDashboardRetencao';
import { KPICard } from './KPICard';
import { TaxaSucessoChart } from '@/components/charts/TaxaSucessoChart';
import { MotivosChart } from '@/components/charts/MotivosChart';
import { StatusDistributionChart } from '@/components/charts/StatusDistributionChart';
import { TopClientesChart } from '@/components/charts/TopClientesChart';
import { DashboardFilters } from './Filters/DashboardFilters';
import { LoadingState } from '@/components/shared/LoadingState';
import { AlertCircle } from 'lucide-react';

export function DashboardRetencao() {
  const [filters, setFilters] = useState({
    periodo: '30d',
    status: undefined,
    riskCategory: undefined
  });
  
  const { data: dashboard, isLoading, error } = useDashboardRetencao(filters);
  
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex gap-2">
        <AlertCircle className="text-red-600" />
        <div>
          <h3 className="font-semibold text-red-900">Erro ao carregar dashboard</h3>
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return <LoadingState count={4} />;
  }
  
  const kpis = dashboard?.kpis || {};
  const graficos = dashboard?.graficos || {};
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard de Retenção</h1>
        <DashboardFilters value={filters} onChange={setFilters} />
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Clientes em Risco"
          value={kpis.clientesEmRisco}
          color={kpis.clientesEmRisco > 5 ? 'red' : kpis.clientesEmRisco > 2 ? 'yellow' : 'green'}
          suffix=" clientes"
        />
        <KPICard
          label="Recuperados este mês"
          value={kpis.clientesRecuperados}
          color="green"
          meta={2}
          suffix=" clientes"
        />
        <KPICard
          label="Taxa de Sucesso"
          value={kpis.taxaSucessoRetenção}
          color={kpis.taxaSucessoRetenção < 60 ? 'red' : kpis.taxaSucessoRetenção < 70 ? 'yellow' : 'green'}
          suffix="%"
          target={70}
        />
        <KPICard
          label="Revenue em Risco"
          value={kpis.revenueEmRisco}
          color={kpis.revenueEmRisco > 50000 ? 'red' : kpis.revenueEmRisco > 20000 ? 'yellow' : 'green'}
          suffix="R$"
          format="currency"
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Taxa Sucesso (90d)</h2>
          <TaxaSucessoChart data={graficos.taxaSucessoTrend} />
        </div>
        
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Motivos Top 5</h2>
          <MotivosChart data={graficos.motivosTopo5} />
        </div>
        
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Distribuição Status</h2>
          <StatusDistributionChart data={graficos.statusDist} />
        </div>
        
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Top Clientes em Risco</h2>
          <TopClientesChart data={graficos.topClientesRisk} />
        </div>
      </div>
    </div>
  );
}
```

**File:** `components/retencao/ListaCasos.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useCasosList } from '@/hooks/useCasoChurn';
import { CasoCard } from './CasoCard';
import { FilterSidebar } from './Filters/FilterSidebar';
import { CreateCasoModal } from './Modals/CreateCasoModal';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function ListaCasos() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const { data: resultado, isLoading } = useCasosList(filters, page);
  
  if (isLoading && page === 0) {
    return <LoadingState count={3} />;
  }
  
  const casos = resultado?.casos || [];
  const total = resultado?.total || 0;
  const pageSize = resultado?.pageSize || 50;
  const totalPages = Math.ceil(total / pageSize);
  
  return (
    <div className="flex gap-6">
      {/* Sidebar Filters */}
      <div className="w-72 flex-shrink-0">
        <FilterSidebar value={filters} onChange={setFilters} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Casos de Churn</h1>
            <p className="text-sm text-gray-600">
              Mostrando {casos.length} de {total} casos
            </p>
          </div>
          
          <Button
            onClick={() => setShowCreateModal(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Caso
          </Button>
        </div>
        
        {casos.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-4">
              Nenhum caso encontrado com esses filtros
            </p>
            <Button variant="outline" onClick={() => setFilters({})}>
              Limpar Filtros
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {casos.map((caso) => (
              <CasoCard key={caso.id} caso={caso} />
            ))}
            
            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                ← Anterior
              </Button>
              
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i ? 'default' : 'outline'}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              
              <Button
                variant="outline"
                disabled={page === totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Próxima →
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Create Modal */}
      <CreateCasoModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
```

**File:** `components/retencao/DetalheCaso.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useCasoChurn } from '@/hooks/useCasoChurn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RiskScoreBadge } from '@/components/shared/RiskScoreBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState } from '@/components/shared/LoadingState';
import { AlertCircle, MoreVertical } from 'lucide-react';
import { TabDiagnosis } from './Tabs/TabDiagnosis';
import { TabPlano } from './Tabs/TabPlano';
import { TabAcoes } from './Tabs/TabAcoes';
import { TabTimeline } from './Tabs/TabTimeline';
import { TransitionStatusModal } from './Modals/TransitionStatusModal';

interface DetalheC asoProps {
  casoId: string;
}

export function DetalheCaso({ casoId }: DetalheCAsoProps) {
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const { data: caso, isLoading, error } = useCasoChurn(casoId);
  
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex gap-2">
        <AlertCircle className="text-red-600" />
        <div>
          <h3 className="font-semibold text-red-900">Erro ao carregar caso</h3>
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return <LoadingState />;
  }
  
  if (!caso) {
    return <div className="text-center py-12">Caso não encontrado</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">
            {caso.cliente?.nome}
          </h1>
          <div className="flex gap-4 mt-3 text-sm">
            <StatusBadge status={caso.status} />
            <RiskScoreBadge score={caso.riskScore} />
            <span className="text-gray-600">
              Dias abertos: {Math.floor((Date.now() - new Date(caso.createdAt).getTime()) / 86400000)}
            </span>
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={() => setShowTransitionModal(true)}
        >
          Mudar Status
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Quick Info */}
        <div className="bg-white p-6 rounded-lg border space-y-4 lg:col-span-1">
          <div>
            <label className="text-xs text-gray-600 font-semibold">RISK SCORE</label>
            <div className="text-3xl font-bold mt-1">{caso.riskScore}</div>
            <p className="text-xs text-gray-600">
              {caso.riskScore >= 80 ? 'CRÍTICO' :
               caso.riskScore >= 60 ? 'ALTO' :
               caso.riskScore >= 40 ? 'MÉDIO' : 'BAIXO'}
            </p>
          </div>
          
          <div className="border-t pt-4">
            <label className="text-xs text-gray-600 font-semibold">MOTIVO</label>
            <p className="font-semibold">{caso.motivo}</p>
          </div>
          
          <div>
            <label className="text-xs text-gray-600 font-semibold">SENTIMENTO</label>
            <p className="font-semibold">{caso.sentimento}</p>
          </div>
          
          <div className="border-t pt-4">
            <label className="text-xs text-gray-600 font-semibold">ATRIBUÍDO PARA</label>
            <p className="font-semibold">{caso.atribuidoPara?.name}</p>
          </div>
          
          <div>
            <label className="text-xs text-gray-600 font-semibold">MRR</label>
            <p className="font-semibold">
              R$ {(caso.clienteBase?.mrr ?? 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
        
        {/* Main Content: Tabs */}
        <div className="lg:col-span-3 bg-white p-6 rounded-lg border">
          <Tabs defaultValue="diagnosis" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
              <TabsTrigger value="plano">Plano</TabsTrigger>
              <TabsTrigger value="acoes">Ações</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            
            <TabsContent value="diagnosis" className="mt-6">
              <TabDiagnosis casoId={casoId} />
            </TabsContent>
            
            <TabsContent value="plano" className="mt-6">
              <TabPlano casoId={casoId} />
            </TabsContent>
            
            <TabsContent value="acoes" className="mt-6">
              <TabAcoes casoId={casoId} />
            </TabsContent>
            
            <TabsContent value="timeline" className="mt-6">
              <TabTimeline casoId={casoId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Transition Modal */}
      <TransitionStatusModal
        casoId={casoId}
        currentStatus={caso.status}
        open={showTransitionModal}
        onOpenChange={setShowTransitionModal}
      />
    </div>
  );
}
```

**File:** `components/retencao/CasoCard.tsx`

```typescript
'use client';

import Link from 'next/link';
import { RiskScoreBadge } from '@/components/shared/RiskScoreBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

interface CasoCardProps {
  caso: CasoChurn;
}

export function CasoCard({ caso }: CasoCardProps) {
  return (
    <div className="bg-white p-4 rounded-lg border hover:border-blue-300 hover:shadow-md transition-all">
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Cliente Name */}
        <div className="col-span-3">
          <h3 className="font-semibold text-lg">{caso.cliente?.nome}</h3>
          <p className="text-xs text-gray-600">
            {caso.clienteBase?.nome}
          </p>
        </div>
        
        {/* Risk Score */}
        <div className="col-span-1">
          <RiskScoreBadge score={caso.riskScore} />
        </div>
        
        {/* MRR */}
        <div className="col-span-1 text-right">
          <p className="font-semibold text-sm">
            R$ {(caso.clienteBase?.mrr ?? 0).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-gray-600">MRR</p>
        </div>
        
        {/* Dias Aberto */}
        <div className="col-span-1 text-right">
          <p className="font-semibold text-sm">
            {Math.floor((Date.now() - new Date(caso.createdAt).getTime()) / 86400000)}d
          </p>
          <p className="text-xs text-gray-600">Dias</p>
        </div>
        
        {/* Motivo */}
        <div className="col-span-2">
          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
            {caso.motivo}
          </span>
        </div>
        
        {/* Atribuído Para */}
        <div className="col-span-2">
          <p className="text-sm">{caso.atribuidoPara?.name ?? 'Sem atribuição'}</p>
        </div>
        
        {/* Status */}
        <div className="col-span-1">
          <StatusBadge status={caso.status} />
        </div>
        
        {/* Link */}
        <div className="col-span-1 text-right">
          <Link href={`/retencao/casos/${caso.id}`}>
            <Button variant="ghost" size="sm">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Tabs Componentes

**File:** `components/retencao/Tabs/TabDiagnosis.tsx`

```typescript
'use client';

import { useDiagnosis, useFillDiagnosis } from '@/hooks';
import { DiagnosisForm } from '../Forms/DiagnosisForm';
import { LoadingState } from '@/components/shared/LoadingState';

export function TabDiagnosis({ casoId }: {casoId: string}) {
  const { data: diagnosis, isLoading } = useDiagnosis(casoId);
  const fillDiagnosis = useFillDiagnosis(casoId);
  
  if (isLoading) return <LoadingState />;
  
  return (
    <DiagnosisForm
      casoId={casoId}
      initialData={diagnosis}
      onSubmit={(data) => fillDiagnosis.mutate(data)}
      isLoading={fillDiagnosis.isPending}
    />
  );
}
```

**File:** `components/retencao/Tabs/TabAcoes.tsx`

```typescript
'use client';

import { useAcoes, useCreateAcao } from '@/hooks';
import { Button } from '@/components/ui/button';
import { CreateAcaoModal } from '../Modals/CreateAcaoModal';
import { useState } from 'react';
import { LoadingState } from '@/components/shared/LoadingState';

export function TabAcoes({ casoId }: {casoId: string}) {
  const [showModal, setShowModal] = useState(false);
  const { data: acoes, isLoading } = useAcoes(casoId);
  const createAcao = useCreateAcao();
  
  if (isLoading) return <LoadingState />;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowModal(true)}>
          + Registrar Ação
        </Button>
      </div>
      
      <div className="space-y-3">
        {acoes?.map((acao) => (
          <div key={acao.id} className="p-4 bg-gray-50 rounded-lg border">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  {new Date(acao.dataAcao).toLocaleDateString('pt-BR')}
                </p>
                <p className="font-semibold mt-1">{acao.tipoAcao}</p>
                <p className="text-sm text-gray-700 mt-1">{acao.descricao}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                acao.resultado === 'POSITIVO' ? 'bg-green-100 text-green-800' :
                acao.resultado === 'NEGATIVO' ? 'bg-red-100 text-red-800' :
                'bg-gray-200 text-gray-800'
              }`}>
                {acao.resultado}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <CreateAcaoModal
        casoId={casoId}
        open={showModal}
        onOpenChange={setShowModal}
      />
    </div>
  );
}
```

---

## 4. Modals

**File:** `components/retencao/Modals/CreateCasoModal.tsx`

```typescript
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { CreateCasoForm } from '../Forms/CreateCasoForm';
import { useCreateCaso } from '@/hooks/useCasoChurn';

interface CreateCasoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCasoModal({ open, onOpenChange }: CreateCasoModalProps) {
  const createCaso = useCreateCaso();
  
  const handleSubmit = (data: any) => {
    createCaso.mutate(data, {
      onSuccess: () => onOpenChange(false)
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Caso de Churn</DialogTitle>
        </DialogHeader>
        
        <CreateCasoForm
          onSubmit={handleSubmit}
          isLoading={createCaso.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
```

**File:** `components/retencao/Modals/TransitionStatusModal.tsx`

```typescript
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { TransitionStatusForm } from '../Forms/TransitionStatusForm';
import { useTransitionCasoStatus } from '@/hooks/useCasoChurn';

interface TransitionStatusModalProps {
  casoId: string;
  currentStatus: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransitionStatusModal({
  casoId,
  currentStatus,
  open,
  onOpenChange
}: TransitionStatusModalProps) {
  const transition = useTransitionCasoStatus(casoId);
  
  const handleSubmit = (data: any) => {
    transition.mutate(data, {
      onSuccess: () => onOpenChange(false)
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Atualizar Status do Caso</DialogTitle>
        </DialogHeader>
        
        <TransitionStatusForm
          currentStatus={currentStatus}
          onSubmit={handleSubmit}
          isLoading={transition.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
```

---

## 5. Forms

**File:** `components/retencao/Forms/DiagnosisForm.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FillDiagnosisSchema } from '@/schemas/diagnosis.schema';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const MOTIVOS = [
  'INSATISFACAO_SERVICO',
  'MAL_USO_PRODUTO',
  'MIGRACAO_CONCORRENCIA',
  'PRECO',
  'FALTA_SUPORTE',
  'INTEGRACAO_PROBLEMAS',
  'VOLUME_BAIXO',
  'PERSONALIZACAO_INSUFICIENTE',
  'PERFORMANCE_LENTA',
  'OUTROS'
];

export function DiagnosisForm({ casoId, initialData, onSubmit, isLoading }) {
  const form = useForm({
    resolver: zodResolver(FillDiagnosisSchema),
    defaultValues: initialData || {}
  });
  
  const sentimentoValue = form.watch('sentimento');
  const grauValue = form.watch('grauInsatisfacao');
  const avaliacaoValue = form.watch('avaliacaoSuporte');
  
  // Calculate riskScore in real-time
  const riskScore = sentimentoValue && grauValue && avaliacaoValue
    ? Math.max(0, Math.min(100,
        ((11 - (['MUITO_NEGATIVO', 'NEGATIVO', 'NEUTRO', 'POSITIVO'].indexOf(sentimentoValue) + 1)) * 10) +
        (grauValue * 2) -
        (avaliacaoValue * 8)
      ))
    : 0;
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Motivo */}
        <FormField
          control={form.control}
          name="motivo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MOTIVOS.map((motivo) => (
                    <SelectItem key={motivo} value={motivo}>
                      {motivo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Detalhe Motivo */}
        <FormField
          control={form.control}
          name="detalheMotivo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Detalhe Motivo *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva o problema específico..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Sentimento */}
        <FormField
          control={form.control}
          name="sentimento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sentimento *</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value}>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="MUITO_NEGATIVO" id="muito-neg" />
                      <label htmlFor="muito-neg">⚠️ Muito negativo</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="NEGATIVO" id="neg" />
                      <label htmlFor="neg">😞 Negativo</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="NEUTRO" id="neutro" />
                      <label htmlFor="neutro">😐 Neutro</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="POSITIVO" id="pos" />
                      <label htmlFor="pos">😊 Positivo</label>
                    </div>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Avaliação Suporte */}
        <FormField
          control={form.control}
          name="avaliacaoSuporte"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avaliação Suporte (1-5) *</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => field.onChange(i)}
                      className={`text-2xl ${
                        field.value >= i ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Grau Insatisfação */}
        <FormField
          control={form.control}
          name="grauInsatisfacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grau Insatisfação (1-10) *</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[field.value || 1]}
                    onValueChange={(val) => field.onChange(val[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Leve</span>
                    <span className="font-semibold text-lg">{field.value}</span>
                    <span>Extrema</span>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Chance Recuperação */}
        <FormField
          control={form.control}
          name="chanceRecuperacao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chance de Recuperação *</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value}>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="MUITO_BAIXA" />
                      <label>Muito Baixa (0-20%)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="BAIXA" />
                      <label>Baixa (20-40%)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="MEDIA" />
                      <label>Média (40-60%)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="ALTA" />
                      <label>Alta (60-80%)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="MUITO_ALTA" />
                      <label>Muito Alta (80-100%)</label>
                    </div>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Risk Score Display */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-600">Risk Score</p>
              <p className="text-2xl font-bold mt-1">{riskScore.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Categoria</p>
              <p className="text-lg font-semibold mt-1">
                {riskScore >= 80 ? '🔴 CRÍTICO' :
                 riskScore >= 60 ? '🟠 ALTO' :
                 riskScore >= 40 ? '🟡 MÉDIO' : '🟢 BAIXO'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Estratégia</p>
              <p className="text-xs font-semibold mt-2">
                {riskScore >= 80 ? 'Urgente: Contato 48h' :
                 riskScore >= 60 ? 'Proativa: Reunião' :
                 riskScore >= 40 ? 'Standard: Check-in' : 'Light: Acompanhar'}
              </p>
            </div>
          </div>
        </Card>
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" type="button">
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Salvar Diagnosis
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## 6. Shared Components

**File:** `components/shared/RiskScoreBadge.tsx`

```typescript
interface RiskScoreBadgeProps {
  score: number;
}

export function RiskScoreBadge({ score }: RiskScoreBadgeProps) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };
  
  const getLabel = (score: number) => {
    if (score >= 80) return 'CRÍTICO';
    if (score >= 60) return 'ALTO';
    if (score >= 40) return 'MÉDIO';
    return 'BAIXO';
  };
  
  return (
    <span className={`px-3 py-1 rounded-full font-semibold text-sm ${getColor(score)}`}>
      {getLabel(score)} ({score})
    </span>
  );
}
```

**File:** `components/shared/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusMap: Record<string, {color: string, label: string}> = {
    ATIVO: {color: 'bg-blue-100 text-blue-800', label: '🔵 Ativo'},
    REMARCADO: {color: 'bg-gray-100 text-gray-800', label: '⏰ Remarcado'},
    NEGOCIANDO: {color: 'bg-purple-100 text-purple-800', label: '💬 Negociando'},
    CANCELADO: {color: 'bg-red-100 text-red-800', label: '❌ Cancelado'},
    REATIVADO: {color: 'bg-green-100 text-green-800', label: '✅ Reativado'},
    FECHADO: {color: 'bg-gray-100 text-gray-800', label: '📁 Fechado'}
  };
  
  const config = statusMap[status] || statusMap.ATIVO;
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}
```

---

## 7. Charts (Recharts)

**File:** `components/charts/TaxaSucessoChart.tsx`

```typescript
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface TaxaSucessoChartProps {
  data: Array<{date: string, taxa: number}>;
}

export function TaxaSucessoChart({ data }: TaxaSucessoChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(value) => `${value}%`} />
        <Legend />
        <Line
          type="monotone"
          dataKey="taxa"
          stroke="#0066CC"
          name="Taxa Sucesso (%)"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## Checklist de Implementação

- ✅ Custom hooks: useCasoChurn, useDashboardRetencao, useRetencaoAlerts
- ✅ Page components: Dashboard, ListaCasos, DetalheCaso, ClientesChurned
- ✅ Card components: CasoCard, KPICard
- ✅ Tab components: Diagnosis, Plano, Ações, Timeline
- ✅ Modal components: Create, Transition, Plano, Ação, Relatório
- ✅ Form components: DiagnosisForm, CreateCasoForm, TransitionStatusForm
- ✅ Shared components: RiskScoreBadge, StatusBadge
- ✅ Chart components: LineChart, BarChart, PieChart, BarChartHorizontal
- ✅ Filter components: FilterSidebar, DashboardFilters
- ✅ WebSocket integration: useRetencaoAlerts
- ✅ React Query integration: all endpoints cached
- ✅ Form validation: Zod + React Hook Form
- ✅ Error boundaries: LoadingState, ErrorAlert
- ✅ Responsive design: mobile + tablet + desktop

---

## Sprint 28 — Frontend PRONTO ✅

Next: Rodrigo Almeida (QA) — 20 test cases cobrindo todas as funcionalidades
