'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Caderno da Laya: quanto ela já aprendeu, em que nível está cada tarefa e o que
// falta a equipe confirmar. Os arquivos baixados ensinam outra IA se ela parar.

type Tarefa = { tarefa: string; nivel: 'aprendiz' | 'assistente' | 'titular'; nome_nivel: string; exemplos: number; acerto: number | null };
type Resumo = { total: number; hoje: number; pendentes: number; tarefas: Tarefa[] };

const NOME: Record<string, string> = { segmento: 'Ramo do cliente', intencao: 'O que o cliente quer', cancelar: 'Risco de cancelar' };
const COR: Record<string, string> = { aprendiz: '#64748b', assistente: '#2563eb', titular: '#15803d' };
const META_DIA = 15;

export default function CadernoLaya() {
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const carregar = () => apiClient.getCadernoLaya().then(x => setR(x.data.data)).catch(() => {});
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, []);

  const baixar = async (tipo: 'caderno' | 'amostras') => {
    setErro('');
    try {
      const x = await apiClient.baixarCadernoLaya(tipo);
      const url = URL.createObjectURL(x.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = tipo === 'caderno' ? `caderno-laya-${new Date().toISOString().slice(0, 10)}.md` : `exemplos-laya-${new Date().toISOString().slice(0, 10)}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setErro('Não foi possível baixar. Só a gestão pode baixar o Caderno.'); }
  };

  if (!r) return null;
  const btn = { padding: '6px 12px', borderRadius: 8, border: '1px solid #7c3aed', background: 'transparent', color: '#7c3aed', fontWeight: 700, fontSize: 12, cursor: 'pointer' } as const;
  return (
    <div style={{ background: 'var(--t-card-bg)', border: '2px solid #7c3aed', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: '1 1 280px' }}>
          <b style={{ fontSize: 16, color: 'var(--t-text-primary)' }}>📓 Caderno da Laya</b>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
            Tudo o que ela aprende com as confirmações da equipe fica escrito aqui, com cópia diária no servidor. Se ela parar, o Caderno ensina outra IA.
          </div>
        </div>
        <button style={btn} onClick={() => baixar('caderno')}>Baixar Caderno</button>
        <button style={btn} onClick={() => baixar('amostras')}>Baixar exemplos (dados)</button>
      </div>
      {erro && <span style={{ fontSize: 12, color: '#dc2626' }}>{erro}</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--t-text-secondary)' }}>
        <span><b style={{ fontSize: 18, color: 'var(--t-text-primary)' }}>{r.total}</b> exemplos confirmados</span>
        <span><b style={{ fontSize: 18, color: r.hoje >= META_DIA ? '#15803d' : 'var(--t-text-primary)' }}>{r.hoje}</b> hoje (meta {META_DIA})</span>
        <span><b style={{ fontSize: 18, color: r.pendentes ? '#ea580c' : 'var(--t-text-primary)' }}>{r.pendentes}</b> conversas esperando confirmação no WhatsApp</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {r.tarefas.map(t => (
          <div key={t.tarefa} style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 10, display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{NOME[t.tarefa] || t.tarefa}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: COR[t.nivel] }}>{t.nome_nivel}</span>
            <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{t.exemplos} exemplos · acerto {t.acerto == null ? '—' : `${t.acerto}%`}</span>
            <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
              {t.nivel === 'aprendiz' ? 'Só sugere. Sobe para Assistente com 30 exemplos e 80% de acerto.' : t.nivel === 'assistente' ? 'Decide quando tem certeza. Titular com 50 exemplos e mais de 90%.' : 'Decide sozinha, sem gastar OpenAI.'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
