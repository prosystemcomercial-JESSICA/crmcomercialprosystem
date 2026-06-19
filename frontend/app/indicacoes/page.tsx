'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Parceiro {
  id: string;
  nome: string;
  categoria: string;
  pitch?: string;
  comissao_valor: number;
  tabela_valores?: string;
  ativo: boolean;
}

interface VendaAdicional {
  id: string;
  cliente_id: string;
  parceiro_id: string;
  vendedor_id: string;
  vendedor_nome?: string;
  tipo_negocio?: string;
  valor_venda?: number;
  plano_anterior?: string;
  plano_novo?: string;
  mensalidade_anterior?: number;
  mensalidade_nova?: number;
  comissao_valor: number;
  comissao_paga: boolean;
  comissao_paga_em?: string;
  status: string;
  observacoes?: string;
  created_at: string;
  data_indicacao?: string;
  data_confirmacao?: string;
  data_fechamento?: string;
  primeiro_vencimento?: string;
  acrescimo_mensal?: number;
  cliente: { id: string; nome: string; empresa?: string; telefone?: string };
  parceiro: { id: string; nome: string; categoria: string; comissao_valor: number };
}

const CATEGORIA_LABEL: Record<string, string> = {
  FISCAL: 'Fiscal',
  TEF: 'TEF',
  TRIBUTARIO: 'Corretor Tributário',
  COMUNICACAO: 'Comunicação',
  UPGRADE: 'Upgrade',
  OUTRO: 'Outro',
};

const CATEGORIA_COLOR: Record<string, string> = {
  FISCAL: 'bg-blue-100 text-blue-700',
  TEF: 'bg-purple-100 text-purple-700',
  TRIBUTARIO: 'bg-amber-100 text-amber-700',
  COMUNICACAO: 'bg-teal-100 text-teal-700',
  UPGRADE: 'bg-green-100 text-green-700',
  OUTRO: 'bg-gray-100 text-gray-600',
};

// Status flow: PENDENTE → CONFIRMADA → PAGA | CANCELADO
const STATUS_COLOR: Record<string, string> = {
  PENDENTE:    'bg-yellow-100 text-yellow-700',
  CONFIRMADA:  'bg-blue-100 text-blue-700',
  PAGA:        'bg-green-100 text-green-700',
  CANCELADO:   'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE:    'Pendente',
  CONFIRMADA:  'Confirmada — A Pagar',
  PAGA:        'Comissão Paga',
  CANCELADO:   'Cancelado',
};

const ROLES_GESTOR = ['CEO', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'ADMIN', 'DIRETOR'];

const PLANOS = ['MEI', 'Basic', 'Pro', 'Plus'];

const MOCK_VENDEDORES = [
  { id: 'jessica', nome: 'Jessica (CEO)' },
  { id: 'vendedor1', nome: 'Vendedor 1' },
  { id: 'vendedor2', nome: 'Vendedor 2' },
];

export default function IndicacoesPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'vendas' | 'parceiros'>('vendas');
  const [vendas, setVendas] = useState<VendaAdicional[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteBusca, setClienteBusca] = useState('');
  const [clienteLoading, setClienteLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  // Troca de CNPJ
  const [showTroca, setShowTroca] = useState(false);
  const [trocaBusca, setTrocaBusca] = useState('');
  const [trocaResultados, setTrocaResultados] = useState<any[]>([]);
  const [trocaCli, setTrocaCli] = useState<any>(null);
  const [trocaSalvando, setTrocaSalvando] = useState(false);
  const [trocaResumo, setTrocaResumo] = useState<{ texto: string; numero?: string } | null>(null);
  const [trocaForm, setTrocaForm] = useState<any>({ taxa: '', vendedor_id: '', cnpj_novo: '', razao_social_nova: '', nome_fantasia_nova: '', inscricao_nova: '', cep: '', endereco: '', numero_end: '', bairro: '', cidade: '', estado: '', telefone: '', email: '', motivo: '', taxa_entrada: '', taxa_parcelas: '', taxa_primeiro_venc: '' });

  const buscarTroca = useCallback(async (termo: string) => {
    if (!termo || termo.length < 2) { setTrocaResultados([]); return; }
    try { const r = await apiClient.getClientes(0, 8, termo); setTrocaResultados(r.data?.data?.clientes || []); } catch { setTrocaResultados([]); }
  }, []);

  // Abre a Troca de CNPJ garantindo a lista de vendedores carregada no dropdown.
  const abrirTroca = async () => {
    if (usuarios.length === 0) {
      try { const r = await apiClient.getVendedores(); setUsuarios((r.data?.data?.length ? r.data.data : MOCK_VENDEDORES)); }
      catch { setUsuarios(MOCK_VENDEDORES); }
    }
    setShowTroca(true);
  };

  const salvarTroca = async () => {
    if (!trocaCli) return alert('Selecione o cliente.');
    if (!trocaForm.cnpj_novo.trim()) return alert('Informe o novo CNPJ.');
    setTrocaSalvando(true);
    try {
      const resp = await apiClient.trocaCnpj({
        cliente_id: trocaCli.id,
        taxa: Number(trocaForm.taxa) || 0,
        vendedor_id: trocaForm.vendedor_id || undefined,
        taxa_entrada: trocaForm.taxa_entrada ? Number(trocaForm.taxa_entrada) : undefined,
        taxa_parcelas: trocaForm.taxa_parcelas ? Number(trocaForm.taxa_parcelas) : undefined,
        taxa_primeiro_venc: trocaForm.taxa_primeiro_venc || undefined,
        cnpj_novo: trocaForm.cnpj_novo.trim(),
        razao_social_nova: trocaForm.razao_social_nova || undefined, nome_fantasia_nova: trocaForm.nome_fantasia_nova || undefined,
        inscricao_nova: trocaForm.inscricao_nova || undefined,
        cep: trocaForm.cep || undefined, endereco: trocaForm.endereco || undefined, numero_end: trocaForm.numero_end || undefined,
        bairro: trocaForm.bairro || undefined, cidade: trocaForm.cidade || undefined, estado: trocaForm.estado || undefined,
        telefone: trocaForm.telefone || undefined, email: trocaForm.email || undefined, motivo: trocaForm.motivo || undefined,
      });
      const numero = resp.data?.data?.contrato?.numero_contrato;
      const resumo = resp.data?.data?.resumo || '';
      setShowTroca(false); setTrocaCli(null); setTrocaBusca(''); setTrocaResultados([]);
      setTrocaForm({ taxa: '', vendedor_id: '', cnpj_novo: '', razao_social_nova: '', nome_fantasia_nova: '', inscricao_nova: '', cep: '', endereco: '', numero_end: '', bairro: '', cidade: '', estado: '', telefone: '', email: '', motivo: '', taxa_entrada: '', taxa_parcelas: '', taxa_primeiro_venc: '' });
      loadVendas();
      setTrocaResumo({ texto: resumo, numero });
    } catch (e: any) { alert(e?.response?.data?.message || 'Erro ao processar a troca.'); }
    finally { setTrocaSalvando(false); }
  };

  // Busca clientes da base por código, razão social, nome fantasia, nome ou CNPJ
  // (server-side, traz até 200 — antes só pegava os 20 primeiros, sem busca).
  // Inativos são marcados na lista, mas a busca traz todos p/ não "sumir" cliente.
  const buscarClientes = useCallback(async (termo: string) => {
    setClienteLoading(true);
    try {
      const res = await apiClient.getClientes(0, 200, termo || undefined);
      setClientes(res.data.data.clientes || []);
    } catch {
      setClientes([]);
    } finally {
      setClienteLoading(false);
    }
  }, []);

  // Busca PRÓPRIA das lojas que vão se comunicar (separada da busca de cliente).
  const [lojaBusca, setLojaBusca] = useState('');
  const [lojaResultados, setLojaResultados] = useState<any[]>([]);
  const [lojaLoading, setLojaLoading] = useState(false);
  // Guarda os dados (nome/código) das lojas SELECIONADAS p/ exibir mesmo quando
  // somem dos resultados da busca atual.
  const [lojasSelMap, setLojasSelMap] = useState<Record<string, any>>({});
  // Acréscimo INDIVIDUAL por loja (id → valor em texto). 0/vazio = só associar.
  const [lojasAcrescimo, setLojasAcrescimo] = useState<Record<string, string>>({});

  // Modal venda
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [vendaForm, setVendaForm] = useState<any>({
    cliente_id: '', parceiro_id: '', vendedor_id: '', valor_venda: '',
    plano_anterior: '', plano_novo: '', observacoes: '',
  });
  const [savingVenda, setSavingVenda] = useState(false);

  // Modal parceiro
  const [showParceiroModal, setShowParceiroModal] = useState(false);
  const [parceiroForm, setParceiroForm] = useState<any>({
    nome: '', categoria: 'OUTRO', pitch: '', comissao_valor: '50', tabela_valores: '',
  });
  const [savingParceiro, setSavingParceiro] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState<Parceiro | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadVendas = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await apiClient.getVendasAdicionais(params);
      setVendas(res.data.data.vendas);
      setStats(res.data.data.stats);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  }, [statusFilter]);

  const loadParceiros = useCallback(async () => {
    try {
      const res = await apiClient.getParceiros();
      setParceiros(res.data.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadVendas();
    loadParceiros();
  }, [isAuthenticated, loadVendas, loadParceiros]);

  const openNovaVenda = async () => {
    setClienteBusca('');
    try {
      const [, vends] = await Promise.all([
        buscarClientes(''),
        // Vendedores reais cadastrados no CRM (ATIVOS) para a supervisão escolher.
        apiClient.getVendedores().catch(() => ({ data: { data: [] } })),
      ]);
      const vendList = vends.data.data || [];
      setUsuarios(vendList.length ? vendList : MOCK_VENDEDORES);
    } catch { setClientes([]); setUsuarios(MOCK_VENDEDORES); }
    setVendaForm({ cliente_id: '', parceiro_id: '', vendedor_id: user?.id || '', tipo_negocio: 'INDICACAO', valor_venda: '', acrescimo_mensal: '', plano_anterior: '', plano_novo: '', observacoes: '', setup_forma: 'PARCELADO', setup_entrada: '', setup_parcelas: 1, setup_primeiro_venc: '',
      // comunicação multi-loja + datas
      lojas_ids: [], setup_loja_id: '', data_venda: '', data_inicio_comunicacao: '', primeiro_vencimento: '', data_indicacao: '', data_fechamento: '' });
    setLojaBusca(''); setLojaResultados([]); setLojasSelMap({}); setLojasAcrescimo({});
    setShowVendaModal(true);
  };

  const handleCreateVenda = async () => {
    // Detecta duplicado: mesmo cliente + mesmo parceiro com venda não-cancelada
    if (vendaForm.cliente_id && vendaForm.parceiro_id) {
      const dupla = vendas.find(v =>
        v.cliente_id === vendaForm.cliente_id &&
        v.parceiro_id === vendaForm.parceiro_id &&
        v.status !== 'CANCELADO'
      );
      if (dupla) {
        const nomeCliente = dupla.cliente?.nome || vendaForm.cliente_id;
        const nomeParceiro = dupla.parceiro?.nome || vendaForm.parceiro_id;
        const confirmar = window.confirm(
          `⚠️ POSSÍVEL DUPLICADO DETECTADO\n\n` +
          `Já existe uma venda de "${nomeParceiro}" para "${nomeCliente}" com status "${STATUS_LABEL[dupla.status] || dupla.status}".\n\n` +
          `Registrada em: ${new Date(dupla.created_at).toLocaleDateString('pt-BR')}\n\n` +
          `Deseja registrar mesmo assim?`
        );
        if (!confirmar) return;
      }
    }

    setSavingVenda(true);
    try {
      const payload: any = {
        cliente_id: vendaForm.cliente_id,
        parceiro_id: vendaForm.parceiro_id,
        vendedor_id: vendaForm.vendedor_id,
        tipo_negocio: vendaForm.tipo_negocio || 'INDICACAO',
        observacoes: vendaForm.observacoes || undefined,
      };
      if (vendaForm.valor_venda) payload.valor_venda = parseFloat(vendaForm.valor_venda);
      if (vendaForm.acrescimo_mensal) payload.acrescimo_mensal = parseFloat(vendaForm.acrescimo_mensal);
      if (vendaForm.plano_anterior) payload.plano_anterior = vendaForm.plano_anterior;
      if (vendaForm.plano_novo) payload.plano_novo = vendaForm.plano_novo;
      // Comunicação multi-loja + datas do ciclo
      const pSel = parceiros.find(p => p.id === vendaForm.parceiro_id);
      const isComunic = pSel?.categoria === 'COMUNICACAO';
      const isoOrUndef = (v?: string) => (v ? new Date(v).toISOString() : undefined);
      if (isComunic && (vendaForm.lojas_ids || []).length) {
        payload.lojas_ids = vendaForm.lojas_ids;
        // Acréscimo INDIVIDUAL por loja.
        payload.lojas_detalhe = (vendaForm.lojas_ids as string[]).map(id => ({
          cliente_id: id,
          acrescimo: Number((lojasAcrescimo[id] || '').toString().replace(',', '.') || 0),
        }));
      }
      if (isComunic && vendaForm.setup_loja_id) payload.setup_loja_id = vendaForm.setup_loja_id;
      payload.data_venda = isoOrUndef(vendaForm.data_venda);
      payload.data_inicio_comunicacao = isoOrUndef(vendaForm.data_inicio_comunicacao);
      payload.primeiro_vencimento = isoOrUndef(vendaForm.primeiro_vencimento);
      payload.data_indicacao = isoOrUndef(vendaForm.data_indicacao);
      payload.data_fechamento = isoOrUndef(vendaForm.data_fechamento);
      // Mensalidade atual do cliente (snapshot) p/ o backend gravar anterior→nova.
      if (mensalidadeAtual > 0) payload.mensalidade_anterior = mensalidadeAtual;
      // Forma de pagamento do setup do upgrade.
      if (setupTotal > 0) {
        payload.setup_forma = vendaForm.setup_forma || 'PARCELADO';
        if (vendaForm.setup_forma === 'ENTRADA_PARCELAS' && vendaForm.setup_entrada) {
          payload.setup_entrada = parseFloat(vendaForm.setup_entrada);
        }
        if (vendaForm.setup_parcelas) payload.setup_parcelas = Number(vendaForm.setup_parcelas);
        // Vencimento do setup: campo próprio (upgrade) ou o 1º vencimento (comunicação).
        if (vendaForm.setup_primeiro_venc) payload.setup_primeiro_venc = new Date(vendaForm.setup_primeiro_venc).toISOString();
        else if (isComunic && vendaForm.primeiro_vencimento) payload.setup_primeiro_venc = new Date(vendaForm.primeiro_vencimento).toISOString();
      }

      await apiClient.createVendaAdicional(payload);
      setShowVendaModal(false);
      loadVendas();
    } catch (e) { console.error(e); }
    finally { setSavingVenda(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const payload: any = { status };
    // Ao CONFIRMAR, pergunta a data da confirmação (demais parceiros: base da
    // comissão = mês seguinte a ela). Default: hoje.
    if (status === 'CONFIRMADA') {
      const hoje = new Date().toISOString().slice(0, 10);
      const d = window.prompt('Data da confirmação (AAAA-MM-DD):', hoje);
      if (d === null) return; // cancelou
      payload.data_confirmacao = new Date(d || hoje).toISOString();
    }
    await apiClient.updateVendaAdicional(id, payload);
    loadVendas();
  };

  // Gera o resumo p/ o financeiro e copia p/ a área de transferência.
  const copiarResumoFinanceiro = async (id: string) => {
    try {
      const res = await apiClient.resumoFinanceiroVenda(id);
      const texto = res.data?.data?.texto || '';
      await navigator.clipboard.writeText(texto);
      alert('Resumo copiado! É só colar para o financeiro.\n\n' + texto);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Não foi possível gerar o resumo.');
    }
  };

  const handlePagarComissao = async (id: string) => {
    await apiClient.updateVendaAdicional(id, { comissao_paga: true, status: 'PAGA' });
    loadVendas();
  };

  const openNovoParceiro = () => {
    setEditingParceiro(null);
    setParceiroForm({ nome: '', categoria: 'OUTRO', pitch: '', comissao_valor: '50', tabela_valores: '' });
    setShowParceiroModal(true);
  };

  const openEditParceiro = (p: Parceiro) => {
    setEditingParceiro(p);
    setParceiroForm({ nome: p.nome, categoria: p.categoria, pitch: p.pitch || '', comissao_valor: String(p.comissao_valor), tabela_valores: p.tabela_valores || '' });
    setShowParceiroModal(true);
  };

  const handleSaveParceiro = async () => {
    setSavingParceiro(true);
    try {
      const payload = { ...parceiroForm, comissao_valor: parseFloat(parceiroForm.comissao_valor) };
      if (editingParceiro) {
        await apiClient.updateParceiro(editingParceiro.id, payload);
      } else {
        await apiClient.createParceiro(payload);
      }
      setShowParceiroModal(false);
      loadParceiros();
    } catch (e) { console.error(e); }
    finally { setSavingParceiro(false); }
  };

  const handleDesativarParceiro = async (id: string) => {
    if (!confirm('Desativar este parceiro?')) return;
    await apiClient.deleteParceiro(id);
    loadParceiros();
  };

  const parceiroSelecionado = parceiros.find(p => p.id === vendaForm.parceiro_id);
  const clienteSelecionado = clientes.find((c: any) => c.id === vendaForm.cliente_id);
  const ehComunicacao = parceiroSelecionado?.categoria === 'COMUNICACAO';
  const nLojasComunic = ehComunicacao ? Math.max(1, (vendaForm.lojas_ids || []).length) : 1;
  const acrescimoTotalComunic = ehComunicacao
    ? (vendaForm.lojas_ids || []).reduce((s: number, id: string) => s + Number((lojasAcrescimo[id] || '').toString().replace(',', '.') || 0), 0)
    : 0;

  // Busca server-side das lojas (debounce 300ms) só com o modal de comunicação aberto.
  useEffect(() => {
    if (!showVendaModal || !ehComunicacao) return;
    const termo = lojaBusca.trim();
    if (termo.length < 2) { setLojaResultados([]); return; }
    setLojaLoading(true);
    const t = setTimeout(() => {
      apiClient.getClientes(0, 20, termo)
        .then(r => setLojaResultados(r.data.data.clientes || []))
        .catch(() => setLojaResultados([]))
        .finally(() => setLojaLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [lojaBusca, showVendaModal, ehComunicacao]);

  // Marca/desmarca uma loja, preservando seus dados p/ exibição posterior.
  const toggleLoja = (c: any) => {
    setLojasSelMap(prev => ({ ...prev, [c.id]: { id: c.id, nome: c.nome_fantasia || c.razao_social || c.nome, codigo: c.codigo } }));
    setVendaForm((p: any) => {
      const cur: string[] = p.lojas_ids || [];
      return { ...p, lojas_ids: cur.includes(c.id) ? cur.filter(x => x !== c.id) : [...cur, c.id] };
    });
  };
  // Mensalidade atual do cliente (base) → nova = atual + acréscimo do upgrade.
  const mensalidadeAtual = Number(clienteSelecionado?.mensalidade_base || 0);
  const acrescimo = Number(vendaForm.acrescimo_mensal || 0);
  const mensalidadeNova = mensalidadeAtual + acrescimo;
  // Setup do upgrade e plano de pagamento.
  const setupTotal = Number(vendaForm.valor_venda || 0);
  const setupEntrada = vendaForm.setup_forma === 'ENTRADA_PARCELAS' ? Number(vendaForm.setup_entrada || 0) : 0;
  const setupParcelas = Math.max(1, Number(vendaForm.setup_parcelas || 1));
  const saldoSetup = Math.max(0, setupTotal - setupEntrada);
  const valorParcelaSetup = setupParcelas > 0 ? saldoSetup / setupParcelas : 0;
  const fmtReal = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const isGestor = ROLES_GESTOR.includes((user as any)?.role || '');

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendas Adicionais</h1>
            <p className="text-gray-500 mt-1">Cross-sell para clientes da base — parceiros e comissões do vendedor</p>
          </div>
          {/* Vendedor também registra a própria venda; gestão confirma/data/libera. */}
          <div className="flex gap-2">
            {isGestor && (
              <button onClick={abrirTroca} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                🔄 Troca de CNPJ
              </button>
            )}
            <button onClick={openNovaVenda} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + Registrar Venda
            </button>
          </div>
        </div>
        {!isGestor && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
            Você registra a venda e ela fica <b>pendente</b>. A confirmação, as datas e a liberação da comissão são feitas pela Supervisão.
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Pendentes</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendentes}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Confirmadas</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{stats.confirmadas}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Pagas</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{stats.pagas}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Comissões Vendedor</p>
              <p className="text-xl font-bold text-orange-700 mt-1">R$ {(stats.comissoes_a_pagar || 0).toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-400 mt-0.5">a pagar</p>
            </div>
            <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Comissões Supervisão</p>
              <p className="text-xl font-bold text-teal-700 mt-1">R$ {(stats.supervisao_a_pagar || 0).toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-400 mt-0.5">a pagar</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {([['vendas', 'Vendas'], ['parceiros', 'Parceiros & Produtos']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Vendas */}
        {tab === 'vendas' && (
          <>
            {/* Filtros */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 items-end">
              {/* Status */}
              <div>
                <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['', 'PENDENTE', 'CONFIRMADA', 'PAGA', 'CANCELADO'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {s === '' ? 'Todas' : STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categoria */}
              <div>
                <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Categoria</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['', ...Object.keys(CATEGORIA_LABEL)] as const).map(cat => {
                    const qtd = cat === '' ? vendas.length : vendas.filter(v => v.parceiro.categoria === cat).length;
                    if (qtd === 0 && cat !== '') return null;
                    return (
                      <button key={cat} onClick={() => setCategoriaFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${categoriaFilter === cat ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {cat === '' ? 'Todas' : `${CATEGORIA_LABEL[cat]} (${qtd})`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vendedor (gestor only) */}
              {isGestor && (() => {
                const vendedoresUnicos = [...new Map(
                  vendas.filter(v => v.vendedor_id).map(v => [v.vendedor_id, (v as any).vendedor_nome || v.vendedor_id])
                ).entries()].sort((a, b) => a[1].localeCompare(b[1]));
                if (vendedoresUnicos.length < 2) return null;
                return (
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Vendedor</p>
                    <select value={vendedorFilter} onChange={e => setVendedorFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                      <option value="">Todos</option>
                      {vendedoresUnicos.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                    </select>
                  </div>
                );
              })()}

              {/* Limpar filtros */}
              {(statusFilter || categoriaFilter || vendedorFilter) && (
                <button onClick={() => { setStatusFilter(''); setCategoriaFilter(''); setVendedorFilter(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors self-end">
                  ✕ Limpar filtros
                </button>
              )}
            </div>

            {/* Lista filtrada */}
            {(() => {
              const listaFiltrada = vendas.filter(v =>
                (!statusFilter || v.status === statusFilter) &&
                (!categoriaFilter || v.parceiro.categoria === categoriaFilter) &&
                (!vendedorFilter || v.vendedor_id === vendedorFilter)
              );
              return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {dataLoading ? (
                <div className="p-8 text-center text-gray-500">Carregando...</div>
              ) : listaFiltrada.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">💰</div>
                  <p className="text-gray-500 font-medium">{vendas.length === 0 ? 'Nenhuma venda adicional registrada' : 'Nenhuma venda com esses filtros'}</p>
                  <p className="text-sm text-gray-400 mt-1">{vendas.length === 0 ? 'Registre vendas de Pacote Fiscal, TEF, Avant/Imendes, Upgrade e mais' : `${vendas.length} venda(s) no total — ajuste os filtros acima`}</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produto / Parceiro</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comissão</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {listaFiltrada.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{v.cliente.nome}</p>
                          {v.cliente.empresa && <p className="text-xs text-gray-400">{v.cliente.empresa}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[v.parceiro.categoria] || 'bg-gray-100 text-gray-600'}`}>
                              {CATEGORIA_LABEL[v.parceiro.categoria] || v.parceiro.categoria}
                            </span>
                            <span className="text-sm text-gray-700">{v.parceiro.nome}</span>
                            {(v as any).tipo_negocio && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: (v as any).tipo_negocio === 'REVENDA' ? '#dcfce7' : '#fef3c7', color: (v as any).tipo_negocio === 'REVENDA' ? '#16a34a' : '#d97706' }}>
                                {(v as any).tipo_negocio === 'REVENDA' ? 'Revenda' : 'Indicação'}
                              </span>
                            )}
                          </div>
                          {v.plano_anterior && v.plano_novo && (
                            <p className="text-xs text-gray-400 mt-0.5">{v.plano_anterior} → {v.plano_novo}</p>
                          )}
                          {(v.mensalidade_anterior != null || v.mensalidade_nova != null) && (
                            <p className="text-xs mt-0.5">
                              <span className="text-gray-400">Mensalidade: </span>
                              <span className="text-gray-500">R$ {Number(v.mensalidade_anterior || 0).toLocaleString('pt-BR')}</span>
                              <span className="text-gray-400"> → </span>
                              <span className="font-semibold text-green-700">R$ {Number(v.mensalidade_nova || 0).toLocaleString('pt-BR')}</span>
                            </p>
                          )}
                          {v.valor_venda && (
                            <p className="text-xs text-gray-400 mt-0.5">R$ {v.valor_venda.toLocaleString('pt-BR')}/mês</p>
                          )}
                          {/* Datas do ciclo (indicação / confirmação / 1º venc.) */}
                          {(v.data_indicacao || v.data_confirmacao || v.data_fechamento || v.primeiro_vencimento) && (
                            <p className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-3">
                              {v.data_indicacao && <span>📅 Indicado: <b>{new Date(v.data_indicacao).toLocaleDateString('pt-BR')}</b></span>}
                              {v.data_fechamento && <span>🤝 Fechado: <b>{new Date(v.data_fechamento).toLocaleDateString('pt-BR')}</b></span>}
                              {v.data_confirmacao && <span>✅ Confirmado: <b>{new Date(v.data_confirmacao).toLocaleDateString('pt-BR')}</b></span>}
                              {v.primeiro_vencimento && <span>💳 1º venc.: <b>{new Date(v.primeiro_vencimento).toLocaleDateString('pt-BR')}</b></span>}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-700">
                            {(v as any).vendedor_nome || usuarios.find((u: any) => u.id === v.vendedor_id)?.nome || v.vendedor_id}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Vendedor</p>
                            <p className="text-sm font-semibold text-gray-800">R$ {v.comissao_valor.toLocaleString('pt-BR')}</p>
                          </div>
                          {(v as any).comissao_supervisao_valor > 0 && (
                            <div className="mt-1">
                              <p className="text-xs text-gray-400 mb-0.5">Supervisão</p>
                              <p className="text-sm font-medium text-teal-700">R$ {(v as any).comissao_supervisao_valor.toLocaleString('pt-BR')}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[v.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABEL[v.status] || v.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {/* Resumo p/ financeiro — Comunicação, Upgrade e Fiscal */}
                          {['COMUNICACAO', 'UPGRADE', 'FISCAL'].includes(v.parceiro.categoria) && (
                            <button onClick={() => copiarResumoFinanceiro(v.id)} title="Copiar resumo para o financeiro"
                              className="mr-1 text-xs text-teal-700 border border-teal-200 rounded-lg px-2 py-1 hover:bg-teal-50 font-medium transition-colors">
                              📋 Resumo
                            </button>
                          )}
                          {isGestor && v.status === 'PENDENTE' && (
                            <button onClick={() => handleUpdateStatus(v.id, 'CONFIRMADA')}
                              className="text-xs text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50 font-medium transition-colors">
                              Confirmar
                            </button>
                          )}
                          {isGestor && v.status === 'CONFIRMADA' && (
                            <button onClick={() => handlePagarComissao(v.id)}
                              className="text-xs text-green-600 border border-green-200 rounded-lg px-2 py-1 hover:bg-green-50 font-medium transition-colors">
                              Marcar paga
                            </button>
                          )}
                          {isGestor && v.status !== 'PAGA' && v.status !== 'CANCELADO' && (
                            <button onClick={() => handleUpdateStatus(v.id, 'CANCELADO')}
                              className="ml-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
              );
            })()}
          </>
        )}

        {/* Tab: Parceiros */}
        {tab === 'parceiros' && (
          <div className="space-y-4">
            {isGestor && (
              <div className="flex justify-end">
                <button onClick={openNovoParceiro}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  + Nova empresa parceira
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {parceiros.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[p.categoria] || 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORIA_LABEL[p.categoria] || p.categoria}
                      </span>
                      <h3 className="font-semibold text-gray-900 mt-1.5">{p.nome}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">R$ {p.comissao_valor.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-gray-400">comissão/venda</p>
                    </div>
                  </div>

                  {p.pitch && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Abordagem</p>
                      <p className="text-sm text-gray-700 italic">"{p.pitch}"</p>
                    </div>
                  )}

                  {p.tabela_valores && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Valor para o cliente:</span> {p.tabela_valores}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEditParceiro(p)}
                      className="flex-1 text-xs text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-colors">
                      Editar
                    </button>
                    <button onClick={() => handleDesativarParceiro(p.id)}
                      className="flex-1 text-xs text-red-500 border border-red-200 rounded-lg py-1.5 hover:bg-red-50 transition-colors">
                      Desativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Nova Venda */}
      {showVendaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registrar Venda Adicional</h2>
              <button onClick={() => setShowVendaModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Cliente da base *</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={clienteBusca}
                    onChange={e => setClienteBusca(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarClientes(clienteBusca); } }}
                    placeholder="Buscar por código, razão social, fantasia, nome ou CNPJ…"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => buscarClientes(clienteBusca)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap"
                  >
                    {clienteLoading ? '…' : '🔍 Buscar'}
                  </button>
                </div>
                <select value={vendaForm.cliente_id} onChange={e => setVendaForm((p: any) => ({ ...p, cliente_id: e.target.value }))}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={clientes.length > 6 ? 6 : undefined}>
                  <option value="">{clienteLoading ? 'Carregando…' : `Selecione… (${clientes.length} encontrado${clientes.length === 1 ? '' : 's'})`}</option>
                  {clientes.map((c: any) => {
                    const nome = c.razao_social || c.nome_fantasia || c.nome || c.empresa || 'Sem nome';
                    const extra = [c.codigo && `#${c.codigo}`, c.nome_fantasia && c.nome_fantasia !== nome ? c.nome_fantasia : '', c.cnpj].filter(Boolean).join(' · ');
                    const inativo = (c.situacao || '').toUpperCase().startsWith('INAT');
                    return (
                      <option key={c.id} value={c.id}>
                        {nome}{extra ? ` — ${extra}` : ''}{inativo ? ' (INATIVO)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-400">Digite e clique em Buscar (ou Enter). Busca toda a base por código, razão social, nome fantasia, nome ou CNPJ.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Produto / Parceiro *</label>
                <select value={vendaForm.parceiro_id} onChange={e => setVendaForm((p: any) => ({ ...p, parceiro_id: e.target.value, plano_anterior: '', plano_novo: '' }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {/* Agrupado por categoria: ex. Corretor Tributário → Avant, Imendes; TEF → parceiros de TEF */}
                  {Object.entries(parceiros.reduce((acc: Record<string, Parceiro[]>, p) => {
                    (acc[p.categoria] = acc[p.categoria] || []).push(p); return acc;
                  }, {})).map(([cat, lista]) => (
                    <optgroup key={cat} label={CATEGORIA_LABEL[cat] || cat}>
                      {(lista as Parceiro[]).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
                {parceiroSelecionado?.pitch && (
                  <p className="mt-1.5 text-xs text-blue-600 bg-blue-50 rounded p-2 italic">"{parceiroSelecionado.pitch}"</p>
                )}
                {parceiroSelecionado && (
                  <p className="mt-1 text-xs text-gray-500">
                    Comissão: <span className="font-semibold text-green-700">R$ {parceiroSelecionado.comissao_valor.toLocaleString('pt-BR')}</span>
                    {parceiroSelecionado.tabela_valores && ` · ${parceiroSelecionado.tabela_valores}`}
                  </p>
                )}
                {/* Aviso inline de duplicado */}
                {vendaForm.cliente_id && vendaForm.parceiro_id && (() => {
                  const dupla = vendas.find(v =>
                    v.cliente_id === vendaForm.cliente_id &&
                    v.parceiro_id === vendaForm.parceiro_id &&
                    v.status !== 'CANCELADO'
                  );
                  if (!dupla) return null;
                  return (
                    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <p className="font-bold mb-0.5">⚠️ Possível duplicado detectado</p>
                      <p>Já existe uma venda de <b>{dupla.parceiro?.nome}</b> para este cliente com status <b>{STATUS_LABEL[dupla.status] || dupla.status}</b> (registrada em {new Date(dupla.created_at).toLocaleDateString('pt-BR')}).</p>
                      <p className="mt-0.5 text-amber-700">Você ainda pode salvar, mas confirme se não é um lançamento repetido.</p>
                    </div>
                  );
                })()}
              </div>

              {/* ── COMUNICAÇÃO: lojas que vão se comunicar (acréscimo por loja) ── */}
              {ehComunicacao && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 space-y-3">
                  <p className="text-sm font-bold text-teal-800">📡 Lojas que vão se comunicar</p>
                  <p className="text-[11px] text-teal-700">O acréscimo na mensalidade é cobrado <b>por loja</b>. Pesquise e marque todas as lojas envolvidas.</p>

                  {/* Busca própria das lojas */}
                  <input
                    type="text"
                    value={lojaBusca}
                    onChange={e => setLojaBusca(e.target.value)}
                    placeholder="🔍 Pesquisar loja por código, razão social, fantasia ou CNPJ…"
                    className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                    autoComplete="off"
                  />
                  {lojaBusca.trim().length >= 2 && (
                    <div className="max-h-40 overflow-auto rounded border border-teal-200 bg-white divide-y">
                      {lojaLoading && <p className="text-xs text-gray-400 p-2">Buscando…</p>}
                      {!lojaLoading && lojaResultados.length === 0 && <p className="text-xs text-gray-400 p-2">Nenhuma loja encontrada.</p>}
                      {lojaResultados.map((c: any) => {
                        const nome = c.nome_fantasia || c.razao_social || c.nome || 'Sem nome';
                        const marcada = (vendaForm.lojas_ids || []).includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-teal-50">
                            <input type="checkbox" checked={marcada} onChange={() => toggleLoja(c)} />
                            <span>{nome}{c.codigo ? ` · #${c.codigo}` : ''}{c.cidade ? ` · ${c.cidade}` : ''}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Lojas selecionadas — cada uma com seu acréscimo individual.
                      Deixe 0 (ou vazio) p/ lojas que já comunicam e estão só sendo associadas. */}
                  {(vendaForm.lojas_ids || []).length > 0 && (
                    <div className="rounded border border-teal-200 bg-white divide-y">
                      {(vendaForm.lojas_ids || []).map((lid: string) => {
                        const info = lojasSelMap[lid] || lojaResultados.find((x: any) => x.id === lid) || {};
                        const nome = info.nome || info.nome_fantasia || info.razao_social || lid;
                        return (
                          <div key={lid} className="flex items-center gap-2 px-2 py-1.5">
                            <button type="button" title="Remover loja"
                              onClick={() => { setVendaForm((p: any) => ({ ...p, lojas_ids: (p.lojas_ids || []).filter((x: string) => x !== lid), setup_loja_id: p.setup_loja_id === lid ? '' : p.setup_loja_id })); setLojasAcrescimo(prev => { const n = { ...prev }; delete n[lid]; return n; }); }}
                              className="text-red-400 hover:text-red-600 font-bold text-sm">×</button>
                            <span className="flex-1 text-sm text-gray-800 truncate">{info.codigo ? `${info.codigo} · ` : ''}{nome}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] text-gray-500">+ R$</span>
                              <input type="number" step="0.01" min="0" value={lojasAcrescimo[lid] || ''}
                                onChange={e => setLojasAcrescimo(prev => ({ ...prev, [lid]: e.target.value }))}
                                placeholder="0,00"
                                className="w-24 px-2 py-1 border border-gray-200 rounded text-sm text-right" />
                              <span className="text-[11px] text-gray-400">/mês</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="text-xs text-teal-800">
                    {nLojasComunic} loja(s) · acréscimo total: <b>R$ {acrescimoTotalComunic.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</b>
                  </div>

                  {/* Setup: valor cobrado + de qual loja + forma de pagamento */}
                  <div className="rounded border border-teal-200 bg-white p-2 space-y-2">
                    <p className="text-xs font-semibold text-teal-800">Setup (cobrado de UMA loja)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Valor do setup (R$)</label>
                        <input type="number" step="0.01" min="0" value={vendaForm.valor_venda || ''}
                          onChange={e => setVendaForm((p: any) => ({ ...p, valor_venda: e.target.value }))}
                          placeholder="Ex: 650,00" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Cobrado da loja</label>
                        <select value={vendaForm.setup_loja_id || ''} onChange={e => setVendaForm((p: any) => ({ ...p, setup_loja_id: e.target.value }))}
                          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                          <option value="">Selecione a loja…</option>
                          {(vendaForm.lojas_ids || []).map((lid: string) => {
                            const info = lojasSelMap[lid] || {};
                            return <option key={lid} value={lid}>{info.codigo ? `${info.codigo} · ` : ''}{info.nome || lid}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                    {/* Forma de pagamento do setup */}
                    <div className="flex gap-2">
                      {[['PARCELADO', 'Parcelamento direto'], ['ENTRADA_PARCELAS', 'Entrada + parcelamento']].map(([v, label]) => (
                        <button key={v} type="button" onClick={() => setVendaForm((p: any) => ({ ...p, setup_forma: v }))}
                          className={`flex-1 px-2 py-1.5 rounded-lg text-xs border ${vendaForm.setup_forma === v ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {vendaForm.setup_forma === 'ENTRADA_PARCELAS' && (
                        <div>
                          <label className="text-xs font-medium text-gray-600">Entrada (R$)</label>
                          <input type="number" step="0.01" min="0" value={vendaForm.setup_entrada || ''}
                            onChange={e => setVendaForm((p: any) => ({ ...p, setup_entrada: e.target.value }))}
                            placeholder="0,00" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-medium text-gray-600">Nº de parcelas</label>
                        <input type="number" min="1" max="24" value={vendaForm.setup_parcelas || 1}
                          onChange={e => setVendaForm((p: any) => ({ ...p, setup_parcelas: e.target.value }))}
                          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                      </div>
                    </div>
                    {Number(vendaForm.valor_venda || 0) > 0 && (
                      <p className="text-[11px] text-teal-700">
                        {vendaForm.setup_forma === 'ENTRADA_PARCELAS'
                          ? `Entrada R$ ${Number(vendaForm.setup_entrada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} + ${Math.max(1, Number(vendaForm.setup_parcelas || 1))}x de R$ ${valorParcelaSetup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : `${Math.max(1, Number(vendaForm.setup_parcelas || 1))}x de R$ ${valorParcelaSetup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      </p>
                    )}
                    {Number(vendaForm.valor_venda || 0) > 0 && (
                      <div className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-[11px] text-green-800">
                        <b>Comissão sobre o setup:</b> Vendedor 15% = R$ {(Number(vendaForm.valor_venda || 0) * 0.15).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Supervisão 5% = R$ {(Number(vendaForm.valor_venda || 0) * 0.05).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <span className="block text-green-600">Paga no mês seguinte ao 1º vencimento, após a confirmação.</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Data inicial da venda</label>
                      <input type="date" value={vendaForm.data_venda || ''} onChange={e => setVendaForm((p: any) => ({ ...p, data_venda: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Início da comunicação</label>
                      <input type="date" value={vendaForm.data_inicio_comunicacao || ''} onChange={e => setVendaForm((p: any) => ({ ...p, data_inicio_comunicacao: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-gray-600">Primeiro vencimento</label>
                      <input type="date" value={vendaForm.primeiro_vencimento || ''} onChange={e => setVendaForm((p: any) => ({ ...p, primeiro_vencimento: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                      <p className="text-[11px] text-teal-700 mt-1">A comissão do vendedor entra no <b>mês seguinte</b> a este vencimento.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tipo do negócio: Indicação (R$50) ou Revenda (valor do parceiro) */}
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo do negócio *</label>
                <div className="flex gap-2 mt-1">
                  {[['INDICACAO', 'Indicação', 'Comissão R$ 50'], ['REVENDA', 'Revenda', 'Comissão do parceiro']].map(([val, label, hint]) => {
                    const ativo = (vendaForm.tipo_negocio || 'INDICACAO') === val;
                    return (
                      <button key={val} type="button" onClick={() => setVendaForm((p: any) => ({ ...p, tipo_negocio: val }))}
                        className="flex-1 px-3 py-2 rounded-lg border text-sm text-left transition-colors"
                        style={{ borderColor: ativo ? '#2563eb' : '#e5e7eb', background: ativo ? '#eff6ff' : '#fff' }}>
                        <div className="font-semibold" style={{ color: ativo ? '#2563eb' : '#374151' }}>{label}</div>
                        <div className="text-[10px] text-gray-500">{hint}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Indicação fica <b>pendente</b> até o retorno do parceiro — depois você confirma a venda.
                </p>
              </div>

              {/* Acréscimo na mensalidade — oculto na Comunicação (cada loja tem o seu) */}
              {!ehComunicacao && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Acréscimo na mensalidade (R$/mês)
                  {parceiroSelecionado?.categoria === 'FISCAL' && <span className="text-amber-600"> *</span>}
                </label>
                <input type="number" step="0.01" min="0" value={vendaForm.acrescimo_mensal || ''}
                  onChange={e => setVendaForm((p: any) => ({ ...p, acrescimo_mensal: e.target.value }))}
                  placeholder="Ex: 80,00"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="mt-1 text-[11px] text-gray-500">
                  Valor negociado a mais por mês com o cliente. Soma na <b>mensalidade total</b> da ficha do cliente quando a venda for confirmada.
                </p>
              </div>
              )}

              {/* Datas do negócio: indicação (demais parceiros) + fechamento. A
                  comissão entra no mês seguinte à CONFIRMAÇÃO (informada ao confirmar). */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!ehComunicacao && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Data da indicação</label>
                    <input type="date" value={vendaForm.data_indicacao || ''} onChange={e => setVendaForm((p: any) => ({ ...p, data_indicacao: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700">Data de fechamento</label>
                  <input type="date" value={vendaForm.data_fechamento || ''} onChange={e => setVendaForm((p: any) => ({ ...p, data_fechamento: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {!ehComunicacao && (
                <p className="text-[11px] text-gray-500">Ao confirmar, você informa a data da confirmação e a comissão entra no <b>mês seguinte</b>.</p>
              )}

              {/* Mensalidade atual → nova (atual + acréscimo) */}
              {vendaForm.cliente_id && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-2">💳 Impacto na mensalidade do cliente</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-center flex-1">
                      <p className="text-[11px] text-gray-500">Plano atual</p>
                      <p className="text-base font-bold text-gray-700">{fmtReal(mensalidadeAtual)}</p>
                      <p className="text-[10px] text-gray-400">{clienteSelecionado?.plano || '—'}/mês</p>
                    </div>
                    <span className="text-gray-400 text-lg">→</span>
                    <div className="text-center flex-1">
                      <p className="text-[11px] text-gray-500">Novo plano</p>
                      <p className="text-base font-extrabold text-green-700">{fmtReal(mensalidadeNova)}</p>
                      <p className="text-[10px] text-gray-400">
                        {acrescimo > 0 ? `+ ${fmtReal(acrescimo)}/mês` : 'sem acréscimo'}
                      </p>
                    </div>
                  </div>
                  {mensalidadeAtual === 0 && (
                    <p className="mt-2 text-[10px] text-amber-600">⚠️ Este cliente não tem mensalidade cadastrada na ficha. Informe o acréscimo para ver a nova mensalidade.</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Vendedor *</label>
                {isGestor ? (
                  // Supervisão/CEO: pode indicar qual vendedor fez a venda.
                  <select value={vendaForm.vendedor_id} onChange={e => setVendaForm((p: any) => ({ ...p, vendedor_id: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione o vendedor...</option>
                    {usuarios.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                ) : (
                  // Vendedor logado: registra para si mesmo (nome fixo).
                  <input
                    value={(user as any)?.nome || 'Você'}
                    disabled
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                  />
                )}
              </div>

              {parceiroSelecionado?.categoria === 'UPGRADE' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Plano atual</label>
                    <select value={vendaForm.plano_anterior} onChange={e => setVendaForm((p: any) => ({ ...p, plano_anterior: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Selecione...</option>
                      {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Novo plano</label>
                    <select value={vendaForm.plano_novo} onChange={e => setVendaForm((p: any) => ({ ...p, plano_novo: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Selecione...</option>
                      {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {/* Setup do upgrade (valor único cobrado pela mudança de plano) */}
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-700">Valor do setup do upgrade (R$)</label>
                    <input type="number" step="0.01" min="0" value={vendaForm.valor_venda}
                      onChange={e => setVendaForm((p: any) => ({ ...p, valor_venda: e.target.value }))}
                      placeholder="Ex: 200,00"
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="mt-1 text-[11px] text-gray-500">Valor único cobrado pelo upgrade. O acréscimo na mensalidade é informado no campo acima.</p>
                  </div>

                  {/* Forma de pagamento do setup */}
                  {setupTotal > 0 && (
                    <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                      <p className="text-xs font-semibold text-gray-600">Forma de pagamento do setup</p>
                      <div className="flex gap-2">
                        {[
                          { v: 'PARCELADO', l: 'Parcelado direto' },
                          { v: 'ENTRADA_PARCELAS', l: 'Entrada + parcelas' },
                        ].map(o => (
                          <button key={o.v} type="button"
                            onClick={() => setVendaForm((p: any) => ({ ...p, setup_forma: o.v }))}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                              vendaForm.setup_forma === o.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                            }`}>
                            {o.l}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {vendaForm.setup_forma === 'ENTRADA_PARCELAS' && (
                          <div>
                            <label className="text-[11px] font-medium text-gray-600">Entrada (R$)</label>
                            <input type="number" step="0.01" min="0" value={vendaForm.setup_entrada || ''}
                              onChange={e => setVendaForm((p: any) => ({ ...p, setup_entrada: e.target.value }))}
                              placeholder="0,00"
                              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        )}
                        <div>
                          <label className="text-[11px] font-medium text-gray-600">Parcelas do saldo</label>
                          <select value={vendaForm.setup_parcelas || 1}
                            onChange={e => setVendaForm((p: any) => ({ ...p, setup_parcelas: Number(e.target.value) }))}
                            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {[1, 2, 3, 4, 5, 6, 10, 12].map(n => <option key={n} value={n}>{n}x</option>)}
                          </select>
                        </div>
                        <div className={vendaForm.setup_forma === 'ENTRADA_PARCELAS' ? '' : 'col-span-1'}>
                          <label className="text-[11px] font-medium text-gray-600">Vencimento da 1ª parcela</label>
                          <input type="date" value={vendaForm.setup_primeiro_venc || ''}
                            onChange={e => setVendaForm((p: any) => ({ ...p, setup_primeiro_venc: e.target.value }))}
                            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>

                      {/* Resumo do parcelamento */}
                      <div className="text-[11px] text-gray-600 bg-white rounded-lg border border-gray-100 p-2">
                        {vendaForm.setup_forma === 'ENTRADA_PARCELAS' && setupEntrada > 0 && (
                          <p>Entrada: <b>{fmtReal(setupEntrada)}</b></p>
                        )}
                        <p>Saldo: <b>{fmtReal(saldoSetup)}</b> em <b>{setupParcelas}x</b> de <b className="text-blue-700">{fmtReal(valorParcelaSetup)}</b></p>
                        {vendaForm.setup_primeiro_venc && (
                          <p className="text-gray-400">1ª em {new Date(vendaForm.setup_primeiro_venc).toLocaleDateString('pt-BR')} · demais mensais sucessivas</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700">Valor para o cliente (R$/mês)</label>
                  <input type="number" value={vendaForm.valor_venda} onChange={e => setVendaForm((p: any) => ({ ...p, valor_venda: e.target.value }))}
                    placeholder="Opcional"
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Observações</label>
                <textarea value={vendaForm.observacoes} onChange={e => setVendaForm((p: any) => ({ ...p, observacoes: e.target.value }))}
                  rows={2} placeholder="Detalhes da conversa, próximos passos..."
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowVendaModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCreateVenda}
                disabled={!vendaForm.cliente_id || !vendaForm.parceiro_id || !vendaForm.vendedor_id || savingVenda}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingVenda ? 'Registrando...' : 'Registrar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Parceiro */}
      {showParceiroModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingParceiro ? 'Editar Parceiro' : 'Novo Parceiro'}</h2>
              <button onClick={() => setShowParceiroModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Nome *</label>
                <input value={parceiroForm.nome} onChange={e => setParceiroForm((p: any) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: BM Fiscal, Stone TEF..."
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Categoria *</label>
                <select value={parceiroForm.categoria} onChange={e => setParceiroForm((p: any) => ({ ...p, categoria: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(CATEGORIA_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Abordagem de venda</label>
                <textarea value={parceiroForm.pitch} onChange={e => setParceiroForm((p: any) => ({ ...p, pitch: e.target.value }))}
                  rows={3} placeholder="Como apresentar para o cliente..."
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Comissão do vendedor (R$)</label>
                  <input type="number" value={parceiroForm.comissao_valor} onChange={e => setParceiroForm((p: any) => ({ ...p, comissao_valor: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Valor para o cliente</label>
                  <input value={parceiroForm.tabela_valores} onChange={e => setParceiroForm((p: any) => ({ ...p, tabela_valores: e.target.value }))}
                    placeholder="Ex: R$ 100/mês"
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowParceiroModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSaveParceiro}
                disabled={!parceiroForm.nome || savingParceiro}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingParceiro ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Troca de CNPJ ─── */}
      {showTroca && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">🔄 Troca de CNPJ</h2>
              <button onClick={() => setShowTroca(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <p className="text-xs text-gray-500">Mesmo cadastro, mesmo plano e mesma mensalidade. Cobra a taxa do serviço, gera venda + comissão (15%/5%) e um contrato novo com os dados novos. Os dados antigos ficam guardados na ficha.</p>

            {/* Buscar cliente */}
            {!trocaCli ? (
              <div>
                <label className="text-xs font-medium text-gray-600">Cliente (buscar por nome/razão/código/CNPJ)</label>
                <input value={trocaBusca} onChange={e => { setTrocaBusca(e.target.value); buscarTroca(e.target.value); }} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Digite para buscar…" />
                {trocaResultados.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg divide-y max-h-44 overflow-auto">
                    {trocaResultados.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => { setTrocaCli(c); setTrocaForm((f: any) => ({ ...f, razao_social_nova: '', cnpj_novo: '' })); setTrocaResultados([]); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-violet-50">
                        <b>{c.razao_social || c.nome_fantasia || c.nome}</b>{c.codigo ? ` · ${c.codigo}` : ''}{c.cnpj ? ` · ${c.cnpj}` : ''}{c.plano ? ` · ${c.plano}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span><b>{trocaCli.razao_social || trocaCli.nome_fantasia || trocaCli.nome}</b>{trocaCli.codigo ? ` · ${trocaCli.codigo}` : ''}</span>
                  <button className="text-violet-700 text-xs underline" onClick={() => setTrocaCli(null)}>trocar</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Atual: CNPJ {trocaCli.cnpj || '—'} · Plano {trocaCli.plano || '—'} · Mensalidade R$ {Number(trocaCli.mensalidade_base || 0).toLocaleString('pt-BR')} (mantidos)</p>
              </div>
            )}

            {trocaCli && (
              <>
                <p className="text-xs font-bold text-gray-500 uppercase mt-1">Novos dados</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-600">Novo CNPJ *</label><input value={trocaForm.cnpj_novo} onChange={e => setTrocaForm({ ...trocaForm, cnpj_novo: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Inscrição estadual</label><input value={trocaForm.inscricao_nova} onChange={e => setTrocaForm({ ...trocaForm, inscricao_nova: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-600">Razão social</label><input value={trocaForm.razao_social_nova} onChange={e => setTrocaForm({ ...trocaForm, razao_social_nova: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-600">Nome fantasia</label><input value={trocaForm.nome_fantasia_nova} onChange={e => setTrocaForm({ ...trocaForm, nome_fantasia_nova: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">CEP</label><input value={trocaForm.cep} onChange={e => setTrocaForm({ ...trocaForm, cep: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Endereço</label><input value={trocaForm.endereco} onChange={e => setTrocaForm({ ...trocaForm, endereco: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Número</label><input value={trocaForm.numero_end} onChange={e => setTrocaForm({ ...trocaForm, numero_end: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Bairro</label><input value={trocaForm.bairro} onChange={e => setTrocaForm({ ...trocaForm, bairro: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Cidade</label><input value={trocaForm.cidade} onChange={e => setTrocaForm({ ...trocaForm, cidade: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Estado (UF)</label><input value={trocaForm.estado} onChange={e => setTrocaForm({ ...trocaForm, estado: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Telefone</label><input value={trocaForm.telefone} onChange={e => setTrocaForm({ ...trocaForm, telefone: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">E-mail</label><input value={trocaForm.email} onChange={e => setTrocaForm({ ...trocaForm, email: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                </div>

                <p className="text-xs font-bold text-gray-500 uppercase mt-2">Taxa do serviço + comissão</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-600">Taxa (R$) *</label><input type="number" value={trocaForm.taxa} onChange={e => setTrocaForm({ ...trocaForm, taxa: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0" /></div>
                  <div><label className="text-xs text-gray-600">Vendedor</label>
                    <select value={trocaForm.vendedor_id} onChange={e => setTrocaForm({ ...trocaForm, vendedor_id: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      <option value="">— selecione —</option>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-600">Entrada (R$)</label><input type="number" value={trocaForm.taxa_entrada} onChange={e => setTrocaForm({ ...trocaForm, taxa_entrada: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">Parcelas</label><input type="number" value={trocaForm.taxa_parcelas} onChange={e => setTrocaForm({ ...trocaForm, taxa_parcelas: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  <div><label className="text-xs text-gray-600">1º vencimento</label><input type="date" value={trocaForm.taxa_primeiro_venc} onChange={e => setTrocaForm({ ...trocaForm, taxa_primeiro_venc: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                </div>
                {Number(trocaForm.taxa) > 0 && (
                  <p className="text-[11px] text-green-700">Comissão: Vendedor 15% = R$ {(Number(trocaForm.taxa) * 0.15).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Supervisão 5% = R$ {(Number(trocaForm.taxa) * 0.05).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                )}
                <div><label className="text-xs text-gray-600">Motivo / observação</label><input value={trocaForm.motivo} onChange={e => setTrocaForm({ ...trocaForm, motivo: e.target.value })} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowTroca(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button>
              <button onClick={salvarTroca} disabled={trocaSalvando || !trocaCli} className="px-4 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg disabled:opacity-50">{trocaSalvando ? 'Processando…' : 'Confirmar troca de CNPJ'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Resumo da Troca de CNPJ (copiar p/ financeiro) ─── */}
      {trocaResumo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">✅ Troca de CNPJ registrada</h2>
              <button onClick={() => setTrocaResumo(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <p className="text-xs text-gray-500">Contrato {trocaResumo.numero || ''} gerado (marcado como serviço, não conta como cliente novo). Copie o resumo abaixo para lançar a cobrança.</p>
            <pre className="bg-slate-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 whitespace-pre-wrap font-sans">{trocaResumo.texto}</pre>
            <div className="flex justify-end gap-2">
              <button onClick={() => router.push('/contratos')} className="px-4 py-2 text-sm font-medium text-violet-700 border border-violet-200 rounded-lg">Abrir Contratos</button>
              <button onClick={async () => { await navigator.clipboard.writeText(trocaResumo.texto); alert('Resumo copiado!'); }} className="px-4 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg">📋 Copiar resumo</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
