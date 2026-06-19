import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  nome: string;
  role: string;
  precisa_trocar_senha?: boolean;
}

class ApiClient {
  public client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Load tokens from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
      this.setAuthHeader();
    }

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          this.refreshToken
        ) {
          originalRequest._retry = true;

          try {
            const response = await this.client.post('/auth/refresh', {
              refreshToken: this.refreshToken
            });

            const { accessToken, refreshToken } = response.data.data;
            this.setTokens(accessToken, refreshToken);
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (err) {
            this.clearTokens();
            return Promise.reject(err);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.setAuthHeader();

    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  private setAuthHeader() {
    if (this.accessToken) {
      this.client.defaults.headers.common.Authorization = `Bearer ${this.accessToken}`;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    const { accessToken, refreshToken } = response.data.data;
    this.setTokens(accessToken, refreshToken);
    return response.data.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  async forgotPassword(email: string) {
    return this.client.post('/auth/forgot-password', { email });
  }

  async alterarSenha(senha_atual: string, nova_senha: string) {
    return this.client.post('/auth/alterar-senha', { senha_atual, nova_senha });
  }

  // Cases endpoints
  async getCasos(page = 0, limit = 20, status?: string, risco_min?: number, risco_max?: number, busca?: string, data_inicio?: string, data_fim?: string) {
    const params: any = { page, limit };
    if (status) params.status = status;
    if (risco_min !== undefined) params.risco_min = risco_min;
    if (risco_max !== undefined) params.risco_max = risco_max;
    if (busca) params.busca = busca;
    if (data_inicio) params.data_inicio = data_inicio;
    if (data_fim) params.data_fim = data_fim;
    return this.client.get('/casos-churn', { params });
  }

  async getAtualizacoesCaso(id: string) {
    return this.client.get(`/casos-churn/${id}/atualizacoes`);
  }
  async addAtualizacaoCaso(id: string, data: { tipo: string; texto: string; canal?: string; resultado?: string }) {
    return this.client.post(`/casos-churn/${id}/atualizacoes`, data);
  }

  async createCaso(clienteId: string, motivo_principal?: string, descricao?: string) {
    return this.client.post('/casos-churn', {
      clienteId,
      motivo_principal,
      descricao
    });
  }

  async getCasoById(id: string) {
    return this.client.get(`/casos-churn/${id}`);
  }

  async updateCaso(id: string, data: any) {
    return this.client.patch(`/casos-churn/${id}`, data);
  }

  // Renegociação por dificuldade financeira (acordo de pagamento do caso de churn).
  async salvarRenegociacao(casoId: string, data: any) {
    return this.client.patch(`/casos-churn/${casoId}/renegociacao`, data);
  }

  // URL do termo de renegociação (PDF, abre em nova aba — endpoint público como o do contrato).
  renegociacaoPdfUrl(casoId: string) {
    return `${this.client.defaults.baseURL}/casos-churn/${casoId}/renegociacao/pdf`;
  }

  // Diagnosis endpoints
  async createDiagnosis(casoId: string, factors: any) {
    return this.client.post(`/casos/${casoId}/diagnostico`, factors);
  }

  async getDiagnosis(casoId: string) {
    return this.client.get(`/casos/${casoId}/diagnostico`);
  }

  // Dashboard endpoints
  async getDashboardKPIs(periodo = '30dias', status?: string) {
    const params: any = { periodo };
    if (status) params.status = status;
    return this.client.get('/dashboard/retencao', { params });
  }

  async getStatusChart(dias = 30) {
    return this.client.get('/dashboard/retencao/chart/status', { params: { dias } });
  }

  async getRiscoChart() {
    return this.client.get('/dashboard/retencao/chart/risco');
  }

  async getTopRiscoClientes(limit = 10) {
    return this.client.get('/dashboard/retencao/top-risco', { params: { limit } });
  }

  // Plans endpoints
  async createPlano(casoId: string, titulo: string, descricao?: string) {
    return this.client.post(`/casos/${casoId}/planos`, { titulo, descricao });
  }

  async getPlanosCaso(casoId: string) {
    return this.client.get(`/casos/${casoId}/planos`);
  }

  async updatePlano(planoId: string, data: any) {
    return this.client.patch(`/planos/${planoId}`, data);
  }

  // Actions endpoints
  async createAcao(casoId: string, data: any) {
    return this.client.post(`/casos/${casoId}/acoes`, data);
  }

  async getAcoes(casoId: string, status?: string) {
    const params: any = {};
    if (status) params.status = status;
    return this.client.get(`/casos/${casoId}/acoes`, { params });
  }

  async getTimeline(casoId: string) {
    return this.client.get(`/casos/${casoId}/timeline`);
  }

  async updateAcao(acaoId: string, data: any) {
    return this.client.patch(`/acoes/${acaoId}`, data);
  }

  // Clientes endpoints
  async getClientes(page = 0, limit = 20, search?: string, filtros?: { grupo_tecnico?: string; situacao?: string; segmento?: string; plano?: string; risco?: boolean }) {
    const params: any = { page, limit };
    if (search) params.search = search;
    if (filtros?.grupo_tecnico) params.grupo_tecnico = filtros.grupo_tecnico;
    if (filtros?.situacao) params.situacao = filtros.situacao;
    if (filtros?.segmento) params.segmento = filtros.segmento;
    if (filtros?.plano) params.plano = filtros.plano;
    if (filtros?.risco) params.risco = true;
    return this.client.get('/clientes', { params });
  }

  async desativarCliente(id: string, motivo: string, mrr_perdido?: number) {
    return this.client.post(`/clientes/${id}/desativar`, { motivo, mrr_perdido });
  }
  async reativarCliente(id: string) {
    return this.client.post(`/clientes/${id}/reativar`);
  }
  async trocarCnpjCliente(id: string, data: { cnpj_novo: string; razao_social_nova?: string; nome_fantasia_nova?: string; inscricao_nova?: string; motivo?: string }) {
    return this.client.post(`/clientes/${id}/trocar-cnpj`, data);
  }

  async getClienteById(id: string) {
    return this.client.get(`/clientes/${id}`);
  }

  async createCliente(data: { nome: string; email: string; telefone?: string; empresa?: string; cidade?: string; estado?: string }) {
    return this.client.post('/clientes', data);
  }

  async updateCliente(id: string, data: any) {
    return this.client.patch(`/clientes/${id}`, data);
  }

  async deleteCliente(id: string) {
    return this.client.delete(`/clientes/${id}`);
  }

  // Campanhas endpoints
  async getCampanhas(page = 0, limit = 20, status?: string) {
    const params: any = { page, limit };
    if (status) params.status = status;
    return this.client.get('/campanhas', { params });
  }

  async getCampanhaById(id: string) {
    return this.client.get(`/campanhas/${id}`);
  }

  async createCampanha(data: { nome: string; descricao?: string; data_inicio: string; data_fim: string }) {
    return this.client.post('/campanhas', data);
  }

  async updateCampanha(id: string, data: any) {
    return this.client.patch(`/campanhas/${id}`, data);
  }

  async deleteCampanha(id: string) {
    return this.client.delete(`/campanhas/${id}`);
  }

  async getCampanhasStats() {
    return this.client.get('/campanhas/stats/resumo');
  }

  // Leads endpoints
  async getLeads(params?: { page?: number; limit?: number; status?: string; etapa_funil?: string; temperatura?: string; search?: string }) {
    return this.client.get('/leads', { params });
  }

  async getLeadById(id: string) {
    return this.client.get(`/leads/${id}`);
  }

  async createLead(data: any) {
    return this.client.post('/leads', data);
  }

  async fecharLead(id: string, data: {
    plano: 'BASIC' | 'MEI' | 'PRO' | 'PLUS';
    valor_instalacao: number;
    mrr: number;
    valor_entrada: number;
    forma_entrada: 'PIX' | 'BOLETO' | 'CARTAO' | 'TRANSFERENCIA';
    parcelas_instalacao?: number;
    data_1cob?: string;
    observacoes?: string;
  }) {
    return this.client.post(`/leads/${id}/fechar`, data);
  }

  async getMetricasComerciais(params?: { data_inicio?: string; data_fim?: string }) {
    return this.client.get('/leads/metricas-comerciais', { params });
  }

  async getContratoStatus(leadId: string) {
    return this.client.get(`/leads/${leadId}/contrato-status`);
  }

  async getZapSignTemplates() {
    return this.client.get('/zapsign/templates');
  }

  async updateLead(id: string, data: any) {
    return this.client.patch(`/leads/${id}`, data);
  }

  async deleteLead(id: string, motivo?: string) {
    return this.client.delete(`/leads/${id}`, { data: { motivo } });
  }

  async getLeadsFunil() {
    return this.client.get('/leads/funil');
  }

  async getLeadsStats() {
    return this.client.get('/leads/stats/resumo');
  }

  async getLeadsKanban(responsavel_id?: string) {
    return this.client.get('/leads/kanban', { params: responsavel_id ? { responsavel_id } : {} });
  }

  // ── Quadros comerciais (Pipeline + Follow-up + customizados) ──
  async getQuadros() {
    return this.client.get('/quadros');
  }
  async getQuadroKanban(quadroId: string) {
    return this.client.get(`/quadros/${quadroId}/kanban`);
  }
  async criarQuadro(data: any) {
    return this.client.post('/quadros', data);
  }
  async editarQuadro(id: string, data: any) {
    return this.client.patch(`/quadros/${id}`, data);
  }
  async excluirQuadro(id: string) {
    return this.client.delete(`/quadros/${id}`);
  }
  async moverLeadNoQuadro(quadroId: string, lead_id: string, coluna_chave: string) {
    return this.client.post(`/quadros/${quadroId}/mover`, { lead_id, coluna_chave });
  }

  async getLeadObservacoes(id: string) {
    return this.client.get(`/leads/${id}/observacoes`);
  }

  async addLeadObservacao(id: string, data: any) {
    return this.client.post(`/leads/${id}/observacoes`, data);
  }

  async saveLeadOnboarding(id: string, data: any) {
    return this.client.put(`/leads/${id}/onboarding`, data);
  }

  async enviarParaExecucao(id: string) {
    return this.client.post(`/leads/${id}/enviar-execucao`, {});
  }

  async saveLeadExecucao(id: string, data: any) {
    return this.client.put(`/leads/${id}/execucao`, data);
  }

  async gerarPropostaDeLead(id: string) {
    return this.client.post(`/leads/${id}/gerar-proposta`, {});
  }

  // Kanban columns
  async getKanbanColunas() {
    return this.client.get('/kanban-colunas');
  }

  async createKanbanColuna(data: { nome: string; cor?: string; ordem?: number }) {
    return this.client.post('/kanban-colunas', data);
  }

  async updateKanbanColuna(id: string, data: any) {
    return this.client.patch(`/kanban-colunas/${id}`, data);
  }

  async deleteKanbanColuna(id: string) {
    return this.client.delete(`/kanban-colunas/${id}`);
  }

  // Etiquetas
  async getEtiquetas() {
    return this.client.get('/etiquetas');
  }

  async createEtiqueta(data: { nome: string; cor?: string; descricao?: string }) {
    return this.client.post('/etiquetas', data);
  }

  async addEtiquetaToLead(leadId: string, etiquetaId: string) {
    return this.client.post(`/leads/${leadId}/etiquetas/${etiquetaId}`, {});
  }

  async removeEtiquetaFromLead(leadId: string, etiquetaId: string) {
    return this.client.delete(`/leads/${leadId}/etiquetas/${etiquetaId}`);
  }

  // Atividades endpoints
  async getAtividades(params?: { status?: string; tipo?: string; lead_id?: string; responsavel_id?: string; page?: number; limit?: number }) {
    return this.client.get('/atividades', { params });
  }

  async getAtividadeById(id: string) {
    return this.client.get(`/atividades/${id}`);
  }

  async getAgenda() {
    return this.client.get('/atividades/agenda');
  }

  async createAtividade(data: any) {
    return this.client.post('/atividades', data);
  }

  async updateAtividade(id: string, data: any) {
    return this.client.patch(`/atividades/${id}`, data);
  }

  async deleteAtividade(id: string) {
    return this.client.delete(`/atividades/${id}`);
  }

  async concluirAtividade(id: string, data: {
    resultado: string;
    duracao_minutos?: number;
    data_realizada?: string;
    percepcao_tags?: string[];
    percepcao_nota?: number;
    percepcao_observ?: string;
  }) {
    return this.client.post(`/atividades/${id}/concluir`, data);
  }

  async getDashboardProdutividade(params?: { data_inicio?: string; data_fim?: string; responsavel_id?: string }) {
    return this.client.get('/atividades/dashboard-produtividade', { params });
  }

  async cancelarAtividade(id: string, motivo_cancelamento: string) {
    return this.client.post(`/atividades/${id}/cancelar`, { motivo_cancelamento });
  }

  async remarcarAtividade(id: string, data: { nova_data_remarcada: string; motivo?: string }) {
    return this.client.post(`/atividades/${id}/remarcar`, data);
  }

  async reagendarRapido(id: string, data_prevista: string) {
    return this.client.post(`/atividades/${id}/reagendar-rapido`, { data_prevista });
  }

  async getAtividadeMetricas(params?: { data_inicio?: string; data_fim?: string; tipo?: string }) {
    return this.client.get('/atividades/metricas', { params });
  }

  async confirmarAtividade(id: string) {
    return this.client.post(`/atividades/${id}/confirmar`);
  }

  async naoCompareceuAtividade(id: string, observacao?: string) {
    return this.client.post(`/atividades/${id}/nao-compareceu`, { observacao });
  }

  async aguardarRetornoAtividade(id: string, observacao?: string) {
    return this.client.post(`/atividades/${id}/aguardar-retorno`, { observacao });
  }

  async criarMeetLink(atividadeId: string) {
    return this.client.post(`/atividades/${atividadeId}/criar-meet`);
  }

  async criarMeetTemp(data: { titulo: string; data_prevista?: string; duracao_minutos?: number; lead_email?: string }) {
    return this.client.post('/agenda/criar-meet-temp', data);
  }

  async getRelatorioAtividades(params?: { data_inicio?: string; data_fim?: string; responsavel_id?: string; status?: string; tipo?: string; lead_id?: string }) {
    return this.client.get('/atividades/relatorio', { params });
  }

  async getGoogleAuthUrl() {
    return this.client.get('/agenda/google/auth');
  }

  async getGoogleStatus() {
    return this.client.get('/agenda/google/status');
  }

  // Propostas endpoints
  async getPropostas(params?: { status?: string; lead_id?: string; page?: number }) {
    return this.client.get('/propostas', { params });
  }

  async getPropostaById(id: string) {
    return this.client.get(`/propostas/${id}`);
  }

  async createProposta(data: any) {
    return this.client.post('/propostas', data);
  }

  async updateProposta(id: string, data: any) {
    return this.client.patch(`/propostas/${id}`, data);
  }

  async deleteProposta(id: string) {
    return this.client.delete(`/propostas/${id}`);
  }

  async converterContrato(propostaId: string, data: any) {
    return this.client.post(`/propostas/${propostaId}/converter-contrato`, data);
  }

  async getPropostasStats() {
    return this.client.get('/propostas/stats/resumo');
  }

  // Contratos endpoints
  async getContratos(params?: { status?: string; recorrencia?: string; page?: number; limit?: number }) {
    return this.client.get('/contratos', { params });
  }

  async getContratoById(id: string) {
    return this.client.get(`/contratos/${id}`);
  }

  async updateContrato(id: string, data: any) {
    return this.client.patch(`/contratos/${id}`, data);
  }

  async getContratosStats() {
    return this.client.get('/contratos/stats/resumo');
  }

  // ── Contratos Comerciais (novo módulo ZapSign)
  async getContratosComerciais(params?: { status?: string; search?: string }) {
    return this.client.get('/contratos-comerciais', { params });
  }

  async getContratoComercial(id: string) {
    return this.client.get(`/contratos-comerciais/${id}`);
  }

  async createContratoComercial(data: any) {
    return this.client.post('/contratos-comerciais', data);
  }

  async createContratoFromProposta(propostaId: string) {
    return this.client.post(`/contratos-comerciais/from-proposta/${propostaId}`);
  }

  async updateContratoComercial(id: string, data: any) {
    return this.client.patch(`/contratos-comerciais/${id}`, data);
  }
  async gerarClienteDoContrato(id: string, data: { codigo?: string; telefone?: string; telefone2?: string; email?: string; grupo_tecnico?: string; segmento?: string; observacoes?: string }) {
    return this.client.post(`/contratos-comerciais/${id}/gerar-cliente`, data);
  }

  async deleteContratoComercial(id: string) {
    return this.client.delete(`/contratos-comerciais/${id}`);
  }

  async getContratoPreview(id: string) {
    return this.client.get(`/contratos-comerciais/${id}/preview`);
  }

  // Dados para revisão: contrato com campos vazios completados pelo lead de origem.
  async getContratoDadosRevisao(id: string) {
    return this.client.get(`/contratos-comerciais/${id}/dados-revisao`);
  }

  // Resumo p/ assinatura (e-mail): texto no padrão da gestão, lead→proposta→contrato.
  async getResumoAssinatura(id: string) {
    return this.client.get(`/contratos-comerciais/${id}/resumo-assinatura`);
  }

  // Grupos técnicos já existentes na base (dropdown ao gerar cadastro).
  async getGruposTecnicos() {
    return this.client.get('/clientes/grupos-tecnicos');
  }

  // ── Módulo ATIVOS (CS comercial) ──
  async criarCampanhaAtivo(data: { grupo_tecnico: string; vendedor_id: string; meta_cobertura_pct?: number; observacoes?: string }) {
    return this.client.post('/ativos/campanhas', data);
  }
  async getCampanhasAtivo() {
    return this.client.get('/ativos/campanhas');
  }
  async getContatosAtivo(campanhaId: string) {
    return this.client.get(`/ativos/campanhas/${campanhaId}/contatos`);
  }
  async atualizarContatoAtivo(id: string, data: any) {
    return this.client.patch(`/ativos/contatos/${id}`, data);
  }
  async registrarTentativaAtivo(id: string, data?: { obs?: string; sem_sucesso?: boolean }) {
    return this.client.post(`/ativos/contatos/${id}/tentativa`, data || {});
  }
  async getAtivosDoCliente(clienteId: string) {
    return this.client.get(`/ativos/cliente/${clienteId}`);
  }
  async getPainelAtivos() {
    return this.client.get('/ativos/painel');
  }
  // Supervisão: ocultar/exibir e etiquetar um contato ativo.
  async supervisaoContatoAtivo(id: string, data: { oculto?: boolean; oculto_motivo?: string; etiqueta?: string | null; etiqueta_cor?: string }) {
    return this.client.patch(`/ativos/contatos/${id}/supervisao`, data);
  }
  // Mini-ficha do contato (dados do cliente + telefones + atualizações).
  async getFichaContatoAtivo(id: string) {
    return this.client.get(`/ativos/contatos/${id}/ficha`);
  }
  async getOportunidadesContato(contatoId: string) {
    return this.client.get(`/ativos/contatos/${contatoId}/oportunidades`);
  }
  async criarOportunidadeAtivo(contatoId: string, data: any) {
    return this.client.post(`/ativos/contatos/${contatoId}/oportunidades`, data);
  }
  async confirmarOportunidade(id: string) {
    return this.client.post(`/ativos/oportunidades/${id}/confirmar`, {});
  }
  async cancelarOportunidade(id: string) {
    return this.client.post(`/ativos/oportunidades/${id}/cancelar`, {});
  }
  async getOportunidadesNegociacao() {
    return this.client.get('/ativos/oportunidades');
  }

  // Troca de CNPJ (venda adicional): atualiza cadastro (guarda antigo na ficha),
  // gera venda+comissão da taxa e cria contrato novo do mesmo plano.
  async trocaCnpj(data: any) {
    return this.client.post('/contratos-comerciais/troca-cnpj', data);
  }

  async enviarContratoZapSign(id: string) {
    return this.client.post(`/contratos-comerciais/${id}/enviar-zapsign`);
  }

  // Gera o PDF a partir do modelo padrão e envia à ZapSign para assinatura (1 clique).
  async gerarEEnviarContrato(id: string) {
    return this.client.post(`/contratos-comerciais/${id}/gerar-e-enviar`);
  }

  // Recuo / distrato do contrato (cliente assinou e desistiu) — sai da meta, estorna comissão.
  async recuarContrato(id: string, motivo?: string) {
    return this.client.post(`/contratos-comerciais/${id}/recuar`, { motivo });
  }

  // URL do PDF do contrato (preview/download), gerado pelo modelo padrão.
  contratoPdfUrl(id: string) {
    return `${this.client.defaults.baseURL}/contratos-comerciais/${id}/pdf`;
  }

  async getConfiguracoesIntegracoes() {
    return this.client.get('/configuracoes/integracoes');
  }

  async saveConfiguracoesIntegracoes(data: Record<string, string>) {
    return this.client.put('/configuracoes/integracoes', data);
  }

  // Metas endpoints
  async getMetas(params?: { periodo?: string; responsavel_id?: string; tipo?: string }) {
    return this.client.get('/metas', { params });
  }

  async getMetasSerieAnual(ano?: number) {
    return this.client.get('/metas/serie-anual', { params: { ano } });
  }

  async createMeta(data: any) {
    return this.client.post('/metas', data);
  }

  async updateMeta(id: string, data: any) {
    return this.client.patch(`/metas/${id}`, data);
  }

  async deleteMeta(id: string) {
    return this.client.delete(`/metas/${id}`);
  }

  async getRanking(periodo?: string) {
    return this.client.get('/metas/ranking', { params: periodo ? { periodo } : {} });
  }

  // Complementos endpoints
  async getLeadHistorico(id: string) {
    return this.client.get(`/leads/${id}/historico`);
  }

  async getAlertas() {
    return this.client.get('/alertas');
  }

  async importarLeads(leads: any[]) {
    return this.client.post('/leads/importar', { leads });
  }

  async getPrevisao(dias = 30) {
    return this.client.get('/leads/previsao', { params: { dias } });
  }

  async getNutricao() {
    return this.client.get('/leads/nutricao');
  }

  async reativarLead(id: string) {
    return this.client.post(`/leads/${id}/reativar`);
  }

  // Planos endpoints
  async getPlanos(params?: { segmento?: string; ativo?: boolean }) {
    return this.client.get('/catalogo', { params });
  }

  async createPlanoServico(data: any) {
    return this.client.post('/catalogo', data);
  }

  async updatePlanoServico(id: string, data: any) {
    return this.client.patch(`/catalogo/${id}`, data);
  }

  async deletePlanoServico(id: string) {
    return this.client.delete(`/catalogo/${id}`);
  }

  // Licenças endpoints
  async getLicencas(params?: { status?: string; cliente_id?: string; page?: number; limit?: number }) {
    return this.client.get('/licencas', { params });
  }

  async createLicenca(data: any) {
    return this.client.post('/licencas', data);
  }

  async updateLicenca(id: string, data: any) {
    return this.client.patch(`/licencas/${id}`, data);
  }

  // Onboarding endpoints
  async getOnboardings(params?: { status?: string }) {
    return this.client.get('/onboardings', { params });
  }

  async createOnboarding(data: any) {
    return this.client.post('/onboardings', data);
  }

  async updateOnboarding(id: string, data: any) {
    return this.client.patch(`/onboardings/${id}`, data);
  }

  // Renovações endpoints
  async getRenovacoes(params?: { status?: string; dias?: number }) {
    return this.client.get('/renovacoes', { params });
  }

  async createRenovacao(data: any) {
    return this.client.post('/renovacoes', data);
  }

  async updateRenovacao(id: string, data: any) {
    return this.client.patch(`/renovacoes/${id}`, data);
  }

  // Tickets de suporte endpoints
  async getTickets(params?: { status?: string; prioridade?: string; cliente_id?: string; page?: number }) {
    return this.client.get('/tickets', { params });
  }

  async createTicket(data: any) {
    return this.client.post('/tickets', data);
  }

  async updateTicket(id: string, data: any) {
    return this.client.patch(`/tickets/${id}`, data);
  }

  // Comissões endpoints
  async getComissoes(params?: { responsavel_id?: string; periodo?: string; status?: string; tipo?: string }) {
    return this.client.get('/comissoes', { params });
  }

  async getComissoesPeriodos() {
    return this.client.get('/comissoes/periodos');
  }

  async getBonusTrimestral(params?: { ref?: string; vendedor_id?: string }) {
    return this.client.get('/comissoes/bonus-trimestral', { params });
  }

  async createComissao(data: any) {
    return this.client.post('/comissoes', data);
  }

  async updateComissao(id: string, data: any) {
    return this.client.patch(`/comissoes/${id}`, data);
  }

  async calcularComissoes(periodo: string) {
    return this.client.post('/comissoes/calcular-mes', { periodo });
  }

  // Comissão da Supervisão Comercial: % do faturamento do setor no período.
  async getComissaoSupervisao(periodo?: string) {
    return this.client.get('/comissoes/supervisao', { params: { periodo } });
  }

  // Relatório de comissões A PAGAR (por mês de pagamento e por vendedor) para o financeiro.
  async getRelatorioComissoesPagar(params?: { mes_pagamento?: string; estagio?: string }) {
    return this.client.get('/comissoes/relatorio', { params });
  }
  async marcarComissoesPagas(data: { ids?: string[]; mes_pagamento?: string }) {
    return this.client.post('/comissoes/marcar-pagas', data);
  }

  // Acompanhamento + execução de implantação
  async getImplantacoes(status?: string) {
    return this.client.get('/implantacoes', { params: { status } });
  }
  async getImplantacao(id: string) {
    return this.client.get(`/implantacoes/${id}`);
  }
  async atualizarImplantacao(id: string, data: any) {
    return this.client.patch(`/implantacoes/${id}`, data);
  }
  async getTecnicosImplantacao() {
    return this.client.get('/implantacoes/tecnicos');
  }
  async designarTecnico(id: string, tecnico_id: string) {
    return this.client.post(`/implantacoes/${id}/designar`, { tecnico_id });
  }
  async moverEtapaImplantacao(id: string, etapa: string) {
    return this.client.post(`/implantacoes/${id}/etapa`, { etapa });
  }
  async treinamentoImplantacao(id: string, acao: 'INICIAR' | 'ENCERRAR') {
    return this.client.post(`/implantacoes/${id}/treinamento`, { acao });
  }
  async addAtividadeImplantacao(id: string, descricao: string, tipo?: string) {
    return this.client.post(`/implantacoes/${id}/atividades`, { descricao, tipo });
  }
  async addTesteImplantacao(id: string, item: string) {
    return this.client.post(`/implantacoes/${id}/testes`, { item });
  }
  async updateTesteImplantacao(testeId: string, data: { resultado?: string; observacao?: string }) {
    return this.client.patch(`/implantacoes/testes/${testeId}`, data);
  }
  async addArquivoImplantacao(id: string, data: { nome: string; tipo: string; url: string; descricao?: string }) {
    return this.client.post(`/implantacoes/${id}/arquivos`, data);
  }
  async delArquivoImplantacao(arquivoId: string) {
    return this.client.delete(`/implantacoes/arquivos/${arquivoId}`);
  }
  async addChecklistImplantacao(id: string, titulo: string, grupo?: string) {
    return this.client.post(`/implantacoes/${id}/checklist`, { titulo, grupo });
  }
  async toggleChecklistImplantacao(itemId: string, feito: boolean) {
    return this.client.patch(`/implantacoes/checklist/${itemId}`, { feito });
  }

  async getRegrasComissao() {
    return this.client.get('/comissoes/regras');
  }

  // Indicações endpoints
  async getIndicacoes(params?: { status?: string }) {
    return this.client.get('/indicacoes', { params });
  }

  async createIndicacao(data: any) {
    return this.client.post('/indicacoes', data);
  }

  async updateIndicacao(id: string, data: any) {
    return this.client.patch(`/indicacoes/${id}`, data);
  }

  async getUsuarios() {
    return this.client.get('/usuarios');
  }

  // Vendedores (dropdown de atribuição) + atribuir/distribuir leads
  async getVendedores() {
    return this.client.get('/usuarios/vendedores');
  }
  // Usuários ativos (id, nome, cargo) para o dropdown de responsável das metas
  async getResponsaveis() {
    return this.client.get('/usuarios/responsaveis');
  }
  // Perfil completo do usuário logado (inclui telefone) — auto-preenche o vendedor
  async getMeuPerfil() {
    return this.client.get('/usuarios/me');
  }
  // Auditoria consolidada (só CEO/Supervisão)
  async getAuditoria(params?: { modulo?: string; ator_id?: string; tipo?: string; data_inicio?: string; data_fim?: string; busca?: string; page?: number; limit?: number }) {
    return this.client.get('/auditoria', { params });
  }

  // ── Lançamentos retroativos (só gestão) ──
  async retroativoVenda(data: { razao_social: string; nome_fantasia?: string; cnpj?: string; segmento?: string; data: string; setup: number; mensalidade: number; plano?: string; vendedor_id?: string; vendedor_nome?: string; gerar_comissao: boolean; comissao_paga: boolean; mes_pagamento_comissao?: string; observacoes?: string }) {
    return this.client.post('/retroativos/venda', data);
  }
  async retroativoComissao(data: { vendedor_id: string; descricao?: string; valor: number; data: string; paga: boolean; mes_pagamento_comissao?: string; tipo?: string }) {
    return this.client.post('/retroativos/comissao', data);
  }
  // Remarcar o mês de pagamento de uma comissão (gestão).
  async remarcarMesComissao(id: string, mes_pagamento: string) {
    return this.client.patch(`/comissoes/${id}/mes-pagamento`, { mes_pagamento });
  }
  // Relatório de comissões agrupado por mês de pagamento (aba A Pagar por mês).
  async getComissoesRelatorio(params?: { mes_pagamento?: string; estagio?: string }) {
    return this.client.get('/comissoes/relatorio', { params });
  }
  // Aprovar comissão indicando o mês de pagamento (gestão).
  async aprovarComissao(id: string, mes_pagamento: string) {
    return this.client.post(`/comissoes/${id}/aprovar`, { mes_pagamento });
  }
  // Ordem de pagamento mensal (comissões a pagar do mês, por vendedor/supervisão).
  async getOrdemPagamento(mes_pagamento: string) {
    return this.client.get('/comissoes/ordem-pagamento', { params: { mes_pagamento } });
  }
  // Lançar o bônus trimestral (paga no mês seguinte ao fim do trimestre).
  async lancarBonusTrimestral(ref?: string) {
    return this.client.post('/comissoes/bonus-trimestral/lancar', ref ? { ref } : {});
  }
  async retroativoSaida(data: { cliente_id?: string; nome?: string; razao_social?: string; data: string; mrr_perdido: number; motivo?: string; grupo_tecnico?: string }) {
    return this.client.post('/retroativos/saida', data);
  }
  async atribuirLeads(lead_ids: string[], vendedor_id: string) {
    return this.client.post('/leads/atribuir', { lead_ids, vendedor_id });
  }
  async distribuirLeads(payload?: { lead_ids?: string[]; vendedor_ids?: string[] }) {
    return this.client.post('/leads/distribuir', payload || {});
  }

  // Auditoria / trilha do lead + ciclo de vendas agregado
  async getLeadAuditoria(leadId: string) {
    return this.client.get(`/leads/${leadId}/auditoria`);
  }
  async getCicloVendas(params?: { data_inicio?: string; data_fim?: string }) {
    return this.client.get('/leads/ciclo-vendas', { params });
  }

  // Vendas Adicionais endpoints
  async getParceiros() {
    return this.client.get('/parceiros');
  }

  async createParceiro(data: any) {
    return this.client.post('/parceiros', data);
  }

  async updateParceiro(id: string, data: any) {
    return this.client.patch(`/parceiros/${id}`, data);
  }

  async deleteParceiro(id: string) {
    return this.client.delete(`/parceiros/${id}`);
  }

  async getVendasAdicionais(params?: { status?: string; vendedor_id?: string; parceiro_id?: string; periodo?: string }) {
    return this.client.get('/vendas-adicionais', { params });
  }

  async createVendaAdicional(data: any) {
    return this.client.post('/vendas-adicionais', data);
  }

  async updateVendaAdicional(id: string, data: any) {
    return this.client.patch(`/vendas-adicionais/${id}`, data);
  }

  async resumoFinanceiroVenda(id: string) {
    return this.client.get(`/vendas-adicionais/${id}/resumo-financeiro`);
  }
  async deleteVendaAdicional(id: string) {
    return this.client.delete(`/vendas-adicionais/${id}`);
  }

  // Health Score endpoints
  async getHealthScores(params?: { nivel?: string; page?: number }) {
    return this.client.get('/health-scores', { params });
  }

  async calcularHealthScore(clienteId: string) {
    return this.client.post(`/health-scores/${clienteId}/calcular`);
  }

  async calcularHealthScores() {
    return this.client.post('/health-scores/calcular-todos');
  }

  async getRankingTecnicos() {
    return this.client.get('/health-scores/ranking-tecnicos');
  }

  // NPS
  async getNpsDashboard() {
    return this.client.get('/nps/dashboard');
  }

  // Dashboard Power
  async getDashboardPower(vendedor_id?: string) {
    return this.client.get('/dashboard/power', { params: vendedor_id ? { vendedor_id } : {} });
  }

  async getDashboardComercial(vendedor_id?: string) {
    return this.client.get('/dashboard/comercial', { params: vendedor_id ? { vendedor_id } : {} });
  }

  // Propostas Comerciais endpoints
  async getPropostasComerciais(params?: { status?: string; vendedor?: string; page?: number; limit?: number }) {
    return this.client.get('/propostas-comerciais', { params });
  }

  async getPropostaComercialById(id: string) {
    return this.client.get(`/propostas-comerciais/${id}`);
  }

  async createPropostaComercial(data: any) {
    return this.client.post('/propostas-comerciais', data);
  }

  async updatePropostaComercial(id: string, data: any) {
    return this.client.patch(`/propostas-comerciais/${id}`, data);
  }

  async deletePropostaComercial(id: string, motivo?: string) {
    return this.client.delete(`/propostas-comerciais/${id}`, { data: motivo ? { motivo } : undefined });
  }

  async regenerarTokenProposta(id: string) {
    return this.client.post(`/propostas-comerciais/${id}/regenerar-token`);
  }

  async renegociarProposta(id: string, data: any) {
    return this.client.post(`/propostas-comerciais/${id}/renegociar`, data);
  }

  async getPropostaHistorico(id: string) {
    return this.client.get(`/propostas-comerciais/${id}/historico`);
  }

  async getRelatorioComissoes(params?: { mes?: string; vendedor_id?: string; status?: string }) {
    return this.client.get('/propostas-comerciais/relatorio/comissoes', { params });
  }

  // WhatsApp Inbox
  async getWhatsappInstancia() {
    return this.client.get('/whatsapp/instancia');
  }

  async conectarWhatsapp() {
    return this.client.post('/whatsapp/conectar');
  }

  async desconectarWhatsapp() {
    return this.client.post('/whatsapp/desconectar');
  }

  async getWhatsappConversas(instanciaId?: string, escopo?: 'todos') {
    const params: any = {};
    if (instanciaId) params.instanciaId = instanciaId;
    if (escopo) params.escopo = escopo;
    return this.client.get('/whatsapp/conversas', { params });
  }
  // Multi-instância
  async getWhatsappInstancias() {
    return this.client.get('/whatsapp/instancias');
  }
  async criarInstanciaWhatsapp(apelido: string) {
    return this.client.post('/whatsapp/instancias', { apelido });
  }
  async conectarInstanciaWhatsapp(id: string) {
    return this.client.post(`/whatsapp/instancias/${id}/conectar`);
  }
  async desconectarInstanciaWhatsapp(id: string) {
    return this.client.post(`/whatsapp/instancias/${id}/desconectar`);
  }
  async renomearInstanciaWhatsapp(id: string, apelido: string) {
    return this.client.patch(`/whatsapp/instancias/${id}`, { apelido });
  }
  async deletarInstanciaWhatsapp(id: string) {
    return this.client.delete(`/whatsapp/instancias/${id}`);
  }
  async excluirConversaWhatsapp(id: string) {
    return this.client.delete(`/whatsapp/conversas/${id}`);
  }
  async desvincularConversaFunil(id: string) {
    return this.client.post(`/whatsapp/conversas/${id}/desvincular`);
  }
  async agendarReuniaoWhatsapp(id: string, data: { data: string; duracao_minutos?: number; link?: string; titulo?: string; mensagem?: string }) {
    return this.client.post(`/whatsapp/conversas/${id}/reuniao`, data);
  }
  async vincularConversaCliente(id: string, data: { cliente_id: string; nome?: string; cargo?: string }) {
    return this.client.post(`/whatsapp/conversas/${id}/vincular-cliente`, data);
  }

  async abrirConversaWhatsapp(numero: string, nome?: string, lead_id?: string) {
    return this.client.post('/whatsapp/abrir', { numero, nome, lead_id });
  }
  async etiquetarConversa(id: string, etiqueta: string | null, etiqueta_cor?: string) {
    return this.client.patch(`/whatsapp/conversas/${id}/etiqueta`, { etiqueta, etiqueta_cor });
  }
  async transferirConversa(id: string, vendedor_id: string) {
    return this.client.post(`/whatsapp/conversas/${id}/transferir`, { vendedor_id });
  }
  async getWhatsappVendedores() {
    return this.client.get('/whatsapp/vendedores');
  }

  async getWhatsappMensagens(conversaId: string) {
    return this.client.get(`/whatsapp/conversas/${conversaId}/mensagens`);
  }

  async enviarWhatsappMensagem(conversaId: string, texto: string) {
    return this.client.post(`/whatsapp/conversas/${conversaId}/enviar`, { texto });
  }

  // Envia um áudio gravado no Inbox (mensagem de voz). audio_base64 = data URL ou base64 puro.
  async enviarWhatsappAudio(conversaId: string, audio_base64: string) {
    return this.client.post(`/whatsapp/conversas/${conversaId}/audio`, { audio_base64 });
  }

  // Forecast de receita ponderado
  async getForecast() {
    return this.client.get('/dashboard/forecast');
  }

  // Centro de custos comercial
  async getFinanceiroCategorias() {
    return this.client.get('/financeiro/categorias');
  }
  async getLancamentos(filtros?: { ano?: number; mes?: number; tipo?: string; categoria?: string }) {
    return this.client.get('/financeiro/lancamentos', { params: filtros || {} });
  }
  async createLancamento(data: any) {
    return this.client.post('/financeiro/lancamentos', data);
  }
  async deleteLancamento(id: string) {
    return this.client.delete(`/financeiro/lancamentos/${id}`);
  }
  async getFinanceiroResumo(ano: number, mes?: number) {
    return this.client.get('/financeiro/resumo', { params: mes ? { ano, mes } : { ano } });
  }

  // Balanço geral: venda comercial (contratos + vendas à base) × despesa do setor.
  async getFinanceiroBalanco(ano: number, mes?: number) {
    return this.client.get('/financeiro/balanco', { params: mes ? { ano, mes } : { ano } });
  }

  // Pesquisa de satisfação
  async responderPesquisa(data: any) {
    return this.client.post('/pesquisa/responder', data);
  }
  async getPesquisas(filtros?: { critico?: boolean; cliente_id?: string }) {
    return this.client.get('/pesquisa', { params: filtros || {} });
  }
  async getPesquisasCliente(clienteId: string) {
    return this.client.get(`/pesquisa/cliente/${clienteId}`);
  }
  async getPesquisasNaoCasadas() {
    return this.client.get('/pesquisa/nao-casadas');
  }

  // Relatório Comercial (CEO)
  async getRelatorioComercial(ano: number, mes: number) {
    return this.client.get('/relatorio-comercial', { params: { ano, mes } });
  }
  async getRelatorioMeses() {
    return this.client.get('/relatorio-comercial/meses');
  }
  // Série anual (evolução mês a mês) p/ os gráficos de tendência.
  async getRelatorioSerieAnual(ano: number) {
    return this.client.get('/relatorio-comercial/serie-anual', { params: { ano } });
  }
  // ── Painel Executivo do CEO ──
  async getPainelCEO(params: { periodo: string; ano: number; mes: number }) {
    return this.client.get('/ceo/painel', { params });
  }
  async getIndicadoresCEO(ano: number, mes: number) {
    return this.client.get('/ceo/indicadores', { params: { ano, mes } });
  }
  async salvarIndicadoresCEO(data: any) {
    return this.client.put('/ceo/indicadores', data);
  }
  // Módulo Comissões & Vendas (resumo executivo).
  async getComissoesVendasCEO(mes_pagamento?: string) {
    return this.client.get('/ceo/comissoes-vendas', { params: mes_pagamento ? { mes_pagamento } : {} });
  }
  async getVendasAdicionaisCEO(ano?: number) {
    return this.client.get('/ceo/vendas-adicionais', { params: ano ? { ano } : {} });
  }
  async salvarRelatorioComercial(data: any) {
    return this.client.put('/relatorio-comercial', data);
  }
  async vincularPesquisa(id: string, cliente_id: string) {
    return this.client.post(`/pesquisa/${id}/vincular`, { cliente_id });
  }
}

export const apiClient = new ApiClient();
