interface KPICardsProps {
  data: {
    total_casos: number;
    taxa_diagnosticados: number;
    taxa_planejados: number;
    taxa_recuperados: number;
    acoes_pendentes: number;
    valor_total_em_risco: number;
  } | null;
}

export default function KPICards({ data }: KPICardsProps) {
  if (!data) return null;

  const kpis = [
    {
      title: 'Total de Casos',
      value: data.total_casos,
      icon: '📊',
      color: 'bg-blue-50 text-blue-700'
    },
    {
      title: 'Taxa Diagnóstico',
      value: `${data.taxa_diagnosticados.toFixed(1)}%`,
      icon: '🔍',
      color: 'bg-green-50 text-green-700'
    },
    {
      title: 'Taxa Planejamento',
      value: `${data.taxa_planejados.toFixed(1)}%`,
      icon: '📈',
      color: 'bg-purple-50 text-purple-700'
    },
    {
      title: 'Taxa Recuperação',
      value: `${data.taxa_recuperados.toFixed(1)}%`,
      icon: '✅',
      color: 'bg-amber-50 text-amber-700'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.title} className={`${kpi.color} p-6 rounded-lg`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-75">{kpi.title}</p>
              <p className="text-2xl font-bold mt-2">{kpi.value}</p>
            </div>
            <span className="text-4xl">{kpi.icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
