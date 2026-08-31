'use client';

interface Aba {
  id: string;
  label: string;
}

interface AbaTabsProps {
  abas: Aba[];
  abaAtiva: string;
  onChange: (id: string) => void;
}

export default function AbaTabs({ abas, abaAtiva, onChange }: AbaTabsProps) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto"
      style={{ borderBottom: '2px solid var(--t-card-border)', marginBottom: 16 }}
    >
      {abas.map(aba => (
        <button
          key={aba.id}
          onClick={() => onChange(aba.id)}
          className="whitespace-nowrap"
          style={{
            appearance: 'none', border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '9px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            color: aba.id === abaAtiva ? 'var(--t-primary-dark)' : 'var(--t-text-muted)',
            borderBottom: aba.id === abaAtiva ? '2px solid var(--t-primary-dark)' : '2px solid transparent',
            marginBottom: -2,
          }}
        >
          {aba.label}
        </button>
      ))}
    </nav>
  );
}
