'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Conversa {
  id: string;
  contato_numero: string;
  contato_nome?: string | null;
  lead_id?: string | null;
  ultima_mensagem?: string | null;
  ultima_em?: string | null;
  nao_lidas: number;
  etiqueta?: string | null;
  etiqueta_cor?: string | null;
  instancia?: { dono_nome?: string | null; numero?: string | null };
}

interface Mensagem {
  id: string;
  direcao: 'ENTRADA' | 'SAIDA';
  tipo?: string;
  conteudo: string;
  midia_url?: string | null;
  status?: string;
  enviada_por?: string | null;
  created_at: string;
}

const ETIQUETAS = [
  { nome: 'Farmácia', cor: '#16a34a' },
  { nome: 'Padaria', cor: '#d97706' },
  { nome: 'Varejo', cor: '#2563eb' },
  { nome: 'Cliente', cor: '#0891b2' },
  { nome: 'Lead', cor: '#7c3aed' },
  { nome: 'Parceiro', cor: '#db2777' },
];

type StatusConexao = 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO';

export default function WhatsappPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [configurado, setConfigurado] = useState(true);
  const [status, setStatus] = useState<StatusConexao>('DESCONECTADO');
  const [qr, setQr] = useState<string | null>(null);
  // Multi-instância
  const [instancias, setInstancias] = useState<any[]>([]);
  const [instAtivaId, setInstAtivaId] = useState<string | null>(null);
  const [novaInstNome, setNovaInstNome] = useState('');
  const [criandoInst, setCriandoInst] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [ativa, setAtiva] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [buscaConv, setBuscaConv] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [menuEtiqueta, setMenuEtiqueta] = useState(false);
  const [menuTransferir, setMenuTransferir] = useState(false);
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [carregandoConn, setCarregandoConn] = useState(true);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  // Carrega instâncias do usuário e deriva status/qr da instância ativa.
  const checarStatus = useCallback(async () => {
    try {
      const res = await apiClient.getWhatsappInstancias();
      const d = res.data.data;
      setConfigurado(d.configurado !== false);
      const lista = d.instancias || [];
      setInstancias(lista);
      // Define a ativa: mantém a atual se ainda existe; senão 1ª conectada; senão 1ª.
      setInstAtivaId(prev => {
        const aindaExiste = prev && lista.some((i: any) => i.id === prev);
        const escolhida = aindaExiste ? prev : (lista.find((i: any) => i.status === 'CONECTADO')?.id || lista[0]?.id || null);
        const inst = lista.find((i: any) => i.id === escolhida);
        setStatus((inst?.status as StatusConexao) || 'DESCONECTADO');
        if (inst?.status === 'CONECTADO') setQr(null);
        else setQr(inst?.qr_code || null);
        return escolhida;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setCarregandoConn(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    checarStatus();
  }, [isAuthenticated, checarStatus]);

  // Polling: status enquanto conecta; conversas quando conectado.
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(() => {
      if (status === 'CONECTANDO') checarStatus();
      if (status === 'CONECTADO') carregarConversas();
    }, 5000);
    return () => clearInterval(t);
  }, [isAuthenticated, status, checarStatus]);

  const carregarConversas = useCallback(async () => {
    try {
      const res = await apiClient.getWhatsappConversas(instAtivaId || undefined);
      setConversas(res.data.data);
    } catch (e) { console.error(e); }
  }, [instAtivaId]);

  useEffect(() => {
    if (status === 'CONECTADO') carregarConversas();
  }, [status, instAtivaId, carregarConversas]);

  // Ao trocar de instância no seletor, atualiza status/qr e recarrega.
  const trocarInstancia = (id: string) => {
    setInstAtivaId(id);
    setAtiva(null);
    const inst = instancias.find(i => i.id === id);
    setStatus((inst?.status as StatusConexao) || 'DESCONECTADO');
    setQr(inst?.status === 'CONECTADO' ? null : (inst?.qr_code || null));
  };

  // Criar nova instância nomeada (novo número).
  const criarInstancia = async () => {
    if (!novaInstNome.trim()) { alert('Dê um nome para a instância (ex.: Comercial).'); return; }
    setCriandoInst(true);
    try {
      const res = await apiClient.criarInstanciaWhatsapp(novaInstNome.trim());
      setNovaInstNome('');
      await checarStatus();
      setInstAtivaId(res.data.data.instancia.id);
      setStatus('CONECTANDO');
      setQr(res.data.data.qr || null);
    } catch (e: any) { alert(e?.response?.data?.message || 'Falha ao criar instância'); }
    finally { setCriandoInst(false); }
  };

  // Reconectar / desconectar / renomear a instância ativa.
  const reconectarAtiva = async () => {
    if (!instAtivaId) return;
    try { const r = await apiClient.conectarInstanciaWhatsapp(instAtivaId); setQr(r.data.data.qr || null); setStatus('CONECTANDO'); } catch (e: any) { alert(e?.response?.data?.message || 'Falha'); }
  };
  const desconectarAtiva = async () => {
    if (!instAtivaId || !confirm('Desconectar este WhatsApp?')) return;
    try { await apiClient.desconectarInstanciaWhatsapp(instAtivaId); await checarStatus(); } catch (e: any) { alert(e?.response?.data?.message || 'Falha'); }
  };
  const renomearAtiva = async () => {
    if (!instAtivaId) return;
    const nome = prompt('Novo nome da instância:');
    if (!nome?.trim()) return;
    try { await apiClient.renomearInstanciaWhatsapp(instAtivaId, nome.trim()); await checarStatus(); } catch (e: any) { alert(e?.response?.data?.message || 'Falha'); }
  };
  // Apaga a instância de vez (quando "desconectar" não resolve / instância travada).
  const excluirInstancia = async () => {
    if (!instAtivaId || !confirm('Excluir esta instância de vez? (remove o número do CRM)')) return;
    try {
      await apiClient.deletarInstanciaWhatsapp(instAtivaId);
      setInstAtivaId(null);
      await checarStatus();
    } catch (e: any) { alert(e?.response?.data?.message || 'Falha ao excluir'); }
  };
  // Excluir uma conversa do Inbox.
  const excluirConversa = async (id: string) => {
    if (!confirm('Excluir esta conversa? As mensagens serão removidas do CRM.')) return;
    try {
      await apiClient.excluirConversaWhatsapp(id);
      if (ativa?.id === id) setAtiva(null);
      setConversas(prev => prev.filter(c => c.id !== id));
    } catch (e: any) { alert(e?.response?.data?.message || 'Falha ao excluir conversa'); }
  };

  // Vindo de um botão de WhatsApp do CRM (/whatsapp?numero=...&nome=...&lead=...):
  // abre (ou cria) a conversa daquele contato e seleciona.
  useEffect(() => {
    if (status !== 'CONECTADO') return;
    const params = new URLSearchParams(window.location.search);
    const numero = params.get('numero');
    if (!numero) return;
    (async () => {
      try {
        const res = await apiClient.abrirConversaWhatsapp(numero, params.get('nome') || undefined, params.get('lead') || undefined);
        const conv = res.data.data;
        await carregarConversas();
        await abrir(conv);
        // limpa o query string para não reabrir ao atualizar
        window.history.replaceState({}, '', '/whatsapp');
      } catch (e: any) {
        alert(e?.response?.data?.message || 'Não foi possível abrir a conversa. Conecte seu WhatsApp.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);


  const abrir = async (c: Conversa) => {
    setAtiva(c);
    try {
      const res = await apiClient.getWhatsappMensagens(c.id);
      setMensagens(res.data.data.mensagens);
      setConversas(prev => prev.map(x => x.id === c.id ? { ...x, nao_lidas: 0 } : x));
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) { console.error(e); }
  };

  // Polling de mensagens da conversa aberta.
  useEffect(() => {
    if (!ativa) return;
    const t = setInterval(async () => {
      try {
        const res = await apiClient.getWhatsappMensagens(ativa.id);
        setMensagens(res.data.data.mensagens);
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [ativa]);

  const enviar = async () => {
    if (!texto.trim() || !ativa) return;
    setEnviando(true);
    const txt = texto;
    setTexto('');
    try {
      const res = await apiClient.enviarWhatsappMensagem(ativa.id, txt);
      setMensagens(prev => [...prev, res.data.data]);
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Falha ao enviar');
      setTexto(txt);
    } finally {
      setEnviando(false);
    }
  };

  // Iniciar nova conversa digitando número com DDD.
  const iniciarConversa = async () => {
    const num = novoNumero.replace(/\D/g, '');
    if (num.length < 10) { alert('Digite o número com DDD (ex.: 27999998888).'); return; }
    try {
      const res = await apiClient.abrirConversaWhatsapp(num);
      setNovoNumero('');
      await carregarConversas();
      await abrir(res.data.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Não foi possível iniciar a conversa.');
    }
  };

  // Aplicar etiqueta à conversa ativa.
  const aplicarEtiqueta = async (nome: string | null, cor?: string) => {
    if (!ativa) return;
    try {
      await apiClient.etiquetarConversa(ativa.id, nome, cor);
      setAtiva({ ...ativa, etiqueta: nome, etiqueta_cor: cor || null });
      setConversas(prev => prev.map(c => c.id === ativa.id ? { ...c, etiqueta: nome, etiqueta_cor: cor || null } : c));
      setMenuEtiqueta(false);
    } catch (e: any) { alert(e?.response?.data?.message || 'Falha ao etiquetar'); }
  };

  // Transferir conversa para outro vendedor (só gestora).
  const abrirTransferir = async () => {
    setMenuTransferir(true);
    if (vendedores.length === 0) {
      try { const r = await apiClient.getWhatsappVendedores(); setVendedores(r.data.data); } catch {}
    }
  };
  const transferir = async (vendedorId: string) => {
    if (!ativa) return;
    try {
      await apiClient.transferirConversa(ativa.id, vendedorId);
      setMenuTransferir(false);
      alert('Conversa transferida com sucesso.');
      await carregarConversas();
      setAtiva(null);
    } catch (e: any) { alert(e?.response?.data?.message || 'Falha ao transferir'); }
  };

  const podeTransferir = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO', 'DIRETOR'].includes(((user as any)?.role || '').toUpperCase());

  const fmtHora = (d?: string | null) => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const nomeContato = (c: Conversa) => c.contato_nome || c.contato_numero;

  // Cor de avatar determinística pelo nome (estilo WhatsApp).
  const corAvatar = (nome: string) => {
    const cores = ['#0D8ABC', '#7E57C2', '#16A34A', '#D97706', '#DC2626', '#0891B2', '#DB2777', '#475569'];
    let h = 0; for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
    return cores[Math.abs(h) % cores.length];
  };

  const conversasFiltradas = buscaConv.trim()
    ? conversas.filter(c => nomeContato(c).toLowerCase().includes(buscaConv.toLowerCase()) || c.contato_numero.includes(buscaConv))
    : conversas;

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" /></div>;
  }

  return (
    <DashboardLayout>
      {/* Ocupa 100% da altura do main (que ja e flex-1). Tudo rola internamente;
          a pagina nao rola junto. h-full e robusto (nao depende de offset fixo). */}
      <div className="flex flex-col gap-3 h-full min-h-0">
        <div className="flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">WhatsApp</h1>
            <p className="text-gray-500 text-sm hidden sm:block">Atenda seus clientes sem sair do CRM</p>
          </div>
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            status === 'CONECTADO' ? 'bg-green-50 text-green-700 border border-green-200'
            : status === 'CONECTANDO' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
            <span className={`w-2 h-2 rounded-full ${status === 'CONECTADO' ? 'bg-green-500' : status === 'CONECTANDO' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
            {status === 'CONECTADO' ? 'Conectado' : status === 'CONECTANDO' ? 'Conectando…' : 'Desconectado'}
          </span>
        </div>

        {/* Barra de instâncias (multi-WhatsApp) — abas p/ trocar + ações */}
        {configurado && (
          <div className="flex items-center gap-2 flex-wrap bg-white border border-gray-200 rounded-xl p-2 flex-shrink-0 overflow-x-auto">
            {instancias.map(i => (
              <button key={i.id} onClick={() => trocarInstancia(i.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${instAtivaId === i.id ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                style={instAtivaId === i.id ? { background: 'linear-gradient(135deg,#128C7E,#075E54)', borderColor: '#128C7E' } : { borderColor: '#e5e7eb' }}>
                <span className={`w-2 h-2 rounded-full ${i.status === 'CONECTADO' ? 'bg-green-400' : i.status === 'CONECTANDO' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                {i.apelido || i.numero || 'WhatsApp'}
              </button>
            ))}
            {/* Criar nova instância */}
            <div className="flex items-center gap-1">
              <input value={novaInstNome} onChange={e => setNovaInstNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') criarInstancia(); }}
                placeholder="Nome do novo WhatsApp"
                className="bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none w-40" />
              <button onClick={criarInstancia} disabled={criandoInst}
                className="text-white rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-50" style={{ background: '#128C7E' }}>+ Conectar</button>
            </div>
            {/* Ações da instância ativa */}
            {instAtivaId && (
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={renomearAtiva} title="Renomear" className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1.5 border border-gray-200 rounded-lg">✏️ Nome</button>
                {status === 'CONECTADO'
                  ? <button onClick={desconectarAtiva} className="text-red-600 text-xs px-2 py-1.5 border border-red-200 rounded-lg">Desconectar</button>
                  : <button onClick={reconectarAtiva} className="text-green-700 text-xs px-2 py-1.5 border border-green-200 rounded-lg">Reconectar</button>}
                <button onClick={excluirInstancia} title="Excluir instância de vez" className="text-red-700 text-xs px-2 py-1.5 border border-red-300 rounded-lg">🗑️</button>
              </div>
            )}
          </div>
        )}

        {/* Evolution não configurada no servidor */}
        {!configurado && !carregandoConn && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">⚙️</div>
            <p className="font-medium text-yellow-800">Integração de WhatsApp ainda não configurada no servidor</p>
            <p className="text-sm text-yellow-700 mt-1">Peça ao administrador para configurar a Evolution API (EVOLUTION_API_URL e EVOLUTION_API_KEY) no Railway.</p>
          </div>
        )}

        {/* Conexão via QR Code */}
        {configurado && status !== 'CONECTADO' && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center max-w-md mx-auto">
            {qr ? (
              <>
                <p className="font-medium text-gray-900 mb-2">Escaneie o QR Code</p>
                <p className="text-sm text-gray-500 mb-4">No WhatsApp do celular: <strong>Aparelhos conectados → Conectar aparelho</strong></p>
                <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR Code WhatsApp" className="mx-auto w-56 h-56 border rounded-lg" />
                <p className="text-xs text-gray-400 mt-3">Aguardando leitura… a tela atualiza sozinha.</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">📱</div>
                <p className="font-medium text-gray-900 mb-1">{instancias.length === 0 ? 'Conecte seu primeiro WhatsApp' : 'Instância desconectada'}</p>
                <p className="text-sm text-gray-500 mb-5">
                  {instancias.length === 0
                    ? 'Dê um nome (ex.: "Comercial") na barra acima e clique em "+ Conectar" para gerar o QR Code.'
                    : 'Clique em "Reconectar" na barra acima para gerar um novo QR Code desta instância.'}
                </p>
                {instAtivaId && (
                  <button onClick={reconectarAtiva} className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-lg">
                    Gerar QR Code
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Inbox — estilo WhatsApp Web */}
        {configurado && status === 'CONECTADO' && (
          <div className="flex md:grid md:grid-cols-3 gap-0 rounded-2xl overflow-hidden border border-gray-200 shadow-sm flex-1 min-h-0">
            {/* Lista de conversas */}
            <div className={`bg-white flex-col border-r border-gray-200 min-h-0 w-full md:w-auto ${ativa ? 'hidden md:flex' : 'flex'}`}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#128C7E,#075E54)' }}>
                <span className="text-white font-semibold">Conversas</span>
                <span className="ml-auto text-xs text-green-100">{conversas.length}</span>
              </div>
              <div className="p-2 border-b border-gray-100 space-y-2">
                <input value={buscaConv} onChange={e => setBuscaConv(e.target.value)}
                  placeholder="🔍 Buscar conversa…"
                  className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                <div className="flex gap-1.5">
                  <input value={novoNumero} onChange={e => setNovoNumero(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') iniciarConversa(); }}
                    placeholder="Novo: nº com DDD (27999998888)"
                    className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  <button onClick={iniciarConversa} title="Iniciar conversa"
                    className="text-white rounded-lg px-3 text-sm font-bold" style={{ background: '#128C7E' }}>+</button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {conversasFiltradas.length === 0 && <p className="text-center text-gray-400 text-sm p-6">Nenhuma conversa</p>}
                {conversasFiltradas.map(c => (
                  <button key={c.id} onClick={() => abrir(c)}
                    className={`w-full text-left px-3 py-3 flex items-center gap-3 border-b border-gray-50 transition-colors ${ativa?.id === c.id ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-lg" style={{ background: corAvatar(nomeContato(c)) }}>
                      {nomeContato(c).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm truncate">{nomeContato(c)}</p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{fmtHora(c.ultima_em)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[13px] text-gray-500 truncate">{c.ultima_mensagem || '—'}</p>
                        {c.nao_lidas > 0 && <span className="bg-green-500 text-white text-[11px] font-bold rounded-full px-1.5 min-w-[20px] h-5 flex items-center justify-center flex-shrink-0">{c.nao_lidas}</span>}
                      </div>
                      {c.etiqueta && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ background: c.etiqueta_cor || '#6b7280' }}>{c.etiqueta}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Janela de chat */}
            <div className={`md:col-span-2 flex-col min-h-0 w-full flex-1 ${ativa ? 'flex' : 'hidden md:flex'}`}
              style={{ background: '#ECE5DD' }}>
              {!ativa ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400" style={{ background: '#F0F2F5' }}>
                  <div className="text-6xl mb-3">💬</div>
                  <p className="text-sm">Selecione uma conversa para começar a atender</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2.5 flex items-center gap-3 shadow-sm relative" style={{ background: 'linear-gradient(135deg,#128C7E,#075E54)' }}>
                    <button onClick={() => setAtiva(null)} className="md:hidden text-white text-lg">←</button>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: corAvatar(nomeContato(ativa)) }}>
                      {nomeContato(ativa).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-sm truncate">{nomeContato(ativa)}</p>
                        {ativa.etiqueta && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ background: ativa.etiqueta_cor || '#6b7280' }}>{ativa.etiqueta}</span>}
                      </div>
                      <p className="text-[11px] text-green-100 truncate">{ativa.contato_numero}{ativa.lead_id ? ' · 🔗 vinculado ao funil' : ''}</p>
                    </div>
                    {/* Etiquetar */}
                    <button onClick={() => { setMenuEtiqueta(v => !v); setMenuTransferir(false); }} title="Etiquetar" className="text-white text-sm bg-white/15 rounded-lg px-2.5 py-1.5">🏷️</button>
                    {/* Transferir (só gestora) */}
                    {podeTransferir && (
                      <button onClick={() => { abrirTransferir(); setMenuEtiqueta(false); }} title="Transferir vendedor" className="text-white text-sm bg-white/15 rounded-lg px-2.5 py-1.5">↗️</button>
                    )}
                    {/* Excluir conversa */}
                    <button onClick={() => excluirConversa(ativa.id)} title="Excluir conversa" className="text-white text-sm bg-white/15 rounded-lg px-2.5 py-1.5">🗑️</button>
                    {/* Menu etiqueta */}
                    {menuEtiqueta && (
                      <div className="absolute right-3 top-14 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-2 w-44">
                        <p className="text-xs text-gray-400 px-1 mb-1">Etiqueta</p>
                        {ETIQUETAS.map(e => (
                          <button key={e.nome} onClick={() => aplicarEtiqueta(e.nome, e.cor)} className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full" style={{ background: e.cor }} />{e.nome}
                          </button>
                        ))}
                        <button onClick={() => aplicarEtiqueta(null)} className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 text-sm text-gray-400">Remover etiqueta</button>
                      </div>
                    )}
                    {/* Menu transferir */}
                    {menuTransferir && (
                      <div className="absolute right-3 top-14 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-2 w-52 max-h-72 overflow-y-auto">
                        <p className="text-xs text-gray-400 px-1 mb-1">Transferir para</p>
                        {vendedores.length === 0 ? <p className="text-xs text-gray-400 px-2 py-2">Carregando…</p> :
                          vendedores.map(v => (
                            <button key={v.id} onClick={() => transferir(v.id)} className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 text-sm">{v.nome}</button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M0 0h40v40H0z%22 fill=%22%23ECE5DD%22/%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%221%22 fill=%22%23D9D2C9%22/%3E%3C/svg%3E")' }}>
                    {mensagens.map(m => (
                      <div key={m.id} className={`flex ${m.direcao === 'SAIDA' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${m.direcao === 'SAIDA' ? 'rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}
                          style={m.direcao === 'SAIDA' ? { background: '#DCF8C6', color: '#111' } : {}}>
                          {m.enviada_por === 'bot' && <p className="text-[10px] font-semibold text-green-700 mb-0.5">🤖 Atendimento automático</p>}
                          {m.tipo === 'IMAGEM' && m.midia_url && (
                            <img src={m.midia_url} alt="imagem" className="rounded-lg max-w-full mb-1" style={{ maxHeight: 240 }} />
                          )}
                          {m.tipo === 'AUDIO' && m.midia_url && (
                            <audio controls src={m.midia_url} className="mb-1" style={{ maxWidth: 220 }} />
                          )}
                          {m.tipo === 'DOCUMENTO' && m.midia_url && (
                            <a href={m.midia_url} download className="text-blue-600 underline text-xs block mb-1">📎 Baixar documento</a>
                          )}
                          {!(m.tipo === 'IMAGEM' && m.midia_url) && (
                            <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                          )}
                          <p className="text-[10px] mt-0.5 text-right text-gray-400">{fmtHora(m.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={fimRef} />
                  </div>
                  <div className="p-3 flex items-center gap-2" style={{ background: '#F0F2F5' }}>
                    <input
                      value={texto}
                      onChange={e => setTexto(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      placeholder="Escreva uma mensagem…"
                      className="flex-1 bg-white rounded-full px-4 py-2.5 text-sm focus:outline-none shadow-sm"
                    />
                    <button onClick={enviar} disabled={enviando || !texto.trim()}
                      className="disabled:opacity-50 text-white rounded-full w-11 h-11 flex items-center justify-center shadow-md text-lg" style={{ background: '#128C7E' }}>
                      ➤
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
