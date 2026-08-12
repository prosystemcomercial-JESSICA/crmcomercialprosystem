'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { Handshake, Loader2 } from 'lucide-react';
import DetalheCandidato from './DetalheCandidato';

export interface CandidatoResumo {
  id: string;
  nome: string;
  empresa?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf_responsavel?: string | null;
  telefone: string;
  email: string;
  cidade?: string | null;
  estado?: string | null;
  perfil_desejado: string;
  status: string;
  observacoes_internas?: string | null;
  created_at: string;
}

const COLUNAS = [
  { chave: 'NOVO', nome: 'Novo', cor: '#2563eb' },
  { chave: 'EM_ANALISE', nome: 'Em Análise', cor: '#d97706' },
  { chave: 'APROVADO', nome: 'Aprovado', cor: '#16a34a' },
  { chave: 'REPROVADO', nome: 'Reprovado', cor: '#9ca3af' },
];

export const PERFIL_LABEL: Record<string, string> = {
  INDICADOR: 'Indicador',
  REPRESENTANTE: 'Representante',
  FRANQUEADO: 'Franqueado',
};

export default function RepresentantesPage() {
  const [candidatos, setCandidatos] = useState<CandidatoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.client.get('/candidatos-representante');
      setCandidatos(res.data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function moverStatus(candidato: CandidatoResumo, novoStatus: string) {
    setCandidatos(prev => prev.map(c => c.id === candidato.id ? { ...c, status: novoStatus } : c));
    await apiClient.client.patch(`/candidatos-representante/${candidato.id}`, { status: novoStatus });
  }

  const porColuna = (chave: string) => candidatos.filter(c => c.status === chave);

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Handshake size={18} color="var(--t-primary)" />
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-primary)' }}>Representantes</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} className="animate-spin" color="var(--t-primary)" />
          </div>
        ) : (
          <div
            style={{ display: 'flex', gap: 12, overflowX: 'auto' }}
            onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
          >
            {COLUNAS.map(col => {
              const lista = porColuna(col.chave);
              const isOver = dragOverCol === col.chave;
              return (
                <div
                  key={col.chave}
                  style={{
                    width: 260, flexShrink: 0, borderRadius: 12,
                    background: isOver ? `${col.cor}08` : 'var(--t-card-bg)',
                    border: `1px solid ${isOver ? col.cor : `${col.cor}33`}`,
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                  onDragEnter={e => { e.preventDefault(); setDragOverCol(col.chave); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const candidato = candidatos.find(c => c.id === draggingId);
                    if (candidato && candidato.status !== col.chave) moverStatus(candidato, col.chave);
                    setDraggingId(null);
                  }}
                >
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--t-card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-primary)' }}>{col.nome}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-muted)' }}>{lista.length}</span>
                  </div>
                  <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                    {lista.map(c => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', c.id);
                          setTimeout(() => setDraggingId(c.id), 0);
                        }}
                        onClick={() => setSelecionadoId(c.id)}
                        style={{
                          background: 'var(--t-content-bg)', borderRadius: 8, padding: 10,
                          cursor: 'pointer', opacity: draggingId === c.id ? 0.4 : 1,
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{c.nome}</p>
                        {c.empresa && <p style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>{c.empresa}</p>}
                        <p style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>{PERFIL_LABEL[c.perfil_desejado] || c.perfil_desejado}</p>
                        <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{[c.cidade, c.estado].filter(Boolean).join('/') || '—'}</p>
                        <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginTop: 4 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selecionadoId && (
          <DetalheCandidato
            candidatoId={selecionadoId}
            onClose={() => setSelecionadoId(null)}
            onStatusChange={(novoStatus) => {
              setCandidatos(prev => prev.map(c => c.id === selecionadoId ? { ...c, status: novoStatus } : c));
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
