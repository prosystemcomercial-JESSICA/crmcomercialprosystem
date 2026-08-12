'use client';

export interface FormState {
  // Passo 1 — campos-chave
  nome: string;
  empresa: string;
  nome_fantasia: string;
  cnpj: string;
  cpf_responsavel: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;

  // Passo 2 — estrutura da empresa
  possui_equipe: boolean | null;
  qtd_pessoas_equipe: string;
  funcao_comercial: string;
  funcao_vendas: string;
  funcao_implantacao: string;
  funcao_instalacao: string;
  funcao_suporte: string;
  funcao_treinamento: string;
  funcao_administrativo: string;
  funcao_outros: string;
  qtd_dedicada_prosystem: string;
  equipe_propria_ou_terceirizada: string;

  // Passo 3 — estrutura comercial
  responsavel_vendas: string;
  qtd_prospeccao_venda: string;
  visita_presencial: boolean | null;
  prospeccao_ativa: boolean | null;
  canais_prospeccao: string[];
  canal_prospeccao_outros: string;

  // Passo 4 — instalação/implantação/treinamento
  realiza_instalacao: boolean | null;
  quem_instala: string;
  qtd_instaladores: string;
  experiencia_erp_pdv_instalacao: boolean | null;
  experiencia_config_equipamentos: boolean | null;
  realiza_implantacao: boolean | null;
  realiza_treinamento: boolean | null;
  qtd_treinadores: string;

  // Passo 5 — suporte
  presta_suporte: boolean | null;
  tipos_suporte: string[];
  tipo_suporte_outros: string;
  suporte_responsavel: string;
  suporte_qtd_pessoas: string;
  suporte_horario: string;
  suporte_experiencia_anterior: boolean | null;

  // Passo 6 — região de atuação
  estados_atuacao: string;
  regiao_principal: string;
  cidades: { nome: string; tipo: 'PRESENCIAL' | 'REMOTO' }[];
  atende_todas_presencial: boolean | null;
  veiculo_proprio: boolean | null;
  distancia_maxima: string;

  // Passo 7 — experiência no mercado
  tempo_atuacao: string;
  trabalhou_software_gestao: boolean | null;
  experiencia_erp_pdv_mercado: boolean | null;
  segmentos_experiencia: string[];
  segmento_outros: string;
  possui_carteira: boolean | null;
  qtd_clientes_aprox: string;

  // Passo 8 — marcas atuais
  representa_outras_marcas: boolean | null;
  marcas: { marca: string; produto_servico: string; segmento: string }[];
  tempo_representacao_marcas: string;
  exclusividade: string;
  atua_com: string[];
  representa_concorrente: boolean | null;
  concorrente_qual: string;
  tem_impedimento: boolean | null;
  impedimento_descricao: string;

  // Passo 9 — capacidade e expansão
  prospectar_mes: string;
  fechar_mes: string;
  implantar_mes: string;
  acompanha_prospeccao_pos_venda: boolean | null;
  etapas_atua: string[];

  // Passo 10 — apresentação + perfil desejado
  apresentacao_operacao: string;
  perfil_desejado: string;
}

export const FORM_INICIAL: FormState = {
  nome: '', empresa: '', nome_fantasia: '', cnpj: '', cpf_responsavel: '', telefone: '', email: '', cidade: '', estado: '',
  possui_equipe: null, qtd_pessoas_equipe: '', funcao_comercial: '', funcao_vendas: '', funcao_implantacao: '',
  funcao_instalacao: '', funcao_suporte: '', funcao_treinamento: '', funcao_administrativo: '', funcao_outros: '',
  qtd_dedicada_prosystem: '', equipe_propria_ou_terceirizada: '',
  responsavel_vendas: '', qtd_prospeccao_venda: '', visita_presencial: null, prospeccao_ativa: null,
  canais_prospeccao: [], canal_prospeccao_outros: '',
  realiza_instalacao: null, quem_instala: '', qtd_instaladores: '', experiencia_erp_pdv_instalacao: null,
  experiencia_config_equipamentos: null, realiza_implantacao: null, realiza_treinamento: null, qtd_treinadores: '',
  presta_suporte: null, tipos_suporte: [], tipo_suporte_outros: '', suporte_responsavel: '', suporte_qtd_pessoas: '',
  suporte_horario: '', suporte_experiencia_anterior: null,
  estados_atuacao: '', regiao_principal: '', cidades: [], atende_todas_presencial: null, veiculo_proprio: null,
  distancia_maxima: '',
  tempo_atuacao: '', trabalhou_software_gestao: null, experiencia_erp_pdv_mercado: null, segmentos_experiencia: [],
  segmento_outros: '', possui_carteira: null, qtd_clientes_aprox: '',
  representa_outras_marcas: null, marcas: [], tempo_representacao_marcas: '', exclusividade: '', atua_com: [],
  representa_concorrente: null, concorrente_qual: '', tem_impedimento: null, impedimento_descricao: '',
  prospectar_mes: '', fechar_mes: '', implantar_mes: '', acompanha_prospeccao_pos_venda: null, etapas_atua: [],
  apresentacao_operacao: '', perfil_desejado: '',
};

/** Converte o FormState plano em payload no formato esperado pelo backend. */
export function paraPayload(f: FormState) {
  return {
    nome: f.nome,
    empresa: f.empresa || undefined,
    nome_fantasia: f.nome_fantasia || undefined,
    cnpj: f.cnpj || undefined,
    cpf_responsavel: f.cpf_responsavel || undefined,
    telefone: f.telefone,
    email: f.email,
    cidade: f.cidade || undefined,
    estado: f.estado || undefined,
    perfil_desejado: f.perfil_desejado,
    respostas_detalhadas: {
      estrutura_empresa: {
        possui_equipe: f.possui_equipe, qtd_pessoas: f.qtd_pessoas_equipe,
        funcoes: {
          comercial: f.funcao_comercial, vendas: f.funcao_vendas, implantacao: f.funcao_implantacao,
          instalacao: f.funcao_instalacao, suporte: f.funcao_suporte, treinamento: f.funcao_treinamento,
          administrativo: f.funcao_administrativo, outros: f.funcao_outros,
        },
        qtd_dedicada_prosystem: f.qtd_dedicada_prosystem, equipe_propria_ou_terceirizada: f.equipe_propria_ou_terceirizada,
      },
      estrutura_comercial: {
        responsavel_vendas: f.responsavel_vendas, qtd_prospeccao_venda: f.qtd_prospeccao_venda,
        visita_presencial: f.visita_presencial, prospeccao_ativa: f.prospeccao_ativa,
        canais: f.canais_prospeccao, canal_outros: f.canal_prospeccao_outros,
      },
      instalacao_implantacao: {
        realiza_instalacao: f.realiza_instalacao, quem_instala: f.quem_instala, qtd_instaladores: f.qtd_instaladores,
        experiencia_erp_pdv: f.experiencia_erp_pdv_instalacao, experiencia_config_equipamentos: f.experiencia_config_equipamentos,
        realiza_implantacao: f.realiza_implantacao, realiza_treinamento: f.realiza_treinamento, qtd_treinadores: f.qtd_treinadores,
      },
      suporte: {
        presta_suporte: f.presta_suporte, tipos: f.tipos_suporte, tipo_outros: f.tipo_suporte_outros,
        responsavel: f.suporte_responsavel, qtd_pessoas: f.suporte_qtd_pessoas, horario: f.suporte_horario,
        experiencia_anterior: f.suporte_experiencia_anterior,
      },
      regiao_atuacao: {
        estados: f.estados_atuacao.split(',').map(s => s.trim()).filter(Boolean), regiao_principal: f.regiao_principal,
        cidades: f.cidades, atende_todas_presencial: f.atende_todas_presencial, veiculo_proprio: f.veiculo_proprio,
        distancia_maxima: f.distancia_maxima,
      },
      experiencia_mercado: {
        tempo_atuacao: f.tempo_atuacao, trabalhou_software_gestao: f.trabalhou_software_gestao,
        experiencia_erp_pdv: f.experiencia_erp_pdv_mercado, segmentos: f.segmentos_experiencia,
        segmento_outros: f.segmento_outros, possui_carteira: f.possui_carteira, qtd_clientes_aprox: f.qtd_clientes_aprox,
      },
      marcas_atuais: {
        representa_outras: f.representa_outras_marcas, marcas: f.marcas,
        tempo_representacao: f.tempo_representacao_marcas, exclusividade: f.exclusividade, atua_com: f.atua_com,
        representa_concorrente: f.representa_concorrente, concorrente_qual: f.concorrente_qual,
        tem_impedimento: f.tem_impedimento, impedimento_descricao: f.impedimento_descricao,
      },
      capacidade_expansao: {
        prospectar_mes: f.prospectar_mes, fechar_mes: f.fechar_mes, implantar_mes: f.implantar_mes,
        acompanha_prospeccao_pos_venda: f.acompanha_prospeccao_pos_venda, etapas_atua: f.etapas_atua,
      },
      apresentacao_operacao: f.apresentacao_operacao,
    },
  };
}

// ─── Componentes de campo reutilizáveis ─────────────────────────────────────

export function Campo({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238' }}
      />
    </div>
  );
}

export function CampoTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238', fontFamily: 'inherit', resize: 'vertical' }}
      />
    </div>
  );
}

export function CampoSimNao({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D2238' }}>
          <input type="radio" checked={value === true} onChange={() => onChange(true)} /> Sim
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D2238' }}>
          <input type="radio" checked={value === false} onChange={() => onChange(false)} /> Não
        </label>
      </div>
    </div>
  );
}

export function CampoMultiSelect({ label, opcoes, value, onChange }: { label: string; opcoes: { valor: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(valor: string) {
    onChange(value.includes(valor) ? value.filter(v => v !== valor) : [...value, valor]);
  }
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {opcoes.map(o => (
          <label key={o.valor} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0D2238', border: '1px solid #E2ECF5', borderRadius: 8, padding: '6px 10px' }}>
            <input type="checkbox" checked={value.includes(o.valor)} onChange={() => toggle(o.valor)} /> {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Passo 1 — Dados do representante ───────────────────────────────────────

export function Passo1({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Nome completo *" value={f.nome} onChange={v => set('nome', v)} />
      <Campo label="Nome da empresa / Razão Social" value={f.empresa} onChange={v => set('empresa', v)} />
      <Campo label="Nome fantasia" value={f.nome_fantasia} onChange={v => set('nome_fantasia', v)} />
      <Campo label="CNPJ" value={f.cnpj} onChange={v => set('cnpj', v)} />
      <Campo label="CPF do responsável" value={f.cpf_responsavel} onChange={v => set('cpf_responsavel', v)} />
      <Campo label="Telefone / WhatsApp *" value={f.telefone} onChange={v => set('telefone', v)} />
      <Campo label="E-mail *" value={f.email} onChange={v => set('email', v)} type="email" />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Campo label="Cidade sede" value={f.cidade} onChange={v => set('cidade', v)} />
        <Campo label="UF sede" value={f.estado} onChange={v => set('estado', v)} />
      </div>
    </div>
  );
}

// ─── Passo 2 — Estrutura da empresa ─────────────────────────────────────────

export function Passo2({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Possui equipe?" value={f.possui_equipe} onChange={v => set('possui_equipe', v)} />
      <Campo label="Quantas pessoas fazem parte da equipe?" value={f.qtd_pessoas_equipe} onChange={v => set('qtd_pessoas_equipe', v)} />
      <p style={{ fontSize: 12, fontWeight: 700, color: '#0D2238', marginTop: 8 }}>Pessoas por função e o que cada uma faz:</p>
      <Campo label="Comercial / Prospecção" value={f.funcao_comercial} onChange={v => set('funcao_comercial', v)} />
      <Campo label="Vendas / Fechamento" value={f.funcao_vendas} onChange={v => set('funcao_vendas', v)} />
      <Campo label="Implantação" value={f.funcao_implantacao} onChange={v => set('funcao_implantacao', v)} />
      <Campo label="Instalação" value={f.funcao_instalacao} onChange={v => set('funcao_instalacao', v)} />
      <Campo label="Suporte" value={f.funcao_suporte} onChange={v => set('funcao_suporte', v)} />
      <Campo label="Treinamento" value={f.funcao_treinamento} onChange={v => set('funcao_treinamento', v)} />
      <Campo label="Administrativo" value={f.funcao_administrativo} onChange={v => set('funcao_administrativo', v)} />
      <Campo label="Outros" value={f.funcao_outros} onChange={v => set('funcao_outros', v)} />
      <Campo label="Quantas pessoas estarão dedicadas à representação da Prosystem?" value={f.qtd_dedicada_prosystem} onChange={v => set('qtd_dedicada_prosystem', v)} />
      <Campo label="A equipe é própria ou terceirizada?" value={f.equipe_propria_ou_terceirizada} onChange={v => set('equipe_propria_ou_terceirizada', v)} />
    </div>
  );
}

// ─── Passo 3 — Estrutura comercial ──────────────────────────────────────────

const CANAIS_PROSPECCAO = [
  { valor: 'VISITA_PRESENCIAL', label: 'Visita presencial' },
  { valor: 'TELEFONE', label: 'Telefone' },
  { valor: 'WHATSAPP', label: 'WhatsApp' },
  { valor: 'REDES_SOCIAIS', label: 'Redes sociais' },
  { valor: 'INDICACOES', label: 'Indicações' },
  { valor: 'TRAFEGO_PAGO', label: 'Tráfego pago' },
];

export function Passo3({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Quem será responsável pelas vendas do sistema?" value={f.responsavel_vendas} onChange={v => set('responsavel_vendas', v)} />
      <Campo label="Quantas pessoas atuarão diretamente na prospecção e venda?" value={f.qtd_prospeccao_venda} onChange={v => set('qtd_prospeccao_venda', v)} />
      <CampoSimNao label="Realiza visitas presenciais aos clientes?" value={f.visita_presencial} onChange={v => set('visita_presencial', v)} />
      <CampoSimNao label="Realiza prospecção ativa?" value={f.prospeccao_ativa} onChange={v => set('prospeccao_ativa', v)} />
      <CampoMultiSelect label="Quais canais utiliza para prospectar clientes?" opcoes={CANAIS_PROSPECCAO} value={f.canais_prospeccao} onChange={v => set('canais_prospeccao', v)} />
      <Campo label="Outros canais (opcional)" value={f.canal_prospeccao_outros} onChange={v => set('canal_prospeccao_outros', v)} />
    </div>
  );
}

// ─── Passo 4 — Instalação, implantação e treinamento ───────────────────────

export function Passo4({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Realiza instalação de sistemas no cliente?" value={f.realiza_instalacao} onChange={v => set('realiza_instalacao', v)} />
      <Campo label="Quem realiza a instalação?" value={f.quem_instala} onChange={v => set('quem_instala', v)} />
      <Campo label="Quantas pessoas da equipe realizam instalações?" value={f.qtd_instaladores} onChange={v => set('qtd_instaladores', v)} />
      <CampoSimNao label="Possui experiência com instalação de ERP, PDV ou sistemas de gestão?" value={f.experiencia_erp_pdv_instalacao} onChange={v => set('experiencia_erp_pdv_instalacao', v)} />
      <CampoSimNao label="Possui experiência com configuração de computadores, impressoras, rede e equipamentos de PDV?" value={f.experiencia_config_equipamentos} onChange={v => set('experiencia_config_equipamentos', v)} />
      <CampoSimNao label="Realiza implantação e configuração inicial do sistema?" value={f.realiza_implantacao} onChange={v => set('realiza_implantacao', v)} />
      <CampoSimNao label="Realiza treinamento dos usuários após a implantação?" value={f.realiza_treinamento} onChange={v => set('realiza_treinamento', v)} />
      <Campo label="Quantas pessoas da equipe podem realizar treinamento?" value={f.qtd_treinadores} onChange={v => set('qtd_treinadores', v)} />
    </div>
  );
}

// ─── Passo 5 — Suporte ao cliente ───────────────────────────────────────────

const TIPOS_SUPORTE = [
  { valor: 'PRESENCIAL', label: 'Presencial' },
  { valor: 'TELEFONE', label: 'Telefone' },
  { valor: 'WHATSAPP', label: 'WhatsApp' },
  { valor: 'REMOTO', label: 'Acesso remoto' },
  { valor: 'TREINAMENTO', label: 'Treinamento' },
  { valor: 'TECNICO_BASICO', label: 'Suporte técnico básico' },
];

export function Passo5({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Presta suporte aos clientes após a venda?" value={f.presta_suporte} onChange={v => set('presta_suporte', v)} />
      <CampoMultiSelect label="Quais tipos de suporte consegue oferecer?" opcoes={TIPOS_SUPORTE} value={f.tipos_suporte} onChange={v => set('tipos_suporte', v)} />
      <Campo label="Outros (opcional)" value={f.tipo_suporte_outros} onChange={v => set('tipo_suporte_outros', v)} />
      <Campo label="Quem é responsável pelo suporte na equipe?" value={f.suporte_responsavel} onChange={v => set('suporte_responsavel', v)} />
      <Campo label="Quantas pessoas realizam suporte?" value={f.suporte_qtd_pessoas} onChange={v => set('suporte_qtd_pessoas', v)} />
      <Campo label="Qual o horário de atendimento do suporte?" value={f.suporte_horario} onChange={v => set('suporte_horario', v)} />
      <CampoSimNao label="Possui experiência anterior com suporte de software?" value={f.suporte_experiencia_anterior} onChange={v => set('suporte_experiencia_anterior', v)} />
    </div>
  );
}

// ─── Passo 6 — Região de atuação ────────────────────────────────────────────

export function Passo6({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  function addCidade() {
    set('cidades', [...f.cidades, { nome: '', tipo: 'PRESENCIAL' }]);
  }
  function updateCidade(i: number, patch: Partial<FormState['cidades'][number]>) {
    set('cidades', f.cidades.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function removeCidade(i: number) {
    set('cidades', f.cidades.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Estado(s) em que atua (separados por vírgula)" value={f.estados_atuacao} onChange={v => set('estados_atuacao', v)} />
      <Campo label="Região principal de atuação" value={f.regiao_principal} onChange={v => set('regiao_principal', v)} />

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Cidades em que possui atuação comercial</label>
        <div style={{ display: 'grid', gap: 8 }}>
          {f.cidades.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={c.nome}
                onChange={e => updateCidade(i, { nome: e.target.value })}
                placeholder="Cidade/UF"
                style={{ flex: 2, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }}
              />
              <select
                value={c.tipo}
                onChange={e => updateCidade(i, { tipo: e.target.value as 'PRESENCIAL' | 'REMOTO' })}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }}
              >
                <option value="PRESENCIAL">Presencial</option>
                <option value="REMOTO">Remoto</option>
              </select>
              <button onClick={() => removeCidade(i)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addCidade} style={{ marginTop: 8, background: 'none', border: '1px dashed #2E6EAB', color: '#2E6EAB', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Adicionar cidade
        </button>
      </div>

      <CampoSimNao label="Consegue realizar atendimento presencial em todas essas cidades?" value={f.atende_todas_presencial} onChange={v => set('atende_todas_presencial', v)} />
      <CampoSimNao label="Possui veículo próprio para visitas e atendimento?" value={f.veiculo_proprio} onChange={v => set('veiculo_proprio', v)} />
      <Campo label="Qual distância máxima consegue percorrer para atendimento presencial?" value={f.distancia_maxima} onChange={v => set('distancia_maxima', v)} />
    </div>
  );
}

// ─── Passo 7 — Experiência no mercado ───────────────────────────────────────

const SEGMENTOS_EXPERIENCIA = [
  { valor: 'FARMACIAS', label: 'Farmácias' },
  { valor: 'DROGARIAS', label: 'Drogarias' },
  { valor: 'PADARIAS', label: 'Padarias' },
  { valor: 'MERCADOS', label: 'Mercados' },
  { valor: 'CONVENIENCIAS', label: 'Conveniências' },
];

export function Passo7({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Há quanto tempo atua comercialmente?" value={f.tempo_atuacao} onChange={v => set('tempo_atuacao', v)} />
      <CampoSimNao label="Já trabalhou ou trabalha com software de gestão?" value={f.trabalhou_software_gestao} onChange={v => set('trabalhou_software_gestao', v)} />
      <CampoSimNao label="Possui experiência com ERP ou PDV?" value={f.experiencia_erp_pdv_mercado} onChange={v => set('experiencia_erp_pdv_mercado', v)} />
      <CampoMultiSelect label="Possui experiência nos seguintes segmentos:" opcoes={SEGMENTOS_EXPERIENCIA} value={f.segmentos_experiencia} onChange={v => set('segmentos_experiencia', v)} />
      <Campo label="Outros segmentos (opcional)" value={f.segmento_outros} onChange={v => set('segmento_outros', v)} />
      <CampoSimNao label="Já possui carteira de clientes nesses segmentos?" value={f.possui_carteira} onChange={v => set('possui_carteira', v)} />
      <Campo label="Se sim, aproximadamente quantos clientes ou contatos possui?" value={f.qtd_clientes_aprox} onChange={v => set('qtd_clientes_aprox', v)} />
    </div>
  );
}

// ─── Passo 8 — Marcas e empresas que representa atualmente ─────────────────

const ATUA_COM_OPCOES = [
  { valor: 'SOFTWARE', label: 'Software' },
  { valor: 'ERP', label: 'ERP' },
  { valor: 'PDV', label: 'PDV' },
  { valor: 'AUTOMACAO_COMERCIAL', label: 'Automação comercial' },
  { valor: 'SISTEMAS_FARMACIAS', label: 'Sistemas para farmácias' },
  { valor: 'SISTEMAS_PADARIAS', label: 'Sistemas para padarias' },
  { valor: 'TECNOLOGIA_VAREJO', label: 'Tecnologia para varejo' },
  { valor: 'NENHUMA', label: 'Nenhuma das anteriores' },
];

export function Passo8({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  function addMarca() {
    set('marcas', [...f.marcas, { marca: '', produto_servico: '', segmento: '' }]);
  }
  function updateMarca(i: number, patch: Partial<FormState['marcas'][number]>) {
    set('marcas', f.marcas.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  }
  function removeMarca(i: number) {
    set('marcas', f.marcas.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoSimNao label="Atualmente representa outras empresas, marcas, produtos ou serviços?" value={f.representa_outras_marcas} onChange={v => set('representa_outras_marcas', v)} />

      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Marcas que representa</label>
        <div style={{ display: 'grid', gap: 10 }}>
          {f.marcas.map((m, i) => (
            <div key={i} style={{ border: '1px solid #E2ECF5', borderRadius: 8, padding: 10, display: 'grid', gap: 6 }}>
              <input value={m.marca} onChange={e => updateMarca(i, { marca: e.target.value })} placeholder="Marca" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }} />
              <input value={m.produto_servico} onChange={e => updateMarca(i, { produto_servico: e.target.value })} placeholder="Produto/Serviço" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }} />
              <input value={m.segmento} onChange={e => updateMarca(i, { segmento: e.target.value })} placeholder="Segmento" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 13 }} />
              <button onClick={() => removeMarca(i)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 12, fontWeight: 700, justifySelf: 'start' }}>Remover</button>
            </div>
          ))}
        </div>
        <button onClick={addMarca} style={{ marginTop: 8, background: 'none', border: '1px dashed #2E6EAB', color: '#2E6EAB', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Adicionar marca
        </button>
      </div>

      <Campo label="Há quanto tempo representa essas marcas?" value={f.tempo_representacao_marcas} onChange={v => set('tempo_representacao_marcas', v)} />
      <Campo label="Essas representações são exclusivas ou não exclusivas?" value={f.exclusividade} onChange={v => set('exclusividade', v)} />
      <CampoMultiSelect label="Alguma dessas marcas atua com:" opcoes={ATUA_COM_OPCOES} value={f.atua_com} onChange={v => set('atua_com', v)} />
      <CampoSimNao label="Representa atualmente algum concorrente direto ou indireto da Prosystem?" value={f.representa_concorrente} onChange={v => set('representa_concorrente', v)} />
      {f.representa_concorrente && (
        <Campo label="Se sim, informe qual empresa ou marca" value={f.concorrente_qual} onChange={v => set('concorrente_qual', v)} />
      )}
      <CampoSimNao label="Existe algum contrato de exclusividade, restrição territorial ou impedimento?" value={f.tem_impedimento} onChange={v => set('tem_impedimento', v)} />
      {f.tem_impedimento && (
        <CampoTextarea label="Se sim, descreva" value={f.impedimento_descricao} onChange={v => set('impedimento_descricao', v)} />
      )}
    </div>
  );
}

// ─── Passo 9 — Capacidade de atendimento e expansão ────────────────────────

const ETAPAS_ATUACAO = [
  { valor: 'PROSPECCAO', label: 'Prospecção' },
  { valor: 'DEMONSTRACAO', label: 'Demonstração' },
  { valor: 'NEGOCIACAO', label: 'Negociação' },
  { valor: 'FECHAMENTO', label: 'Fechamento' },
  { valor: 'INSTALACAO', label: 'Instalação' },
  { valor: 'IMPLANTACAO', label: 'Implantação' },
  { valor: 'TREINAMENTO', label: 'Treinamento' },
  { valor: 'SUPORTE', label: 'Suporte' },
  { valor: 'POS_VENDA', label: 'Pós-venda' },
];

export function Passo9({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Campo label="Quantos novos clientes acredita conseguir prospectar por mês?" value={f.prospectar_mes} onChange={v => set('prospectar_mes', v)} />
      <Campo label="Quantos novos clientes acredita conseguir fechar por mês?" value={f.fechar_mes} onChange={v => set('fechar_mes', v)} />
      <Campo label="Quantos clientes sua estrutura consegue implantar por mês?" value={f.implantar_mes} onChange={v => set('implantar_mes', v)} />
      <CampoSimNao label="Consegue acompanhar o cliente desde a prospecção até o pós-venda?" value={f.acompanha_prospeccao_pos_venda} onChange={v => set('acompanha_prospeccao_pos_venda', v)} />
      <CampoMultiSelect label="Em quais etapas sua equipe consegue atuar diretamente?" opcoes={ETAPAS_ATUACAO} value={f.etapas_atua} onChange={v => set('etapas_atua', v)} />
    </div>
  );
}

// ─── Passo 10 — Apresentação da operação + perfil desejado ─────────────────

export function Passo10({ f, set }: { f: FormState; set: <K extends keyof FormState>(campo: K, valor: FormState[K]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <CampoTextarea
        label="Descreva resumidamente sua estrutura atual, equipe, região de atuação, marcas que representa e como pretende desenvolver comercialmente a Prosystem em sua região:"
        value={f.apresentacao_operacao}
        onChange={v => set('apresentacao_operacao', v)}
        rows={6}
      />
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A6E8A', marginBottom: 6 }}>Perfil desejado *</label>
        <select
          value={f.perfil_desejado}
          onChange={e => set('perfil_desejado', e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2ECF5', fontSize: 14, color: '#0D2238' }}
        >
          <option value="">Selecione...</option>
          <option value="INDICADOR">Indicador</option>
          <option value="REPRESENTANTE">Representante</option>
          <option value="FRANQUEADO">Franqueado</option>
        </select>
      </div>
    </div>
  );
}
