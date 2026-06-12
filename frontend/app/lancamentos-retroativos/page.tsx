'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

type Aba = 'venda' | 'comissao' | 'saida';

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

function Campo({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export default function LancamentosRetroativosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('venda');
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<string[]>([]);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);
  useEffect(() => {
    if (isAuthenticated) apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
  }, [isAuthenticated]);

  // ── Estado dos formulários ──
  const [venda, setVenda] = useState({ razao_social: '', cnpj: '', segmento: '', data: '', setup: '', mensalidade: '', plano: 'PLUS', vendedor_id: '', gerar_comissao: true, comissao_paga: false, observacoes: '' });
  const [comissao, setComissao] = useState({ vendedor_id: '', descricao: '', valor: '', data: '', paga: false });
  const [saida, setSaida] = useState({ busca: '', cliente_id: '', cliente_nome: '', razao_social: '', data: '', mrr_perdido: '', motivo: '', grupo_tecnico: '' });
  const [resultadosBusca, setResultadosBusca] = useState<any[]>([]);

  const flash = (tipo: 'ok' | 'erro', texto: string) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 6000); };
  const erroMsg = (e: any) => e?.response?.data?.message || 'Erro ao salvar. Verifique os campos.';
  const addHistorico = (t: string) => setHistorico(h => [`${new Date().toLocaleTimeString('pt-BR')} — ${t}`, ...h].slice(0, 30));

  // ── Buscar cliente (aba saída) ──
  const buscarCliente = useCallback(async (termo: string) => {
    if (!termo || termo.length < 2) { setResultadosBusca([]); return; }
    try {
      const r = await apiClient.getClientes(0, 8, termo);
      setResultadosBusca(r.data?.data || r.data?.clientes || []);
    } catch { setResultadosBusca([]); }
  }, []);

  // ── Salvar ──
  const salvarVenda = async () => {
    if (!venda.razao_social.trim() || !venda.data) return flash('erro', 'Informe pelo menos o cliente e a data.');
    setSalvando(true);
    try {
      const nome = vendedores.find(v => v.id === venda.vendedor_id)?.nome;
      await apiClient.retroativoVenda({
        razao_social: venda.razao_social.trim(), cnpj: venda.cnpj || undefined, segmento: venda.segmento || undefined,
        data: venda.data, setup: Number(venda.setup) || 0, mensalidade: Number(venda.mensalidade) || 0,
        plano: venda.plano, vendedor_id: venda.vendedor_id || undefined, vendedor_nome: nome,
        gerar_comissao: venda.gerar_comissao && !!venda.vendedor_id, comissao_paga: venda.comissao_paga, observacoes: venda.observacoes || undefined,
      });
      addHistorico(`✅ Venda fechada: ${venda.razao_social} (${venda.data})`);
      flash('ok', 'Venda retroativa lançada! Já aparece no relatório do mês.');
      setVenda({ razao_social: '', cnpj: '', segmento: '', data: venda.data, setup: '', mensalidade: '', plano: 'PLUS', vendedor_id: venda.vendedor_id, gerar_comissao: true, comissao_paga: false, observacoes: '' });
    } catch (e) { flash('erro', erroMsg(e)); } finally { setSalvando(false); }
  };

  const salvarComissao = async () => {
    if (!comissao.vendedor_id || !comissao.valor || !comissao.data) return flash('erro', 'Informe vendedor, valor e data.');
    setSalvando(true);
    try {
      await apiClient.retroativoComissao({ vendedor_id: comissao.vendedor_id, descricao: comissao.descricao || undefined, valor: Number(comissao.valor), data: comissao.data, paga: comissao.paga });
      const nome = vendedores.find(v => v.id === comissao.vendedor_id)?.nome || 'vendedor';
      addHistorico(`✅ Comissão ${comissao.paga ? '(paga)' : '(a pagar)'}: ${nome} — R$ ${comissao.valor} (${comissao.data})`);
      flash('ok', 'Comissão retroativa lançada!');
      setComissao({ vendedor_id: comissao.vendedor_id, descricao: '', valor: '', data: comissao.data, paga: false });
    } catch (e) { flash('erro', erroMsg(e)); } finally { setSalvando(false); }
  };

  const salvarSaida = async () => {
    if (!saida.data) return flash('erro', 'Informe a data da saída.');
    if (!saida.cliente_id && !saida.razao_social.trim()) return flash('erro', 'Selecione um cliente da base ou informe o nome.');
    setSalvando(true);
    try {
      await apiClient.retroativoSaida({
        cliente_id: saida.cliente_id || undefined, razao_social: saida.razao_social || undefined, nome: saida.razao_social || saida.cliente_nome || undefined,
        data: saida.data, mrr_perdido: Number(saida.mrr_perdido) || 0, motivo: saida.motivo || undefined, grupo_tecnico: saida.grupo_tecnico || undefined,
      });
      addHistorico(`✅ Saída/churn: ${saida.cliente_nome || saida.razao_social} (${saida.data}) — R$ ${saida.mrr_perdido || 0}/mês`);
      flash('ok', 'Saída retroativa lançada! Já entra em Entrada×Saída do mês.');
      setSaida({ busca: '', cliente_id: '', cliente_nome: '', razao_social: '', data: saida.data, mrr_perdido: '', motivo: '', grupo_tecnico: '' });
      setResultadosBusca([]);
    } catch (e) { flash('erro', erroMsg(e)); } finally { setSalvando(false); }
  };

  if (loading || !isAuthenticated) return null;

  const abas: { id: Aba; label: string; icone: string }[] = [
    { id: 'venda', label: 'Venda / Contrato fechado', icone: '💰' },
    { id: 'comissao', label: 'Comissão', icone: '🧾' },
    { id: 'saida', label: 'Saída (churn)', icone: '📉' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Lançamentos Retroativos</h1>
          <p className="text-sm text-gray-500 mt-1">Complete o histórico do ano. Cada lançamento entra no <b>mês da data informada</b> e reflete no relatório mensal, metas, comissões e entrada×saída.</p>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${msg.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{msg.texto}</div>
        )}

        {/* Abas */}
        <div className="flex gap-2 mb-5 border-b border-gray-200">
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${aba === a.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a.icone} {a.label}
            </button>
          ))}
        </div>

        {/* ── ABA VENDA ── */}
        {aba === 'venda' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Cliente (razão social) *"><input className={inputCls} value={venda.razao_social} onChange={e => setVenda({ ...venda, razao_social: e.target.value })} placeholder="Ex.: Farmácia Modelo Ltda" /></Campo>
              <Campo label="CNPJ"><input className={inputCls} value={venda.cnpj} onChange={e => setVenda({ ...venda, cnpj: e.target.value })} /></Campo>
              <Campo label="Data do fechamento *"><input type="date" className={inputCls} value={venda.data} onChange={e => setVenda({ ...venda, data: e.target.value })} /></Campo>
              <Campo label="Segmento"><input className={inputCls} value={venda.segmento} onChange={e => setVenda({ ...venda, segmento: e.target.value })} placeholder="Farmácia, Padaria..." /></Campo>
              <Campo label="Setup (valor de implantação) R$"><input type="number" className={inputCls} value={venda.setup} onChange={e => setVenda({ ...venda, setup: e.target.value })} placeholder="0" /></Campo>
              <Campo label="Mensalidade (MRR) R$"><input type="number" className={inputCls} value={venda.mensalidade} onChange={e => setVenda({ ...venda, mensalidade: e.target.value })} placeholder="0" /></Campo>
              <Campo label="Plano">
                <select className={inputCls} value={venda.plano} onChange={e => setVenda({ ...venda, plano: e.target.value })}>
                  <option value="PLUS">Plus</option><option value="PRO">Pro</option><option value="PERSONALIZADO">Personalizado</option>
                </select>
              </Campo>
              <Campo label="Vendedor">
                <select className={inputCls} value={venda.vendedor_id} onChange={e => setVenda({ ...venda, vendedor_id: e.target.value })}>
                  <option value="">— selecione —</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </Campo>
            </div>
            <Campo label="Observações"><textarea className={inputCls} rows={2} value={venda.observacoes} onChange={e => setVenda({ ...venda, observacoes: e.target.value })} /></Campo>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={venda.gerar_comissao} onChange={e => setVenda({ ...venda, gerar_comissao: e.target.checked })} />
                Gerar comissão do vendedor (15% do setup) automaticamente
              </label>
              {venda.gerar_comissao && (
                <label className="flex items-center gap-2 text-sm text-gray-700 ml-6">
                  <input type="checkbox" checked={venda.comissao_paga} onChange={e => setVenda({ ...venda, comissao_paga: e.target.checked })} />
                  Essa comissão já foi <b>paga</b> (senão fica como “a pagar”)
                </label>
              )}
              {venda.gerar_comissao && !venda.vendedor_id && <p className="text-xs text-amber-600 ml-6">Selecione um vendedor para gerar a comissão.</p>}
            </div>
            <button disabled={salvando} onClick={salvarVenda} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg text-sm">
              {salvando ? 'Salvando...' : 'Lançar venda retroativa'}
            </button>
          </div>
        )}

        {/* ── ABA COMISSÃO ── */}
        {aba === 'comissao' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Vendedor *">
                <select className={inputCls} value={comissao.vendedor_id} onChange={e => setComissao({ ...comissao, vendedor_id: e.target.value })}>
                  <option value="">— selecione —</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Valor da comissão R$ *"><input type="number" className={inputCls} value={comissao.valor} onChange={e => setComissao({ ...comissao, valor: e.target.value })} placeholder="0" /></Campo>
              <Campo label="Data (competência) *"><input type="date" className={inputCls} value={comissao.data} onChange={e => setComissao({ ...comissao, data: e.target.value })} /></Campo>
              <Campo label="Descrição"><input className={inputCls} value={comissao.descricao} onChange={e => setComissao({ ...comissao, descricao: e.target.value })} placeholder="Ex.: venda adicional / upgrade" /></Campo>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={comissao.paga} onChange={e => setComissao({ ...comissao, paga: e.target.checked })} />
              Essa comissão já foi <b>paga</b> (senão fica como “a pagar”)
            </label>
            <button disabled={salvando} onClick={salvarComissao} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg text-sm">
              {salvando ? 'Salvando...' : 'Lançar comissão retroativa'}
            </button>
          </div>
        )}

        {/* ── ABA SAÍDA ── */}
        {aba === 'saida' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <Campo label="Cliente da base (buscar por nome/razão/código/CNPJ)">
              <input className={inputCls} value={saida.busca}
                onChange={e => { const v = e.target.value; setSaida({ ...saida, busca: v, cliente_id: '', cliente_nome: '' }); buscarCliente(v); }}
                placeholder="Digite para buscar..." />
              {resultadosBusca.length > 0 && !saida.cliente_id && (
                <div className="mt-1 border border-gray-200 rounded-lg divide-y max-h-48 overflow-auto">
                  {resultadosBusca.map((c: any) => (
                    <button key={c.id} type="button" onClick={() => { setSaida({ ...saida, cliente_id: c.id, cliente_nome: c.razao_social || c.nome_fantasia || c.nome, busca: c.razao_social || c.nome_fantasia || c.nome, mrr_perdido: String(c.mensalidade_base || ''), grupo_tecnico: c.grupo_tecnico || '' }); setResultadosBusca([]); }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50">
                      <b>{c.razao_social || c.nome_fantasia || c.nome}</b>{c.codigo ? ` · ${c.codigo}` : ''}{c.cnpj ? ` · ${c.cnpj}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </Campo>
            {saida.cliente_id ? (
              <p className="text-sm text-green-700">✅ Cliente selecionado: <b>{saida.cliente_nome}</b> <button className="text-blue-600 underline ml-2" onClick={() => setSaida({ ...saida, cliente_id: '', cliente_nome: '', busca: '' })}>trocar</button></p>
            ) : (
              <Campo label="...ou informe o nome (se não estiver na base)"><input className={inputCls} value={saida.razao_social} onChange={e => setSaida({ ...saida, razao_social: e.target.value })} placeholder="Nome do cliente que saiu" /></Campo>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Data da saída *"><input type="date" className={inputCls} value={saida.data} onChange={e => setSaida({ ...saida, data: e.target.value })} /></Campo>
              <Campo label="Mensalidade perdida (MRR) R$"><input type="number" className={inputCls} value={saida.mrr_perdido} onChange={e => setSaida({ ...saida, mrr_perdido: e.target.value })} placeholder="0" /></Campo>
              <Campo label="Motivo"><input className={inputCls} value={saida.motivo} onChange={e => setSaida({ ...saida, motivo: e.target.value })} placeholder="Ex.: Dificuldade financeira" /></Campo>
              <Campo label="Grupo técnico"><input className={inputCls} value={saida.grupo_tecnico} onChange={e => setSaida({ ...saida, grupo_tecnico: e.target.value })} placeholder="Ex.: Grupo 5 - Wellington" /></Campo>
            </div>
            <button disabled={salvando} onClick={salvarSaida} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg text-sm">
              {salvando ? 'Salvando...' : 'Lançar saída retroativa'}
            </button>
          </div>
        )}

        {/* Histórico da sessão */}
        {historico.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Lançado nesta sessão</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              {historico.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
