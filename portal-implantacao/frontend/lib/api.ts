// Cliente HTTP do portal. SSO: o token vem do CRM comercial — via ?token=... na
// URL (ao clicar no link do CRM) ou do localStorage. Guardamos em chave própria.
const API_URL = process.env.NEXT_PUBLIC_PORTAL_API_URL || 'http://localhost:3002';
const CRM_API_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'portal_token';

export function captarTokenDaUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const t = url.searchParams.get('token');
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
  }
}

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function req(path: string, opts: RequestInit = {}) {
  const t = token();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`);
  return data;
}

// Cliente para o backend do CRM principal (tickets, KB, CSAT)
async function crmReq(path: string, opts: RequestInit = {}) {
  const t = token();
  const res = await fetch(`${CRM_API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`);
  return data;
}

export const crmApi = {
  // Tickets
  getTickets: (params?: { status?: string; prioridade?: string }) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as any).toString();
    return crmReq(`/tickets${qs ? '?' + qs : ''}`);
  },
  createTicket: (body: any) => crmReq('/tickets', { method: 'POST', body: JSON.stringify(body) }),
  updateTicket: (id: string, body: any) => crmReq(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getClientes: () => crmReq('/clientes?limit=200'),

  // KB
  getKbArtigos: (params?: { busca?: string; categoria_id?: string; status?: string }) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as any).toString();
    return crmReq(`/kb/artigos${qs ? '?' + qs : ''}`);
  },
  getKbArtigo: (id: string) => crmReq(`/kb/artigos/${id}`),
  getKbCategorias: () => crmReq('/kb/categorias'),
  feedbackKbArtigo: (id: string, util: boolean) => crmReq(`/kb/artigos/${id}/feedback`, { method: 'POST', body: JSON.stringify({ util }) }),
};

export const api = {
  config: () => req('/config'),
  projetos: (params?: { funil?: string; status?: string; busca?: string }) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as any).toString();
    return req(`/projetos${qs ? '?' + qs : ''}`);
  },
  projeto: (id: string) => req(`/projetos/${id}`),
  criarProjeto: (body: any) => req('/projetos', { method: 'POST', body: JSON.stringify(body) }),
  editarProjeto: (id: string, body: any) => req(`/projetos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  moverProjeto: (id: string, fase: string) => req(`/projetos/${id}/mover`, { method: 'POST', body: JSON.stringify({ fase }) }),
  marcarChecklist: (itemId: string, concluido: boolean) => req(`/checklist/${itemId}`, { method: 'PATCH', body: JSON.stringify({ concluido }) }),
  dashboard: () => req('/dashboard'),
};
