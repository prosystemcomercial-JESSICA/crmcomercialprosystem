'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const OPCOES: Record<string, { v: string; l: string }[]> = {
  segmento_atuacao: [
    { v: 'FARMACIA_DROGARIA', l: 'Farmácia/Drogaria' }, { v: 'PADARIA_PERECIVEIS', l: 'Padaria/Perecíveis' },
    { v: 'VESTUARIO_CALCADOS', l: 'Vestuário/Calçados' }, { v: 'VAREJO_GERAL', l: 'Varejo Geral' }, { v: 'FOOD_SERVICE', l: 'Food Service' },
  ],
  regime_tributario: [{ v: 'SIMPLES_NACIONAL', l: 'Simples Nacional' }, { v: 'LUCRO_PRESUMIDO', l: 'Lucro Presumido' }, { v: 'LUCRO_REAL', l: 'Lucro Real' }],
  tipo_implantacao: [{ v: 'BANCO_ZERADO', l: 'Banco Zerado (SLA 7 dias)' }, { v: 'MIGRACAO_DADOS', l: 'Migração de Dados (SLA 30 dias)' }],
  tipo_certificado: [{ v: 'A1', l: 'A1 (Arquivo)' }, { v: 'A3', l: 'A3 (Cartão/Token)' }, { v: 'NAO_POSSUI', l: 'Não Possui' }],
};

export default function FichaProjeto({ id, onClose, onChange }: { id: string | null; onClose: () => void; onChange: () => void }) {
  const novo = id === null;
  const [p, setP] = useState<any>(novo ? { cliente_nome: '', funil: 'IMPLANTACAO' } : null);
  const [funis, setFunis] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { api.config().then(r => setFunis(r.data.funis)).catch(() => {}); }, []);
  useEffect(() => { if (!novo && id) api.projeto(id).then(r => setP(r.data)).catch(() => {}); }, [id, novo]);

  if (!p) return null;
  const setF = (k: string, v: any) => setP((x: any) => ({ ...x, [k]: v }));

  const salvarCampos = async () => {
    setSalvando(true);
    try {
      if (novo) { await api.criarProjeto(p); }
      else { await api.editarProjeto(p.id, p); }
      onChange(); onClose();
    } catch (e: any) { alert(e.message); } finally { setSalvando(false); }
  };

  const toggleItem = async (item: any) => {
    try { await api.marcarChecklist(item.id, !item.concluido); const r = await api.projeto(p.id); setP(r.data); }
    catch (e: any) { alert(e.message); }
  };

  // fases do funil atual p/ o seletor de "mover"
  const funilAtual = funis.find((f: any) => f.codigo === p.funil);
  const mover = async (fase: string) => {
    try { await api.moverProjeto(p.id, fase); const r = await api.projeto(p.id); setP(r.data); onChange(); }
    catch (e: any) { alert(e.message); }
  };

  const Campo = ({ k, label, tipo = 'text' }: { k: string; label: string; tipo?: string }) => (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {OPCOES[k] ? (
        <select value={p[k] || ''} onChange={e => setF(k, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="">Selecione…</option>
          {OPCOES[k].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : tipo === 'textarea' ? (
        <textarea value={p[k] || ''} onChange={e => setF(k, e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      ) : (
        <input type={tipo} value={p[k] ?? ''} onChange={e => setF(k, tipo === 'number' ? e.target.value : e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{novo ? 'Novo projeto' : (p.nome_fantasia || p.razao_social || p.cliente_nome)}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo k="cliente_nome" label="Cliente (nome) *" />
            <Campo k="razao_social" label="Razão social" />
            <Campo k="nome_fantasia" label="Nome fantasia" />
            <Campo k="cnpj" label="CNPJ" />
            <Campo k="telefone" label="Telefone" />
            <Campo k="email" label="E-mail" />
          </div>

          {/* Campos personalizados (Parte 1) */}
          <p className="text-xs font-bold text-prosystem-600 pt-2">Dados da implantação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo k="segmento_atuacao" label="Segmento de Atuação" />
            <Campo k="regime_tributario" label="Regime Tributário" />
            <Campo k="tipo_implantacao" label="Tipo de Implantação" />
            <Campo k="tipo_certificado" label="Certificado Digital" />
            <Campo k="erp_anterior" label="ERP/Sistema Anterior" />
            <Campo k="volumetria_pdvs" label="Volumetria de Caixas (PDVs)" tipo="number" />
            <Campo k="csc_sefaz" label="ID do CSC SEFAZ" />
            <Campo k="dados_contador" label="Dados do Contador" tipo="textarea" />
          </div>

          <div className="flex justify-end">
            <button onClick={salvarCampos} disabled={salvando || !p.cliente_nome?.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-prosystem-600 disabled:opacity-50">
              {salvando ? 'Salvando…' : (novo ? 'Criar projeto' : 'Salvar dados')}
            </button>
          </div>

          {/* Checklist da fase + mover (só projeto existente) */}
          {!novo && (
            <>
              <hr />
              {p.checklists?.filter((c: any) => c.fase === p.fase).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-prosystem-600 mb-2">Checklist da fase atual</p>
                  <div className="space-y-1.5">
                    {p.checklists.filter((c: any) => c.fase === p.fase).map((c: any) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={c.concluido} onChange={() => toggleItem(c)} />
                        <span className={c.concluido ? 'line-through text-slate-400' : 'text-slate-700'}>{c.titulo}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {funilAtual && (
                <div>
                  <p className="text-xs font-bold text-prosystem-600 mb-2">Mover para a fase</p>
                  <div className="flex gap-2 flex-wrap">
                    {funilAtual.fases.map((f: any) => (
                      <button key={f.codigo} disabled={f.codigo === p.fase} onClick={() => mover(f.codigo)}
                        className={`px-2.5 py-1 rounded-lg text-xs border ${f.codigo === p.fase ? 'bg-prosystem-500 text-white border-prosystem-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {f.nome}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Ao fechar o comercial ou concluir o Go-Live, o projeto avança de funil automaticamente.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
