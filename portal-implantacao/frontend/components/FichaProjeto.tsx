'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Opcao = { v: string; l: string };

export default function FichaProjeto({ id, onClose, onChange }: { id: string | null; onClose: () => void; onChange: () => void }) {
  const novo = id === null;
  const [p, setP] = useState<any>(novo ? { cliente_nome: '', funil: 'IMPLANTACAO' } : null);
  const [funis, setFunis] = useState<any[]>([]);
  const [opcoes, setOpcoes] = useState<Record<string, Opcao[]>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { api.config().then(r => { setFunis(r.data.funis); setOpcoes(r.data.opcoes || {}); }).catch(() => {}); }, []);
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
      {opcoes[k] ? (
        <select value={p[k] || ''} onChange={e => setF(k, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="">Selecione…</option>
          {opcoes[k].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : tipo === 'textarea' ? (
        <textarea value={p[k] || ''} onChange={e => setF(k, e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      ) : tipo === 'date' ? (
        <input type="date" value={p[k] ? String(p[k]).slice(0, 10) : ''} onChange={e => setF(k, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      ) : (
        <input type={tipo} value={p[k] ?? ''} onChange={e => setF(k, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      )}
    </div>
  );

  const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <>
      <p className="text-xs font-bold text-prosystem-600 pt-2">{titulo}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </>
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

          <Secao titulo="Primeiro contato — responsáveis">
            <Campo k="tecnico_responsavel" label="Técnico Responsável *" />
            <Campo k="contato_principal" label="Contato principal no cliente *" />
          </Secao>

          <Secao titulo="Dados da implantação">
            <Campo k="segmento_atuacao" label="Segmento de Atuação *" />
            <Campo k="regime_tributario" label="Regime Tributário" />
            <Campo k="tipo_implantacao" label="Tipo de Implantação *" />
            <Campo k="inscricao_estadual" label="Inscrição Estadual" />
            <Campo k="erp_anterior" label="ERP/Sistema Anterior" />
            <Campo k="endereco" label="Endereço completo" tipo="textarea" />
            <Campo k="dados_contador" label="Contador / contabilidade" tipo="textarea" />
          </Secao>

          <Secao titulo="Estrutura da empresa">
            <Campo k="tipo_estrutura" label="Tipo de estrutura" />
            <Campo k="qtd_lojas" label="Quantidade de lojas" tipo="number" />
            <Campo k="volumetria_pdvs" label="Quantidade de PDVs (caixas) *" tipo="number" />
            <Campo k="qtd_computadores" label="Quantidade de computadores" tipo="number" />
            <Campo k="qtd_usuarios" label="Usuários do sistema" tipo="number" />
            <Campo k="admin_erp" label="Responsável pela administração do ERP" />
          </Secao>

          <Secao titulo="Infraestrutura e fiscal">
            <Campo k="internet_download" label="Internet — download" />
            <Campo k="internet_upload" label="Internet — upload" />
            <Campo k="tipo_certificado" label="Certificado Digital" />
            <Campo k="ambiente_fiscal" label="Ambiente fiscal" />
            <Campo k="csc_sefaz" label="ID do CSC SEFAZ" />
          </Secao>

          <Secao titulo="Estoque, migração e integrações">
            <Campo k="qtd_produtos" label="Qtd. aproximada de produtos" tipo="number" />
            <Campo k="escopo_migracao" label="O que será migrado" tipo="textarea" />
            <Campo k="integracoes" label="Integrações (TEF, PBM, Farmácia Popular…)" tipo="textarea" />
          </Secao>

          <Secao titulo="Operação e treinamento">
            <Campo k="horario_funcionamento" label="Horário de funcionamento" />
            <Campo k="data_prevista_golive" label="Data prevista de entrada em produção" tipo="date" />
            <Campo k="modalidade_treinamento" label="Modalidade do treinamento" />
            <Campo k="qtd_pessoas_treinar" label="Pessoas a treinar" tipo="number" />
            <Campo k="perfis_treinamento" label="Perfis a treinar (proprietário, caixa, compras…)" tipo="textarea" />
          </Secao>

          <Secao titulo="Fechamento do primeiro contato">
            <Campo k="pendencias_kickoff" label="Pendências (o quê / quem / prazo)" tipo="textarea" />
            <Campo k="onboarding_aprovado_em" label="Onboarding aprovado pelo cliente em" tipo="date" />
          </Secao>

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
                      <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={c.concluido} onChange={() => toggleItem(c)} className="mt-0.5" />
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
