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

  // Cases endpoints
  async getCasos(page = 0, limit = 20, status?: string, risco_min?: number, risco_max?: number) {
    const params: any = { page, limit };
    if (status) params.status = status;
    if (risco_min !== undefined) params.risco_min = risco_min;
    if (risco_max !== undefined) params.risco_max = risco_max;

    return this.client.get('/casos-churn', { params });
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
  async getClientes(page = 0, limit = 20, search?: string) {
    const params: any = { page, limit };
    if (search) params.search = search;
    return this.client.get('/clientes', { params });
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

  async updateLead(id: string, data: any) {
    return this.client.patch(`/leads/${id}`, data);
  }

  async deleteLead(id: string) {
    return this.client.delete(`/leads/${id}`);
  }

  async getLeadsFunil() {
    return this.client.get('/leads/funil');
  }

  async getLeadsStats() {
    return this.client.get('/leads/stats/resumo');
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

  async concluirAtividade(id: string, data: { resultado: string; duracao_minutos?: number; data_realizada?: string }) {
    return this.client.post(`/atividades/${id}/concluir`, data);
  }

  async cancelarAtividade(id: string, motivo_cancelamento: string) {
    return this.client.post(`/atividades/${id}/cancelar`, { motivo_cancelamento });
  }

  async remarcarAtividade(id: string, data: { nova_data_remarcada: string; motivo?: string }) {
    return this.client.post(`/atividades/${id}/remarcar`, data);
  }

  async confirmarAtividade(id: string) {
    return this.client.post(`/atividades/${id}/confirmar`);
  }

  async criarMeetLink(atividadeId: string) {
    return this.client.post(`/atividades/${atividadeId}/criar-meet`);
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

  // Metas endpoints
  async getMetas(params?: { periodo?: string; responsavel_id?: string; tipo?: string }) {
    return this.client.get('/metas', { params });
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
  async getComissoes(params?: { responsavel_id?: string; periodo?: string; status?: string }) {
    return this.client.get('/comissoes', { params });
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

  // NPS
  async getNpsDashboard() {
    return this.client.get('/nps/dashboard');
  }

  // Dashboard Power
  async getDashboardPower() {
    return this.client.get('/dashboard/power');
  }
}

export const apiClient = new ApiClient();
