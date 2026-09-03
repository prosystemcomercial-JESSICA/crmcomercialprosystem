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
  estagio_funil?: string;
  prioridade?: string;
  sla_prazo_em?: string | null;
  instancia?: { apelido?: string | null; dono_nome?: string | null; numero?: string | null };
}

interface PainelConversa {
  cliente: {
    id: string; codigo?: string | null; razao_social?: string | null; nome_fantasia?: string | null;
    nome?: string | null; plano?: string | null; segmento?: string | null; situacao?: string | null;
    mensalidade_base?: number | null; data_entrada?: string | null;
  } | null;
  proposta: {
    id: string; status: string; valor_final?: number | null; titulo_proposta?: string | null;
    validade?: string | null; created_at: string;
  } | null;
  responsavel: { nome: string; cargo?: string | null } | null;
  prioridade: string;
  estagio_funil: string;
  sla_prazo_em?: string | null;
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

// Segmento/comercial (mantém no funil).
const ETIQUETAS = [
  { nome: 'Farmácia', cor: '#16a34a' },
  { nome: 'Padaria', cor: '#d97706' },
  { nome: 'Varejo', cor: '#2563eb' },
  { nome: 'Cliente', cor: '#0891b2' },
  { nome: 'Lead', cor: '#7c3aed' },
];
// Tipos de atendimento NÃO-comerciais — ao marcar, desvinculam do funil sozinhos.
const ETIQUETAS_TIPO = [
  { nome: 'Financeiro', cor: '#0d9488' },
  { nome: 'Renegociação', cor: '#ca8a04' },
  { nome: 'Serviço', cor: '#6366f1' },
  { nome: 'Parceiro', cor: '#db2777' },
  { nome: 'Suporte', cor: '#64748b' },
  { nome: 'Pessoal', cor: '#9333ea' },
];

// Kanban comercial (funil de atendimento) — substitui o Kanban por etiqueta.
const ESTAGIOS_FUNIL = [
  { valor: 'NOVO_CONTATO', nome: 'Novo Contato', cor: '#7c3aed' },
  { valor: 'EM_NEGOCIACAO', nome: 'Em Negociação', cor: '#2563eb' },
  { valor: 'PROPOSTA_ENVIADA', nome: 'Proposta Enviada', cor: '#d97706' },
  { valor: 'AGUARDANDO_RETORNO', nome: 'Aguardando Retorno', cor: '#64748b' },
  { valor: 'FECHADO', nome: 'Fechado', cor: '#16a34a' },
];

const PRIORIDADES = [
  { valor: 'BAIXA', nome: 'Baixa', cor: '#64748b' },
  { valor: 'NORMAL', nome: 'Normal', cor: '#2563eb' },
  { valor: 'CRITICA', nome: 'Crítica', cor: '#dc2626' },
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
  const [gravando, setGravando] = useState(false);
  const [gravTempo, setGravTempo] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const gravTimerRef = useRef<any>(null);
  const [buscaConv, setBuscaConv] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [menuEtiqueta, setMenuEtiqueta] = useState(false);
  const [menuPrioridade, setMenuPrioridade] = useState(false);
  const [menuTransferir, setMenuTransferir] = useState(false);
  const [painel, setPainel] = useState<PainelConversa | null>(null);
  const [viewMode, setViewMode] = useState<'inbox' | 'kanban'>('inbox');
  const [verSupervisao, setVerSupervisao] = useState(false); // gestão: ver conversas de todos
  const [dragConvId, setDragConvId] = useState<string | null>(null);
  const [showReuniao, setShowReuniao] = useState(false);
  const [reuniao, setReuniao] = useState({ data: '', duracao_minutos: 60, link: '', titulo: 'Reunião ProSystem' });
  const [salvandoReuniao, setSalvandoReuniao] = useState(false);
  // Vincular conversa a um cliente da base (+ registrar contato com cargo)
  const [showVincCliente, setShowVincCliente] = useState(false);
  const [vincBusca, setVincBusca] = useState('');
  const [vincResultados, setVincResultados] = useState<any[]>([]);
  const [vincSel, setVincSel] = useState<any>(null);
  const [vincNome, setVincNome] = useState('');
  const [vincCargo, setVincCargo] = useState('');
  const [vincSalvando, setVincSalvando] = useState(false);
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

  // Polling: status enquanto conecta. Conversas/mensagens têm SSE (tempo real,
  // ver useEffect abaixo) — este intervalo aqui fica bem mais longo, só como
  // rede de segurança caso a conexão SSE caia sem o navegador notar.
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(() => {
      if (status === 'CONECTANDO') checarStatus();
      if (status === 'CONECTADO') carregarConversas();
    }, status === 'CONECTANDO' ? 5000 : 30000);
    return () => clearInterval(t);
  }, [isAuthenticated, status, checarStatus]);

  const carregarConversas = useCallback(async () => {
    try {
      // No modo supervisão (gestão), ignora a instância e traz as conversas de todos.
      const res = verSupervisao
        ? await apiClient.getWhatsappConversas(undefined, 'todos')
        : await apiClient.getWhatsappConversas(instAtivaId || undefined);
      setConversas(res.data.data);
    } catch (e) { console.error(e); }
  }, [instAtivaId, verSupervisao]);

  useEffect(() => {
    if (status === 'CONECTADO') carregarConversas();
  }, [status, instAtivaId, verSupervisao, carregarConversas]);

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
      if (!res.data.data.qr) alert('A instância foi criada, mas o QR Code não veio da UazAPI. Tente clicar em "Reconectar" na barra de instâncias.');
    } catch (e: any) {
      console.error('Falha ao criar instância', e);
      alert(`Falha ao conectar o WhatsApp: ${e?.response?.data?.message || e?.message || 'erro desconhecido'}`);
    }
    finally { setCriandoInst(false); }
  };

  // Reconectar / desconectar / renomear a instância ativa.
  const reconectarAtiva = async () => {
    if (!instAtivaId) return;
    try { const r = await apiClient.conectarInstanciaWhatsapp(instAtivaId); setQr(r.data.data.qr || null); setStatus('CONECTANDO'); } catch (e: any) { console.error('Falha', e); }
  };
  const desconectarAtiva = async () => {
    if (!instAtivaId || !confirm('Desconectar este WhatsApp?')) return;
    try { await apiClient.desconectarInstanciaWhatsapp(instAtivaId); await checarStatus(); } catch (e: any) { console.error('Falha', e); }
  };
  const renomearAtiva = async () => {
    if (!instAtivaId) return;
    const nome = prompt('Novo nome da instância:');
    if (!nome?.trim()) return;
    try { await apiClient.renomearInstanciaWhatsapp(instAtivaId, nome.trim()); await checarStatus(); } catch (e: any) { console.error('Falha', e); }
  };
  // Apaga a instância de vez (quando "desconectar" não resolve / instância travada).
  const excluirInstancia = async () => {
    if (!instAtivaId || !confirm('Excluir esta instância de vez? (remove o número do CRM)')) return;
    try {
      await apiClient.deletarInstanciaWhatsapp(instAtivaId);
      setInstAtivaId(null);
      await checarStatus();
    } catch (e: any) { console.error('Falha ao excluir', e); }
  };
  // Desvincular a conversa do funil (não conta como lead no dashboard).
  const desvincularFunil = async () => {
    if (!ativa) return;
    if (!confirm('Desvincular esta conversa do funil? Ela deixa de contar como lead no dashboard.')) return;
    try {
      await apiClient.desvincularConversaFunil(ativa.id);
      setAtiva({ ...ativa, lead_id: null });
      setConversas(prev => prev.map(c => c.id === ativa.id ? { ...c, lead_id: null } : c));
    } catch (e: any) { console.error('Falha ao desvincular', e); }
  };

  // Abrir modal de vincular cliente: pré-preenche o nome com o do contato.
  const abrirVincCliente = () => {
    setVincSel(null); setVincBusca(''); setVincResultados([]);
    setVincNome(ativa?.contato_nome || ''); setVincCargo('');
    setShowVincCliente(true);
  };
  // Busca de cliente na base (server-side, debounce).
  useEffect(() => {
    if (!showVincCliente || vincSel) return;
    const termo = vincBusca.trim();
    if (termo.length < 2) { setVincResultados([]); return; }
    const t = setTimeout(() => {
      apiClient.getClientes(0, 15, termo)
        .then(r => setVincResultados(r.data.data.clientes || []))
        .catch(() => setVincResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [vincBusca, showVincCliente, vincSel]);

  const salvarVincCliente = async () => {
    if (!ativa || !vincSel) { console.warn('Selecione o cliente.'); return; }
    setVincSalvando(true);
    try {
      await apiClient.vincularConversaCliente(ativa.id, {
        cliente_id: vincSel.id, nome: vincNome || undefined, cargo: vincCargo || undefined,
      });
      // Atualiza a etiqueta verde na hora (sem precisar recarregar): código + razão.
      const cod = vincSel.codigo || null;
      const razao = vincSel.razao_social || vincSel.nome_fantasia || vincSel.nome || null;
      setAtiva(prev => prev ? ({ ...prev, cliente_id: vincSel.id, cliente_codigo: cod, cliente_razao: razao } as any) : prev);
      setConversas(prev => prev.map(c => c.id === ativa.id ? ({ ...c, cliente_id: vincSel.id, cliente_codigo: cod, cliente_razao: razao } as any) : c));
      setShowVincCliente(false);
      console.warn('Conversa vinculada ao cliente e contato registrado na ficha! ✅');
    } catch (e: any) { console.error('Falha ao vincular ao cliente', e); }
    finally { setVincSalvando(false); }
  };

  // Agendar reunião: cria a atividade e envia o link pelo WhatsApp do contato.
  const agendarReuniao = async () => {
    if (!ativa || !reuniao.data) { console.warn('Escolha a data e hora da reunião.'); return; }
    setSalvandoReuniao(true);
    try {
      await apiClient.agendarReuniaoWhatsapp(ativa.id, {
        data: new Date(reuniao.data).toISOString(),
        duracao_minutos: Number(reuniao.duracao_minutos) || 60,
        link: reuniao.link || undefined,
        titulo: reuniao.titulo || undefined,
      });
      setShowReuniao(false);
      setReuniao({ data: '', duracao_minutos: 60, link: '', titulo: 'Reunião ProSystem' });
      // Recarrega as mensagens p/ mostrar a confirmação enviada.
      const res = await apiClient.getWhatsappMensagens(ativa.id);
      setMensagens(res.data.data.mensagens);
      console.warn('Reunião agendada e link enviado no WhatsApp! 📅');
    } catch (e: any) {
      console.error('Falha ao agendar reunião', e);
    } finally { setSalvandoReuniao(false); }
  };

  // Excluir uma conversa do Inbox.
  const excluirConversa = async (id: string) => {
    if (!confirm('Excluir esta conversa? As mensagens serão removidas do CRM.')) return;
    try {
      await apiClient.excluirConversaWhatsapp(id);
      if (ativa?.id === id) setAtiva(null);
      setConversas(prev => prev.filter(c => c.id !== id));
    } catch (e: any) { console.error('Falha ao excluir conversa', e); }
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
        console.error('Não foi possível abrir a conversa. Conecte seu WhatsApp.', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);


  const abrir = async (c: Conversa) => {
    setAtiva(c);
    setPainel(null);
    try {
      const res = await apiClient.getWhatsappMensagens(c.id);
      setMensagens(res.data.data.mensagens);
      setConversas(prev => prev.map(x => x.id === c.id ? { ...x, nao_lidas: 0 } : x));
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) { console.error(e); }
    try {
      const resPainel = await apiClient.getPainelConversaWhatsapp(c.id);
      setPainel(resPainel.data.data);
    } catch (e) { console.error('Falha ao carregar painel', e); }
  };

  // Move a conversa entre as colunas do funil comercial.
  const moverEstagio = async (convId: string, estagio_funil: string) => {
    try {
      await apiClient.moverEstagioConversa(convId, estagio_funil);
      setConversas(prev => prev.map(c => c.id === convId ? { ...c, estagio_funil } : c));
      if (ativa?.id === convId) setAtiva({ ...ativa, estagio_funil });
    } catch (e: any) { console.error('Falha ao mover etapa', e); }
  };

  // Define a prioridade da conversa ativa.
  const definirPrioridade = async (prioridade: string) => {
    if (!ativa) return;
    try {
      const res = await apiClient.definirPrioridadeConversa(ativa.id, prioridade);
      const upd = res.data.data;
      setAtiva({ ...ativa, prioridade: upd.prioridade, sla_prazo_em: upd.sla_prazo_em });
      setConversas(prev => prev.map(c => c.id === ativa.id ? { ...c, prioridade: upd.prioridade, sla_prazo_em: upd.sla_prazo_em } : c));
      setPainel(p => p ? { ...p, prioridade: upd.prioridade, sla_prazo_em: upd.sla_prazo_em } : p);
      setMenuPrioridade(false);
    } catch (e: any) { console.error('Falha ao definir prioridade', e); }
  };

  // Polling de mensagens da conversa aberta — rede de segurança (ver SSE
  // abaixo), bem mais espaçado agora que o tempo real cobre o caso comum.
  useEffect(() => {
    if (!ativa) return;
    const t = setInterval(async () => {
      try {
        const res = await apiClient.getWhatsappMensagens(ativa.id);
        setMensagens(res.data.data.mensagens);
      } catch {}
    }, 20000);
    return () => clearInterval(t);
  }, [ativa]);

  // Tempo real (SSE): substitui o polling curto por push do servidor. Refs
  // guardam o estado mais recente pra evitar closures obsoletas dentro do
  // listener (o EventSource é aberto uma única vez por sessão autenticada).
  const ativaRef = useRef(ativa);
  useEffect(() => { ativaRef.current = ativa; }, [ativa]);

  useEffect(() => {
    if (!isAuthenticated || status !== 'CONECTADO') return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const es = new EventSource(`${apiUrl}/whatsapp/eventos?token=${encodeURIComponent(token)}`);

    es.onmessage = (ev) => {
      try {
        const evento = JSON.parse(ev.data);
        if (evento.tipo === 'mensagem') {
          // Mensagem nova de uma conversa: se é a conversa aberta, injeta na
          // lista de mensagens; sempre recarrega a lista de conversas (última
          // mensagem/não lidas mudam mesmo se a conversa não estiver aberta).
          if (ativaRef.current?.id === evento.conversaId) {
            setMensagens(prev => prev.some(m => m.id === evento.mensagem.id) ? prev : [...prev, evento.mensagem]);
            setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
          carregarConversas();
        } else if (evento.tipo === 'conversa_atualizada') {
          carregarConversas();
        }
      } catch { /* evento malformado — ignora */ }
    };
    es.onerror = () => { /* o EventSource reconecta sozinho; o polling de rede de segurança cobre o intervalo */ };

    return () => es.close();
  }, [isAuthenticated, status, carregarConversas]);

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
      console.error('Falha ao enviar', e);
      setTexto(txt);
    } finally {
      setEnviando(false);
    }
  };

  // ── Gravar e enviar áudio (mensagem de voz) ────────────────────────────────
  const blobParaBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  const iniciarGravacao = async () => {
    if (!ativa) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // ogg/opus é o formato que o WhatsApp usa p/ voz; cai p/ webm se não suportar.
      const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '');
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/ogg' });
        if (blob.size > 0 && ativa) {
          try {
            const dataUrl = await blobParaBase64(blob);
            const res = await apiClient.enviarWhatsappAudio(ativa.id, dataUrl);
            setMensagens(prev => [...prev, res.data.data]);
            setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          } catch (e: any) {
            console.error('Falha ao enviar o áudio', e);
          }
        }
      };
      mediaRecRef.current = rec;
      rec.start();
      setGravando(true);
      setGravTempo(0);
      gravTimerRef.current = setInterval(() => setGravTempo(t => t + 1), 1000);
    } catch {
      console.warn('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  };

  const pararGravacao = (cancelar = false) => {
    if (gravTimerRef.current) { clearInterval(gravTimerRef.current); gravTimerRef.current = null; }
    setGravando(false);
    setGravTempo(0);
    const rec = mediaRecRef.current;
    if (!rec) return;
    if (cancelar) { chunksRef.current = []; rec.onstop = () => rec.stream?.getTracks().forEach(t => t.stop()); }
    if (rec.state !== 'inactive') rec.stop();
    mediaRecRef.current = null;
  };

  // Iniciar nova conversa digitando número com DDD.
  const iniciarConversa = async () => {
    const num = novoNumero.replace(/\D/g, '');
    if (num.length < 10) { console.warn('Digite o número com DDD (ex.: 27999998888).'); return; }
    try {
      const res = await apiClient.abrirConversaWhatsapp(num);
      setNovoNumero('');
      await carregarConversas();
      await abrir(res.data.data);
    } catch (e: any) {
      console.error('Não foi possível iniciar a conversa.', e);
    }
  };

  // Aplicar etiqueta à conversa ativa.
  const aplicarEtiqueta = async (nome: string | null, cor?: string) => {
    if (!ativa) return;
    try {
      const res = await apiClient.etiquetarConversa(ativa.id, nome, cor);
      const upd = res.data.data; // backend pode ter desvinculado (lead_id null) se tipo não-comercial
      setAtiva({ ...ativa, etiqueta: upd.etiqueta, etiqueta_cor: upd.etiqueta_cor, lead_id: upd.lead_id });
      setConversas(prev => prev.map(c => c.id === ativa.id ? { ...c, etiqueta: upd.etiqueta, etiqueta_cor: upd.etiqueta_cor, lead_id: upd.lead_id } : c));
      setMenuEtiqueta(false);
    } catch (e: any) { console.error('Falha ao etiquetar', e); }
  };

  // Aplica etiqueta a uma conversa por id (usado ao arrastar no Kanban).
  const etiquetarPorId = async (convId: string, nome: string | null, cor?: string) => {
    try {
      const res = await apiClient.etiquetarConversa(convId, nome, cor);
      const upd = res.data.data;
      setConversas(prev => prev.map(c => c.id === convId ? { ...c, etiqueta: upd.etiqueta, etiqueta_cor: upd.etiqueta_cor, lead_id: upd.lead_id } : c));
      if (ativa?.id === convId) setAtiva({ ...ativa, etiqueta: upd.etiqueta, etiqueta_cor: upd.etiqueta_cor, lead_id: upd.lead_id });
    } catch (e: any) { console.error('Falha ao etiquetar', e); }
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
      console.warn('Conversa transferida com sucesso.');
      await carregarConversas();
      setAtiva(null);
    } catch (e: any) { console.error('Falha ao transferir', e); }
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

  // Formata o prazo de SLA: "Violado há 3h" (vermelho) ou "Prazo em 5h" (neutro).
  const fmtSla = (sla_prazo_em?: string | null): { texto: string; violado: boolean } | null => {
    if (!sla_prazo_em) return null;
    const diffMs = new Date(sla_prazo_em).getTime() - Date.now();
    const violado = diffMs < 0;
    const horas = Math.abs(diffMs) / 3600000;
    const txtHoras = horas < 1 ? `${Math.round(horas * 60)}min` : `${Math.round(horas)}h`;
    return { texto: violado ? `Violado há ${txtHoras}` : `Prazo em ${txtHoras}`, violado };
  };

  const fmtDataCurta = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtMoeda = (v?: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const tempoDeCasa = (d?: string | null) => {
    if (!d) return '—';
    const meses = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (meses < 1) return 'menos de 1 mês';
    if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    const anos = Math.floor(meses / 12);
    return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  };

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
            <h1 className="text-2xl sm:text-3xl font-bold text-sm font-semibold">WhatsApp</h1>
            <p className="text-gray-500 text-sm hidden sm:block">Atenda seus clientes sem sair do CRM</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle de visão: Inbox (lista) | Kanban (por etiqueta) */}
            {status === 'CONECTADO' && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => setViewMode('inbox')} className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'inbox' ? 'text-white' : 'text-gray-600 bg-white'}`} style={viewMode === 'inbox' ? { background: '#2563eb' } : {}}>Conversas</button>
                <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 text-sm font-medium ${viewMode === 'kanban' ? 'text-white' : 'text-gray-600 bg-white'}`} style={viewMode === 'kanban' ? { background: '#2563eb' } : {}}>Fila de Chamados</button>
              </div>
            )}
            {/* Visão de supervisão (só gestão): alterna entre "minhas" e "todas". */}
            {status === 'CONECTADO' && podeTransferir && (
              <button
                onClick={() => setVerSupervisao(v => !v)}
                title="Ver as conversas de todos os vendedores (supervisão)"
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
                  verSupervisao ? 'text-white border-transparent' : 'text-gray-600 bg-white border-gray-200'
                }`}
                style={verSupervisao ? { background: '#2E6EAB' } : {}}>
                {verSupervisao ? '👁️ Todas (supervisão)' : '👤 Minhas'}
              </button>
            )}
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              status === 'CONECTADO' ? 'bg-green-50 text-green-700 border border-green-200'
              : status === 'CONECTANDO' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              : 'bg-opacity-0  border border-gray-200'}`}>
              <span className={`w-2 h-2 rounded-full ${status === 'CONECTADO' ? 'bg-green-500' : status === 'CONECTANDO' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
              {status === 'CONECTADO' ? 'Conectado' : status === 'CONECTANDO' ? 'Conectando…' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Barra de instâncias (multi-WhatsApp) — abas p/ trocar + ações */}
        {configurado && (
          <div className="flex items-center gap-2 flex-wrap ps-card border border-gray-200 rounded-xl p-2 flex-shrink-0 overflow-x-auto">
            {instancias.map(i => (
              <button key={i.id} onClick={() => trocarInstancia(i.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${instAtivaId === i.id ? 'text-white' : 'text-gray-600 hover:bg-opacity-0'}`}
                style={instAtivaId === i.id ? { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', borderColor: '#2563eb' } : { borderColor: '#e5e7eb' }}>
                <span className={`w-2 h-2 rounded-full ${i.status === 'CONECTADO' ? 'bg-green-400' : i.status === 'CONECTANDO' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                {i.apelido || i.numero || 'WhatsApp'}
              </button>
            ))}
            {/* Criar nova instância */}
            <div className="flex items-center gap-1">
              <input value={novaInstNome} onChange={e => setNovaInstNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') criarInstancia(); }}
                placeholder="Nome do novo WhatsApp"
                className="bg-opacity-0 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none w-40" />
              <button onClick={criarInstancia} disabled={criandoInst}
                className="text-white rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-50" style={{ background: '#2563eb' }}>+ Conectar</button>
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
          <div className="ps-card border border-gray-200 rounded-xl p-8 text-center max-w-md mx-auto">
            {qr ? (
              <>
                <p className="font-medium text-sm font-semibold mb-2">Escaneie o QR Code</p>
                <p className="text-sm  mb-4">No WhatsApp do celular: <strong>Aparelhos conectados → Conectar aparelho</strong></p>
                <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR Code WhatsApp" className="mx-auto w-56 h-56 border rounded-lg" />
                <p className="text-xs  mt-3">Aguardando leitura… a tela atualiza sozinha.</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">📱</div>
                <p className="font-medium text-sm font-semibold mb-1">{instancias.length === 0 ? 'Conecte seu primeiro WhatsApp' : 'Instância desconectada'}</p>
                <p className="text-sm  mb-5">
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
        {configurado && status === 'CONECTADO' && viewMode === 'inbox' && (
          <div className={`flex md:grid gap-0 rounded-2xl overflow-hidden border border-gray-200 shadow-sm flex-1 min-h-0 ${ativa ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {/* Lista de conversas */}
            <div className={`bg-white flex-col border-r border-gray-200 min-h-0 w-full md:w-auto ${ativa ? 'hidden md:flex' : 'flex'}`}>
              <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 bg-white">
                <span className="text-gray-800 font-semibold text-sm">Conversas</span>
                <span className="ml-auto text-xs text-gray-400">{conversas.length}</span>
              </div>
              <div className="p-2 border-b border-gray-100 space-y-2">
                <input value={buscaConv} onChange={e => setBuscaConv(e.target.value)}
                  placeholder="🔍 Buscar conversa…"
                  className="w-full bg-opacity-0 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                <div className="flex gap-1.5">
                  <input value={novoNumero} onChange={e => setNovoNumero(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') iniciarConversa(); }}
                    placeholder="Novo: nº com DDD (27999998888)"
                    className="flex-1 bg-opacity-0 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  <button onClick={iniciarConversa} title="Iniciar conversa"
                    className="text-white rounded-lg px-3 text-sm font-bold" style={{ background: '#2563eb' }}>+</button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {conversasFiltradas.length === 0 && <p className="text-center  text-sm p-6">Nenhuma conversa</p>}
                {conversasFiltradas.map(c => (
                  <button key={c.id} onClick={() => abrir(c)}
                    className={`w-full text-left px-3 py-3 flex items-center gap-3 border-b border-gray-50 transition-colors ${ativa?.id === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-lg" style={{ background: corAvatar(nomeContato(c)) }}>
                      {nomeContato(c).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm font-semibold text-sm truncate">{nomeContato(c)}</p>
                        <span className="text-[11px]  flex-shrink-0">{fmtHora(c.ultima_em)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[13px]  truncate">{c.ultima_mensagem || '—'}</p>
                        {c.nao_lidas > 0 && <span className="bg-blue-600 text-white text-[11px] font-bold rounded-full px-1.5 min-w-[20px] h-5 flex items-center justify-center flex-shrink-0">{c.nao_lidas}</span>}
                      </div>
                      {c.etiqueta && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ background: c.etiqueta_cor || '#6b7280' }}>{c.etiqueta}</span>
                      )}
                      {verSupervisao && c.instancia?.dono_nome && (
                        <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: '#E5EEF7', color: 'var(--t-primary-dark)' }}>
                          👤 {c.instancia.dono_nome}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Janela de chat */}
            <div className={`md:col-span-2 flex-col min-h-0 w-full flex-1 ${ativa ? 'flex' : 'hidden md:flex'}`}
              style={{ background: '#F7F8FA' }}>
              {!ativa ? (
                <div className="flex-1 flex flex-col items-center justify-center " style={{ background: '#F7F8FA' }}>
                  <div className="text-6xl mb-3">💬</div>
                  <p className="text-sm">Selecione uma conversa para começar a atender</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-200 bg-white relative">
                    <button onClick={() => setAtiva(null)} className="md:hidden text-gray-500 text-lg">←</button>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-sm" style={{ background: corAvatar(nomeContato(ativa)) }}>
                      {nomeContato(ativa).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm truncate">{nomeContato(ativa)}</p>
                        {ativa.etiqueta && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ background: ativa.etiqueta_cor || '#6b7280' }}>{ativa.etiqueta}</span>}
                        {(ativa as any).cliente_id && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white inline-flex items-center gap-1" style={{ background: '#16a34a' }}
                            title="Cliente da base vinculado a esta conversa">
                            👤 {(ativa as any).cliente_codigo ? `${(ativa as any).cliente_codigo} · ` : ''}{(ativa as any).cliente_razao || 'Cliente vinculado'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">{ativa.contato_numero}{ativa.lead_id ? ' · 🔗 funil' : ''}</p>
                    </div>
                    {/* Prioridade da conversa */}
                    {(() => {
                      const prioAtiva = PRIORIDADES.find(p => p.valor === (ativa.prioridade || 'NORMAL'));
                      const slaAtiva = fmtSla(ativa.sla_prazo_em);
                      return (
                        <button onClick={() => { setMenuPrioridade(v => !v); setMenuEtiqueta(false); setMenuTransferir(false); }}
                          title="Prioridade" className="text-white text-[11px] font-bold rounded-lg px-2.5 py-1.5"
                          style={{ background: prioAtiva?.cor || '#64748b' }}>
                          {prioAtiva?.nome || 'Normal'}{slaAtiva?.violado ? ' ⏰' : ''}
                        </button>
                      );
                    })()}
                    {/* Vincular a cliente da base */}
                    <button onClick={abrirVincCliente} title="Vincular a um cliente da base" className="text-gray-500 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5">👤</button>
                    {/* Agendar reunião */}
                    <button onClick={() => setShowReuniao(true)} title="Agendar reunião" className="text-gray-500 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5">📅</button>
                    <button onClick={() => { setMenuEtiqueta(v => !v); setMenuTransferir(false); setMenuPrioridade(false); }} title="Etiquetar" className="text-gray-500 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5">🏷️</button>
                    {/* Transferir (só gestora) */}
                    {podeTransferir && (
                      <button onClick={() => { abrirTransferir(); setMenuEtiqueta(false); }} title="Transferir vendedor" className="text-gray-500 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5">↗️</button>
                    )}
                    {/* Desvincular do funil (só se vinculado) */}
                    {ativa.lead_id && (
                      <button onClick={desvincularFunil} title="Desvincular do funil (não conta como lead)" className="text-gray-500 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5">🔗✖</button>
                    )}
                    {/* Excluir conversa */}
                    <button onClick={() => excluirConversa(ativa.id)} title="Excluir conversa" className="text-gray-500 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1.5">🗑️</button>
                    {/* Menu etiqueta */}
                    {menuEtiqueta && (
                      <div className="absolute right-3 top-14 ps-card rounded-lg shadow-lg border border-gray-200 z-20 p-2 w-52 max-h-80 overflow-y-auto">
                        <p className="text-[10px] font-semibold  px-1 mb-1 uppercase">Segmento (comercial)</p>
                        {ETIQUETAS.map(e => (
                          <button key={e.nome} onClick={() => aplicarEtiqueta(e.nome, e.cor)} className="w-full text-left px-2 py-1.5 rounded hover:opacity-80 flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full" style={{ background: e.cor }} />{e.nome}
                          </button>
                        ))}
                        <p className="text-[10px] font-semibold  px-1 mt-2 mb-1 uppercase">Tipo de atendimento</p>
                        <p className="text-[10px]  px-1 mb-1">Estes saem do funil (não viram lead)</p>
                        {ETIQUETAS_TIPO.map(e => (
                          <button key={e.nome} onClick={() => aplicarEtiqueta(e.nome, e.cor)} className="w-full text-left px-2 py-1.5 rounded hover:opacity-80 flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full" style={{ background: e.cor }} />{e.nome}
                          </button>
                        ))}
                        <button onClick={() => aplicarEtiqueta(null)} className="w-full text-left px-2 py-1.5 rounded hover:opacity-80 text-sm  mt-1 border-t border-gray-100">Remover etiqueta</button>
                      </div>
                    )}
                    {/* Menu prioridade */}
                    {menuPrioridade && (
                      <div className="absolute right-3 top-14 ps-card rounded-lg shadow-lg border border-gray-200 z-20 p-2 w-44">
                        {PRIORIDADES.map(p => (
                          <button key={p.valor} onClick={() => definirPrioridade(p.valor)} className="w-full text-left px-2 py-1.5 rounded hover:opacity-80 flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full" style={{ background: p.cor }} />{p.nome}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Menu transferir */}
                    {menuTransferir && (
                      <div className="absolute right-3 top-14 ps-card rounded-lg shadow-lg border border-gray-200 z-20 p-2 w-52 max-h-72 overflow-y-auto">
                        <p className="text-xs  px-1 mb-1">Transferir para</p>
                        {vendedores.length === 0 ? <p className="text-xs  px-2 py-2">Carregando…</p> :
                          vendedores.map(v => (
                            <button key={v.id} onClick={() => transferir(v.id)} className="w-full text-left px-2 py-1.5 rounded hover:opacity-80 text-sm">{v.nome}</button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5" style={{ background: '#F7F8FA' }}>
                    {mensagens.map(m => (
                      <div key={m.id} className={`flex ${m.direcao === 'SAIDA' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm shadow-sm border ${m.direcao === 'SAIDA' ? 'rounded-br-none text-white border-transparent' : 'bg-white text-gray-800 rounded-bl-none border-gray-100'}`}
                          style={m.direcao === 'SAIDA' ? { background: '#2563eb' } : {}}>
                          {m.enviada_por === 'bot' && <p className="text-[10px] font-semibold mb-0.5 opacity-80">🤖 Atendimento automático</p>}
                          {m.enviada_por === 'cadencia_automatica' && <p className="text-[10px] font-semibold mb-0.5 opacity-80">🔁 Cadência automática</p>}
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
                          <p className={`text-[10px] mt-0.5 text-right ${m.direcao === 'SAIDA' ? 'text-white/70' : 'text-gray-400'}`}>{fmtHora(m.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={fimRef} />
                  </div>
                  <div className="p-3 flex items-center gap-2" style={{ background: '#F7F8FA' }}>
                    {gravando ? (
                      <>
                        <div className="flex-1 flex items-center gap-2 ps-card rounded-full px-4 py-2.5 text-sm shadow-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-red-600 font-medium">Gravando… {String(Math.floor(gravTempo / 60)).padStart(2, '0')}:{String(gravTempo % 60).padStart(2, '0')}</span>
                        </div>
                        <button onClick={() => pararGravacao(true)} title="Cancelar"
                          className="text-gray-500 rounded-full w-11 h-11 flex items-center justify-center shadow-md text-lg ps-card hover:opacity-80">
                          🗑️
                        </button>
                        <button onClick={() => pararGravacao(false)} title="Enviar áudio"
                          className="text-white rounded-full w-11 h-11 flex items-center justify-center shadow-md text-lg" style={{ background: '#2563eb' }}>
                          ➤
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          value={texto}
                          onChange={e => setTexto(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                          placeholder="Escreva uma mensagem…"
                          className="flex-1 ps-card rounded-full px-4 py-2.5 text-sm focus:outline-none shadow-sm"
                        />
                        {texto.trim() ? (
                          <button onClick={enviar} disabled={enviando}
                            className="disabled:opacity-50 text-white rounded-full w-11 h-11 flex items-center justify-center shadow-md text-lg" style={{ background: '#2563eb' }}>
                            ➤
                          </button>
                        ) : (
                          <button onClick={iniciarGravacao} title="Gravar áudio"
                            className="text-white rounded-full w-11 h-11 flex items-center justify-center shadow-md text-lg" style={{ background: '#2563eb' }}>
                            🎤
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Painel lateral — resumo comercial da conversa ativa */}
            {ativa && (
              <div className="hidden md:flex md:flex-col bg-white border-l border-gray-200 min-h-0 overflow-y-auto">
                <div className="px-4 py-3.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{painel?.cliente ? (painel.cliente.razao_social || painel.cliente.nome_fantasia || painel.cliente.nome) : 'Atendimento'}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {(() => {
                      const prio = PRIORIDADES.find(p => p.valor === (ativa.prioridade || 'NORMAL'));
                      return prio && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: prio.cor }}>{prio.nome}</span>
                      );
                    })()}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: '#eef2ff', color: '#4338ca' }}>
                      {ESTAGIOS_FUNIL.find(e => e.valor === ativa.estagio_funil)?.nome || 'Novo Contato'}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3.5 border-b border-gray-100">
                  {(() => {
                    const sla = fmtSla(ativa.sla_prazo_em);
                    return (
                      <>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">SLA</p>
                        {sla ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${sla.violado ? 'text-white' : ''}`}
                            style={sla.violado ? { background: '#dc2626' } : { background: '#f1f5f9', color: '#334155' }}>
                            {sla.violado ? '⏰ ' : '🕐 '}{sla.texto}
                          </span>
                        ) : <p className="text-xs text-gray-400">Sem SLA em contagem</p>}
                        {ativa.sla_prazo_em && (
                          <p className="text-[11px] text-gray-400 mt-1">Prazo: {new Date(ativa.sla_prazo_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="px-4 py-3.5 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase">Contato</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-0.5">Nome</p>
                  <p className="text-sm font-medium text-gray-800 mb-2">{nomeContato(ativa)}</p>
                  <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                  <p className="text-sm font-medium text-gray-800">{ativa.contato_numero}</p>
                </div>

                {painel?.cliente && (
                  <div className="px-4 py-3.5 border-b border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Cliente</p>
                    <p className="text-sm font-medium text-gray-800">
                      {painel.cliente.codigo ? `#${painel.cliente.codigo} · ` : ''}
                      {painel.cliente.razao_social || painel.cliente.nome_fantasia || painel.cliente.nome}
                    </p>
                    <div className="text-xs text-gray-500 mt-1.5 space-y-1">
                      {painel.cliente.plano && <p>Plano: <span className="font-medium text-gray-700">{painel.cliente.plano}</span></p>}
                      {painel.cliente.mensalidade_base != null && <p>Mensalidade: <span className="font-medium text-gray-700">{fmtMoeda(painel.cliente.mensalidade_base)}</span></p>}
                      <p>Cliente há: <span className="font-medium text-gray-700">{tempoDeCasa(painel.cliente.data_entrada)}</span></p>
                      {painel.cliente.situacao && (
                        <p>Situação: <span className={`font-medium ${painel.cliente.situacao === 'ATIVA' ? 'text-green-600' : 'text-red-600'}`}>{painel.cliente.situacao === 'ATIVA' ? 'Ativa' : 'Inativa'}</span></p>
                      )}
                    </div>
                  </div>
                )}

                {painel?.proposta && (
                  <div className="px-4 py-3.5 border-b border-gray-100">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                      <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Proposta em aberto</p>
                      <p className="text-sm font-medium text-amber-900">{painel.proposta.titulo_proposta || 'Proposta comercial'}</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {painel.proposta.valor_final != null ? fmtMoeda(painel.proposta.valor_final) : ''} · {painel.proposta.status}
                      </p>
                      {painel.proposta.validade && <p className="text-[11px] text-amber-600 mt-0.5">Validade: {fmtDataCurta(painel.proposta.validade)}</p>}
                    </div>
                  </div>
                )}

                <div className="px-4 py-3.5 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Responsável</p>
                  <p className="text-sm font-medium text-gray-800">{painel?.responsavel?.nome || '—'}</p>
                </div>

                <div className="px-4 py-3.5">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Mover no funil</label>
                  <select value={ativa.estagio_funil || 'NOVO_CONTATO'} onChange={e => moverEstagio(ativa.id, e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2">
                    {ESTAGIOS_FUNIL.map(e => <option key={e.valor} value={e.valor}>{e.nome}</option>)}
                  </select>
                </div>

                <div className="mt-auto px-4 py-3.5 border-t border-gray-100 grid grid-cols-2 gap-2">
                  {podeTransferir && (
                    <button onClick={() => { abrirTransferir(); setMenuEtiqueta(false); setMenuPrioridade(false); }}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50">
                      ↗️ Transferir
                    </button>
                  )}
                  <button onClick={abrirVincCliente}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50">
                    👤 Identificar
                  </button>
                  <button onClick={() => excluirConversa(ativa.id)}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50">
                    🗑️ Excluir
                  </button>
                  <button onClick={() => moverEstagio(ativa.id, 'FECHADO')}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg py-2" style={{ background: '#16a34a' }}>
                    ✓ Finalizar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Kanban comercial — colunas: etapas do funil de atendimento */}
        {configurado && status === 'CONECTADO' && viewMode === 'kanban' && (
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 h-full pb-2" style={{ minWidth: 'min-content' }}>
              {ESTAGIOS_FUNIL.map(col => {
                const cards = conversasFiltradas.filter(c => (c.estagio_funil || 'NOVO_CONTATO') === col.valor);
                return (
                  <div key={col.valor}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (dragConvId) { moverEstagio(dragConvId, col.valor); setDragConvId(null); } }}
                    className="flex flex-col bg-opacity-0 rounded-xl border border-gray-200 flex-shrink-0 w-72 min-h-0">
                    <div className="px-3 py-2.5 flex items-center gap-2 border-b border-gray-200 rounded-t-xl" style={{ background: `${col.cor}15` }}>
                      <span className="w-3 h-3 rounded-full" style={{ background: col.cor }} />
                      <span className="font-semibold text-sm ">{col.nome}</span>
                      <span className="ml-auto text-xs ">{cards.length}</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
                      {cards.length === 0 && <p className="text-center  text-xs py-6">—</p>}
                      {cards.map(c => {
                        const sla = fmtSla(c.sla_prazo_em);
                        const prio = PRIORIDADES.find(p => p.valor === (c.prioridade || 'NORMAL'));
                        return (
                          <div key={c.id}
                            draggable onDragStart={() => setDragConvId(c.id)} onDragEnd={() => setDragConvId(null)}
                            onClick={() => { setViewMode('inbox'); abrir(c); }}
                            className="ps-card rounded-lg border border-gray-200 p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              {prio && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: prio.cor }}>{prio.nome}</span>
                              )}
                              {sla && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sla.violado ? 'text-white' : ''}`}
                                  style={sla.violado ? { background: '#dc2626' } : { background: '#f1f5f9', color: '#475569' }}>
                                  {sla.violado ? '⏰ ' : ''}{sla.texto}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: corAvatar(nomeContato(c)) }}>
                                {nomeContato(c).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-sm font-semibold truncate">{nomeContato(c)}</p>
                                <p className="text-xs  truncate">{c.ultima_mensagem || '—'}</p>
                              </div>
                              {c.nao_lidas > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center flex-shrink-0">{c.nao_lidas}</span>}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap mt-1">
                              {c.lead_id && <span className="inline-block text-[10px] text-blue-600">🔗 funil</span>}
                              {(c as any).cliente_id && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: '#16a34a' }}
                                  title="Cliente da base vinculado">
                                  👤 {(c as any).cliente_codigo ? `${(c as any).cliente_codigo} · ` : ''}{(c as any).cliente_razao || 'Cliente'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal agendar reunião */}
      {/* Modal: vincular conversa a um cliente da base */}
      {showVincCliente && ativa && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="ps-card rounded-xl p-5 w-full max-w-md">
            <h3 className="text-lg font-bold text-sm font-semibold mb-1">👤 Vincular a um cliente</h3>
            <p className="text-sm  mb-4">
              Este contato ({ativa.contato_numero}) será registrado na ficha do cliente com nome, telefone e cargo.
            </p>

            {/* Busca / seleção do cliente */}
            {vincSel ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-emerald-300 bg-emerald-50 rounded-lg mb-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm font-semibold truncate">{vincSel.nome_fantasia || vincSel.razao_social || vincSel.nome}</div>
                  <div className="text-xs  truncate">{vincSel.codigo ? `#${vincSel.codigo}` : ''}{vincSel.cidade ? ` · ${vincSel.cidade}` : ''}</div>
                </div>
                <button type="button" onClick={() => setVincSel(null)} className="text-sm text-emerald-700 shrink-0">Trocar</button>
              </div>
            ) : (
              <div className="relative mb-3">
                <input value={vincBusca} onChange={e => setVincBusca(e.target.value)} autoComplete="off"
                  placeholder="Buscar cliente por código, razão, fantasia, CNPJ…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" />
                {vincBusca.trim().length >= 2 && vincResultados.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 ps-card border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                    {vincResultados.map(c => (
                      <button key={c.id} type="button" onClick={() => setVincSel(c)}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-gray-100 last:border-0">
                        <div className="text-sm font-medium text-sm font-semibold truncate">{c.nome_fantasia || c.razao_social || c.nome}</div>
                        <div className="text-xs  truncate">{c.codigo ? `#${c.codigo}` : ''}{c.cidade ? ` · ${c.cidade}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="block text-xs font-medium  mb-1">Nome do contato</label>
            <input value={vincNome} onChange={e => setVincNome(e.target.value)}
              placeholder="Nome de quem fala no WhatsApp" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3" />
            <label className="block text-xs font-medium  mb-1">Cargo</label>
            <input value={vincCargo} onChange={e => setVincCargo(e.target.value)}
              placeholder="Ex.: Proprietário, Gerente, Financeiro, Comprador" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4" />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowVincCliente(false)} className="px-4 py-2 text-sm ">Cancelar</button>
              <button onClick={salvarVincCliente} disabled={vincSalvando || !vincSel}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: '#2563eb' }}>
                {vincSalvando ? 'Vinculando…' : 'Vincular e salvar contato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReuniao && ativa && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="ps-card rounded-xl p-5 w-full max-w-md">
            <h3 className="text-lg font-bold text-sm font-semibold mb-1">📅 Agendar reunião</h3>
            <p className="text-sm  mb-4">Com {ativa.contato_nome || ativa.contato_numero}. A confirmação vai pelo WhatsApp.</p>
            <label className="block text-xs font-medium  mb-1">Título</label>
            <input value={reuniao.titulo} onChange={e => setReuniao(r => ({ ...r, titulo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium  mb-1">Data e hora *</label>
                <input type="datetime-local" value={reuniao.data} onChange={e => setReuniao(r => ({ ...r, data: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium  mb-1">Duração (min)</label>
                <input type="number" value={reuniao.duracao_minutos} onChange={e => setReuniao(r => ({ ...r, duracao_minutos: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <label className="block text-xs font-medium  mb-1">Link da reunião (opcional)</label>
            <input value={reuniao.link} onChange={e => setReuniao(r => ({ ...r, link: e.target.value }))}
              placeholder="https://meet.google.com/… (cole o link, se houver)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReuniao(false)} className="px-4 py-2 text-sm ">Cancelar</button>
              <button onClick={agendarReuniao} disabled={salvandoReuniao} className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: '#2563eb' }}>
                {salvandoReuniao ? 'Agendando…' : 'Agendar e enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
