'use client';

import { useState } from 'react';
import { X, CheckCircle2, DollarSign, Calendar, FileText, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Props = {
  leadId: string;
  leadNome?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

const PLANOS = [
  { value: 'BASIC', label: 'Basic',  color: '#64748b', mrrSug: 199  },
  { value: 'MEI',   label: 'MEI',    color: '#0891b2', mrrSug: 149  },
  { value: 'PRO',   label: 'Pro',    color: '#4B8EC8', mrrSug: 399  },
  { value: 'PLUS',  label: 'Plus',   color: '#7c3aed', mrrSug: 699  },
];

const FORMAS = [
  { value: 'PIX',           label: 'PIX',          emoji: '⚡' },
  { value: 'BOLETO',        label: 'Boleto',       emoji: '📄' },
  { value: 'CARTAO',        label: 'Cartão',       emoji: '💳' },
  { value: 'TRANSFERENCIA', label: 'Transferência',emoji: '🏦' },
];

export function FecharLeadModal({ leadId, leadNome, onClose, onSuccess }: Props) {
  const [plano, setPlano] = useState<'BASIC'|'MEI'|'PRO'|'PLUS'|''>('');
  const [valorInst, setValorInst] = useState('');
  const [mrr, setMrr] = useState('');
  const [valorEntrada, setValorEntrada] = useState('');
  const [formaEntrada, setFormaEntrada] = useState<'PIX'|'BOLETO'|'CARTAO'|'TRANSFERENCIA'|''>('');
  const [parcelas, setParcelas] = useState('1');
  const [data1Cob, setData1Cob] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const podeSalvar = plano && valorInst && mrr && valorEntrada && formaEntrada;

  const handleSalvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro('');
    try {
      await apiClient.fecharLead(leadId, {
        plano: plano as any,
        valor_instalacao: parseFloat(valorInst.replace(',', '.')),
        mrr: parseFloat(mrr.replace(',', '.')),
        valor_entrada: parseFloat(valorEntrada.replace(',', '.')),
        forma_entrada: formaEntrada as any,
        parcelas_instalacao: parseInt(parcelas) || 1,
        data_1cob: data1Cob ? new Date(data1Cob).toISOString() : undefined,
        observacoes: observacoes || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.message || e?.message || 'Erro ao salvar fechamento');
    }
    setSalvando(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto'
        }}>
        {/* Header verde — celebração de venda fechada */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #d1fae5',
          background: 'linear-gradient(135deg, #dcfce7, #f0fdf4)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={22} color="#16a34a" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0D2238' }}>Fechar venda</div>
              {leadNome && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{leadNome}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Plano */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginBottom: 8, display: 'block' }}>
              Plano contratado *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {PLANOS.map(p => (
                <button key={p.value} type="button"
                  onClick={() => {
                    setPlano(p.value as any);
                    if (!mrr) setMrr(String(p.mrrSug));
                  }}
                  style={{
                    padding: '12px 8px', borderRadius: 10,
                    background: plano === p.value ? p.color : '#fff',
                    color: plano === p.value ? '#fff' : p.color,
                    border: `2px solid ${p.color}`, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Valores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginBottom: 6, display: 'block' }}>
                Valor instalação (R$) *
              </label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                <input type="text" inputMode="decimal" value={valorInst}
                  onChange={e => setValorInst(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="0,00"
                  style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginBottom: 6, display: 'block' }}>
                Mensalidade MRR (R$) *
              </label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                <input type="text" inputMode="decimal" value={mrr}
                  onChange={e => setMrr(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="0,00"
                  style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
              </div>
            </div>
          </div>

          {/* Entrada */}
          <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>💰 Entrada da instalação</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#92400e', marginBottom: 4, display: 'block' }}>
                  Valor entrada (R$) *
                </label>
                <input type="text" inputMode="decimal" value={valorEntrada}
                  onChange={e => setValorEntrada(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="0,00"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #fde047', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#92400e', marginBottom: 4, display: 'block' }}>
                  Parcelas restantes
                </label>
                <select value={parcelas} onChange={e => setParcelas(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #fde047', fontSize: 13 }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#92400e', marginBottom: 6, display: 'block' }}>
                Forma de pagamento da entrada *
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FORMAS.map(f => (
                  <button key={f.value} type="button"
                    onClick={() => setFormaEntrada(f.value as any)}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: formaEntrada === f.value ? '#92400e' : '#fff',
                      color: formaEntrada === f.value ? '#fff' : '#92400e',
                      border: '1.5px solid #92400e', cursor: 'pointer'
                    }}>
                    {f.emoji} {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Data 1ª cobrança */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginBottom: 6, display: 'block' }}>
              Data 1ª cobrança da mensalidade
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
              <input type="date" value={data1Cob} onChange={e => setData1Cob(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginBottom: 6, display: 'block' }}>
              Observações
            </label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Condições especiais, descontos, prazos negociados..."
              rows={2}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          {erro && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
              ⚠️ {erro}
            </div>
          )}

          {/* Resumo */}
          {plano && valorInst && mrr && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginBottom: 6 }}>📊 Resumo</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Plano <strong>{plano}</strong></span>
                <span>Instalação: <strong>R$ {valorInst}</strong></span>
                <span>MRR: <strong>R$ {mrr}/mês</strong></span>
              </div>
            </div>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
            <button onClick={onClose}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b' }}>
              Cancelar
            </button>
            <button onClick={handleSalvar} disabled={!podeSalvar || salvando}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: podeSalvar ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#cbd5e1',
                color: '#fff', cursor: podeSalvar ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {salvando ? 'Salvando...' : 'Confirmar fechamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
