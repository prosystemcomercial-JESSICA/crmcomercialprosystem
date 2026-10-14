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
