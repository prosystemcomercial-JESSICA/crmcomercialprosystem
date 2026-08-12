'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Loader2, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { PERFIL_LABEL } from './page';

interface CandidatoCompleto {
  id: string;
  nome: string;
  empresa?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf_responsavel?: string | null;
  telefone: string;
  email: string;
  cidade?: string | null;
  estado?: string | null;
  perfil_desejado: string;
  status: string;
  observacoes_internas?: string | null;
  respostas_detalhadas: any;
  created_at: string;
}

const SIM_NAO = (v: any) => v === true ? 'Sim' : v === false ? 'Não' : '—';
const LISTA = (v: any) => Array.isArray(v) && v.length ? v.join(', ') : '—';
const TXT = (v: any) => v || '—';

function Secao({ titulo, aberto, onToggle, children }: { titulo: string; aberto: boolean; onToggle: () => void; children: React.ReactNode }) {
  // O conteúdo fica SEMPRE no DOM (não condicional) — na tela normal o CSS
  // esconde via display:none quando fechado; na impressão, @media print força
  // display:block em tudo. Isso evita depender de qualquer timing de re-render
  // do React antes de window.print() ser chamado (que é síncrono e bloqueante,
  // então não há garantia de quando o browser pinta um setState anterior).
  return (
    <div className="secao-detalhe" style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        className="secao-detalhe-header no-print-controls"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--t-content-bg)', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)' }}>{titulo}</span>
        {aberto ? <ChevronUp size={16} color="var(--t-text-secondary)" /> : <ChevronDown size={16} color="var(--t-text-secondary)" />}
      </button>
      <p className="secao-detalhe-titulo-print">{titulo}</p>
      <div
        className="secao-detalhe-conteudo"
        style={{ display: aberto ? 'grid' : 'none', padding: '12px 14px', gap: 6, fontSize: 13, color: 'var(--t-text-secondary)' }}
      >
        {children}
      </div>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return <p><strong style={{ color: 'var(--t-text-primary)' }}>{label}:</strong> {valor}</p>;
}

export default function DetalheCandidato({ candidatoId, onClose, onStatusChange }: { candidatoId: string; onClose: () => void; onStatusChange: (novoStatus: string) => void }) {
  const [candidato, setCandidato] = useState<CandidatoCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [obsRascunho, setObsRascunho] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [secaoAberta, setSecaoAberta] = useState<string | null>('estrutura_empresa');

  function imprimir() {
    window.print();
  }

  useEffect(() => {
    setLoading(true);
    apiClient.client.get(`/candidatos-representante/${candidatoId}`).then(res => {
      const c = res.data.data as CandidatoCompleto;
      setCandidato(c);
      setObsRascunho(c.observacoes_internas || '');
    }).finally(() => setLoading(false));
  }, [candidatoId]);

  async function salvarObservacoes() {
    if (!candidato) return;
    setSalvando(true);
    try {
      await apiClient.client.patch(`/candidatos-representante/${candidato.id}`, { observacoes_internas: obsRascunho });
    } finally {
      setSalvando(false);
    }
  }

  function toggleSecao(chave: string) {
    setSecaoAberta(prev => prev === chave ? null : chave);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,34,56,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="modal-detalhe-candidato" style={{ background: 'var(--t-card-bg)', borderRadius: 16, padding: 24, width: 600, maxWidth: '92vw', maxHeight: '86vh', overflowY: 'auto' }}>
        {loading || !candidato ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} className="animate-spin" color="var(--t-primary)" />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>{candidato.nome}</h2>
                {candidato.empresa && <p style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{candidato.empresa}</p>}
              </div>
              <div className="no-print-controls" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={imprimir}
                  title="Imprimir / Salvar como PDF"
                  style={{ background: 'none', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t-text-secondary)' }}
                >
                  <Printer size={15} /> Imprimir / PDF
                </button>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={18} color="var(--t-text-secondary)" />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 4, marginBottom: 16, fontSize: 13, color: 'var(--t-text-secondary)' }}>
              <Linha label="Perfil desejado" valor={PERFIL_LABEL[candidato.perfil_desejado] || candidato.perfil_desejado} />
              <Linha label="Nome fantasia" valor={TXT(candidato.nome_fantasia)} />
              <Linha label="CNPJ" valor={TXT(candidato.cnpj)} />
              <Linha label="CPF responsável" valor={TXT(candidato.cpf_responsavel)} />
              <Linha label="Telefone" valor={candidato.telefone} />
              <Linha label="E-mail" valor={candidato.email} />
              <Linha label="Cidade/UF sede" valor={[candidato.cidade, candidato.estado].filter(Boolean).join('/') || '—'} />
            </div>

            {(() => {
              const r = candidato.respostas_detalhadas || {};
              const ee = r.estrutura_empresa || {};
              const ec = r.estrutura_comercial || {};
              const ii = r.instalacao_implantacao || {};
              const sp = r.suporte || {};
              const ra = r.regiao_atuacao || {};
              const em = r.experiencia_mercado || {};
              const ma = r.marcas_atuais || {};
              const ce = r.capacidade_expansao || {};

              return (
                <>
                  <Secao titulo="Estrutura da empresa" aberto={secaoAberta === 'estrutura_empresa'} onToggle={() => toggleSecao('estrutura_empresa')}>
                    <Linha label="Possui equipe" valor={SIM_NAO(ee.possui_equipe)} />
                    <Linha label="Qtd. pessoas" valor={TXT(ee.qtd_pessoas)} />
                    <Linha label="Comercial/Prospecção" valor={TXT(ee.funcoes?.comercial)} />
                    <Linha label="Vendas/Fechamento" valor={TXT(ee.funcoes?.vendas)} />
                    <Linha label="Implantação" valor={TXT(ee.funcoes?.implantacao)} />
                    <Linha label="Instalação" valor={TXT(ee.funcoes?.instalacao)} />
                    <Linha label="Suporte" valor={TXT(ee.funcoes?.suporte)} />
                    <Linha label="Treinamento" valor={TXT(ee.funcoes?.treinamento)} />
                    <Linha label="Administrativo" valor={TXT(ee.funcoes?.administrativo)} />
                    <Linha label="Outros" valor={TXT(ee.funcoes?.outros)} />
                    <Linha label="Dedicadas à Prosystem" valor={TXT(ee.qtd_dedicada_prosystem)} />
                    <Linha label="Equipe própria/terceirizada" valor={TXT(ee.equipe_propria_ou_terceirizada)} />
                  </Secao>

                  <Secao titulo="Estrutura comercial" aberto={secaoAberta === 'estrutura_comercial'} onToggle={() => toggleSecao('estrutura_comercial')}>
                    <Linha label="Responsável pelas vendas" valor={TXT(ec.responsavel_vendas)} />
                    <Linha label="Qtd. em prospecção/venda" valor={TXT(ec.qtd_prospeccao_venda)} />
                    <Linha label="Visita presencial" valor={SIM_NAO(ec.visita_presencial)} />
                    <Linha label="Prospecção ativa" valor={SIM_NAO(ec.prospeccao_ativa)} />
                    <Linha label="Canais" valor={LISTA(ec.canais)} />
                    <Linha label="Outros canais" valor={TXT(ec.canal_outros)} />
                  </Secao>

                  <Secao titulo="Instalação, implantação e treinamento" aberto={secaoAberta === 'instalacao_implantacao'} onToggle={() => toggleSecao('instalacao_implantacao')}>
                    <Linha label="Realiza instalação" valor={SIM_NAO(ii.realiza_instalacao)} />
                    <Linha label="Quem instala" valor={TXT(ii.quem_instala)} />
                    <Linha label="Qtd. instaladores" valor={TXT(ii.qtd_instaladores)} />
                    <Linha label="Experiência ERP/PDV" valor={SIM_NAO(ii.experiencia_erp_pdv)} />
                    <Linha label="Experiência config. equipamentos" valor={SIM_NAO(ii.experiencia_config_equipamentos)} />
                    <Linha label="Realiza implantação" valor={SIM_NAO(ii.realiza_implantacao)} />
                    <Linha label="Realiza treinamento" valor={SIM_NAO(ii.realiza_treinamento)} />
                    <Linha label="Qtd. treinadores" valor={TXT(ii.qtd_treinadores)} />
                  </Secao>

                  <Secao titulo="Suporte ao cliente" aberto={secaoAberta === 'suporte'} onToggle={() => toggleSecao('suporte')}>
                    <Linha label="Presta suporte" valor={SIM_NAO(sp.presta_suporte)} />
                    <Linha label="Tipos" valor={LISTA(sp.tipos)} />
                    <Linha label="Outros tipos" valor={TXT(sp.tipo_outros)} />
                    <Linha label="Responsável" valor={TXT(sp.responsavel)} />
                    <Linha label="Qtd. pessoas" valor={TXT(sp.qtd_pessoas)} />
                    <Linha label="Horário" valor={TXT(sp.horario)} />
                    <Linha label="Experiência anterior" valor={SIM_NAO(sp.experiencia_anterior)} />
                  </Secao>

                  <Secao titulo="Região de atuação" aberto={secaoAberta === 'regiao_atuacao'} onToggle={() => toggleSecao('regiao_atuacao')}>
                    <Linha label="Estados" valor={LISTA(ra.estados)} />
                    <Linha label="Região principal" valor={TXT(ra.regiao_principal)} />
                    <Linha label="Cidades" valor={Array.isArray(ra.cidades) && ra.cidades.length ? ra.cidades.map((c: any) => `${c.nome} (${c.tipo === 'PRESENCIAL' ? 'Presencial' : 'Remoto'})`).join(', ') : '—'} />
                    <Linha label="Atende todas presencialmente" valor={SIM_NAO(ra.atende_todas_presencial)} />
                    <Linha label="Veículo próprio" valor={SIM_NAO(ra.veiculo_proprio)} />
                    <Linha label="Distância máxima" valor={TXT(ra.distancia_maxima)} />
                  </Secao>

                  <Secao titulo="Experiência no mercado" aberto={secaoAberta === 'experiencia_mercado'} onToggle={() => toggleSecao('experiencia_mercado')}>
                    <Linha label="Tempo de atuação" valor={TXT(em.tempo_atuacao)} />
                    <Linha label="Trabalhou com software de gestão" valor={SIM_NAO(em.trabalhou_software_gestao)} />
                    <Linha label="Experiência ERP/PDV" valor={SIM_NAO(em.experiencia_erp_pdv)} />
                    <Linha label="Segmentos" valor={LISTA(em.segmentos)} />
                    <Linha label="Outros segmentos" valor={TXT(em.segmento_outros)} />
                    <Linha label="Possui carteira" valor={SIM_NAO(em.possui_carteira)} />
                    <Linha label="Qtd. aproximada de clientes" valor={TXT(em.qtd_clientes_aprox)} />
                  </Secao>

                  <Secao titulo="Marcas que representa atualmente" aberto={secaoAberta === 'marcas_atuais'} onToggle={() => toggleSecao('marcas_atuais')}>
                    <Linha label="Representa outras marcas" valor={SIM_NAO(ma.representa_outras)} />
                    <Linha label="Marcas" valor={Array.isArray(ma.marcas) && ma.marcas.length ? ma.marcas.map((m: any) => `${m.marca} — ${m.produto_servico} (${m.segmento})`).join('; ') : '—'} />
                    <Linha label="Tempo de representação" valor={TXT(ma.tempo_representacao)} />
                    <Linha label="Exclusividade" valor={TXT(ma.exclusividade)} />
                    <Linha label="Atua com" valor={LISTA(ma.atua_com)} />
                    <Linha label="Representa concorrente" valor={SIM_NAO(ma.representa_concorrente)} />
                    {ma.representa_concorrente && <Linha label="Qual concorrente" valor={TXT(ma.concorrente_qual)} />}
                    <Linha label="Tem impedimento" valor={SIM_NAO(ma.tem_impedimento)} />
                    {ma.tem_impedimento && <Linha label="Descrição do impedimento" valor={TXT(ma.impedimento_descricao)} />}
                  </Secao>

                  <Secao titulo="Capacidade de atendimento e expansão" aberto={secaoAberta === 'capacidade_expansao'} onToggle={() => toggleSecao('capacidade_expansao')}>
                    <Linha label="Prospectar/mês" valor={TXT(ce.prospectar_mes)} />
                    <Linha label="Fechar/mês" valor={TXT(ce.fechar_mes)} />
                    <Linha label="Implantar/mês" valor={TXT(ce.implantar_mes)} />
                    <Linha label="Acompanha prospecção→pós-venda" valor={SIM_NAO(ce.acompanha_prospeccao_pos_venda)} />
                    <Linha label="Etapas em que atua" valor={LISTA(ce.etapas_atua)} />
                  </Secao>

                  <Secao titulo="Apresentação da operação" aberto={secaoAberta === 'apresentacao_operacao'} onToggle={() => toggleSecao('apresentacao_operacao')}>
                    <p>{TXT(r.apresentacao_operacao)}</p>
                  </Secao>
                </>
              );
            })()}

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)', margin: '16px 0 6px' }}>Observações internas</label>
            <textarea
              value={obsRascunho}
              onChange={e => setObsRascunho(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--t-card-border)', fontSize: 13, marginBottom: 12, fontFamily: 'inherit' }}
            />
            <button
              onClick={salvarObservacoes}
              disabled={salvando}
              className="no-print-controls"
              style={{ background: 'var(--t-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? 'Salvando...' : 'Salvar observações'}
            </button>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          /* Some só o conteúdo da ficha na impressão — o resto da página do CRM
             (kanban, overlay escuro, sidebar) some, e os controles de interação
             (chevrons, botão fechar, botão salvar) também não fazem sentido no papel. */
          body * { visibility: hidden; }
          .modal-detalhe-candidato, .modal-detalhe-candidato * { visibility: visible; }
          .modal-detalhe-candidato {
            position: absolute; inset: 0; background: #fff !important;
            box-shadow: none !important; max-height: none !important; overflow: visible !important;
            width: 100% !important; max-width: 100% !important;
          }
          .no-print-controls { display: none !important; }
          .secao-detalhe-titulo-print { display: none; }
          .secao-detalhe-header { display: none !important; }
          .secao-detalhe {
            border: none !important; margin-bottom: 12px !important; page-break-inside: avoid;
          }
          .secao-detalhe .secao-detalhe-titulo-print {
            display: block !important; font-size: 13px; font-weight: 700; color: #0D2238;
            padding: 6px 0; border-bottom: 1px solid #ccc; margin-bottom: 6px;
          }
          /* Força todas as seções abertas na impressão, independente do estado
             de acordeão da tela — puro CSS, sem depender de nenhum timing de
             re-render do React antes de window.print() (que é síncrono e
             bloqueante, sem garantia de quando o browser pinta um setState). */
          .secao-detalhe-conteudo { display: grid !important; }
        }
      `}</style>
    </div>
  );
}
