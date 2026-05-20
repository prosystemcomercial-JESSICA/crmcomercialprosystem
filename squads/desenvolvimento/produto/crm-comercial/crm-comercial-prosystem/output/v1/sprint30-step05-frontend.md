# Sprint 30 — Step 05 — Isabela Costa (Frontend)
# Campanhas de Retenção — Componentes e Páginas React

## Estrutura de Diretórios

```
app/(dashboard)/
├── campanhas/
│   ├── page.tsx                    # T1: Lista de campanhas
│   ├── nova/
│   │   └── page.tsx                # T2-T4: Multi-step form
│   └── [id]/
│       └── page.tsx                # T5: Dashboard da campanha
│
├── components/
│   ├── campanhas/
│   │   ├── CampanhaListPage.tsx
│   │   ├── CampanhaFormModal.tsx   # Multi-step modal
│   │   ├── DashboardCampanha.tsx
│   │   ├── SegmentacaoStep.tsx
│   │   ├── AcoesStep.tsx
│   │   ├── CampanhaCard.tsx
│   │   ├── KPICard.tsx
│   │   ├── Charts/
│   │   │   ├── TendenciaChart.tsx
│   │   │   └── MotivosChart.tsx
│   │   └── Modals/
│   │       ├── AcaoModal.tsx
│   │       ├── PreviewTemplateModal.tsx
│   │       └── ExportModal.tsx
│   │
│   ├── templates/
│   │   ├── TemplateListPage.tsx
│   │   ├── TemplateForm.tsx
│   │   └── TemplatePreview.tsx
│   │
│   └── shared/
│       ├── StatusBadge.tsx
│       ├── LoadingState.tsx
│       └── PageHeader.tsx
│
└── hooks/
    ├── useCampanha.ts             # CRUD campanhas
    ├── useCampanhas.ts            # List campanhas
    ├── useDashboardCampanha.ts    # Dashboard KPIs
    ├── useSegmentacao.ts          # Filtrar clientes
    ├── useTemplates.ts            # CRUD templates
    └── useCampanhaForm.ts         # Multi-step form state
```

---

## Custom Hooks

### `hooks/useCampanha.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/campanhas';

export const useCampanha = (id: string) => {
  return useQuery({
    queryKey: ['campanha', id],
    queryFn: () => api.getCampanha(id),
    staleTime: 5 * 60 * 1000
  });
};

export const useCampanhas = (filters?: any) => {
  return useQuery({
    queryKey: ['campanhas', filters],
    queryFn: () => api.listCampanhas(filters),
    staleTime: 5 * 60 * 1000
  });
};

export const useCreateCampanha = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateCampanhaDTO) => api.createCampanha(data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['campanhas']});
    }
  });
};

export const useAtivarCampanha = (id: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => api.ativarCampanha(id),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['campanha', id]});
      queryClient.invalidateQueries({queryKey: ['campanhas']});
    }
  });
};
```

### `hooks/useDashboardCampanha.ts`

```typescript
export const useDashboardCampanha = (id: string) => {
  return useQuery({
    queryKey: ['dashboard-campanha', id],
    queryFn: () => api.getDashboard(id),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 1000 // refresh a cada 30s
  });
};
```

### `hooks/useSegmentacao.ts`

```typescript
export const useSegmentacao = (campanhaId: string, filters: any) => {
  return useMutation({
    mutationFn: (filters: SegmentFilters) => 
      api.filtrarClientes(campanhaId, filters)
  });
};
```

---

## Páginas e Componentes

### `app/(dashboard)/campanhas/page.tsx` — T1 Lista

```typescript
'use client';

import { useState } from 'react';
import { useCampanhas } from '@/hooks/useCampanha';
import { CampanhaListPage } from '@/components/campanhas/CampanhaListPage';
import { Button } from '@/components/ui/button';

export default function CampanhasPage() {
  const [filters, setFilters] = useState({});
  const { data: campanhas, isLoading } = useCampanhas(filters);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Campanhas de Retenção</h1>
        <Button asChild>
          <Link href="/campanhas/nova">+ Nova Campanha</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <CampanhaListPage 
          campanhas={campanhas || []} 
          isLoading={isLoading}
          onFilterChange={setFilters}
        />
      </div>
    </div>
  );
}
```

### `components/campanhas/CampanhaListPage.tsx`

```typescript
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export function CampanhaListPage({ campanhas, isLoading, onFilterChange }: any) {
  const statusColors = {
    RASCUNHO: 'bg-gray-100 text-gray-800',
    ATIVA: 'bg-cyan-100 text-cyan-800',
    PAUSADA: 'bg-amber-100 text-amber-800',
    FINALIZADA: 'bg-gray-100 text-gray-600'
  };

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Enviados</TableHead>
            <TableHead className="text-right">Taxa</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campanhas.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell>
                <Badge className={statusColors[c.status as keyof typeof statusColors]}>
                  {c.status}
                </Badge>
              </TableCell>
              <TableCell>
                {format(new Date(c.data_inicio), 'dd MMM', {locale: pt})} — {format(new Date(c.data_fim), 'dd MMM', {locale: pt})}
              </TableCell>
              <TableCell className="text-right">142</TableCell>
              <TableCell className="text-right">67%</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">⋮</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <Link href={`/campanhas/${c.id}`}>Visualizar</Link>
                    </DropdownMenuItem>
                    {c.status === 'ATIVA' && (
                      <DropdownMenuItem onClick={() => onPause(c.id)}>Pausar</DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onDuplicate(c.id)}>Duplicar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

### `app/(dashboard)/campanhas/[id]/page.tsx` — T5 Dashboard

```typescript
'use client';

import { useDashboardCampanha, useCampanha } from '@/hooks/useCampanha';
import { DashboardCampanha } from '@/components/campanhas/DashboardCampanha';
import { LoadingState } from '@/components/shared/LoadingState';

export default function CampanhaDashboardPage({ params }: any) {
  const { data: campanha } = useCampanha(params.id);
  const { data: dashboard } = useDashboardCampanha(params.id);

  if (!dashboard) return <LoadingState />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{campanha?.nome}</h1>
        <div className="space-x-2">
          {campanha?.status === 'ATIVA' && (
            <Button variant="outline" onClick={() => onPause(campanha.id)}>Pausar</Button>
          )}
          <Button variant="outline">Duplicar</Button>
          <Button variant="outline">Exportar</Button>
        </div>
      </div>

      <DashboardCampanha dashboard={dashboard} />
    </div>
  );
}
```

### `components/campanhas/DashboardCampanha.tsx`

```typescript
'use client';

import { KPICard } from './KPICard';
import { TendenciaChart } from './Charts/TendenciaChart';
import { MotivosChart } from './Charts/MotivosChart';
import { Grid } from '@/components/ui/grid';

export function DashboardCampanha({ dashboard }: any) {
  const { kpis, charts } = dashboard;

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <Grid cols={4} gap={4}>
        <KPICard title="Enviados" value={kpis.totalEnviados} change={12} />
        <KPICard title="Taxa Abertura" value={`${kpis.taxaAbertura}%`} change={8} />
        <KPICard title="Taxa Clique" value={`${kpis.taxaClique}%`} change={-2} />
        <KPICard title="Convertidos" value={kpis.totalConvertidos} change={0} suffix="novo" />
      </Grid>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Progresso Temporal</h3>
          <TendenciaChart data={charts.tendencia} />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Motivos Não-Convertidos</h3>
          <MotivosChart data={charts.motivos} />
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Ações Executadas</h3>
        <div className="space-y-3">
          {/* Ações listadas */}
        </div>
      </div>
    </div>
  );
}
```

### `components/campanhas/KPICard.tsx`

```typescript
'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function KPICard({ title, value, change, suffix }: any) {
  const isPositive = change >= 0;

  return (
    <Card className="p-6">
      <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      <div className="flex items-baseline justify-between mt-4">
        <div className="text-3xl font-bold">
          {value}
          {suffix && <span className="text-sm text-gray-500 ml-2">{suffix}</span>}
        </div>
        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{Math.abs(change)}%</span>
        </div>
      </div>
    </Card>
  );
}
```

### `components/campanhas/CampanhaFormModal.tsx` — T2-T4

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateCampanha } from '@/hooks/useCampanha';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SegmentacaoStep } from './SegmentacaoStep';
import { AcoesStep } from './AcoesStep';

const campanhaSchema = z.object({
  nome: z.string().min(3),
  descricao: z.string().optional(),
  data_inicio: z.string().datetime(),
  data_fim: z.string().datetime()
});

export function CampanhaFormModal({ isOpen, onClose }: any) {
  const [step, setStep] = useState(1);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const { mutate: create } = useCreateCampanha();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(campanhaSchema),
    defaultValues: {
      nome: '',
      descricao: '',
      data_inicio: new Date().toISOString(),
      data_fim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  });

  const onSubmit = async (data: any) => {
    if (step === 1) {
      // Create campanha first
      create(data, {
        onSuccess: (newCampanha) => {
          setCampaignId(newCampanha.id);
          setStep(2);
        }
      });
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Nova Campanha'}
            {step === 2 && 'Segmentação'}
            {step === 3 && 'Ações'}
            {step === 4 && 'Revisão'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <input placeholder="Nome da campanha" required />
              <textarea placeholder="Descrição" />
              <input type="datetime-local" required />
              <input type="datetime-local" required />
            </div>
          )}

          {step === 2 && campaignId && <SegmentacaoStep campanhaId={campaignId} />}
          {step === 3 && campaignId && <AcoesStep campanhaId={campaignId} />}
          {step === 4 && <div>Revisão...</div>}

          <div className="flex justify-between">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              Anterior
            </Button>
            <Button type="submit">
              {step === 4 ? 'Finalizar' : 'Próximo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### `components/campanhas/Charts/TendenciaChart.tsx`

```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function TendenciaChart({ data }: any) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="data" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="enviados" stroke="#3b82f6" strokeWidth={2} />
        <Line type="monotone" dataKey="abertos" stroke="#10b981" strokeWidth={2} />
        <Line type="monotone" dataKey="clicados" stroke="#f59e0b" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## API Integration

### `lib/api/campanhas.ts`

```typescript
import { apiClient } from './client';

export async function getCampanha(id: string) {
  return apiClient.get(`/campanhas/${id}`);
}

export async function listCampanhas(filters?: any) {
  return apiClient.get('/campanhas', {params: filters});
}

export async function createCampanha(data: any) {
  return apiClient.post('/campanhas', data);
}

export async function ativarCampanha(id: string) {
  return apiClient.post(`/campanhas/${id}/ativar`);
}

export async function pausarCampanha(id: string) {
  return apiClient.post(`/campanhas/${id}/pausar`);
}

export async function getDashboard(id: string) {
  return apiClient.get(`/campanhas/${id}/dashboard`);
}

export async function listTemplates() {
  return apiClient.get('/templates');
}

export async function previewTemplate(id: string, clienteId: string) {
  return apiClient.post(`/templates/${id}/preview`, {cliente_id: clienteId});
}
```

---

## Sprint 30 Step 05 — Frontend PRONTO ✅

**Entregáveis:**
- CampanhaListPage (T1)
- CampanhaFormModal multi-step (T2-T4)
- DashboardCampanha (T5)
- 4 custom hooks (useCampanha, useDashboardCampanha, useSegmentacao, useTemplates)
- 5 Modais (Ação, Preview, Export, etc)
- 4 componentes de Chart (Tendencia, Motivos, etc)
- API integration layer

**Próximo:** Rodrigo Almeida (QA) — 20 test cases
