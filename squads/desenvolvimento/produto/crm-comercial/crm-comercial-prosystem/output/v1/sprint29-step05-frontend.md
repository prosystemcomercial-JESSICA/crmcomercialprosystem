# Sprint 29 — Step 05 — Isabela Costa (Frontend)
# Pesquisa de Motivos de Churn — Componentes e Páginas React

## Estrutura de Diretórios

```
app/(dashboard)/
├── pesquisa/
│   ├── page.tsx                    # T1: Dashboard com KPIs + Filtros
│   └── layout.tsx
│
├── surveys/
│   └── [id]/
│       └── page.tsx                # T2-T5: Survey de Saída (público)
│
├── components/
│   ├── pesquisa/
│   │   ├── DashboardPesquisa.tsx
│   │   ├── KPICard.tsx
│   │   ├── SentimentoChart.tsx     # Pie: distribuição de sentimentos
│   │   ├── MotivosChart.tsx        # Bar: motivos reais vs respondidos
│   │   ├── TendenciaChart.tsx      # Line: evolução ao longo do tempo
│   │   ├── TopKeywordsChart.tsx    # Bar: palavras-chave mais frequentes
│   │   ├── PesquisaFilters.tsx
│   │   └── Modals/
│   │       ├── ExportReportModal.tsx
│   │       └── AnaliseComparativaModal.tsx
│   │
│   ├── survey/
│   │   ├── SurveyForm.tsx          # Multi-step form com progresso
│   │   ├── SurveyQuestion.tsx      # Componente para cada tipo Q
│   │   ├── SurveyThankYou.tsx      # Screen de conclusão
│   │   └── SurveyExpired.tsx       # Screen de expirada
│   │
│   ├── shared/
│   │   ├── SentimentoBadge.tsx     # Cor conforme label (muito_negativo=red)
│   │   ├── ConfidenceBadge.tsx
│   │   └── LoadingState.tsx
│   │
│   └── charts/
│       ├── SentimentoDistributionChart.tsx
│       ├── ChurnMotivoChart.tsx
│       └── TimeSeriesChart.tsx
│
└── hooks/
    ├── useSurveyChurn.ts           # Queries para surveys
    ├── useSurveyResponse.ts        # Mutation para responder
    ├── useDashboardPesquisa.ts     # Dashboard KPIs + charts
    └── usePesquisaFilters.ts       # Filter state management
```

---

## 1. Custom Hooks

### `hooks/useSurveyChurn.ts`

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import * as api from '@/lib/api/surveys';

export const useSurveyChurn = (surveyId: string) => {
  return useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => api.getSurveyPublic(surveyId),
    staleTime: 30 * 60 * 1000, // 30min
    retry: 1
  });
};

export const useSurveysList = (filters?: Record<string, any>) => {
  return useQuery({
    queryKey: ['surveys', filters],
    queryFn: () => api.listSurveys(filters),
    staleTime: 10 * 60 * 1000,
    retry: 2
  });
};

export const useSurveyResponse = () => {
  return useMutation({
    mutationFn: (data: {surveyId: string; responses: Record<string, any>}) =>
      api.respondSurvey(data.surveyId, data.responses),
    onSuccess: () => {
      // Auto-invalidate dashboard to show new response
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'pesquisa'] });
    }
  });
};

export const useSurveyByToken = (token: string) => {
  return useQuery({
    queryKey: ['survey-token', token],
    queryFn: () => api.getSurveyByToken(token),
    enabled: !!token,
    staleTime: 30 * 60 * 1000
  });
};
```

### `hooks/useDashboardPesquisa.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api/dashboard-pesquisa';

export const useDashboardPesquisa = (filters: {periodo?: string; status?: string; motivo?: string}) => {
  return useQuery({
    queryKey: ['dashboard', 'pesquisa', filters],
    queryFn: () => api.getDashboardKPIs(filters),
    staleTime: 30 * 60 * 1000,
    retry: 2
  });
};

export const useSentimentoDistribution = (filters?: Record<string, any>) => {
  return useQuery({
    queryKey: ['chart', 'sentimento', filters],
    queryFn: () => api.getSentimentoChart(filters),
    staleTime: 30 * 60 * 1000
  });
};

export const useChurnMotivoChart = (filters?: Record<string, any>) => {
  return useQuery({
    queryKey: ['chart', 'motivos', filters],
    queryFn: () => api.getMotivoChart(filters),
    staleTime: 30 * 60 * 1000
  });
};

export const useSurveyReport = (tipo: 'pdf' | 'xlsx' | 'json', filters: Record<string, any>) => {
  return useMutation({
    mutationFn: () => api.generateReport(tipo, filters),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-pesquisa.${tipo === 'xlsx' ? 'xlsx' : tipo}`;
      a.click();
    }
  });
};
```

### `hooks/usePesquisaFilters.ts`

```typescript
import { useState, useCallback } from 'react';

export const usePesquisaFilters = () => {
  const [filters, setFilters] = useState({
    periodo: '30dias',
    status: 'all',
    motivo: 'all',
    sentimento: 'all'
  });

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({...prev, [key]: value}));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      periodo: '30dias',
      status: 'all',
      motivo: 'all',
      sentimento: 'all'
    });
  }, []);

  return { filters, updateFilter, clearFilters };
};
```

---

## 2. Componentes de Página

### `app/(dashboard)/pesquisa/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { DashboardPesquisa } from '@/components/pesquisa/DashboardPesquisa';
import { PesquisaFilters } from '@/components/pesquisa/PesquisaFilters';
import { usePesquisaFilters } from '@/hooks/usePesquisaFilters';

export default function PesquisaPage() {
  const { filters, updateFilter, clearFilters } = usePesquisaFilters();

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Pesquisa de Saída</h1>
      </div>

      <PesquisaFilters
        filters={filters}
        onFilterChange={updateFilter}
        onClear={clearFilters}
      />

      <DashboardPesquisa filters={filters} />
    </div>
  );
}
```

### `app/(dashboard)/surveys/[id]/page.tsx`

```typescript
'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { SurveyForm } from '@/components/survey/SurveyForm';
import { SurveyExpired } from '@/components/survey/SurveyExpired';
import { useSurveyChurn } from '@/hooks/useSurveyChurn';
import { LoadingState } from '@/components/shared/LoadingState';

export default function SurveyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyId = params.id as string;
  const token = searchParams.get('token');

  const { data: survey, isLoading, error } = useSurveyChurn(surveyId);

  if (isLoading) return <LoadingState />;
  
  if (error || !survey) {
    return <SurveyExpired />;
  }

  if (survey.expira_em < new Date()) {
    return <SurveyExpired />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <SurveyForm surveyId={surveyId} token={token} survey={survey} />
      </div>
    </div>
  );
}
```

---

## 3. Componentes de Survey

### `components/survey/SurveyForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SurveyQuestion } from './SurveyQuestion';
import { SurveyThankYou } from './SurveyThankYou';
import { useSurveyResponse } from '@/hooks/useSurveyChurn';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const surveySchema = z.object({
  q1: z.string().min(10, 'Mínimo 10 caracteres'),
  q2: z.string().optional(),
  q3: z.number().int().min(1).max(10),
  q4: z.enum(['sim', 'não', 'talvez']),
  q5: z.number().int().min(1).max(5)
});

type SurveyFormData = z.infer<typeof surveySchema>;

export function SurveyForm({ surveyId, survey }: {surveyId: string; survey: any}) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const { mutate, isPending } = useSurveyResponse();

  const { control, handleSubmit, formState: {errors} } = useForm<SurveyFormData>({
    resolver: zodResolver(surveySchema),
    mode: 'onBlur'
  });

  const onSubmit = async (data: SurveyFormData) => {
    mutate(
      { surveyId, responses: data },
      {
        onSuccess: () => {
          setSubmitted(true);
        }
      }
    );
  };

  if (submitted) {
    return <SurveyThankYou clienteNome={survey.cliente?.nome} />;
  }

  const questions = [
    { id: 1, type: 'text', label: 'Por que decidiu cancelar?' },
    { id: 2, type: 'textarea', label: 'Há algo que gostaríamos de melhorar?' },
    { id: 3, type: 'slider', label: 'Como avalia nosso produto?', min: 1, max: 10 },
    { id: 4, type: 'radio', label: 'Voltaria a usar em outra situação?', options: ['sim', 'não', 'talvez'] },
    { id: 5, type: 'stars', label: 'Recomendaria para um amigo?' }
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Sua opinião é importante
          </h2>
          <p className="text-gray-600">
            Ajude-nos a melhorar respondendo algumas perguntas rápidas
          </p>
        </div>

        <Progress value={(step / questions.length) * 100} className="mb-8" />

        <div className="mb-8">
          <SurveyQuestion
            question={questions[step - 1]}
            fieldName={`q${step}`}
            control={control}
            error={errors[`q${step}` as keyof SurveyFormData]}
          />
        </div>

        <div className="flex justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            Anterior
          </Button>

          {step < questions.length ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
            >
              Próximo
            </Button>
          ) : (
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Enviando...' : 'Enviar Pesquisa'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
```

### `components/survey/SurveyQuestion.tsx`

```typescript
'use client';

import { Controller } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export function SurveyQuestion({ question, fieldName, control, error }: any) {
  return (
    <div className="space-y-4">
      <Label className="text-lg font-semibold">{question.label}</Label>

      <Controller
        name={fieldName}
        control={control}
        render={({ field }) => {
          switch (question.type) {
            case 'text':
              return (
                <Input
                  {...field}
                  placeholder="Sua resposta..."
                  className={error ? 'border-red-500' : ''}
                />
              );

            case 'textarea':
              return (
                <Textarea
                  {...field}
                  placeholder="Detalhes opcionais..."
                  rows={4}
                  className={error ? 'border-red-500' : ''}
                />
              );

            case 'slider':
              return (
                <div className="space-y-4">
                  <Slider
                    min={question.min}
                    max={question.max}
                    step={1}
                    value={[field.value || 5]}
                    onValueChange={(val) => field.onChange(val[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{question.min}</span>
                    <span className="font-semibold text-gray-900">{field.value || 5}</span>
                    <span>{question.max}</span>
                  </div>
                </div>
              );

            case 'radio':
              return (
                <RadioGroup value={field.value} onValueChange={field.onChange}>
                  {question.options.map((opt: string) => (
                    <div key={opt} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt} id={opt} />
                      <Label htmlFor={opt} className="capitalize cursor-pointer">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              );

            case 'stars':
              return (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => field.onChange(star)}
                      className={`text-3xl transition ${
                        star <= (field.value || 0) ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              );

            default:
              return null;
          }
        }}
      />

      {error && <p className="text-red-500 text-sm">{error.message}</p>}
    </div>
  );
}
```

### `components/survey/SurveyThankYou.tsx`

```typescript
'use client';

import { CheckCircle2 } from 'lucide-react';

export function SurveyThankYou({ clienteNome }: {clienteNome?: string}) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-12 text-center space-y-6">
      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Obrigado!</h2>
        <p className="text-gray-600 mt-2">
          Sua resposta foi recebida e analisada. Seus feedbacks nos ajudam a melhorar.
        </p>
      </div>

      <p className="text-sm text-gray-500">
        Você será redirecionado em breve...
      </p>
    </div>
  );
}
```

### `components/survey/SurveyExpired.tsx`

```typescript
'use client';

import { AlertCircle } from 'lucide-react';

export function SurveyExpired() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-12 text-center space-y-6">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pesquisa Expirada</h2>
        <p className="text-gray-600 mt-2">
          O período para responder esta pesquisa já terminou. Obrigado pelo interesse.
        </p>
      </div>
    </div>
  );
}
```

---

## 4. Componentes de Dashboard

### `components/pesquisa/DashboardPesquisa.tsx`

```typescript
'use client';

import { useDashboardPesquisa } from '@/hooks/useDashboardPesquisa';
import { KPICard } from './KPICard';
import { SentimentoChart } from './SentimentoChart';
import { MotivosChart } from './MotivosChart';
import { TendenciaChart } from './TendenciaChart';
import { TopKeywordsChart } from './TopKeywordsChart';
import { LoadingState } from '@/components/shared/LoadingState';
import { Grid } from '@/components/ui/grid';

export function DashboardPesquisa({ filters }: {filters: Record<string, any>}) {
  const { data: dashboard, isLoading } = useDashboardPesquisa(filters);

  if (isLoading) return <LoadingState />;
  if (!dashboard) return <div>Nenhum dado disponível</div>;

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <Grid cols={4} gap={4}>
        <KPICard
          title="Pesquisas Enviadas"
          value={dashboard.kpis.totalEnviadas}
          change={dashboard.kpis.changeEnviadas}
        />
        <KPICard
          title="Taxa de Resposta"
          value={`${dashboard.kpis.taxaResposta}%`}
          change={dashboard.kpis.changeTaxa}
        />
        <KPICard
          title="Sentimento Médio"
          value={dashboard.kpis.sentimentoMedio.toFixed(2)}
          change={dashboard.kpis.changesentimento}
          suffix={dashboard.kpis.sentimentoLabel}
        />
        <KPICard
          title="Padrões Detectados"
          value={dashboard.kpis.padroesDtetectados}
          change={dashboard.kpis.changePatterns}
        />
      </Grid>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição de Sentimentos</h3>
          <SentimentoChart data={dashboard.charts.sentimento} />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Motivos de Churn</h3>
          <MotivosChart data={dashboard.charts.motivos} />
        </div>

        <div className="col-span-2 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Tendência ao Longo do Tempo</h3>
          <TendenciaChart data={dashboard.charts.tendencia} />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Palavras-Chave Mais Frequentes</h3>
          <TopKeywordsChart data={dashboard.charts.topKeywords} />
        </div>
      </div>
    </div>
  );
}
```

### `components/pesquisa/KPICard.tsx`

```typescript
'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function KPICard({ title, value, change, suffix }: any) {
  const isPositive = change >= 0;

  return (
    <Card className="p-6 bg-white">
      <h4 className="text-sm font-medium text-gray-600 mb-2">{title}</h4>
      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-bold text-gray-900">
          {value}
          {suffix && <span className="text-sm text-gray-500 ml-2">{suffix}</span>}
        </div>
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{Math.abs(change)}%</span>
        </div>
      </div>
    </Card>
  );
}
```

### `components/pesquisa/SentimentoChart.tsx`

```typescript
'use client';

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

const SENTIMENT_COLORS = {
  MUITO_NEGATIVO: '#ef4444',
  NEGATIVO: '#f97316',
  NEUTRO: '#9ca3af',
  POSITIVO: '#22c55e',
  MUITO_POSITIVO: '#16a34a'
};

export function SentimentoChart({ data }: {data: any[]}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({name, value}) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name as keyof typeof SENTIMENT_COLORS]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

### `components/pesquisa/MotivosChart.tsx`

```typescript
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function MotivosChart({ data }: {data: any[]}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="motivo" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### `components/pesquisa/TendenciaChart.tsx`

```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function TendenciaChart({ data }: {data: any[]}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="data" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="pesquisas" stroke="#3b82f6" />
        <Line type="monotone" dataKey="respostas" stroke="#10b981" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### `components/pesquisa/TopKeywordsChart.tsx`

```typescript
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function TopKeywordsChart({ data }: {data: any[]}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis dataKey="palavra" type="category" width={100} />
        <Tooltip />
        <Bar dataKey="frequencia" fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

## 5. Componentes Compartilhados

### `components/shared/SentimentoBadge.tsx`

```typescript
'use client';

export function SentimentoBadge({ label, score }: {label: string; score?: number}) {
  const colors: Record<string, string> = {
    MUITO_NEGATIVO: 'bg-red-100 text-red-800',
    NEGATIVO: 'bg-orange-100 text-orange-800',
    NEUTRO: 'bg-gray-100 text-gray-800',
    POSITIVO: 'bg-green-100 text-green-800',
    MUITO_POSITIVO: 'bg-emerald-100 text-emerald-800'
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colors[label]}`}>
      {label.replace(/_/g, ' ')}
      {score !== undefined && ` (${score.toFixed(2)})`}
    </span>
  );
}
```

### `components/shared/ConfidenceBadge.tsx`

```typescript
'use client';

export function ConfidenceBadge({ level }: {level: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'}) {
  const variants = {
    HIGH: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-orange-100 text-orange-800',
    NONE: 'bg-gray-100 text-gray-800'
  };

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${variants[level]}`}>
      {level}
    </span>
  );
}
```

---

## 6. Filtros

### `components/pesquisa/PesquisaFilters.tsx`

```typescript
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const PERIODOS = [
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: '90dias', label: 'Últimos 90 dias' },
  { value: 'custom', label: 'Personalizado' }
];

const STATUS = [
  { value: 'all', label: 'Todos' },
  { value: 'PENDING', label: 'Aguardando Resposta' },
  { value: 'RESPONDED', label: 'Respondida' },
  { value: 'EXPIRED', label: 'Expirada' }
];

const SENTIMENTOS = [
  { value: 'all', label: 'Todos' },
  { value: 'MUITO_NEGATIVO', label: 'Muito Negativo' },
  { value: 'NEGATIVO', label: 'Negativo' },
  { value: 'NEUTRO', label: 'Neutro' },
  { value: 'POSITIVO', label: 'Positivo' },
  { value: 'MUITO_POSITIVO', label: 'Muito Positivo' }
];

export function PesquisaFilters({ filters, onFilterChange, onClear }: any) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Select value={filters.periodo} onValueChange={(val) => onFilterChange('periodo', val)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(val) => onFilterChange('status', val)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sentimento} onValueChange={(val) => onFilterChange('sentimento', val)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SENTIMENTOS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={onClear} className="gap-2">
          <X size={16} /> Limpar
        </Button>
      </div>
    </div>
  );
}
```

---

## 7. Integração com API

### `lib/api/surveys.ts`

```typescript
import { apiClient } from './client';

export async function getSurveyPublic(surveyId: string) {
  return apiClient.get(`/surveys/${surveyId}/public`);
}

export async function listSurveys(filters?: Record<string, any>) {
  return apiClient.get('/surveys/saida', { params: filters });
}

export async function respondSurvey(surveyId: string, data: Record<string, any>) {
  return apiClient.post(`/surveys/${surveyId}/respond`, data);
}

export async function getSurveyByToken(token: string) {
  return apiClient.get(`/surveys/public`, { params: { token } });
}
```

### `lib/api/dashboard-pesquisa.ts`

```typescript
import { apiClient } from './client';

export async function getDashboardKPIs(filters: Record<string, any>) {
  return apiClient.get('/dashboard/pesquisa', { params: filters });
}

export async function getSentimentoChart(filters?: Record<string, any>) {
  return apiClient.get('/dashboard/pesquisa/charts/sentimento', { params: filters });
}

export async function getMotivoChart(filters?: Record<string, any>) {
  return apiClient.get('/dashboard/pesquisa/charts/motivos', { params: filters });
}

export async function generateReport(tipo: string, filters: Record<string, any>) {
  return apiClient.get('/relatorios/pesquisa', {
    params: { tipo, ...filters },
    responseType: 'blob'
  });
}
```

---

## Sprint 29 Step 05 — Frontend PRONTO ✅

Next: Rodrigo Almeida (QA) — 20 test cases
