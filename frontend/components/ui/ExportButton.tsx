'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileSpreadsheet, Printer } from 'lucide-react';
import { useIsGestor } from '@/lib/auth-context';
import { exportarCSV, imprimirRelatorio, Coluna } from '@/lib/export-csv';

// Botão "Baixar relatório" reutilizável — SÓ aparece para CEO/Supervisão.
// Exporta exatamente as linhas que receber (respeitando os filtros da tela).
export default function ExportButton<T>({
  nome, titulo, colunas, linhas, small,
}: {
  nome: string;                 // nome-base do arquivo (ex.: "metas")
  titulo: string;               // título do relatório impresso
  colunas: Coluna<T>[];
  linhas: T[];
  small?: boolean;
}) {
  const isGestor = useIsGestor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!isGestor) return null;   // só gestão exporta

  const disabled = !linhas || linhas.length === 0;
  const pad = small ? '6px 10px' : '8px 14px';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        title={disabled ? 'Sem dados para exportar' : 'Baixar relatório'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: pad, borderRadius: 8,
          fontSize: small ? 12 : 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
          border: '1px solid var(--t-card-border, #D8E8F5)', background: 'var(--t-card-bg, #fff)',
          color: 'var(--t-text-primary, #0D2238)', opacity: disabled ? 0.55 : 1,
        }}
      >
        <Download size={small ? 13 : 15} /> Baixar relatório <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 60, minWidth: 200,
          background: 'var(--t-card-bg, #fff)', border: '1px solid var(--t-card-border, #D8E8F5)',
          borderRadius: 10, boxShadow: '0 14px 36px rgba(13,34,56,0.16)', overflow: 'hidden',
        }}>
          <button onClick={() => { exportarCSV(nome, colunas, linhas); setOpen(false); }}
            style={menuItem}>
            <FileSpreadsheet size={14} style={{ color: '#16a34a' }} /> Exportar CSV (Excel)
          </button>
          <button onClick={() => { imprimirRelatorio(titulo, colunas, linhas); setOpen(false); }}
            style={menuItem}>
            <Printer size={14} style={{ color: '#2E6EAB' }} /> Imprimir / Salvar PDF
          </button>
        </div>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  padding: '10px 14px', fontSize: 13, background: 'transparent', border: 'none',
  cursor: 'pointer', color: 'var(--t-text-primary, #0D2238)',
};
