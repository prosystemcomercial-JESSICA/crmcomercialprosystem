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
  // Qualificado → aparece em "Leads para Distribuir" para a Supervisão encaminhar.
  out.etapa_sdr = ETAPA_QUALIFICADO;
  return out;
}

const ETAPA_QUALIFICADO = 'QUALIFICADO';

export function efeitosDesfecho(desfecho: Desfecho, dados: DadosTriagem, leadAtual: LeadAtual | null): EfeitosDesfecho {
  if (desfecho === 'suporte' || desfecho === 'financeiro') {
    const etiqueta = desfecho === 'suporte' ? 'Suporte' : 'Financeiro';
    return { conversa: { etiqueta, etiqueta_cor: COR[etiqueta], desvincularLead: true }, lead: null, observacao: null, notificacao: null };
  }
  if (desfecho === 'servicos') {
    return {
      conversa: { etiqueta: 'Serviços', etiqueta_cor: COR['Serviços'], desvincularLead: false },
      lead: { etapa_sdr: ETAPA_QUALIFICADO },
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
