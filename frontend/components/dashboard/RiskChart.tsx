interface RiskChartProps {
  data: {
    BAIXO: number;
    MÉDIO: number;
    ALTO: number;
  } | undefined;
}

export default function RiskChart({ data }: RiskChartProps) {
  if (!data) return null;

  const total = data.BAIXO + data.MÉDIO + data.ALTO;
  const getRiskColor = (level: 'BAIXO' | 'MÉDIO' | 'ALTO') => {
    switch (level) {
      case 'BAIXO':
        return 'bg-green-500';
      case 'MÉDIO':
        return 'bg-yellow-500';
      case 'ALTO':
        return 'bg-red-500';
    }
  };

  const getRiskLabelColor = (level: 'BAIXO' | 'MÉDIO' | 'ALTO') => {
    switch (level) {
      case 'BAIXO':
        return 'text-green-700';
      case 'MÉDIO':
        return 'text-yellow-700';
      case 'ALTO':
        return 'text-red-700';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Distribuição de Risco
      </h2>

      <div className="space-y-4">
        {(['BAIXO', 'MÉDIO', 'ALTO'] as const).map((level) => {
          const count = data[level];
          const percentage = total > 0 ? (count / total) * 100 : 0;

          return (
            <div key={level}>
              <div className="flex justify-between items-center mb-2">
                <span className={`font-medium ${getRiskLabelColor(level)}`}>
                  {level}
                </span>
                <span className="text-sm text-gray-600">
                  {count} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getRiskColor(level)}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600">
        <p>Total de casos: {total}</p>
      </div>
    </div>
  );
}
