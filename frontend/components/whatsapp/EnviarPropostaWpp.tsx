'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

// Painel da conversa: envia uma proposta aberta deste contato pelo WhatsApp, com
// os botões Aceitar / Tenho dúvidas e o follow-up automático (dias 2, 5 e 7).

type Prop = {
  id: string; nome: string; status: string; plano: string | null; valor: number | null; tem_link: boolean; enviada_wpp_em: string | null;
  desconto_pct: number; desconto_precisa: boolean; desconto_status: string | null; desconto_limite: number | null;
};
const STATUS: Record<string, string> = { RASCUNHO: 'rascunho', ENVIADA: 'enviada', VISUALIZADA: 'visualizada', EM_NEGOCIACAO: 'em negociação' };
const brl = (n: number | null) => n == null ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

type ConversaProp = { lead_id?: string | null; contato_nome?: string | null; contato_numero: string; bot_dados?: any };

// Dados para a tela de proposta (mesmo caminho do "Gerar proposta" do lead): lead
// vinculado + empresa da Receita consultada na conversa + contato do WhatsApp.
async function dadosParaProposta(c: ConversaProp) {
  const lead: any = c.lead_id ? await apiClient.getLeadById(c.lead_id).then(r => r.data?.data || r.data).catch(() => null) : null;
  const d: any = c.bot_dados || {};
  const r: any = d.receita || {};
  const tel = (c.contato_numero || '').replace(/^55/, '');
  return {
    razao_social: lead?.razao_social || r.razao_social || '',
    nome_fantasia: lead?.nome_fantasia || r.nome_fantasia || lead?.empresa || '',
    cnpj: lead?.cnpj || d.cnpj || '',
    segmento: lead?.segmento || d.segmento || '',
    cidade: lead?.cidade || r.municipio || d.cidade || '',
    estado: lead?.estado || r.uf || '',
    sistema_atual: lead?.sistema_atual || '',
    responsavel_nome: lead?.responsavel_nome || c.contato_nome || '',
    responsavel_telefone: lead?.responsavel_telefone || tel,
    responsavel_email: lead?.responsavel_email || lead?.email || '',
    campanha: lead?.campanha_nome || lead?.utm_campaign || '',
    origem: lead?.origem || 'WHATSAPP',
    observacoes: lead?.observacoes_comerciais || '',
    status: 'RASCUNHO',
  };
}

export default function EnviarPropostaWpp({ conversaId, conversa }: { conversaId: string; conversa?: ConversaProp }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Prop[] | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const abrir = async () => {
    setAberto(a => !a); setAviso(null);
    if (aberto) return;
    setLista(null);
    try { setLista((await apiClient.getPropostasConversa(conversaId)).data.data); }
    catch { setLista([]); setAviso({ ok: false, texto: 'Não foi possível buscar as propostas.' }); }
  };

  const pedirAprovacao = async (p: Prop) => {
    setEnviando(p.id); setAviso(null);
    try {
      const r = await apiClient.pedirAprovacaoDesconto(p.id);
      setAviso({ ok: true, texto: r.data.message });
      setLista(l => l && l.map(x => x.id === p.id ? { ...x, desconto_status: 'PENDENTE' } : x));
    } catch (e: any) {
      setAviso({ ok: false, texto: e?.response?.data?.message || 'Não foi possível pedir a aprovação.' });
    } finally { setEnviando(null); }
  };

  const enviar = async (p: Prop) => {
    setEnviando(p.id); setAviso(null);
    try {
      await apiClient.enviarPropostaWhatsapp(conversaId, p.id);
      setAviso({ ok: true, texto: 'Proposta enviada. O follow-up dos dias 2, 5 e 7 já está programado.' });
      setAberto(false);
    } catch (e: any) {
      setAviso({ ok: false, texto: e?.response?.data?.message || 'Não foi possível enviar.' });
    } finally { setEnviando(null); }
  };

  // Criar proposta: abre a tela de proposta em outra aba já preenchida com os dados deste contato.
  // Os dados são buscados antes do clique: a aba nova abre na hora (o navegador não bloqueia).
  const [preenchimento, setPreenchimento] = useState<any>(null);
  useEffect(() => {
    if (!conversa) return;
    let vivo = true;
    dadosParaProposta(conversa).then(d => { if (vivo) setPreenchimento(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [conversa?.lead_id, conversa?.contato_numero]); // eslint-disable-line react-hooks/exhaustive-deps
  const criar = () => {
    if (!conversa) return;
    try { sessionStorage.setItem('prefill_proposta', JSON.stringify(preenchimento || { responsavel_nome: conversa.contato_nome || '', responsavel_telefone: conversa.contato_numero.replace(/^55/, ''), status: 'RASCUNHO' })); } catch { /* segue sem preencher */ }
    window.open('/propostas-comerciais', '_blank');
    setAviso({ ok: true, texto: 'A proposta abriu em outra aba, já preenchida. Depois de salvar e gerar o link, volte aqui e clique em Enviar.' });
  };

  return (
    <div className="px-4 py-3.5 border-b border-gray-100">
      <div className="flex gap-2">
        {conversa && (
          <button onClick={criar}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 border border-teal-700 text-teal-800 hover:bg-teal-50">
            ➕ Criar proposta
          </button>
        )}
        <button onClick={abrir}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg py-2" style={{ background: '#0f766e' }}>
          📄 Enviar / reenviar
        </button>
      </div>
      {aberto && (
        <div className="mt-2 space-y-1.5">
          {lista === null && <p className="text-xs text-gray-400">Buscando propostas deste contato…</p>}
          {lista?.length === 0 && (
            <p className="text-xs text-gray-500">Nenhuma proposta aberta com o CNPJ ou o telefone deste contato. Clique em ➕ Criar proposta.</p>
          )}
          {lista?.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-lg p-2">
              <p className="text-xs font-semibold text-gray-800">{p.nome}</p>
              <p className="text-[11px] text-gray-500">
                {[p.plano, brl(p.valor), STATUS[p.status] || p.status].filter(Boolean).join(' · ')}
                {p.enviada_wpp_em ? ' · já enviada pelo WhatsApp' : ''}
              </p>
              {p.desconto_precisa && (
                <p className="text-[11px] mt-1 text-amber-700">
                  Desconto de {p.desconto_pct.toLocaleString('pt-BR')}% passa do limite de {p.desconto_limite}%.
                  {p.desconto_status === 'PENDENTE' ? ' Aguardando aprovação da gestão.' : p.desconto_status === 'RECUSADO' ? ' A gestão recusou: ajuste o desconto ou peça de novo.' : ''}
                </p>
              )}
              {p.desconto_precisa && p.desconto_status !== 'PENDENTE' && (
                <button disabled={enviando === p.id} onClick={() => pedirAprovacao(p)}
                  className="mt-1.5 w-full text-[11px] font-semibold rounded-md py-1.5 border border-amber-600 text-amber-800 hover:bg-amber-50 disabled:opacity-40">
                  💸 Pedir aprovação do desconto
                </button>
              )}
              <button disabled={!p.tem_link || enviando === p.id || p.desconto_precisa} onClick={() => enviar(p)}
                title={p.tem_link ? '' : 'Gere o link público da proposta antes de enviar'}
                className="mt-1.5 w-full text-[11px] font-semibold rounded-md py-1.5 border border-teal-700 text-teal-800 hover:bg-teal-50 disabled:opacity-40">
                {enviando === p.id ? 'Enviando…' : p.enviada_wpp_em ? 'Reenviar' : 'Enviar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {aviso && <p className={`text-[11px] mt-1.5 ${aviso.ok ? 'text-green-700' : 'text-red-600'}`}>{aviso.texto}</p>}
    </div>
  );
}
