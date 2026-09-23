# Triagem automática no WhatsApp da empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Robô com botões que faz a triagem de todo número novo no WhatsApp da empresa, valida o CNPJ na Receita, preenche o lead e avisa o time com alarme sonoro.

**Architecture:** Quatro módulos puros e testáveis (`lib/cnpj.ts`, `lib/triagem/fluxo.ts`, `lib/triagem/desfecho.ts`, e o envio de menu no provider `services/evolution.service.ts`) e uma camada fina em `routes/whatsapp.ts` que executa as ações (envia, grava, atualiza lead/conversa, emite SSE). Configuração (liga/desliga e material) em `ConfiguracaoIntegracao`. Frontend: seção em Configurações, selos na tela do WhatsApp e alarme global no `DashboardLayout`.

**Tech Stack:** Fastify 4, Prisma 5 (MySQL), Zod, Vitest, Next.js (frontend — ler `frontend/AGENTS.md`), `fetch` nativo.

**Spec:** `docs/superpowers/specs/2026-09-23-whatsapp-triagem-automatica-design.md`

## Global Constraints

- Triagem só para conversa **nova** na instância **empresa** (`WhatsappInstancia.instancia_nome = 'empresa'`) e só com a triagem **ligada** em Configurações.
- Contato geral de Suporte e Financeiro: texto exato **27 99779-8103**.
- IDs das opções: `conhecer`, `servicos`, `suporte`, `financeiro`, `padaria`, `farmacia`, `cliente`, `ex_cliente`, `nao_conhece`, `cnpj_sim`, `cnpj_nao`.
- Menu inicial com 4 opções = `/send/menu` `type: "list"` (`listButton: "Ver opções"`); os demais = `type: "button"` (máx. 3).
- CNPJ: BrasilAPI `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` → fallback `https://open.cnpja.com/office/{cnpj}`; timeout 8000 ms por fonte.
- CNPJ não ATIVO é **aceito** e gera aviso vermelho; nunca bloqueia.
- Mensagens do robô: SAIDA com `enviada_por: 'bot'`.
- Mudanças de banco somente aditivas: `WhatsappConversa.bot_dados Json?`; `ConfiguracaoIntegracao.valor` TEXT → LONGTEXT.
- Chaves de configuração: `whatsapp.triagem.ativa` (`'true'|'false'`, padrão desligada), `whatsapp.triagem.material.farmacia`, `whatsapp.triagem.material.padaria` (JSON).
- Testes novos importam por caminho relativo `../src/...`; `fetch` sempre mockado; nunca chamar UAZAPI/BrasilAPI reais em teste.
- Nunca `git stash`; `git add` por caminho explícito; commits em português terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Cliente manda **áudio, figurinha ou foto** num passo que espera texto ou botão → o robô repete a pergunta, não quebra nem avança. (Task 3, teste "entrada sem texto")
2. CNPJ digitado **com pontuação ou junto de outras palavras** ("meu cnpj é 11.222.333/0001-81") → extrair os 14 dígitos e aceitar. (Task 1 e Task 3)
3. Cliente escreve **de novo depois que a triagem terminou** → o robô não recomeça. (Task 5, `bot_ativo=false` ao fim; Task 3 estado `FIM` não gera ação)
4. **Receita lenta ou fora do ar** → o cliente não fica sem resposta: cai no fallback e, se tudo falhar, segue sem confirmação. (Task 1 timeout; Task 3 `indisponivel`)
5. **Vendedor responde no meio da triagem** → o robô para naquela conversa e não manda mais nada. (Task 5, steps de "parar robô")

---

### Task 1: Validação e consulta de CNPJ (`lib/cnpj.ts`)

**Files:**
- Create: `backend/src/lib/cnpj.ts`
- Test: `backend/tests/cnpj.test.ts`

**Interfaces — Produces:**
```ts
export function extrairCnpj(texto: string): string | null            // 14 dígitos encontrados no texto
export function cnpjValido(cnpj: string): boolean                      // dígitos verificadores
export function formatarCnpj(cnpj: string): string                     // 11.222.333/0001-81
export type SocioReceita = { nome: string; qualificacao: string | null };
export type DadosReceita = {
  cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  situacao: string | null; data_situacao: string | null;
  cnae_principal: { codigo: string; descricao: string } | null;
  cnaes_secundarios: { codigo: string; descricao: string }[];
  porte: string | null; natureza_juridica: string | null; data_abertura: string | null;
  capital_social: number | null; email: string | null; telefones: string[];
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cep: string | null; municipio: string | null; uf: string | null;
  socios: SocioReceita[]; simples: boolean | null; mei: boolean | null;
};
export type ConsultaCnpj =
  | { status: 'encontrado'; dados: DadosReceita; fonte: 'BrasilAPI' | 'CNPJá' }
  | { status: 'nao_encontrado' }
  | { status: 'indisponivel' };
export function deBrasilApi(json: any): DadosReceita
export function deCnpja(json: any): DadosReceita
export async function consultarCnpj(cnpj: string, fetchImpl?: typeof fetch): Promise<ConsultaCnpj>
export function situacaoAtiva(dados: DadosReceita | null | undefined): boolean
export function enderecoCompleto(d: DadosReceita): string
```

- [ ] **Step 1: Conferir o formato real da CNPJá (sem salvar nada)**

Run: `curl -s -m 20 https://open.cnpja.com/office/00000000000191 | head -c 1500`
Expected: JSON com `taxId`, `alias`, `founded`, `status.text`, `statusDate`, `company.name`, `company.equity`, `company.nature.text`, `company.size.text`, `company.members[].person.name`, `company.members[].role.text`, `company.simples.optant`, `company.simei.optant`, `address.{street,number,details,district,zip,city,state}`, `phones[].{area,number}`, `emails[].address`, `mainActivity.{id,text}`, `sideActivities[]`. Se algum nome diferir, ajustar `deCnpja` e o teste de acordo e anotar no relatório.

- [ ] **Step 2: Escrever o teste que falha**

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  extrairCnpj, cnpjValido, formatarCnpj, deBrasilApi, deCnpja, consultarCnpj, situacaoAtiva, enderecoCompleto,
} from '../src/lib/cnpj';

const BRASILAPI = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE',
  descricao_situacao_cadastral: 'ATIVA', data_situacao_cadastral: '2010-05-01',
  cnae_fiscal: 1091102, cnae_fiscal_descricao: 'Fabricação de produtos de padaria e confeitaria',
  cnaes_secundarios: [{ codigo: 4721102, descricao: 'Padaria e confeitaria com predominância de revenda' }, { codigo: 0, descricao: '' }],
  porte: 'MICRO EMPRESA', natureza_juridica: 'Sociedade Empresária Limitada', data_inicio_atividade: '2010-05-01',
  capital_social: 50000, email: 'contato@paoquente.com', ddd_telefone_1: '2733334444', ddd_telefone_2: '',
  descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '100', complemento: 'LOJA 2', bairro: 'CENTRO',
  cep: '29100000', municipio: 'VILA VELHA', uf: 'ES',
  qsa: [{ nome_socio: 'MARIA DA SILVA', qualificacao_socio: 'Sócio-Administrador' }],
  opcao_pelo_simples: true, opcao_pelo_mei: false,
};

const CNPJA = {
  taxId: '11222333000181', alias: 'PAO QUENTE', founded: '2010-05-01',
  status: { id: 2, text: 'Ativa' }, statusDate: '2010-05-01',
  company: {
    name: 'PADARIA PAO QUENTE LTDA', equity: 50000, nature: { text: 'Sociedade Empresária Limitada' }, size: { text: 'Microempresa' },
    members: [{ person: { name: 'MARIA DA SILVA' }, role: { text: 'Sócio-Administrador' } }],
    simples: { optant: true }, simei: { optant: false },
  },
  address: { street: 'Rua das Flores', number: '100', details: 'Loja 2', district: 'Centro', zip: '29100000', city: 'Vila Velha', state: 'ES' },
  phones: [{ area: '27', number: '33334444' }], emails: [{ address: 'contato@paoquente.com' }],
  mainActivity: { id: 1091102, text: 'Fabricação de produtos de padaria e confeitaria' },
  sideActivities: [{ id: 4721102, text: 'Padaria e confeitaria com predominância de revenda' }],
};

function resposta(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

describe('extrairCnpj / cnpjValido / formatarCnpj', () => {
  it('extrai 14 dígitos de texto com pontuação e palavras', () => {
    expect(extrairCnpj('meu cnpj é 11.222.333/0001-81 ok')).toBe('11222333000181');
  });
  it('devolve null sem 14 dígitos', () => {
    expect(extrairCnpj('123')).toBeNull();
    expect(extrairCnpj('')).toBeNull();
  });
  it('valida dígitos verificadores', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false);
  });
  it('formata', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('deBrasilApi', () => {
  it('mapeia todos os campos', () => {
    const d = deBrasilApi(BRASILAPI);
    expect(d).toMatchObject({
      cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE',
      situacao: 'ATIVA', data_situacao: '2010-05-01',
      cnae_principal: { codigo: '1091102', descricao: 'Fabricação de produtos de padaria e confeitaria' },
      porte: 'MICRO EMPRESA', natureza_juridica: 'Sociedade Empresária Limitada', data_abertura: '2010-05-01',
      capital_social: 50000, email: 'contato@paoquente.com', telefones: ['2733334444'],
      logradouro: 'RUA DAS FLORES', numero: '100', complemento: 'LOJA 2', bairro: 'CENTRO', cep: '29100000',
      municipio: 'VILA VELHA', uf: 'ES', simples: true, mei: false,
    });
    expect(d.cnaes_secundarios).toEqual([{ codigo: '4721102', descricao: 'Padaria e confeitaria com predominância de revenda' }]);
    expect(d.socios).toEqual([{ nome: 'MARIA DA SILVA', qualificacao: 'Sócio-Administrador' }]);
  });
});

describe('deCnpja', () => {
  it('mapeia para o mesmo formato, situação em maiúsculas', () => {
    const d = deCnpja(CNPJA);
    expect(d).toMatchObject({
      cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
      cnae_principal: { codigo: '1091102', descricao: 'Fabricação de produtos de padaria e confeitaria' },
      porte: 'Microempresa', capital_social: 50000, telefones: ['2733334444'], municipio: 'Vila Velha', uf: 'ES',
      simples: true, mei: false,
    });
    expect(d.socios).toEqual([{ nome: 'MARIA DA SILVA', qualificacao: 'Sócio-Administrador' }]);
  });
});

describe('consultarCnpj', () => {
  it('usa a BrasilAPI quando responde', async () => {
    const f = vi.fn().mockResolvedValue(resposta(200, BRASILAPI));
    const r = await consultarCnpj('11222333000181', f as any);
    expect(r.status).toBe('encontrado');
    if (r.status === 'encontrado') expect(r.fonte).toBe('BrasilAPI');
    expect(f.mock.calls[0][0]).toBe('https://brasilapi.com.br/api/cnpj/v1/11222333000181');
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('cai na CNPJá se a BrasilAPI falhar', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(resposta(500, {}))
      .mockResolvedValueOnce(resposta(200, CNPJA));
    const r = await consultarCnpj('11222333000181', f as any);
    expect(r.status === 'encontrado' && r.fonte).toBe('CNPJá');
    expect(f.mock.calls[1][0]).toBe('https://open.cnpja.com/office/11222333000181');
  });
  it('nao_encontrado quando as fontes respondem 404', async () => {
    const f = vi.fn().mockResolvedValue(resposta(404, {}));
    expect((await consultarCnpj('11222333000181', f as any)).status).toBe('nao_encontrado');
  });
  it('indisponivel quando as duas dão erro de rede', async () => {
    const f = vi.fn().mockRejectedValue(new Error('timeout'));
    expect((await consultarCnpj('11222333000181', f as any)).status).toBe('indisponivel');
  });
  it('404 numa e erro na outra conta como indisponivel (não afirma que não existe)', async () => {
    const f = vi.fn().mockResolvedValueOnce(resposta(404, {})).mockRejectedValueOnce(new Error('x'));
    expect((await consultarCnpj('11222333000181', f as any)).status).toBe('indisponivel');
  });
});

describe('situacaoAtiva / enderecoCompleto', () => {
  it('ATIVA é ativa; BAIXADA não; null não', () => {
    expect(situacaoAtiva(deBrasilApi(BRASILAPI))).toBe(true);
    expect(situacaoAtiva({ ...deBrasilApi(BRASILAPI), situacao: 'BAIXADA' })).toBe(false);
    expect(situacaoAtiva(null)).toBe(false);
  });
  it('monta endereço sem partes vazias', () => {
    expect(enderecoCompleto(deBrasilApi(BRASILAPI))).toBe('RUA DAS FLORES, 100, LOJA 2 - CENTRO - VILA VELHA/ES - CEP 29100-000');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/cnpj.test.ts`
Expected: FAIL — `Failed to load url ../src/lib/cnpj`.

- [ ] **Step 4: Implementar**

```ts
// Validação de CNPJ e consulta pública à Receita (BrasilAPI, com CNPJá de reserva).

export type SocioReceita = { nome: string; qualificacao: string | null };
export type DadosReceita = {
  cnpj: string; razao_social: string | null; nome_fantasia: string | null;
  situacao: string | null; data_situacao: string | null;
  cnae_principal: { codigo: string; descricao: string } | null;
  cnaes_secundarios: { codigo: string; descricao: string }[];
  porte: string | null; natureza_juridica: string | null; data_abertura: string | null;
  capital_social: number | null; email: string | null; telefones: string[];
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cep: string | null; municipio: string | null; uf: string | null;
  socios: SocioReceita[]; simples: boolean | null; mei: boolean | null;
};
export type ConsultaCnpj =
  | { status: 'encontrado'; dados: DadosReceita; fonte: 'BrasilAPI' | 'CNPJá' }
  | { status: 'nao_encontrado' }
  | { status: 'indisponivel' };

const TIMEOUT_MS = 8000;

export function extrairCnpj(texto: string): string | null {
  const digitos = (texto || '').replace(/\D/g, '');
  const m = digitos.match(/\d{14}/);
  return m ? m[0] : null;
}

export function cnpjValido(cnpj: string): boolean {
  const c = (cnpj || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(c.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return c.endsWith(`${d1}${d2}`);
}

export function formatarCnpj(cnpj: string): string {
  const c = (cnpj || '').replace(/\D/g, '');
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

const txt = (v: any): string | null => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

export function deBrasilApi(j: any): DadosReceita {
  const tipoLog = txt(j?.descricao_tipo_de_logradouro);
  const log = txt(j?.logradouro);
  return {
    cnpj: String(j?.cnpj || '').replace(/\D/g, ''),
    razao_social: txt(j?.razao_social),
    nome_fantasia: txt(j?.nome_fantasia),
    situacao: txt(j?.descricao_situacao_cadastral)?.toUpperCase() || null,
    data_situacao: txt(j?.data_situacao_cadastral),
    cnae_principal: j?.cnae_fiscal ? { codigo: String(j.cnae_fiscal), descricao: txt(j?.cnae_fiscal_descricao) || '' } : null,
    cnaes_secundarios: (j?.cnaes_secundarios || [])
      .filter((c: any) => c?.codigo && txt(c?.descricao))
      .map((c: any) => ({ codigo: String(c.codigo), descricao: String(c.descricao) })),
    porte: txt(j?.porte),
    natureza_juridica: txt(j?.natureza_juridica),
    data_abertura: txt(j?.data_inicio_atividade),
    capital_social: typeof j?.capital_social === 'number' ? j.capital_social : null,
    email: txt(j?.email),
    telefones: [j?.ddd_telefone_1, j?.ddd_telefone_2].map(t => String(t || '').replace(/\D/g, '')).filter(t => t.length >= 10),
    logradouro: log ? (tipoLog && !log.toUpperCase().startsWith(tipoLog.toUpperCase()) ? `${tipoLog} ${log}` : log) : null,
    numero: txt(j?.numero),
    complemento: txt(j?.complemento),
    bairro: txt(j?.bairro),
    cep: txt(j?.cep)?.replace(/\D/g, '') || null,
    municipio: txt(j?.municipio),
    uf: txt(j?.uf),
    socios: (j?.qsa || []).filter((s: any) => txt(s?.nome_socio)).map((s: any) => ({ nome: String(s.nome_socio), qualificacao: txt(s?.qualificacao_socio) })),
    simples: typeof j?.opcao_pelo_simples === 'boolean' ? j.opcao_pelo_simples : null,
    mei: typeof j?.opcao_pelo_mei === 'boolean' ? j.opcao_pelo_mei : null,
  };
}

export function deCnpja(j: any): DadosReceita {
  const a = j?.address || {};
  const empresa = j?.company || {};
  return {
    cnpj: String(j?.taxId || '').replace(/\D/g, ''),
    razao_social: txt(empresa?.name),
    nome_fantasia: txt(j?.alias),
    situacao: txt(j?.status?.text)?.toUpperCase() || null,
    data_situacao: txt(j?.statusDate),
    cnae_principal: j?.mainActivity?.id ? { codigo: String(j.mainActivity.id), descricao: txt(j.mainActivity.text) || '' } : null,
    cnaes_secundarios: (j?.sideActivities || [])
      .filter((c: any) => c?.id && txt(c?.text))
      .map((c: any) => ({ codigo: String(c.id), descricao: String(c.text) })),
    porte: txt(empresa?.size?.text),
    natureza_juridica: txt(empresa?.nature?.text),
    data_abertura: txt(j?.founded),
    capital_social: typeof empresa?.equity === 'number' ? empresa.equity : null,
    email: txt(j?.emails?.[0]?.address),
    telefones: (j?.phones || []).map((p: any) => `${p?.area || ''}${p?.number || ''}`.replace(/\D/g, '')).filter((t: string) => t.length >= 10),
    logradouro: txt(a.street),
    numero: txt(a.number),
    complemento: txt(a.details),
    bairro: txt(a.district),
    cep: txt(a.zip)?.replace(/\D/g, '') || null,
    municipio: txt(a.city),
    uf: txt(a.state),
    socios: (empresa?.members || []).filter((m: any) => txt(m?.person?.name)).map((m: any) => ({ nome: String(m.person.name), qualificacao: txt(m?.role?.text) })),
    simples: typeof empresa?.simples?.optant === 'boolean' ? empresa.simples.optant : null,
    mei: typeof empresa?.simei?.optant === 'boolean' ? empresa.simei.optant : null,
  };
}

type Tentativa = { tipo: 'ok'; json: any } | { tipo: '404' } | { tipo: 'erro' };

async function tentar(url: string, fetchImpl: typeof fetch): Promise<Tentativa> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res: any = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
    if (res.status === 404) return { tipo: '404' };
    if (!res.ok) return { tipo: 'erro' };
    return { tipo: 'ok', json: await res.json() };
  } catch {
    return { tipo: 'erro' };
  } finally {
    clearTimeout(timer);
  }
}

export async function consultarCnpj(cnpj: string, fetchImpl: typeof fetch = fetch): Promise<ConsultaCnpj> {
  const c = cnpj.replace(/\D/g, '');
  const b = await tentar(`https://brasilapi.com.br/api/cnpj/v1/${c}`, fetchImpl);
  if (b.tipo === 'ok') return { status: 'encontrado', dados: deBrasilApi(b.json), fonte: 'BrasilAPI' };
  const r = await tentar(`https://open.cnpja.com/office/${c}`, fetchImpl);
  if (r.tipo === 'ok') return { status: 'encontrado', dados: deCnpja(r.json), fonte: 'CNPJá' };
  if (b.tipo === '404' && r.tipo === '404') return { status: 'nao_encontrado' };
  return { status: 'indisponivel' };
}

export function situacaoAtiva(dados: DadosReceita | null | undefined): boolean {
  return (dados?.situacao || '').toUpperCase() === 'ATIVA';
}

export function enderecoCompleto(d: DadosReceita): string {
  const cep = d.cep && d.cep.length === 8 ? `${d.cep.slice(0, 5)}-${d.cep.slice(5)}` : d.cep;
  const rua = [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', ');
  const cidade = [d.municipio, d.uf].filter(Boolean).join('/');
  return [rua, d.bairro, cidade, cep ? `CEP ${cep}` : null].filter(Boolean).join(' - ');
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/cnpj.test.ts`
Expected: PASS (14 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cnpj.ts backend/tests/cnpj.test.ts
git commit -m "feat(whatsapp): validação e consulta de CNPJ na Receita (BrasilAPI + CNPJá)"
```

---

### Task 2: Envio de menu com botões/lista e leitura do botão clicado

**Files:**
- Modify: `backend/src/services/evolution.service.ts` (nova função antes de `idDaMensagemEnviada`)
- Modify: `backend/src/lib/uazapi-webhook-parser.ts` (`EventoMensagemUazapi.botao_id` e extração)
- Test: `backend/tests/evolution.service.test.ts`, `backend/tests/uazapi-webhook-parser.test.ts`

**Interfaces — Produces:**
```ts
// evolution.service.ts
export type OpcaoMenu = { id: string; texto: string; descricao?: string };
export type MenuWhatsapp =
  | { modo: 'button'; texto: string; opcoes: OpcaoMenu[]; rodape?: string }
  | { modo: 'list'; texto: string; opcoes: OpcaoMenu[]; botaoLista: string; secao: string; rodape?: string };
export async function enviarMenu(instanceToken: string, numero: string, menu: MenuWhatsapp): Promise<{ externo_id?: string }>
// parser: EventoMensagemUazapi ganha
botao_id?: string   // id da opção clicada (buttonOrListid), quando houver
```

- [ ] **Step 1: Testes que falham** — acrescentar em `backend/tests/evolution.service.test.ts`, antes de `describe('configurarWebhook'`:

```ts
describe('enviarMenu', () => {
  it('botões: choices "Texto|id" e footerText', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'm-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await evo.enviarMenu('tok', '27999998888', {
      modo: 'button', texto: 'Qual o segmento?', rodape: 'Prosystem',
      opcoes: [{ id: 'padaria', texto: 'Padaria' }, { id: 'farmacia', texto: 'Farmácia' }],
    });
    expect(r.externo_id).toBe('m-1');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exemplo.uazapi.test/send/menu');
    expect(JSON.parse(opts.body)).toEqual({
      number: '5527999998888', type: 'button', text: 'Qual o segmento?',
      choices: ['Padaria|padaria', 'Farmácia|farmacia'], footerText: 'Prosystem',
    });
  });

  it('lista: seção, "texto|id|descrição" e listButton', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk({ messageid: 'm-2' }));
    vi.stubGlobal('fetch', fetchMock);
    await evo.enviarMenu('tok', '5527999998888', {
      modo: 'list', texto: 'Como podemos ajudar?', botaoLista: 'Ver opções', secao: 'Atendimento',
      opcoes: [{ id: 'conhecer', texto: 'Quero conhecer', descricao: 'Conheça nossos sistemas' }, { id: 'suporte', texto: 'Suporte' }],
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      number: '5527999998888', type: 'list', text: 'Como podemos ajudar?', listButton: 'Ver opções',
      choices: ['[Atendimento]', 'Quero conhecer|conhecer|Conheça nossos sistemas', 'Suporte|suporte'],
    });
  });
});
```

E em `backend/tests/uazapi-webhook-parser.test.ts`, dentro do `describe` principal:

```ts
  it('lê o id do botão clicado em buttonOrListid', () => {
    const payload = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', messageType: 'ButtonsResponseMessage', text: 'Farmácia', buttonOrListid: 'farmacia', messageid: 'b-1' } };
    expect(parseUazapiEvento(payload)).toMatchObject({ tipo: 'mensagem_recebida', texto: 'Farmácia', botao_id: 'farmacia' });
  });

  it('lê o id do item de lista quando só vem no content', () => {
    const payload = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', messageType: 'ListResponseMessage', text: 'Suporte', content: { singleSelectReply: { selectedRowID: 'suporte' } } } };
    expect(parseUazapiEvento(payload)).toMatchObject({ botao_id: 'suporte' });
  });

  it('mensagem comum não tem botao_id', () => {
    const payload = { EventType: 'messages', message: { chatid: '5527999998888@s.whatsapp.net', text: 'oi' } };
    expect((parseUazapiEvento(payload) as any).botao_id).toBeUndefined();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/evolution.service.test.ts tests/uazapi-webhook-parser.test.ts`
Expected: FAIL — `enviarMenu is not a function` e `botao_id` ausente.

- [ ] **Step 3: Implementar** — em `evolution.service.ts`, antes de `function idDaMensagemEnviada`:

```ts
export type OpcaoMenu = { id: string; texto: string; descricao?: string };
export type MenuWhatsapp =
  | { modo: 'button'; texto: string; opcoes: OpcaoMenu[]; rodape?: string }
  | { modo: 'list'; texto: string; opcoes: OpcaoMenu[]; botaoLista: string; secao: string; rodape?: string };

/** Menu interativo via POST /send/menu: botões (até 3) ou lista (4+ opções). */
export async function enviarMenu(instanceToken: string, numero: string, menu: MenuWhatsapp): Promise<{ externo_id?: string }> {
  const corpo: any = { number: normalizarNumero(numero), type: menu.modo, text: menu.texto };
  if (menu.modo === 'button') {
    corpo.choices = menu.opcoes.map(o => `${o.texto}|${o.id}`);
  } else {
    corpo.listButton = menu.botaoLista;
    corpo.choices = [`[${menu.secao}]`, ...menu.opcoes.map(o => (o.descricao ? `${o.texto}|${o.id}|${o.descricao}` : `${o.texto}|${o.id}`))];
  }
  if (menu.rodape) corpo.footerText = menu.rodape;
  const data = await call('/send/menu', 'POST', instanceToken, corpo);
  return { externo_id: idDaMensagemEnviada(data) };
}
```

No parser, em `EventoMensagemUazapi` acrescentar `botao_id?: string;` e, em `parseUazapiEvento`, antes do `return` final:

```ts
  const content = msg.content && typeof msg.content === 'object' ? msg.content : null;
  const botao_id: string | undefined =
    (typeof msg.buttonOrListid === 'string' && msg.buttonOrListid) ||
    content?.selectedButtonID || content?.selectedButtonId ||
    content?.singleSelectReply?.selectedRowID || content?.singleSelectReply?.selectedRowId ||
    undefined;
```
e incluir `...(botao_id ? { botao_id } : {})` no objeto retornado.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/evolution.service.test.ts tests/uazapi-webhook-parser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/evolution.service.ts backend/src/lib/uazapi-webhook-parser.ts backend/tests/evolution.service.test.ts backend/tests/uazapi-webhook-parser.test.ts
git commit -m "feat(whatsapp): envio de menu com botões/lista e leitura do botão clicado"
```

---

### Task 3: Roteiro da triagem (`lib/triagem/fluxo.ts`)

**Files:**
- Create: `backend/src/lib/triagem/fluxo.ts`
- Test: `backend/tests/triagem-fluxo.test.ts`

**Interfaces:**
- Consumes: `extrairCnpj`, `cnpjValido`, `ConsultaCnpj`, `DadosReceita` (Task 1); `MenuWhatsapp` (Task 2).
- Produces:
```ts
export type EstadoTriagem = 'MENU' | 'MENU_CLIENTE' | 'SERVICO' | 'SEGMENTO' | 'RELACAO' | 'NOME' | 'CIDADE' | 'CNPJ' | 'CNPJ_CONFIRMA' | 'FIM';
export const ESTADOS_TRIAGEM: EstadoTriagem[];
export type DadosTriagem = {
  fluxo?: 'conhecer' | 'servicos' | 'suporte' | 'financeiro';
  segmento?: 'Padaria' | 'Farmácia';
  relacao?: 'cliente' | 'ex_cliente' | 'nao_conhece';
  nome?: string; cidade?: string; servico?: string;
  cnpj?: string; receita?: DadosReceita | null; receita_fonte?: string | null;
};
export type Acao = { tipo: 'texto'; texto: string } | { tipo: 'menu'; menu: MenuWhatsapp } | { tipo: 'material'; segmento: 'Padaria' | 'Farmácia' };
export type Desfecho = 'qualificado' | 'servicos' | 'suporte' | 'financeiro';
export type ResultadoPasso = { estado: EstadoTriagem; dados: DadosTriagem; acoes: Acao[]; desfecho?: Desfecho };
export type DepsTriagem = { consultarCnpj: (cnpj: string) => Promise<ConsultaCnpj>; temMaterial: (segmento: 'Padaria' | 'Farmácia') => boolean };
export const CONTATO_GERAL = '27 99779-8103';
export function iniciarTriagem(ctx: { clienteNome?: string | null }): ResultadoPasso
export async function avancarTriagem(estado: EstadoTriagem, dados: DadosTriagem, entrada: { texto: string; botaoId?: string | null }, deps: DepsTriagem): Promise<ResultadoPasso>
```

- [ ] **Step 1: Teste que falha** — `backend/tests/triagem-fluxo.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { iniciarTriagem, avancarTriagem, CONTATO_GERAL, DepsTriagem } from '../src/lib/triagem/fluxo';
import type { DadosReceita } from '../src/lib/cnpj';

const RECEITA: DadosReceita = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
  data_situacao: null, cnae_principal: null, cnaes_secundarios: [], porte: null, natureza_juridica: null,
  data_abertura: null, capital_social: null, email: null, telefones: [], logradouro: null, numero: null,
  complemento: null, bairro: null, cep: null, municipio: 'VILA VELHA', uf: 'ES', socios: [], simples: null, mei: null,
};

function deps(over: Partial<DepsTriagem> = {}): DepsTriagem {
  return {
    consultarCnpj: vi.fn().mockResolvedValue({ status: 'encontrado', dados: RECEITA, fonte: 'BrasilAPI' }),
    temMaterial: () => false,
    ...over,
  };
}

const textos = (acoes: any[]) => acoes.map(a => (a.tipo === 'texto' ? a.texto : a.tipo === 'menu' ? a.menu.texto : `material:${a.segmento}`)).join('\n');

describe('iniciarTriagem', () => {
  it('número novo recebe menu de lista com 4 opções', () => {
    const r = iniciarTriagem({});
    expect(r.estado).toBe('MENU');
    const menu = (r.acoes[0] as any).menu;
    expect(menu.modo).toBe('list');
    expect(menu.botaoLista).toBe('Ver opções');
    expect(menu.opcoes.map((o: any) => o.id)).toEqual(['conhecer', 'servicos', 'suporte', 'financeiro']);
  });
  it('cliente da base recebe 3 botões com o nome', () => {
    const r = iniciarTriagem({ clienteNome: 'Padaria Sol' });
    expect(r.estado).toBe('MENU_CLIENTE');
    const menu = (r.acoes[0] as any).menu;
    expect(menu.modo).toBe('button');
    expect(menu.texto).toContain('Padaria Sol');
    expect(menu.opcoes.map((o: any) => o.id)).toEqual(['servicos', 'suporte', 'financeiro']);
  });
});

describe('suporte e financeiro', () => {
  it('suporte informa o contato geral e encerra', async () => {
    const r = await avancarTriagem('MENU', {}, { texto: 'Suporte', botaoId: 'suporte' }, deps());
    expect(r.estado).toBe('FIM');
    expect(r.desfecho).toBe('suporte');
    expect(textos(r.acoes)).toContain(CONTATO_GERAL);
  });
  it('financeiro a partir do menu de cliente', async () => {
    const r = await avancarTriagem('MENU_CLIENTE', {}, { texto: 'Financeiro', botaoId: 'financeiro' }, deps());
    expect(r.desfecho).toBe('financeiro');
    expect(textos(r.acoes)).toContain(CONTATO_GERAL);
  });
});

describe('serviços', () => {
  it('pergunta o serviço, depois encerra com o pedido', async () => {
    const a = await avancarTriagem('MENU', {}, { texto: 'Serviços', botaoId: 'servicos' }, deps());
    expect(a.estado).toBe('SERVICO');
    const b = await avancarTriagem('SERVICO', a.dados, { texto: 'Preciso de treinamento para 2 caixas' }, deps());
    expect(b.estado).toBe('FIM');
    expect(b.desfecho).toBe('servicos');
    expect(b.dados.servico).toBe('Preciso de treinamento para 2 caixas');
  });
  it('descrição vazia repete a pergunta', async () => {
    const r = await avancarTriagem('SERVICO', { fluxo: 'servicos' }, { texto: '' }, deps());
    expect(r.estado).toBe('SERVICO');
  });
});

describe('quero conhecer — caminho completo', () => {
  it('segmento → relação → nome → cidade → CNPJ → confirma → fim', async () => {
    const d = deps();
    let r = await avancarTriagem('MENU', {}, { texto: 'Quero conhecer', botaoId: 'conhecer' }, d);
    expect(r.estado).toBe('SEGMENTO');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'Farmácia', botaoId: 'farmacia' }, d);
    expect(r.estado).toBe('RELACAO');
    expect(r.dados.segmento).toBe('Farmácia');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'Não conheço a Prosystem', botaoId: 'nao_conhece' }, d);
    expect(r.estado).toBe('NOME');
    r = await avancarTriagem(r.estado, r.dados, { texto: '  Maria  ' }, d);
    expect(r.estado).toBe('CIDADE');
    expect(r.dados.nome).toBe('Maria');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'Vila Velha' }, d);
    expect(r.estado).toBe('CNPJ');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'é 11.222.333/0001-81' }, d);
    expect(r.estado).toBe('CNPJ_CONFIRMA');
    expect((r.acoes[0] as any).menu.texto).toContain('PAO QUENTE');
    expect((r.acoes[0] as any).menu.texto).toContain('VILA VELHA/ES');
    r = await avancarTriagem(r.estado, r.dados, { texto: 'Sim', botaoId: 'cnpj_sim' }, d);
    expect(r.estado).toBe('FIM');
    expect(r.desfecho).toBe('qualificado');
    expect(r.dados.cnpj).toBe('11222333000181');
    expect(r.dados.receita_fonte).toBe('BrasilAPI');
    expect(textos(r.acoes)).toContain('Obrigado, Maria');
    expect(textos(r.acoes)).not.toContain('ferramentas');
  });

  it('com material cadastrado, manda o texto de ferramentas e a ação de material do segmento', async () => {
    const d = deps({ temMaterial: () => true });
    const r = await avancarTriagem('CNPJ_CONFIRMA', { fluxo: 'conhecer', segmento: 'Padaria', nome: 'João', cnpj: '11222333000181', receita: RECEITA }, { texto: 'Sim', botaoId: 'cnpj_sim' }, d);
    expect(textos(r.acoes)).toContain('ferramentas');
    expect(textos(r.acoes)).toContain('padaria');
    expect(r.acoes.some(a => a.tipo === 'material' && a.segmento === 'Padaria')).toBe(true);
  });

  it('"Não, digitar de novo" volta a pedir o CNPJ', async () => {
    const r = await avancarTriagem('CNPJ_CONFIRMA', { fluxo: 'conhecer', cnpj: '11222333000181', receita: RECEITA }, { texto: 'Não', botaoId: 'cnpj_nao' }, deps());
    expect(r.estado).toBe('CNPJ');
    expect(r.dados.cnpj).toBeUndefined();
    expect(r.dados.receita).toBeUndefined();
  });

  it('CNPJ inválido não avança e não consulta', async () => {
    const d = deps();
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer' }, { texto: '11.222.333/0001-82' }, d);
    expect(r.estado).toBe('CNPJ');
    expect(d.consultarCnpj).not.toHaveBeenCalled();
    expect(textos(r.acoes).toLowerCase()).toContain('não parece válido');
  });

  it('CNPJ não encontrado na Receita pede de novo', async () => {
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer' }, { texto: '11222333000181' }, deps({ consultarCnpj: vi.fn().mockResolvedValue({ status: 'nao_encontrado' }) }));
    expect(r.estado).toBe('CNPJ');
    expect(textos(r.acoes)).toContain('Não encontramos');
  });

  it('Receita indisponível: aceita o CNPJ válido e encerra sem confirmação', async () => {
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer', nome: 'Ana', segmento: 'Farmácia' }, { texto: '11222333000181' }, deps({ consultarCnpj: vi.fn().mockResolvedValue({ status: 'indisponivel' }) }));
    expect(r.estado).toBe('FIM');
    expect(r.desfecho).toBe('qualificado');
    expect(r.dados.receita).toBeNull();
    expect(r.dados.cnpj).toBe('11222333000181');
  });

  it('CNPJ baixado é aceito (aviso é interno, não para o cliente)', async () => {
    const baixada = { ...RECEITA, situacao: 'BAIXADA' };
    const r = await avancarTriagem('CNPJ', { fluxo: 'conhecer' }, { texto: '11222333000181' }, deps({ consultarCnpj: vi.fn().mockResolvedValue({ status: 'encontrado', dados: baixada, fonte: 'BrasilAPI' }) }));
    expect(r.estado).toBe('CNPJ_CONFIRMA');
    expect(textos(r.acoes)).not.toContain('BAIXADA');
  });
});

describe('texto em vez de clique e entradas inválidas', () => {
  it('aceita número da opção e texto sem acento', async () => {
    expect((await avancarTriagem('MENU', {}, { texto: '1' }, deps())).estado).toBe('SEGMENTO');
    expect((await avancarTriagem('SEGMENTO', { fluxo: 'conhecer' }, { texto: 'farmacia' }, deps())).dados.segmento).toBe('Farmácia');
    expect((await avancarTriagem('MENU', {}, { texto: 'quero falar com o suporte' }, deps())).desfecho).toBe('suporte');
  });
  it('resposta que não casa repete o mesmo menu com aviso', async () => {
    const r = await avancarTriagem('SEGMENTO', { fluxo: 'conhecer' }, { texto: 'mercado' }, deps());
    expect(r.estado).toBe('SEGMENTO');
    expect(textos(r.acoes)).toContain('escolha uma das opções');
    expect(r.acoes.some(a => a.tipo === 'menu')).toBe(true);
  });
  it('entrada sem texto (áudio/figurinha) num passo de texto repete a pergunta', async () => {
    const r = await avancarTriagem('NOME', { fluxo: 'conhecer' }, { texto: '[áudio]' }, deps());
    expect(r.estado).toBe('NOME');
  });
  it('estado FIM não gera ação', async () => {
    const r = await avancarTriagem('FIM', { fluxo: 'suporte' }, { texto: 'oi de novo' }, deps());
    expect(r.estado).toBe('FIM');
    expect(r.acoes).toEqual([]);
    expect(r.desfecho).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/triagem-fluxo.test.ts`
Expected: FAIL — `Failed to load url ../src/lib/triagem/fluxo`.

- [ ] **Step 3: Implementar** — `backend/src/lib/triagem/fluxo.ts`:

```ts
// Roteiro da triagem automática do WhatsApp da empresa. Puro: recebe o estado,
// os dados coletados e a entrada do cliente; devolve o próximo estado e as
// ações (mensagens) que o executor deve enviar. A consulta de CNPJ e a
// existência de material vêm por injeção (deps), para testar sem rede.

import { extrairCnpj, cnpjValido, type ConsultaCnpj, type DadosReceita } from '../cnpj';
import type { MenuWhatsapp, OpcaoMenu } from '../../services/evolution.service';

export type EstadoTriagem = 'MENU' | 'MENU_CLIENTE' | 'SERVICO' | 'SEGMENTO' | 'RELACAO' | 'NOME' | 'CIDADE' | 'CNPJ' | 'CNPJ_CONFIRMA' | 'FIM';
export const ESTADOS_TRIAGEM: EstadoTriagem[] = ['MENU', 'MENU_CLIENTE', 'SERVICO', 'SEGMENTO', 'RELACAO', 'NOME', 'CIDADE', 'CNPJ', 'CNPJ_CONFIRMA', 'FIM'];

export type DadosTriagem = {
  fluxo?: 'conhecer' | 'servicos' | 'suporte' | 'financeiro';
  segmento?: 'Padaria' | 'Farmácia';
  relacao?: 'cliente' | 'ex_cliente' | 'nao_conhece';
  nome?: string; cidade?: string; servico?: string;
  cnpj?: string; receita?: DadosReceita | null; receita_fonte?: string | null;
};
export type Acao = { tipo: 'texto'; texto: string } | { tipo: 'menu'; menu: MenuWhatsapp } | { tipo: 'material'; segmento: 'Padaria' | 'Farmácia' };
export type Desfecho = 'qualificado' | 'servicos' | 'suporte' | 'financeiro';
export type ResultadoPasso = { estado: EstadoTriagem; dados: DadosTriagem; acoes: Acao[]; desfecho?: Desfecho };
export type DepsTriagem = { consultarCnpj: (cnpj: string) => Promise<ConsultaCnpj>; temMaterial: (segmento: 'Padaria' | 'Farmácia') => boolean };

export const CONTATO_GERAL = '27 99779-8103';
const RODAPE = 'Prosystem Sistemas';

const OPC_MENU: OpcaoMenu[] = [
  { id: 'conhecer', texto: 'Quero conhecer', descricao: 'Conheça nossos sistemas' },
  { id: 'servicos', texto: 'Serviços', descricao: 'Solicite um serviço' },
  { id: 'suporte', texto: 'Suporte', descricao: 'Ajuda técnica' },
  { id: 'financeiro', texto: 'Financeiro', descricao: 'Boletos e pagamentos' },
];
const OPC_CLIENTE: OpcaoMenu[] = [
  { id: 'servicos', texto: 'Serviços' }, { id: 'suporte', texto: 'Suporte' }, { id: 'financeiro', texto: 'Financeiro' },
];
const OPC_SEGMENTO: OpcaoMenu[] = [{ id: 'padaria', texto: 'Padaria' }, { id: 'farmacia', texto: 'Farmácia' }];
const OPC_RELACAO: OpcaoMenu[] = [
  { id: 'cliente', texto: 'Sou cliente' }, { id: 'ex_cliente', texto: 'Já fui cliente' }, { id: 'nao_conhece', texto: 'Não conheço a Prosystem' },
];
const OPC_CONFIRMA: OpcaoMenu[] = [{ id: 'cnpj_sim', texto: 'Sim' }, { id: 'cnpj_nao', texto: 'Não, digitar de novo' }];

// Palavras que também valem como escolha quando o cliente digita em vez de clicar.
const APELIDOS: Record<string, string[]> = {
  conhecer: ['conhecer', 'quero conhecer', 'conhecer o sistema', 'comprar', 'orcamento'],
  servicos: ['servico', 'servicos'],
  suporte: ['suporte', 'ajuda', 'problema', 'erro'],
  financeiro: ['financeiro', 'boleto', 'pagamento', 'cobranca', 'nota fiscal'],
  padaria: ['padaria', 'panificadora', 'confeitaria'],
  farmacia: ['farmacia', 'drogaria'],
  cliente: ['sou cliente', 'ja sou', 'cliente'],
  ex_cliente: ['ja fui', 'ex cliente', 'ex-cliente', 'fui cliente'],
  nao_conhece: ['nao conheco', 'nao sou', 'nunca'],
  cnpj_sim: ['sim', 's', 'isso', 'correto', 'certo'],
  cnpj_nao: ['nao', 'n', 'errado', 'digitar de novo'],
};

const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const temLetras = (s: string, min: number) => (s || '').replace(/[^a-zA-ZÀ-ÿ]/g, '').length >= min;
const ehPlaceholder = (s: string) => /^\[[^\]]*\]$/.test((s || '').trim());

function escolher(entrada: { texto: string; botaoId?: string | null }, opcoes: OpcaoMenu[]): string | null {
  if (entrada.botaoId && opcoes.some(o => o.id === entrada.botaoId)) return entrada.botaoId;
  const t = norm(entrada.texto);
  if (!t) return null;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= opcoes.length) return opcoes[n - 1].id;
  const exata = opcoes.find(o => norm(o.texto) === t || o.id === t);
  if (exata) return exata.id;
  // Apelidos: frase mais longa primeiro, para "nao conheco" não cair em "nao".
  const candidatos = opcoes
    .flatMap(o => (APELIDOS[o.id] || []).map(a => ({ id: o.id, a })))
    .sort((x, y) => y.a.length - x.a.length);
  const achou = candidatos.find(({ a }) => (a.length <= 2 ? t === a : t.includes(a)));
  return achou ? achou.id : null;
}

const menuPrincipal = (): Acao => ({
  tipo: 'menu',
  menu: { modo: 'list', texto: 'Olá! 👋 Aqui é a *Prosystem Sistemas*, especialista em sistemas para o varejo.\n\nComo podemos te ajudar?', opcoes: OPC_MENU, botaoLista: 'Ver opções', secao: 'Atendimento', rodape: RODAPE },
});
const menuCliente = (nome: string): Acao => ({
  tipo: 'menu',
  menu: { modo: 'button', texto: `Olá! 👋 Que bom falar com você, *${nome}*!\n\nComo podemos te ajudar?`, opcoes: OPC_CLIENTE, rodape: RODAPE },
});
const menuSegmento = (): Acao => ({ tipo: 'menu', menu: { modo: 'button', texto: 'Que ótimo! 😊 Qual é o seu segmento?', opcoes: OPC_SEGMENTO, rodape: RODAPE } });
const menuRelacao = (): Acao => ({ tipo: 'menu', menu: { modo: 'button', texto: 'Você já é cliente Prosystem?', opcoes: OPC_RELACAO, rodape: RODAPE } });
const texto = (t: string): Acao => ({ tipo: 'texto', texto: t });
const repetir = (menu: Acao): Acao[] => [texto('Por favor, escolha uma das opções abaixo 👇'), menu];

const PEDIR_CNPJ = 'Qual é o CNPJ da empresa? (pode mandar só os números)';

export function iniciarTriagem(ctx: { clienteNome?: string | null }): ResultadoPasso {
  if (ctx.clienteNome) return { estado: 'MENU_CLIENTE', dados: {}, acoes: [menuCliente(ctx.clienteNome)] };
  return { estado: 'MENU', dados: {}, acoes: [menuPrincipal()] };
}

function desfechoAtendimentoGeral(dados: DadosTriagem, fluxo: 'suporte' | 'financeiro'): ResultadoPasso {
  const msg = fluxo === 'suporte'
    ? `Para suporte, fale com nosso atendimento geral pelo WhatsApp *${CONTATO_GERAL}*. Eles vão te ajudar! 💙`
    : `Para assuntos financeiros, o contato correto é o nosso atendimento geral: *${CONTATO_GERAL}*. 💙`;
  return { estado: 'FIM', dados: { ...dados, fluxo }, acoes: [texto(msg)], desfecho: fluxo };
}

function escolhaDoMenu(estado: 'MENU' | 'MENU_CLIENTE', dados: DadosTriagem, escolha: string | null, menu: Acao): ResultadoPasso {
  if (escolha === 'suporte' || escolha === 'financeiro') return desfechoAtendimentoGeral(dados, escolha);
  if (escolha === 'servicos') {
    return { estado: 'SERVICO', dados: { ...dados, fluxo: 'servicos' }, acoes: [texto('Que tipo de serviço você precisa? Pode descrever em uma mensagem. 📝')] };
  }
  if (escolha === 'conhecer' && estado === 'MENU') {
    return { estado: 'SEGMENTO', dados: { ...dados, fluxo: 'conhecer' }, acoes: [menuSegmento()] };
  }
  return { estado, dados, acoes: repetir(menu) };
}

function finalQualificado(dados: DadosTriagem, deps: DepsTriagem): ResultadoPasso {
  const nome = dados.nome ? `, ${dados.nome}` : '';
  const acoes: Acao[] = [texto(`Obrigado${nome}! 🙌 Nossa especialista recebeu seu contato e vai retornar o mais breve possível.`)];
  if (dados.segmento && deps.temMaterial(dados.segmento)) {
    const onde = dados.segmento === 'Farmácia' ? 'farmácia' : 'padaria';
    acoes.push(texto(`Enquanto isso, aqui estão algumas ferramentas que temos para evoluir com você na sua ${onde}:`));
    acoes.push({ tipo: 'material', segmento: dados.segmento });
  }
  return { estado: 'FIM', dados, acoes, desfecho: 'qualificado' };
}

export async function avancarTriagem(
  estado: EstadoTriagem,
  dados: DadosTriagem,
  entrada: { texto: string; botaoId?: string | null },
  deps: DepsTriagem,
): Promise<ResultadoPasso> {
  const livre = ehPlaceholder(entrada.texto) ? '' : (entrada.texto || '').trim();

  switch (estado) {
    case 'MENU':
      return escolhaDoMenu('MENU', dados, escolher(entrada, OPC_MENU), menuPrincipal());
    case 'MENU_CLIENTE':
      return escolhaDoMenu('MENU_CLIENTE', dados, escolher(entrada, OPC_CLIENTE), menuCliente('cliente'));
    case 'SERVICO':
      if (livre.length < 3) return { estado, dados, acoes: [texto('Pode descrever em uma mensagem qual serviço você precisa? 📝')] };
      return { estado: 'FIM', dados: { ...dados, servico: livre.slice(0, 1000) }, acoes: [texto('Recebemos seu pedido! ✅ Um consultor vai te atender em breve.')], desfecho: 'servicos' };
    case 'SEGMENTO': {
      const e = escolher(entrada, OPC_SEGMENTO);
      if (!e) return { estado, dados, acoes: repetir(menuSegmento()) };
      return { estado: 'RELACAO', dados: { ...dados, segmento: e === 'padaria' ? 'Padaria' : 'Farmácia' }, acoes: [menuRelacao()] };
    }
    case 'RELACAO': {
      const e = escolher(entrada, OPC_RELACAO) as DadosTriagem['relacao'] | null;
      if (!e) return { estado, dados, acoes: repetir(menuRelacao()) };
      return { estado: 'NOME', dados: { ...dados, relacao: e }, acoes: [texto('Qual é o seu nome?')] };
    }
    case 'NOME':
      if (!temLetras(livre, 2)) return { estado, dados, acoes: [texto('Pode me dizer o seu nome?')] };
      return { estado: 'CIDADE', dados: { ...dados, nome: livre.slice(0, 80) }, acoes: [texto(`Prazer, ${livre.slice(0, 80)}! De qual cidade você está falando?`)] };
    case 'CIDADE':
      if (!temLetras(livre, 2)) return { estado, dados, acoes: [texto('De qual cidade você está falando?')] };
      return { estado: 'CNPJ', dados: { ...dados, cidade: livre.slice(0, 80) }, acoes: [texto(PEDIR_CNPJ)] };
    case 'CNPJ': {
      const cnpj = extrairCnpj(livre);
      if (!cnpj || !cnpjValido(cnpj)) {
        return { estado, dados, acoes: [texto('Esse CNPJ não parece válido. 🤔 Confira e digite os 14 números do CNPJ da empresa.')] };
      }
      const consulta = await deps.consultarCnpj(cnpj);
      if (consulta.status === 'nao_encontrado') {
        return { estado, dados, acoes: [texto('Não encontramos esse CNPJ na Receita Federal. Confira e digite novamente, por favor.')] };
      }
      if (consulta.status === 'indisponivel') {
        return finalQualificado({ ...dados, cnpj, receita: null, receita_fonte: null }, deps);
      }
      const r = consulta.dados;
      const nomeEmpresa = r.nome_fantasia || r.razao_social || 'sua empresa';
      const local = [r.municipio, r.uf].filter(Boolean).join('/');
      return {
        estado: 'CNPJ_CONFIRMA',
        dados: { ...dados, cnpj, receita: r, receita_fonte: consulta.fonte },
        acoes: [{ tipo: 'menu', menu: { modo: 'button', texto: `É a *${nomeEmpresa}*${local ? `, de *${local}*` : ''}?`, opcoes: OPC_CONFIRMA, rodape: RODAPE } }],
      };
    }
    case 'CNPJ_CONFIRMA': {
      const e = escolher(entrada, OPC_CONFIRMA);
      if (e === 'cnpj_sim') return finalQualificado(dados, deps);
      if (e === 'cnpj_nao') {
        const { cnpj: _c, receita: _r, receita_fonte: _f, ...resto } = dados;
        return { estado: 'CNPJ', dados: resto, acoes: [texto(`Tudo bem! ${PEDIR_CNPJ}`)] };
      }
      const r = dados.receita;
      const nomeEmpresa = r?.nome_fantasia || r?.razao_social || 'sua empresa';
      return { estado, dados, acoes: repetir({ tipo: 'menu', menu: { modo: 'button', texto: `É a *${nomeEmpresa}*?`, opcoes: OPC_CONFIRMA, rodape: RODAPE } }) };
    }
    case 'FIM':
    default:
      return { estado: 'FIM', dados, acoes: [] };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/triagem-fluxo.test.ts`
Expected: PASS (todos). Se o teste "quero falar com o suporte" pegar outra opção, ajustar só a ordem/lista de `APELIDOS`, nunca o teste.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/triagem/fluxo.ts backend/tests/triagem-fluxo.test.ts
git commit -m "feat(whatsapp): roteiro da triagem automática (menus, CNPJ, desfechos)"
```

---

### Task 4: Efeitos do desfecho no lead e na conversa (`lib/triagem/desfecho.ts`)

**Files:**
- Create: `backend/src/lib/triagem/desfecho.ts`
- Test: `backend/tests/triagem-desfecho.test.ts`

**Interfaces:**
- Consumes: `DadosTriagem`, `Desfecho` (Task 3); `DadosReceita`, `situacaoAtiva`, `enderecoCompleto`, `formatarCnpj` (Task 1).
- Produces:
```ts
export type LeadAtual = { cnpj?: string | null; razao_social?: string | null; nome_fantasia?: string | null; empresa?: string | null;
  segmento?: string | null; cidade?: string | null; estado?: string | null; endereco?: string | null;
  responsavel_nome?: string | null; responsavel_email?: string | null; telefone?: string | null };
export type EfeitosDesfecho = {
  conversa: { etiqueta: string; etiqueta_cor: string; prioridade?: 'CRITICA' | 'NORMAL'; contato_nome?: string; desvincularLead: boolean };
  lead: Record<string, string> | null;
  observacao: string | null;
  notificacao: { titulo: string; detalhe: string; alerta: string | null } | null;
};
export function efeitosDesfecho(desfecho: Desfecho, dados: DadosTriagem, leadAtual: LeadAtual | null): EfeitosDesfecho
export function avisoCnpj(dados: DadosTriagem | null | undefined): string | null   // "CNPJ BAIXADA na Receita" ou null
```

- [ ] **Step 1: Teste que falha** — `backend/tests/triagem-desfecho.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { efeitosDesfecho, avisoCnpj } from '../src/lib/triagem/desfecho';
import type { DadosReceita } from '../src/lib/cnpj';

const RECEITA: DadosReceita = {
  cnpj: '11222333000181', razao_social: 'PADARIA PAO QUENTE LTDA', nome_fantasia: 'PAO QUENTE', situacao: 'ATIVA',
  data_situacao: '2010-05-01', cnae_principal: { codigo: '1091102', descricao: 'Fabricação de produtos de padaria' },
  cnaes_secundarios: [{ codigo: '4721102', descricao: 'Padaria e confeitaria' }], porte: 'MICRO EMPRESA',
  natureza_juridica: 'Sociedade Empresária Limitada', data_abertura: '2010-05-01', capital_social: 50000,
  email: 'contato@paoquente.com', telefones: ['2733334444'], logradouro: 'RUA DAS FLORES', numero: '100',
  complemento: null, bairro: 'CENTRO', cep: '29100000', municipio: 'VILA VELHA', uf: 'ES',
  socios: [{ nome: 'MARIA DA SILVA', qualificacao: 'Sócio-Administrador' }], simples: true, mei: false,
};

describe('efeitosDesfecho — qualificado', () => {
  const dados = { fluxo: 'conhecer' as const, segmento: 'Padaria' as const, relacao: 'nao_conhece' as const, nome: 'Maria', cidade: 'Vila Velha', cnpj: '11222333000181', receita: RECEITA, receita_fonte: 'BrasilAPI' };

  it('preenche o lead com a Receita sem sobrescrever o que já existe', () => {
    const e = efeitosDesfecho('qualificado', dados, { telefone: '5527988887777', responsavel_email: 'ja@tem.com' });
    expect(e.lead).toEqual({
      cnpj: '11.222.333/0001-81', razao_social: 'PADARIA PAO QUENTE LTDA', empresa: 'PADARIA PAO QUENTE LTDA',
      nome_fantasia: 'PAO QUENTE', nome: 'PAO QUENTE', segmento: 'Padaria', cidade: 'VILA VELHA', estado: 'ES',
      endereco: 'RUA DAS FLORES, 100 - CENTRO - VILA VELHA/ES - CEP 29100-000', responsavel_nome: 'Maria',
    });
  });

  it('observação traz sócios, CNAE, porte, situação, relação e fonte', () => {
    const e = efeitosDesfecho('qualificado', dados, null);
    const o = e.observacao || '';
    for (const trecho of ['Dados da Receita', 'MARIA DA SILVA', 'Sócio-Administrador', '1091102', 'MICRO EMPRESA', 'ATIVA', 'Não conhece a Prosystem', 'BrasilAPI', 'Vila Velha', 'contato@paoquente.com', '2733334444', 'Simples: sim']) {
      expect(o).toContain(trecho);
    }
  });

  it('conversa: etiqueta do segmento, prioridade crítica com CNPJ ativo, nome do contato', () => {
    const e = efeitosDesfecho('qualificado', dados, null);
    expect(e.conversa).toEqual({ etiqueta: 'Padaria', etiqueta_cor: '#d97706', prioridade: 'CRITICA', contato_nome: 'Maria', desvincularLead: false });
    expect(e.notificacao).toEqual({ titulo: 'Novo lead qualificado', detalhe: 'PAO QUENTE — VILA VELHA/ES', alerta: null });
  });

  it('CNPJ baixado: prioridade normal e alerta vermelho', () => {
    const e = efeitosDesfecho('qualificado', { ...dados, receita: { ...RECEITA, situacao: 'BAIXADA' } }, null);
    expect(e.conversa.prioridade).toBe('NORMAL');
    expect(e.notificacao?.alerta).toBe('CNPJ BAIXADA na Receita');
    expect(e.observacao).toContain('⚠️ CNPJ BAIXADA');
  });

  it('Receita indisponível: usa cidade digitada e marca como não consultado', () => {
    const e = efeitosDesfecho('qualificado', { fluxo: 'conhecer', segmento: 'Farmácia', nome: 'Ana', cidade: 'Serra', cnpj: '11222333000181', receita: null, receita_fonte: null }, null);
    expect(e.lead).toMatchObject({ cnpj: '11.222.333/0001-81', segmento: 'Farmácia', cidade: 'Serra', responsavel_nome: 'Ana' });
    expect(e.conversa.etiqueta).toBe('Farmácia');
    expect(e.conversa.prioridade).toBe('NORMAL');
    expect(e.observacao).toContain('não consultado na Receita');
  });
});

describe('efeitosDesfecho — outros', () => {
  it('serviços: etiqueta Serviços, pedido na observação, notifica', () => {
    const e = efeitosDesfecho('servicos', { fluxo: 'servicos', servico: 'Treinamento' }, null);
    expect(e.conversa).toMatchObject({ etiqueta: 'Serviços', desvincularLead: false });
    expect(e.observacao).toContain('Treinamento');
    expect(e.notificacao?.titulo).toBe('Pedido de serviço');
    expect(e.lead).toBeNull();
  });
  it('suporte e financeiro: desvinculam o lead e não notificam', () => {
    for (const d of ['suporte', 'financeiro'] as const) {
      const e = efeitosDesfecho(d, { fluxo: d }, null);
      expect(e.conversa.desvincularLead).toBe(true);
      expect(e.conversa.etiqueta).toBe(d === 'suporte' ? 'Suporte' : 'Financeiro');
      expect(e.notificacao).toBeNull();
    }
  });
});

describe('avisoCnpj', () => {
  it('só avisa com Receita consultada e situação não ativa', () => {
    expect(avisoCnpj({ receita: { ...RECEITA, situacao: 'INAPTA' } })).toBe('CNPJ INAPTA na Receita');
    expect(avisoCnpj({ receita: RECEITA })).toBeNull();
    expect(avisoCnpj({ receita: null })).toBeNull();
    expect(avisoCnpj(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run tests/triagem-desfecho.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar** — `backend/src/lib/triagem/desfecho.ts`:

```ts
// O que muda no lead e na conversa quando a triagem termina. Puro.

import { enderecoCompleto, formatarCnpj, situacaoAtiva } from '../cnpj';
import type { DadosTriagem, Desfecho } from './fluxo';

export type LeadAtual = { cnpj?: string | null; razao_social?: string | null; nome_fantasia?: string | null; empresa?: string | null;
  segmento?: string | null; cidade?: string | null; estado?: string | null; endereco?: string | null;
  responsavel_nome?: string | null; responsavel_email?: string | null; telefone?: string | null };
export type EfeitosDesfecho = {
  conversa: { etiqueta: string; etiqueta_cor: string; prioridade?: 'CRITICA' | 'NORMAL'; contato_nome?: string; desvincularLead: boolean };
  lead: Record<string, string> | null;
  observacao: string | null;
  notificacao: { titulo: string; detalhe: string; alerta: string | null } | null;
};

const COR: Record<string, string> = { Padaria: '#d97706', 'Farmácia': '#16a34a', 'Serviços': '#6366f1', Suporte: '#64748b', Financeiro: '#0d9488' };
const RELACAO: Record<string, string> = { cliente: 'É cliente Prosystem', ex_cliente: 'Já foi cliente Prosystem', nao_conhece: 'Não conhece a Prosystem' };

export function avisoCnpj(dados: DadosTriagem | null | undefined): string | null {
  const r = dados?.receita;
  if (!r || situacaoAtiva(r)) return null;
  return `CNPJ ${r.situacao || 'SEM SITUAÇÃO'} na Receita`;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const simNao = (v: boolean | null) => (v === null ? null : v ? 'sim' : 'não');

function observacaoQualificado(d: DadosTriagem): string {
  const r = d.receita;
  const linhas: (string | null)[] = ['🤖 Triagem automática do WhatsApp — Dados da Receita'];
  const aviso = avisoCnpj(d);
  if (aviso) linhas.push(`⚠️ ${aviso}`);
  linhas.push(`Segmento informado: ${d.segmento || '—'}`, `Relação: ${RELACAO[d.relacao || ''] || '—'}`,
    `Nome informado: ${d.nome || '—'}`, `Cidade informada: ${d.cidade || '—'}`, `CNPJ: ${d.cnpj ? formatarCnpj(d.cnpj) : '—'}`);
  if (!r) {
    linhas.push('CNPJ com dígitos válidos, não consultado na Receita (serviço indisponível no momento).');
    return linhas.filter(Boolean).join('\n');
  }
  linhas.push(
    `Fonte: ${d.receita_fonte || '—'}`,
    `Situação: ${r.situacao || '—'}${r.data_situacao ? ` desde ${r.data_situacao}` : ''}`,
    r.razao_social ? `Razão social: ${r.razao_social}` : null,
    r.nome_fantasia ? `Nome fantasia: ${r.nome_fantasia}` : null,
    r.cnae_principal ? `Atividade principal: ${r.cnae_principal.codigo} — ${r.cnae_principal.descricao}` : null,
    r.cnaes_secundarios.length ? `Atividades secundárias: ${r.cnaes_secundarios.map(c => `${c.codigo} — ${c.descricao}`).join('; ')}` : null,
    r.porte ? `Porte: ${r.porte}` : null,
    r.natureza_juridica ? `Natureza jurídica: ${r.natureza_juridica}` : null,
    r.data_abertura ? `Abertura: ${r.data_abertura}` : null,
    r.capital_social !== null ? `Capital social: ${brl(r.capital_social)}` : null,
    simNao(r.simples) ? `Simples: ${simNao(r.simples)}` : null,
    simNao(r.mei) ? `MEI: ${simNao(r.mei)}` : null,
    `Endereço: ${enderecoCompleto(r) || '—'}`,
    r.email ? `E-mail na Receita: ${r.email}` : null,
    r.telefones.length ? `Telefones na Receita: ${r.telefones.join(', ')}` : null,
    r.socios.length ? `Sócios:\n${r.socios.map(s => `- ${s.nome}${s.qualificacao ? ` (${s.qualificacao})` : ''}`).join('\n')}` : null,
  );
  return linhas.filter(Boolean).join('\n');
}

function leadQualificado(d: DadosTriagem, atual: LeadAtual | null): Record<string, string> {
  const r = d.receita;
  const vazio = (campo: keyof LeadAtual) => !atual?.[campo];
  const out: Record<string, string> = {};
  const por = (campo: string, valor: string | null | undefined, sobrescreve = true) => {
    if (!valor) return;
    if (!sobrescreve && !vazio(campo as keyof LeadAtual)) return;
    out[campo] = valor;
  };
  if (d.cnpj) por('cnpj', formatarCnpj(d.cnpj));
  por('segmento', d.segmento);
  por('responsavel_nome', d.nome);
  if (r) {
    por('razao_social', r.razao_social);
    por('empresa', r.razao_social);
    por('nome_fantasia', r.nome_fantasia);
    const nomeEmpresa = r.nome_fantasia || r.razao_social;
    if (nomeEmpresa) out.nome = nomeEmpresa;
    por('cidade', r.municipio || d.cidade);
    por('estado', r.uf);
    const end = enderecoCompleto(r);
    por('endereco', end || null);
    por('responsavel_email', r.email, false);
    por('telefone', r.telefones[0], false);
  } else {
    por('cidade', d.cidade);
  }
  return out;
}

export function efeitosDesfecho(desfecho: Desfecho, dados: DadosTriagem, leadAtual: LeadAtual | null): EfeitosDesfecho {
  if (desfecho === 'suporte' || desfecho === 'financeiro') {
    const etiqueta = desfecho === 'suporte' ? 'Suporte' : 'Financeiro';
    return { conversa: { etiqueta, etiqueta_cor: COR[etiqueta], desvincularLead: true }, lead: null, observacao: null, notificacao: null };
  }
  if (desfecho === 'servicos') {
    return {
      conversa: { etiqueta: 'Serviços', etiqueta_cor: COR['Serviços'], desvincularLead: false },
      lead: null,
      observacao: `🤖 Triagem automática do WhatsApp — Pedido de serviço:\n${dados.servico || '—'}`,
      notificacao: { titulo: 'Pedido de serviço', detalhe: (dados.servico || '').slice(0, 80), alerta: null },
    };
  }
  const segmento = dados.segmento || 'Farmácia';
  const r = dados.receita;
  const nomeEmpresa = r?.nome_fantasia || r?.razao_social || dados.nome || 'Lead';
  const local = r ? [r.municipio, r.uf].filter(Boolean).join('/') : (dados.cidade || '');
  return {
    conversa: {
      etiqueta: segmento, etiqueta_cor: COR[segmento],
      prioridade: situacaoAtiva(r) ? 'CRITICA' : 'NORMAL',
      ...(dados.nome ? { contato_nome: dados.nome } : {}),
      desvincularLead: false,
    },
    lead: leadQualificado(dados, leadAtual),
    observacao: observacaoQualificado(dados),
    notificacao: { titulo: 'Novo lead qualificado', detalhe: local ? `${nomeEmpresa} — ${local}` : nomeEmpresa, alerta: avisoCnpj(dados) },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run tests/triagem-desfecho.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/triagem/desfecho.ts backend/tests/triagem-desfecho.test.ts
git commit -m "feat(whatsapp): efeitos do fim da triagem no lead e na conversa"
```

---

### Task 5: Ligar a triagem no backend (schema, configuração, execução, parar robô)

**Files:**
- Modify: `backend/prisma/schema.prisma` (`WhatsappConversa.bot_dados`, `ConfiguracaoIntegracao.valor`)
- Create: `backend/src/services/triagem-config.service.ts`
- Create: `backend/src/services/triagem-executor.service.ts`
- Modify: `backend/src/services/whatsapp-eventos.service.ts` (tipo `lead_qualificado`)
- Modify: `backend/src/routes/whatsapp.ts` (rotas de configuração, início/avanço da triagem, parar robô, remover `processarBot`)
- Test: `backend/tests/triagem-config.service.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `enviarTexto`, `enviarMenu`, `enviarArquivo` do provider; `emitirEventoConversa`.
- Produces (HTTP para o Task 6):
  - `GET /whatsapp/triagem` (gestão) → `{ data: { ativa: boolean, material: { farmacia: MaterialSegmento, padaria: MaterialSegmento } } }`
  - `PUT /whatsapp/triagem` (gestão) body igual → `{ status: 'success' }`
  - SSE `{ tipo: 'lead_qualificado', conversaId, titulo, detalhe, alerta }` para todos os conectados.
  - Conversas passam a trazer `bot_ativo`, `bot_estado`, `bot_dados` (já vêm no `findMany`).
- `MaterialSegmento = { texto: string; imagem: string | null; pdf: string | null; pdf_nome: string | null }` (imagem/pdf em data URL base64).

- [ ] **Step 1: Schema aditivo**

Em `model WhatsappConversa`, logo abaixo de `bot_ativo`, acrescentar:
```prisma
  // Respostas coletadas pela triagem automática (segmento, nome, cidade, CNPJ, dados da Receita).
  bot_dados  Json?
```
Em `model ConfiguracaoIntegracao`, trocar `valor      String   @db.Text` por `valor      String   @db.LongText`.

Run: `cd backend && DATABASE_URL="mysql://u:p@localhost:3306/x" npx prisma validate && npx prisma generate`
Expected: schema válido e client gerado. Não rodar `db push`.

- [ ] **Step 2: Teste que falha da configuração** — `backend/tests/triagem-config.service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { obterConfigTriagem, salvarConfigTriagem, materialVazio } from '../src/services/triagem-config.service';

function prismaFalso(inicial: Record<string, string> = {}) {
  const linhas = new Map(Object.entries(inicial).map(([chave, valor]) => [chave, { chave, valor }]));
  return {
    linhas,
    configuracaoIntegracao: {
      findMany: async ({ where }: any) => [...linhas.values()].filter(l => where.chave.in.includes(l.chave)),
      upsert: async ({ where, create, update }: any) => { const n = linhas.has(where.chave) ? { ...linhas.get(where.chave), ...update } : create; linhas.set(where.chave, n); return n; },
    },
  };
}

describe('triagem-config', () => {
  it('padrão: desligada e sem material', async () => {
    const c = await obterConfigTriagem(prismaFalso() as any);
    expect(c.ativa).toBe(false);
    expect(c.material.farmacia).toEqual({ texto: '', imagem: null, pdf: null, pdf_nome: null });
    expect(materialVazio(c.material.padaria)).toBe(true);
  });
  it('salva e lê de volta', async () => {
    const p = prismaFalso();
    const cfg = { ativa: true, material: { farmacia: { texto: 'Veja: https://x', imagem: null, pdf: 'data:application/pdf;base64,AA', pdf_nome: 'catalogo.pdf' }, padaria: { texto: '', imagem: null, pdf: null, pdf_nome: null } } };
    await salvarConfigTriagem(p as any, cfg, 'u1');
    expect(p.linhas.get('whatsapp.triagem.ativa')?.valor).toBe('true');
    const lida = await obterConfigTriagem(p as any);
    expect(lida).toEqual(cfg);
    expect(materialVazio(lida.material.farmacia)).toBe(false);
  });
  it('JSON corrompido vira material vazio', async () => {
    const c = await obterConfigTriagem(prismaFalso({ 'whatsapp.triagem.material.farmacia': '{quebrado' }) as any);
    expect(c.material.farmacia.texto).toBe('');
  });
});
```

Run: `cd backend && npx vitest run tests/triagem-config.service.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar a configuração** — `backend/src/services/triagem-config.service.ts`:

```ts
import type { PrismaClient } from '@prisma/client';

export type MaterialSegmento = { texto: string; imagem: string | null; pdf: string | null; pdf_nome: string | null };
export type ConfigTriagem = { ativa: boolean; material: { farmacia: MaterialSegmento; padaria: MaterialSegmento } };
type PrismaConfig = Pick<PrismaClient, 'configuracaoIntegracao'>;

const CH = {
  ativa: 'whatsapp.triagem.ativa',
  farmacia: 'whatsapp.triagem.material.farmacia',
  padaria: 'whatsapp.triagem.material.padaria',
};
const VAZIO: MaterialSegmento = { texto: '', imagem: null, pdf: null, pdf_nome: null };

export const materialVazio = (m: MaterialSegmento) => !m.texto.trim() && !m.imagem && !m.pdf;

function lerMaterial(json: string | undefined): MaterialSegmento {
  if (!json) return { ...VAZIO };
  try {
    const m = JSON.parse(json);
    return { texto: String(m?.texto || ''), imagem: m?.imagem || null, pdf: m?.pdf || null, pdf_nome: m?.pdf_nome || null };
  } catch {
    return { ...VAZIO };
  }
}

export async function obterConfigTriagem(prisma: PrismaConfig): Promise<ConfigTriagem> {
  const linhas = await prisma.configuracaoIntegracao.findMany({ where: { chave: { in: Object.values(CH) } } });
  const v = (c: string) => linhas.find(l => l.chave === c)?.valor;
  return { ativa: v(CH.ativa) === 'true', material: { farmacia: lerMaterial(v(CH.farmacia)), padaria: lerMaterial(v(CH.padaria)) } };
}

export async function salvarConfigTriagem(prisma: PrismaConfig, cfg: ConfigTriagem, por = 'system'): Promise<void> {
  const pares: [string, string][] = [
    [CH.ativa, cfg.ativa ? 'true' : 'false'],
    [CH.farmacia, JSON.stringify(cfg.material.farmacia)],
    [CH.padaria, JSON.stringify(cfg.material.padaria)],
  ];
  for (const [chave, valor] of pares) {
    await prisma.configuracaoIntegracao.upsert({ where: { chave }, create: { chave, valor, updated_by: por }, update: { valor, updated_by: por } });
  }
}
```

Run: `cd backend && npx vitest run tests/triagem-config.service.test.ts` → PASS.

- [ ] **Step 4: Evento SSE** — em `backend/src/services/whatsapp-eventos.service.ts`, trocar o tipo do parâmetro `tipo` de `emitirEventoConversa` para `'mensagem' | 'conversa_atualizada' | 'lead_qualificado'`.

- [ ] **Step 5: Executor** — `backend/src/services/triagem-executor.service.ts`:

```ts
// Aplica um passo da triagem: envia as ações pela UAZAPI, grava as mensagens do
// robô, salva estado/dados na conversa e, no fim, aplica os efeitos no lead e
// na conversa e avisa o time.

import type { PrismaClient } from '@prisma/client';
import * as evo from './evolution.service';
import { emitirEventoConversa } from './whatsapp-eventos.service';
import { calcularSlaPrazo } from './whatsapp-sla.service';
import { obterConfigTriagem, materialVazio, type ConfigTriagem } from './triagem-config.service';
import { consultarCnpj } from '../lib/cnpj';
import { iniciarTriagem, avancarTriagem, ESTADOS_TRIAGEM, type Acao, type DadosTriagem, type EstadoTriagem, type ResultadoPasso } from '../lib/triagem/fluxo';
import { efeitosDesfecho } from '../lib/triagem/desfecho';

type ConversaTriagem = { id: string; contato_numero: string; lead_id: string | null; dono_id: string | null; bot_ativo: boolean; bot_estado: string | null; bot_dados: any };

export function emTriagem(c: { bot_ativo: boolean; bot_estado: string | null }): boolean {
  return c.bot_ativo && !!c.bot_estado && ESTADOS_TRIAGEM.includes(c.bot_estado as EstadoTriagem) && c.bot_estado !== 'FIM';
}

async function registrarSaida(prisma: PrismaClient, conversaId: string, conteudo: string, externo_id?: string, extra: { tipo?: string; midia_url?: string } = {}) {
  const msg = await prisma.whatsappMensagem.create({
    data: { conversaId, externo_id, direcao: 'SAIDA', tipo: extra.tipo || 'TEXTO', conteudo, midia_url: extra.midia_url, status: 'ENVIADA', enviada_por: 'bot' },
  }).catch((e: any) => { console.error('[TRIAGEM] falha ao gravar saída:', e?.message); return null; });
  return msg;
}

async function enviarAcoes(prisma: PrismaClient, token: string, conversa: ConversaTriagem, acoes: Acao[], cfg: ConfigTriagem) {
  let ultima = '';
  for (const a of acoes) {
    try {
      if (a.tipo === 'texto') {
        const r = await evo.enviarTexto(token, conversa.contato_numero, a.texto);
        await registrarSaida(prisma, conversa.id, a.texto, r.externo_id);
        ultima = a.texto;
      } else if (a.tipo === 'menu') {
        const r = await evo.enviarMenu(token, conversa.contato_numero, a.menu);
        const conteudo = `${a.menu.texto}\n\n${a.menu.opcoes.map(o => `▫️ ${o.texto}`).join('\n')}`;
        await registrarSaida(prisma, conversa.id, conteudo, r.externo_id);
        ultima = a.menu.texto;
      } else if (a.tipo === 'material') {
        const m = a.segmento === 'Farmácia' ? cfg.material.farmacia : cfg.material.padaria;
        if (m.texto.trim()) {
          const r = await evo.enviarTexto(token, conversa.contato_numero, m.texto);
          await registrarSaida(prisma, conversa.id, m.texto, r.externo_id);
        }
        if (m.imagem) {
          const r = await evo.enviarArquivo(token, conversa.contato_numero, m.imagem, 'imagem.jpg');
          await registrarSaida(prisma, conversa.id, '🖼️ Imagem', r.externo_id, { tipo: r.tipo, midia_url: m.imagem });
        }
        if (m.pdf) {
          const nome = m.pdf_nome || 'material.pdf';
          const r = await evo.enviarArquivo(token, conversa.contato_numero, m.pdf, nome);
          await registrarSaida(prisma, conversa.id, nome, r.externo_id, { tipo: r.tipo, midia_url: m.pdf });
        }
      }
    } catch (e: any) {
      console.error('[TRIAGEM] falha ao enviar ação:', e?.message);
    }
  }
  if (ultima) {
    await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { ultima_mensagem: ultima.slice(0, 200), ultima_em: new Date() } }).catch(() => {});
  }
}

async function aplicarDesfecho(prisma: PrismaClient, conversa: ConversaTriagem, passo: ResultadoPasso) {
  const lead = conversa.lead_id
    ? await prisma.lead.findUnique({ where: { id: conversa.lead_id }, select: { cnpj: true, razao_social: true, nome_fantasia: true, empresa: true, segmento: true, cidade: true, estado: true, endereco: true, responsavel_nome: true, responsavel_email: true, telefone: true, origem: true } }).catch(() => null)
    : null;
  const e = efeitosDesfecho(passo.desfecho!, passo.dados, lead);

  const dadosConversa: any = { etiqueta: e.conversa.etiqueta, etiqueta_cor: e.conversa.etiqueta_cor };
  if (e.conversa.prioridade) { dadosConversa.prioridade = e.conversa.prioridade; dadosConversa.sla_prazo_em = calcularSlaPrazo(e.conversa.prioridade); }
  if (e.conversa.contato_nome) dadosConversa.contato_nome = e.conversa.contato_nome;
  if (e.conversa.desvincularLead && conversa.lead_id) {
    dadosConversa.lead_id = null;
    if (lead?.origem === 'WHATSAPP') await prisma.lead.update({ where: { id: conversa.lead_id }, data: { deleted_at: new Date() as any } }).catch(() => {});
  }
  await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: dadosConversa }).catch((err: any) => console.error('[TRIAGEM] conversa:', err?.message));

  if (conversa.lead_id && !e.conversa.desvincularLead) {
    if (e.lead && Object.keys(e.lead).length) {
      await prisma.lead.update({ where: { id: conversa.lead_id }, data: e.lead }).catch((err: any) => console.error('[TRIAGEM] lead:', err?.message));
    }
    if (e.observacao) {
      await prisma.leadObservacao.create({ data: { lead_id: conversa.lead_id, tipo: 'SISTEMA', descricao: e.observacao, created_by: 'bot', created_by_name: 'Triagem automática' } })
        .catch((err: any) => console.error('[TRIAGEM] observação:', err?.message));
    }
  }

  if (e.notificacao) {
    emitirEventoConversa(null, 'lead_qualificado', { conversaId: conversa.id, ...e.notificacao });
  }
  emitirEventoConversa(conversa.dono_id, 'conversa_atualizada', { conversaId: conversa.id });
}

/** Executa um passo e persiste. `inicio` = primeira mensagem de número novo. */
export async function executarTriagem(
  prisma: PrismaClient,
  token: string,
  conversa: ConversaTriagem,
  entrada: { texto: string; botaoId?: string | null } | { inicio: true; clienteNome?: string | null },
) {
  const cfg = await obterConfigTriagem(prisma);
  if (!cfg.ativa) return;
  const deps = {
    consultarCnpj: (c: string) => consultarCnpj(c),
    temMaterial: (s: 'Padaria' | 'Farmácia') => !materialVazio(s === 'Farmácia' ? cfg.material.farmacia : cfg.material.padaria),
  };
  const passo = 'inicio' in entrada
    ? iniciarTriagem({ clienteNome: entrada.clienteNome })
    : await avancarTriagem((conversa.bot_estado || 'MENU') as EstadoTriagem, (conversa.bot_dados || {}) as DadosTriagem, entrada, deps);

  // Grava o estado antes de enviar: se o cliente responder rápido, o próximo webhook já vê o estado novo.
  const fim = passo.estado === 'FIM';
  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: { bot_ativo: !fim, bot_estado: passo.estado, bot_dados: passo.dados as any },
  });

  await enviarAcoes(prisma, token, conversa, passo.acoes, cfg);
  if (passo.desfecho) await aplicarDesfecho(prisma, conversa, passo);
}
```

- [ ] **Step 6: Rotas de configuração** — em `backend/src/routes/whatsapp.ts`, junto das rotas `/whatsapp/empresa`:

```ts
  const materialSchema = z.object({
    texto: z.string().max(4000),
    imagem: z.string().startsWith('data:image/').nullable(),
    pdf: z.string().startsWith('data:application/pdf').nullable(),
    pdf_nome: z.string().max(200).nullable(),
  });

  fastify.get('/whatsapp/triagem', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    return reply.send({ status: 'success', data: await obterConfigTriagem(prisma) });
  });

  fastify.put('/whatsapp/triagem', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const body = z.object({ ativa: z.boolean(), material: z.object({ farmacia: materialSchema, padaria: materialSchema }) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.errors[0]?.message || 'Dados inválidos' });
    await salvarConfigTriagem(prisma, body.data, getUser(request)?.id);
    return reply.send({ status: 'success' });
  });
```
Imports no topo: `requireGestor` (já importado no arquivo — conferir), `obterConfigTriagem, salvarConfigTriagem` de `@/services/triagem-config.service`, `executarTriagem, emTriagem` de `@/services/triagem-executor.service`.

- [ ] **Step 7: Iniciar e avançar a triagem** — em `processarMensagemRecebida`:
  1. A assinatura de `dados` passa a incluir `'botao_id'`: `Pick<EventoMensagemUazapi, 'contato_numero' | 'contato_nome' | 'externo_id' | 'tipo_msg' | 'texto' | 'botao_id'>` (no caminho Evolution legado, que não tem botão, passar sem o campo).
  2. No `create` do upsert da conversa, trocar `bot_ativo: true, bot_estado: 'SAUDACAO'` por `bot_ativo: false, bot_estado: null` (quem liga é a triagem).
  3. Substituir o bloco inteiro "CHATBOT DE QUALIFICAÇÃO" (da linha `const botLigado = process.env.WHATSAPP_BOT_ATIVO === 'true';` até o `}` que fecha o `if`) por:

```ts
    // ===== TRIAGEM AUTOMÁTICA (só WhatsApp da empresa) =====
    if (ehEmpresa) {
      try {
        if (ehNova) {
          const sufTel = contato_numero.slice(-8);
          const clienteBase = await prisma.cliente.findFirst({
            where: { telefone: { contains: sufTel } },
            select: { nome: true, razao_social: true, nome_fantasia: true },
          }).catch(() => null);
          const clienteNome = clienteBase ? (clienteBase.nome_fantasia || clienteBase.razao_social || clienteBase.nome) : null;
          await executarTriagem(prisma, inst.instance_token || '', conversa as any, { inicio: true, clienteNome });
        } else if (emTriagem(conversa as any)) {
          await executarTriagem(prisma, inst.instance_token || '', conversa as any, { texto, botaoId: dados.botao_id });
        }
      } catch (e: any) { console.error('[TRIAGEM] erro:', e?.message); }
    }
```
  4. Apagar a função `processarBot` inteira (e a menção a `WHATSAPP_BOT_ATIVO`). Rodar `grep -n "processarBot\|WHATSAPP_BOT_ATIVO" backend/src` → vazio.
  5. Onde o evento UAZAPI chama `processarMensagemRecebida(empresa, ev, obterMidia, true)`, o `ev` já carrega `botao_id` (Task 2).

- [ ] **Step 8: Parar o robô quando um humano fala** — criar dentro de `whatsappRoutes` (perto de `assumirSeSemDono`):

```ts
  // Vendedor falou na conversa: o robô para ali mesmo.
  async function pararRobo(conversaId: string) {
    await prisma.whatsappConversa.updateMany({ where: { id: conversaId, bot_ativo: true }, data: { bot_ativo: false } }).catch(() => {});
  }
```
Chamar `await pararRobo(id);` logo após o envio bem-sucedido em `POST /whatsapp/conversas/:id/enviar`, `/audio`, `/arquivo` e `/reuniao`. Em `registrarMensagemPropriaNormalizada` (mensagem digitada no celular da empresa), depois de achar a conversa, acrescentar `await prisma.whatsappConversa.updateMany({ where: { id: conversa.id, bot_ativo: true }, data: { bot_ativo: false } }).catch(() => {});`. Como a UAZAPI está configurada com `excludeMessages: ['wasSentByApi']`, as mensagens do próprio robô não voltam pelo webhook e não disparam isso.

- [ ] **Step 9: Conferência**

Run:
```bash
cd backend && npx vitest run tests/cnpj.test.ts tests/triagem-fluxo.test.ts tests/triagem-desfecho.test.ts tests/triagem-config.service.test.ts tests/evolution.service.test.ts tests/uazapi-webhook-parser.test.ts tests/whatsapp-empresa.test.ts
npx tsc --noEmit -p . 2>&1 | grep "src/" || echo "tsc ok em src"
```
Expected: todos PASS; `tsc ok em src`.

- [ ] **Step 10: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/services/triagem-config.service.ts backend/src/services/triagem-executor.service.ts backend/src/services/whatsapp-eventos.service.ts backend/src/routes/whatsapp.ts backend/tests/triagem-config.service.test.ts
git commit -m "feat(whatsapp): triagem automática ligada ao webhook, configuração e parada ao humano responder"
```

---

### Task 6: Frontend — Configurações → Triagem, selos e alarme

**Files:**
- Modify: `frontend/lib/api-client.ts`
- Modify: `frontend/app/configuracoes/page.tsx`
- Modify: `frontend/app/whatsapp/page.tsx`
- Modify: `frontend/components/dashboard/DashboardLayout.tsx`

**Interfaces — Consumes:** `GET/PUT /whatsapp/triagem`; SSE `lead_qualificado` em `/whatsapp/eventos?token=`; conversas com `bot_ativo`, `bot_estado`, `bot_dados`.

Ler `frontend/AGENTS.md` antes.

- [ ] **Step 1: api-client** — perto dos métodos do WhatsApp da empresa:

```ts
  async getWhatsappTriagem() {
    return this.client.get('/whatsapp/triagem');
  }

  async salvarWhatsappTriagem(data: {
    ativa: boolean;
    material: Record<'farmacia' | 'padaria', { texto: string; imagem: string | null; pdf: string | null; pdf_nome: string | null }>;
  }) {
    return this.client.put('/whatsapp/triagem', data);
  }
```

- [ ] **Step 2: Configurações → Triagem** — em `frontend/app/configuracoes/page.tsx`, visível só para gestão (mesma regra da seção "WhatsApp da empresa" já existente na página; reutilizar a variável/condição que ela usa). Estado:

```ts
  type MaterialTriagem = { texto: string; imagem: string | null; pdf: string | null; pdf_nome: string | null };
  const MATERIAL_VAZIO: MaterialTriagem = { texto: '', imagem: null, pdf: null, pdf_nome: null };
  const [triagem, setTriagem] = useState<{ ativa: boolean; material: { farmacia: MaterialTriagem; padaria: MaterialTriagem } }>({ ativa: false, material: { farmacia: MATERIAL_VAZIO, padaria: MATERIAL_VAZIO } });
  const [triagemSalvando, setTriagemSalvando] = useState(false);
  const [triagemMsg, setTriagemMsg] = useState<{ ok: boolean; texto: string } | null>(null);
```
Carregar com `apiClient.getWhatsappTriagem()` no mesmo `useEffect` que carrega a seção do WhatsApp da empresa. Ler arquivo como data URL com `FileReader.readAsDataURL`, limite 5 MB para imagem e 10 MB para PDF (acima disso, `setTriagemMsg({ ok:false, texto:'Arquivo grande demais (máx. 5 MB imagem / 10 MB PDF).' })`). Card (mesmo `cardStyle`/`sectionHeader` da página) com:
  - chave **"Triagem automática ligada"** (checkbox) com explicação: "Todo número novo que escrever para o WhatsApp da empresa recebe o menu (Quero conhecer, Serviços, Suporte, Financeiro)."
  - para **Farmácia** e **Padaria**: textarea "Texto (pode ter links)", input de imagem (`accept="image/*"`, mostra miniatura e botão "Remover"), input de PDF (`accept="application/pdf"`, mostra o nome e "Remover").
  - botão **Salvar triagem** → `apiClient.salvarWhatsappTriagem(triagem)`; mensagem verde "Triagem salva." ou vermelha com `e.response.data.message`.

- [ ] **Step 3: Selos na tela do WhatsApp** — em `frontend/app/whatsapp/page.tsx`:
  - Interface `Conversa`: acrescentar `bot_ativo?: boolean; bot_estado?: string | null; bot_dados?: any;`.
  - Função no componente:
```ts
  const ESTADOS_TRIAGEM = ['MENU', 'MENU_CLIENTE', 'SERVICO', 'SEGMENTO', 'RELACAO', 'NOME', 'CIDADE', 'CNPJ', 'CNPJ_CONFIRMA'];
  const emTriagem = (c?: Conversa | null) => !!c?.bot_ativo && ESTADOS_TRIAGEM.includes(c?.bot_estado || '');
  const avisoCnpj = (c?: Conversa | null): string | null => {
    const r = c?.bot_dados?.receita;
    if (!r || String(r.situacao || '').toUpperCase() === 'ATIVA') return null;
    return `CNPJ ${r.situacao || 'SEM SITUAÇÃO'} na Receita`;
  };
```
  - Na lista de conversas (junto do selo "Sem dono"): `{emTriagem(c) && <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-800">🤖 Em triagem</span>}` e `{avisoCnpj(c) && <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">⚠️ {avisoCnpj(c)}</span>}`.
  - No cabeçalho da conversa aberta e no painel lateral: o mesmo selo vermelho com `avisoCnpj(ativa)`, e no cabeçalho `emTriagem(ativa)` mostra "🤖 Em triagem — responder para o robô parar".
  - Depois de enviar texto/áudio/arquivo com sucesso, além de `marcarComoMinha`, atualizar localmente `setAtiva(a => a ? { ...a, bot_ativo: false } : a)` e o mesmo na lista.

- [ ] **Step 4: Alarme global** — em `frontend/components/dashboard/DashboardLayout.tsx`:
  - No `checar()` do sino, ignorar na soma de não lidas as conversas em triagem, para o bipe comum não tocar a cada resposta ao robô:
```ts
        const ESTADOS_TRIAGEM = ['MENU', 'MENU_CLIENTE', 'SERVICO', 'SEGMENTO', 'RELACAO', 'NOME', 'CIDADE', 'CNPJ', 'CNPJ_CONFIRMA'];
        const contaParaSino = (c: any) => !(c.bot_ativo && ESTADOS_TRIAGEM.includes(c.bot_estado || ''));
        const total = convs.filter(contaParaSino).reduce((s: number, c: any) => s + (c.nao_lidas || 0), 0);
```
  - Novo estado e efeito (depois do efeito do sino):
```tsx
  const [avisoLead, setAvisoLead] = useState<{ titulo: string; detalhe: string; alerta: string | null } | null>(null);
  const tocarAlarmeLead = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.9].forEach(atraso => {
        [659, 784, 988].forEach((freq, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
          const t0 = ctx.currentTime + atraso + i * 0.18;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.22, t0 + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
          o.start(t0); o.stop(t0 + 0.35);
        });
      });
    } catch {}
  };
  useEffect(() => {
    if (!user) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const es = new EventSource(`${apiUrl}/whatsapp/eventos?token=${encodeURIComponent(token)}`);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data);
        if (e.tipo !== 'lead_qualificado') return;
        tocarAlarmeLead();
        setAvisoLead({ titulo: e.titulo, detalhe: e.detalhe, alerta: e.alerta || null });
      } catch {}
    };
    return () => es.close();
  }, [user]);
```
  - Aviso fixo no canto (dentro do JSX raiz do layout, fora do `main`):
```tsx
      {avisoLead && (
        <div className="fixed bottom-5 right-5 z-[60] w-80 rounded-xl shadow-2xl border border-emerald-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-emerald-700">🔔 {avisoLead.titulo}</p>
            <button onClick={() => setAvisoLead(null)} className="text-gray-400 hover:text-gray-600" title="Fechar">✕</button>
          </div>
          <p className="text-sm text-gray-800 mt-1">{avisoLead.detalhe}</p>
          {avisoLead.alerta && <p className="text-xs font-bold text-white bg-red-600 rounded px-2 py-1 mt-2">⚠️ {avisoLead.alerta}</p>}
          <button onClick={() => { setAvisoLead(null); router.push('/whatsapp'); }}
            className="mt-3 w-full text-sm font-semibold text-white rounded-lg py-2" style={{ background: '#128C7E' }}>
            Abrir conversas sem dono
          </button>
        </div>
      )}
```

- [ ] **Step 5: Conferência**

Run: `cd frontend && npx tsc --noEmit -p . 2>&1 | grep -E "configuracoes|app/whatsapp|DashboardLayout|api-client" || echo "tsc ok"`
Expected: `tsc ok`.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/api-client.ts frontend/app/configuracoes/page.tsx frontend/app/whatsapp/page.tsx frontend/components/dashboard/DashboardLayout.tsx
git commit -m "feat(whatsapp): configuração da triagem, selos Em triagem/CNPJ e alarme de lead qualificado"
```

---

### Task 7: Deploy e teste real (com a usuária — não executar sem o "pode subir")

- [ ] **Step 1:** Push para `main` (fast-forward) depois da revisão final.
- [ ] **Step 2 (VPS):** backup `mysqldump db_comercial WhatsappConversa ConfiguracaoIntegracao`; `git pull --ff-only`; `npx prisma generate`; conferir `prisma migrate diff` — esperado exatamente: `ALTER TABLE \`ConfiguracaoIntegracao\` MODIFY \`valor\` LONGTEXT NOT NULL;` e `ALTER TABLE \`WhatsappConversa\` ADD COLUMN \`bot_dados\` JSON NULL;` (qualquer outra linha → parar); `npx prisma db push --skip-generate`; `npm run build` no frontend; `pm2 restart ecosystem.config.js --only comercial-backend,comercial-frontend --update-env`; `/health` ok.
- [ ] **Step 3:** Usuária liga a triagem em Configurações → Triagem.
- [ ] **Step 4 (celular de teste, número que nunca falou com a empresa):** Quero conhecer → Farmácia → Não conheço → nome → cidade → CNPJ inválido (recusado) → CNPJ válido (confirmação com nome da empresa) → Sim → mensagem final; no CRM: selo Em triagem durante, alarme + aviso no fim, lead com dados da Receita e observação com sócios, etiqueta Farmácia, prioridade Crítica.
- [ ] **Step 5:** Outros números (ou apagar a conversa de teste entre rodadas): Suporte e Financeiro (texto com 27 99779-8103, etiqueta, sem alarme); Serviços (pergunta + alarme); vendedor responde no meio → robô para.
