import { describe, it, expect } from 'vitest';
import { canalDoLead, campanhaDoLead } from '../src/lib/funil-origem';

// Funil por origem (parte 4 do plano, 14/10/2026), com as origens reais dos leads de out/2026.
describe('canal e campanha do lead', () => {
  it('classifica as origens reais', () => {
    expect(canalDoLead({ origem: 'PROSPECCAO', utm_source: 'google_maps', campanha_nome: 'Prospecção Heitor' })).toBe('Prospecção (Heitor)');
    expect(canalDoLead({ origem: 'CAMPANHA', utm_source: 'facebook', utm_campaign: 'prosystem_demonstracao_13082026' })).toBe('Anúncio (Meta)');
    expect(canalDoLead({ origem: 'FORMULARIO_BLOG' })).toBe('Blog');
    expect(canalDoLead({ origem: 'FORMULARIO_SITE' })).toBe('Site');
    expect(canalDoLead({ origem: 'INDICACAO', campanha_nome: 'Indicação de cliente' })).toBe('Indicação de cliente');
    expect(canalDoLead({ origem: 'INDICACAO', campanha_nome: 'Decisor indicado pela loja' })).toBe('Indicação da loja (decisor)');
    expect(canalDoLead({ origem: 'WHATSAPP' })).toBe('WhatsApp direto');
  });
  it('a campanha vem da UTM, depois do nome no CRM, depois do canal', () => {
    expect(campanhaDoLead({ origem: 'CAMPANHA', utm_source: 'facebook', utm_campaign: 'farmacia_out26_video', campanha_nome: 'x' })).toBe('farmacia_out26_video');
    expect(campanhaDoLead({ origem: 'FORMULARIO_BLOG', campanha_nome: 'Formulário: Guia do SNGPC' })).toBe('Formulário: Guia do SNGPC');
    expect(campanhaDoLead({ origem: 'WHATSAPP' })).toBe('WhatsApp direto');
  });
});

// Painel de Leads (13/11/2026): as origens escritas de vários jeitos caem no mesmo canal.
describe('origens escritas de jeitos diferentes', () => {
  it('junta maiúscula, acento e o nome digitado à mão', () => {
    expect(canalDoLead({ origem: 'Instagram' })).toBe('Instagram');
    expect(canalDoLead({ origem: 'INSTAGRAM' })).toBe('Instagram');
    expect(canalDoLead({ origem: 'Indicação' })).toBe('Indicação');
    expect(canalDoLead({ origem: 'INDICACAO' })).toBe('Indicação da loja (decisor)');
    expect(canalDoLead({ origem: 'Prospecção ativa' })).toBe('Prospecção ativa (equipe)');
    expect(canalDoLead({ origem: 'Cliente antigo' })).toBe('Cliente antigo');
    expect(canalDoLead({ origem: 'CLIENTE_ANTIGO' })).toBe('Cliente antigo');
    expect(canalDoLead({ origem: 'RECUPERACAO_CLIENTE_INATIVO' })).toBe('Recuperação de inativos');
    expect(canalDoLead({ origem: 'CAMPANHA_PADARIA_2025_2026' })).toBe('Campanha pelo WhatsApp');
    expect(campanhaDoLead({ origem: 'CAMPANHA_PADARIA_2025_2026' })).toBe('Campanha padaria 2025 2026');
    expect(canalDoLead({ origem: 'Instagram', utm_source: 'facebook' })).toBe('Anúncio (Meta)');
    expect(canalDoLead({ origem: null })).toBe('Sem origem');
  });
});
