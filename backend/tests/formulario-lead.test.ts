import { describe, it, expect } from 'vitest';
import { lerFormularioLead, origemDoFormulario } from '../src/lib/formulario-lead';

describe('formulário de captação de lead (site/blog)', () => {
  it('lê os campos, normaliza o WhatsApp com 55 e monta a origem', () => {
    const r = lerFormularioLead({ nome: ' Maria Souza ', telefone: '(27) 99888-7766', email: 'maria@farma.com', empresa: 'Farmácia Boa Saúde', segmento: 'farmacia', cidade: 'Serra/ES', origem: 'blog', material: 'Guia SNGPC', pagina: 'https://prosystemnet.com/blog/sngpc', utm_source: 'google' });
    expect(r).toEqual({ ok: true, dados: expect.objectContaining({ nome: 'Maria Souza', telefone: '5527998887766', email: 'maria@farma.com', empresa: 'Farmácia Boa Saúde', segmento: 'Farmácia', cidade: 'Serra', estado: 'ES', origem: 'FORMULARIO_BLOG', material: 'Guia SNGPC', pagina: 'https://prosystemnet.com/blog/sngpc', utm_source: 'google' }) });
  });

  it('segmento padaria e telefone já com 55', () => {
    const r = lerFormularioLead({ nome: 'João', telefone: '5531988887777', segmento: 'Panificadora' });
    expect(r.ok && [r.dados.telefone, r.dados.segmento, r.dados.origem]).toEqual(['5531988887777', 'Padaria', 'FORMULARIO_SITE']);
  });

  it('recusa sem nome ou sem WhatsApp válido, com mensagem clara', () => {
    expect(lerFormularioLead({ telefone: '27999998888' })).toEqual({ ok: false, erro: 'Preencha seu nome e WhatsApp.' });
    expect(lerFormularioLead({ nome: 'Ana', telefone: '9999' })).toEqual({ ok: false, erro: 'Informe o WhatsApp com DDD.' });
  });

  it('robô (campo invisível preenchido) é ignorado em silêncio', () => {
    expect(lerFormularioLead({ nome: 'Bot', telefone: '27999998888', site: 'http://spam' })).toEqual({ ok: false, robo: true, erro: '' });
  });

  it('origem vira um código limpo', () => {
    expect(origemDoFormulario('Blog Prosystem')).toBe('FORMULARIO_BLOG_PROSYSTEM');
    expect(origemDoFormulario('landing-página')).toBe('FORMULARIO_LANDING_PAGINA');
    expect(origemDoFormulario(undefined)).toBe('FORMULARIO_SITE');
  });
});
