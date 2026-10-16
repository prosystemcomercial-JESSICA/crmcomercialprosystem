// Link de descadastro dos e-mails da sequência (16/10/2026). O backend fica atrás de /api no domínio público
// (comercial.prosystemnet.com/api/...). Sem o /api o link caía numa página "não encontrada" do site e a pessoa
// não conseguia se descadastrar (obrigatório em e-mail marketing / LGPD).
export function urlDescadastro(base: string | null | undefined, leadSequenciaId: string): string {
  const raiz = (base || 'https://comercial.prosystemnet.com').trim().replace(/\/+$/, '');
  const api = /\/api$/.test(raiz) ? raiz : `${raiz}/api`;
  return `${api}/sequencias-email/descadastro/${encodeURIComponent(leadSequenciaId)}`;
}
