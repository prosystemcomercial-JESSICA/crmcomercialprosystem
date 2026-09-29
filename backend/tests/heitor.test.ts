import { describe, it, expect } from 'vitest';
import { ehRede, dentroDoPerfil, telefoneBr, ehCelular, lerSite, cnpjValido, responsavelDaReceita, consultasDoLugar, observacaoDoLead, ONDAS } from '../src/lib/assistente/heitor';

describe('Heitor, o prospectador', () => {
  it('começa pela Grande Vitória', () => {
    expect(ONDAS[0].nome).toBe('Grande Vitória');
    expect(ONDAS[0].cidades.map(c => c.nome)).toContain('Vila Velha');
  });
  it('monta as buscas por segmento e lugar', () => {
    const c = { nome: 'Vitória', uf: 'ES' };
    expect(consultasDoLugar('Vitória', c, ['farmacia', 'padaria']).map(q => q.texto)).toEqual(['farmácia em Vitória, ES', 'drogaria em Vitória, ES', 'padaria em Vitória, ES']);
    expect(consultasDoLugar('Jardim da Penha', c, ['padaria'])[0]).toEqual({ texto: 'padaria em Jardim da Penha, Vitória, ES', segmento: 'Padaria' });
  });
  it('descarta redes grandes e mantém independentes', () => {
    for (const n of ['Drogasil', 'Farmácia Pague Menos', 'Drogarias Pacheco', 'Santa Lúcia Drogarias', 'Farmes - Reta da Penha I']) expect(ehRede(n)).toBe(true);
    for (const n of ['Farmácia Central', 'Padaria São João', 'FARMALAR', 'Farmácia Homeopática Medicinallis']) expect(ehRede(n)).toBe(false);
  });
  it('confere a categoria do Google', () => {
    expect(dentroDoPerfil('Drogaria', 'Farmácia')).toBe(true);
    expect(dentroDoPerfil('Empresa farmacêutica', 'Farmácia')).toBe(false);
    expect(dentroDoPerfil('Farmácia veterinária', 'Farmácia')).toBe(false);
    expect(dentroDoPerfil('Padaria', 'Padaria')).toBe(true);
    expect(dentroDoPerfil('Supermercado', 'Padaria')).toBe(false);
  });
  it('normaliza telefone e reconhece celular', () => {
    expect(telefoneBr('(27) 99710-8361')).toBe('5527997108361');
    expect(telefoneBr('(27) 3317-0403')).toBe('552733170403');
    expect(telefoneBr('4002-8282')).toBeNull();
    expect(telefoneBr('0800 123 4567')).toBeNull();
    expect(ehCelular('5527997108361')).toBe(true);
    expect(ehCelular('552733170403')).toBe(false);
  });
  it('lê redes, WhatsApp, e-mail e CNPJ do site', () => {
    const html = '<a href="https://www.instagram.com/farmaciaexemplo/?hl=pt">ig</a> <a href="https://wa.me/5527999990000">zap</a> contato@farmaciaexemplo.com.br logo@2x.png CNPJ 11.222.333/0001-81';
    const a = lerSite(html, 'https://farmaciaexemplo.com.br');
    expect(a.instagram).toBe('https://www.instagram.com/farmaciaexemplo');
    expect(a.whatsapp).toBe('5527999990000');
    expect(a.emails).toEqual(['contato@farmaciaexemplo.com.br']);
    expect(a.cnpj).toBe('11222333000181');
    expect(lerSite('', 'https://instagram.com/padariaexemplo').instagram).toBe('https://instagram.com/padariaexemplo');
  });
  it('valida CNPJ e escolhe o sócio-administrador', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
    expect(responsavelDaReceita([{ nome: 'MARIA EXEMPLO', qualificacao: 'Sócio' }, { nome: 'JOAO EXEMPLO', qualificacao: 'Sócio-Administrador' }])).toBe('Joao Exemplo');
    expect(responsavelDaReceita([])).toBeNull();
  });
  it('escreve a observação do lead', () => {
    const o = observacaoDoLead({ nome: 'Farmácia Exemplo', segmento: 'Farmácia', cidade: 'Vitória', bairro: 'Jardim da Penha', uf: 'ES', endereco: 'Rua Exemplo, 1', telefone: '552733330000', whatsapp: '5527999990000', site: null, emails: [], instagram: 'https://instagram.com/x', facebook: null, linkedin: null, cnpj: '11222333000181', razao_social: 'FARMACIA EXEMPLO LTDA', socios: [], abertura: null, porte: null, nota: 4.6, avaliacoes: 80, horario: null, maps_link: null });
    expect(o).toContain('Jardim da Penha, Vitória');
    expect(o).toContain('Nota 4,6');
    expect(o).toContain('11.222.333/0001-81');
    expect(o).toContain('WhatsApp confirmado');
  });
});
