'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// IA Laya: mostra o que ela entendeu da conversa e a equipe confirma ou corrige.
// Cada confirmação vira uma amostra de treino (fase de aprendizado de 20 dias).

type Sugestao = { segmento: string; intencao: string; cancelar: number; urgencia: number };

const SEGMENTOS: [string, string][] = [
  ['farmacia', 'Farmácia'], ['manipulacao', 'Manipulação'], ['padaria', 'Padaria'],
  ['varejo', 'Varejo'], ['outro', 'Outro ramo'], ['nao_sei', 'Não dá para saber'],
];
const INTENCOES: [string, string][] = [
  ['comprar', 'Quer comprar'], ['suporte', 'Suporte'], ['financeiro', 'Financeiro'],
  ['servicos', 'Serviços'], ['outro', 'Outro assunto'],
];
const TIPOS_SEM_IA = ['EQUIPE', 'PARCEIRO', 'FORNECEDOR', 'OUTRO'];

export default function PainelLaya({ conversa }: { conversa: { id: string; tipo_contato?: string | null; ia_sugestao?: Sugestao | null } }) {
  const s = conversa.ia_sugestao || null;
  const [segmento, setSegmento] = useState('nao_sei');
  const [intencao, setIntencao] = useState('outro');
  const [cancelar, setCancelar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Nova sugestão (ou outra conversa): recomeça o formulário a partir dela.
  const chave = `${conversa.id}|${s?.segmento}|${s?.intencao}|${s?.cancelar}`;
  useEffect(() => {
    setSegmento(s?.segmento || 'nao_sei');
    setIntencao(s?.intencao || 'outro');
    setCancelar((s?.cancelar ?? 0) >= 0.5);
    setAviso(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (conversa.tipo_contato && TIPOS_SEM_IA.includes(conversa.tipo_contato)) return null;

  const salvar = async (ignorar = false) => {
    setSalvando(true);
    try {
      const r = await apiClient.salvarIaRotulos(conversa.id, ignorar ? { ignorar: true } : { segmento, intencao, cancelar });
      setAviso(`✓ Aprendido! ${r.data.data.total} conversas ensinadas até agora.`);
    } catch (e: any) {
      setAviso(e?.response?.data?.message || 'Não foi possível salvar agora.');
    } finally {
      setSalvando(false);
    }
  };

  const riscoAlto = (s?.cancelar ?? 0) >= 0.5;
  return (
    <div className="px-4 py-3.5 border-b border-gray-100">
      <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">🤖 IA Laya · aprendendo</p>
      {s ? (
        <p className="text-xs text-gray-600 mb-2">
          Entendi: <b>{SEGMENTOS.find(x => x[0] === s.segmento)?.[1]}</b> · <b>{INTENCOES.find(x => x[0] === s.intencao)?.[1]}</b>
          {riscoAlto && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">risco de cancelar</span>}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-2">Ainda analisando… você já pode ensinar abaixo.</p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <select value={segmento} onChange={e => setSegmento(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
          {SEGMENTOS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <select value={intencao} onChange={e => setIntencao(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
          {INTENCOES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-gray-600 mt-1.5">
        <input type="checkbox" checked={cancelar} onChange={e => setCancelar(e.target.checked)} /> Ameaça cancelar / trocar de sistema
      </label>
      <div className="flex gap-1.5 mt-2">
        <button disabled={salvando} onClick={() => salvar(false)}
          className="flex-1 text-xs font-semibold text-white rounded-lg py-1.5 disabled:opacity-50" style={{ background: '#7c3aed' }}>
          ✓ Confirmar
        </button>
        <button disabled={salvando} onClick={() => salvar(true)} title="Conversa pessoal ou sem relação com vendas: o Laya não aprende com ela"
          className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50">
          Não comercial
        </button>
      </div>
      {aviso && <p className="text-[11px] text-gray-500 mt-1.5">{aviso}</p>}
    </div>
  );
}
