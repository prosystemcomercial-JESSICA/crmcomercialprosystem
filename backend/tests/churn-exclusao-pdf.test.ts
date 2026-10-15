import { describe, it, expect } from 'vitest';
import { gerarRelatorioExclusaoPdf } from '../src/lib/churn-exclusao-pdf';

// Relatório em PDF para o Teams (pedido da Jessica, 15/10/2026), na identidade Prosystem.
describe('relatório de churn em PDF', () => {
  it('gera um PDF com os clientes, as observações e a observação do envio', async () => {
    const pdf = await gerarRelatorioExclusaoPdf({
      enviado_por: 'Jessica', para: 'CEO', observacao: 'conferir boletos', link: 'https://crm/casos?aba=exclusao',
      clientes: [
        { codigo: '1', nome: 'FARMÁCIA A', cnpj: '11222333000181', status: 'PERDIDO', perdido_em: new Date(), mensalidade: 300, valor_devido: 100, motivo: 'Inadimplência', fin_situacao: 'INADIMPLENTE', atualizacoes: [{ em: new Date(), por: 'Ana', texto: 'ligou' }] },
        { nome: 'PADARIA B', status: 'SISTEMA_REMOVIDO', mensalidade: null },
      ],
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(5000);
  });
  it('lote grande quebra a página antes dos detalhes e continua gerando', async () => {
    const clientes = Array.from({ length: 12 }, (_, i) => ({ nome: `Cliente ${i}`, status: 'PERDIDO', mensalidade: 200 }));
    const pdf = await gerarRelatorioExclusaoPdf({ enviado_por: 'J', link: 'L', clientes });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
