'use client';

import { useState } from 'react';
import Shell from '@/components/Shell';

const VARIAVEIS = [
  '{{nome_cliente}}','{{nome_agente}}','{{numero_chamado}}','{{problema}}',
  '{{prazo}}','{{acao_realizada}}','{{proxima_acao}}','{{solucao_paliativa}}',
  '{{funcionalidade}}','{{caminho_no_sistema}}','{{informacao_1}}','{{informacao_2}}',
];

const TEMPLATES = [
  {
    id:'FC-01', cat:'primeiro-contato', catLabel:'Primeiro Contato', severity:'baixa',
    titulo:'Abertura — Confirmação de Recebimento',
    cenario:'Cliente abriu chamado; confirmando que foi recebido e quem está atendendo',
    canais:{
      whatsapp:`Oi {{nome_cliente}}! 👋 Aqui é {{nome_agente}} da ProSystem.\n\nRecebi seu chamado #{{numero_chamado}} sobre {{problema}}. Já estou analisando aqui!\n\nAssim que tiver novidade eu te retorno — normalmente em até 2 horas. 🙏`,
      email:`Olá, {{nome_cliente}},\n\nConfirmamos o recebimento do seu chamado #{{numero_chamado}}.\n\n**Assunto:** {{problema}}\n**Responsável:** {{nome_agente}}\n**Previsão de retorno:** {{prazo}}\n\nAbraços,\n{{nome_agente}}\nEquipe de Suporte ProSystem`,
    },
  },
  {
    id:'FC-02', cat:'primeiro-contato', catLabel:'Primeiro Contato', severity:'alta',
    titulo:'Abertura — Problema Crítico (Operação Parada)',
    cenario:'Cliente com operação completamente parada',
    canais:{
      whatsapp:`{{nome_cliente}}, recebi seu chamado — prioridade máxima! 🚨\n\nJá estou olhando para {{problema}} agora mesmo. Me conta: aconteceu depois de alguma atualização ou do nada?`,
      telefone:`"Olá, {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem. Recebi seu chamado — já estou com o sistema aberto. Me conta o que está acontecendo exatamente?"`,
    },
  },
  {
    id:'FC-03', cat:'primeiro-contato', catLabel:'Primeiro Contato', severity:'media',
    titulo:'Fora do Horário / Retorno Programado',
    cenario:'Chamado fora do horário de suporte',
    canais:{
      whatsapp:`Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem.\n\nVi seu chamado sobre {{problema}} — recebi, mas estou fora do horário agora.\n\nRetorno até {{prazo}}. 🙏`,
    },
  },
  {
    id:'FC-04', cat:'primeiro-contato', catLabel:'Primeiro Contato', severity:'media',
    titulo:'Triagem — Pedindo Mais Detalhes',
    cenario:'Descrição insuficiente para iniciar diagnóstico',
    canais:{
      whatsapp:`Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem. 👋\n\nPode me ajudar com mais alguns detalhes?\n\n1. Qual módulo você estava usando?\n2. Apareceu alguma mensagem de erro?\n3. Aconteceu depois de alguma atualização ou do nada?\n\nCom isso já consigo te ajudar muito mais rápido! 🙏`,
    },
  },
  {
    id:'INV-01', cat:'investigacao', catLabel:'Investigação', severity:'media',
    titulo:'Atualização — Ainda Investigando',
    cenario:'Problema complexo; técnico ainda analisando',
    canais:{
      whatsapp:`Oi {{nome_cliente}}, atualização sobre o chamado #{{numero_chamado}}:\n\nJá identifiquei onde está o problema com {{problema}}, mas ainda estou corrigindo.\n\nVolto com novidade até {{prazo}}!`,
      email:`Olá, {{nome_cliente}},\n\nAtualização sobre o chamado #{{numero_chamado}} — {{problema}}:\n\n**O que já fiz:**\n- {{acao_realizada}}\n\n**Próximo passo:**\n{{proxima_acao}} — previsão: {{prazo}}\n\nAbraços,\n{{nome_agente}}`,
    },
  },
  {
    id:'INV-02', cat:'investigacao', catLabel:'Investigação', severity:'media',
    titulo:'Solicitação de Informação Adicional',
    cenario:'Precisa de mais dados do cliente para investigar',
    canais:{
      whatsapp:`{{nome_cliente}}, para resolver o problema com {{problema}} preciso de mais informações:\n\n1. {{informacao_1}}\n2. {{informacao_2}}\n\nPode me mandar um print? Vai agilizar muito! 📱`,
    },
  },
  {
    id:'RES-01', cat:'resolucao', catLabel:'Resolução', severity:'baixa',
    titulo:'Solução Encontrada e Aplicada',
    cenario:'Técnico resolveu o problema',
    canais:{
      whatsapp:`Boa notícia, {{nome_cliente}}! 🎉\n\nResolvi o problema com {{problema}}. O que eu fiz:\n{{acao_realizada}}\n\nPode testar aí? Se funcionar, posso encerrar o chamado #{{numero_chamado}}.`,
      email:`Olá, {{nome_cliente}},\n\nO chamado #{{numero_chamado}} sobre {{problema}} foi resolvido.\n\n**Solução aplicada:**\n{{acao_realizada}}\n\nPor favor, confirme se está tudo certo.\n\nAbraços,\n{{nome_agente}}`,
    },
  },
  {
    id:'ESC-01', cat:'escalacao', catLabel:'Escalação', severity:'alta',
    titulo:'Escalonamento para Técnico Especialista',
    cenario:'Problema requer especialista de nível 2',
    canais:{
      whatsapp:`{{nome_cliente}}, o problema com {{problema}} é mais específico — preciso chamar nosso técnico especialista.\n\nJá passei todo o histórico pra ele, não precisará explicar de novo.\n\nEle entra em contato em até {{prazo}}. Chamado: #{{numero_chamado}}.`,
      email:`Olá, {{nome_cliente}},\n\nO chamado #{{numero_chamado}} requer nosso time especializado.\n\n- Previsão de contato: {{prazo}}\n- Você não precisará repetir as informações\n\nAbraços,\n{{nome_agente}}`,
    },
  },
];

const CATS = [
  { value:'all', label:'Todos' },
  { value:'primeiro-contato', label:'Primeiro Contato' },
  { value:'investigacao', label:'Investigação' },
  { value:'resolucao', label:'Resolução' },
  { value:'escalacao', label:'Escalação' },
];

const SEV_COLOR: Record<string,string> = { baixa:'#16a34a', media:'#d97706', alta:'#dc2626' };

export default function TemplatesPage() {
  const [cat, setCat] = useState('all');
  const [canal, setCanal] = useState<Record<string,string>>({});
  const [copiadoId, setCopiadoId] = useState<string|null>(null);

  const filtrados = cat === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.cat === cat);
  const canalDo = (t: typeof TEMPLATES[0]) => canal[t.id] || Object.keys(t.canais)[0];

  const copiar = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  return (
    <Shell>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Templates de Atendimento</h2>
        <p className="text-sm text-slate-500">Mensagens prontas para WhatsApp, e-mail e telefone.</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
        <p className="text-xs font-semibold text-blue-700 mb-2">Clique para copiar a variável:</p>
        <div className="flex flex-wrap gap-1.5">
          {VARIAVEIS.map(v => (
            <button key={v} onClick={() => navigator.clipboard.writeText(v)}
              className="text-[10px] font-mono bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {CATS.map(c => (
          <button key={c.value} onClick={() => setCat(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${cat === c.value ? 'text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            style={cat === c.value ? { background:'#2E6EAB' } : {}}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {filtrados.map(t => {
          const canalAtivo = canalDo(t) as keyof typeof t.canais;
          const texto = t.canais[canalAtivo] || '';
          const copiado = copiadoId === t.id;
          return (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-bold text-slate-400 font-mono">{t.id}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: SEV_COLOR[t.severity] || '#64748b' }}>{t.catLabel}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">{t.titulo}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t.cenario}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {Object.keys(t.canais).map(c => (
                    <button key={c} onClick={() => setCanal(prev => ({ ...prev, [t.id]: c }))}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-md capitalize transition-colors ${canalAtivo === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {c === 'whatsapp' ? '📱' : c === 'email' ? '📧' : '📞'} {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-4 py-3">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 rounded-lg p-3 border border-slate-100">{texto}</pre>
                <div className="mt-2 flex justify-end">
                  <button onClick={() => copiar(t.id, texto)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${copiado ? 'bg-green-500 text-white' : 'text-white'}`}
                    style={copiado ? {} : { background:'#2E6EAB' }}>
                    {copiado ? '✓ Copiado!' : 'Copiar mensagem'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
