import { describe, it, expect } from 'vitest';
import { gerarPdfImplantacao } from '../src/lib/implantacao-pdf';

const dados = {
  cliente: 'Farmácia Teste', cnpj: '00.000.000/0001-00', modulo: 'IMPLANTACAO', tipo: 'Implantação · conversão de Trier', plano: 'Farma Pro',
  tecnico: 'Lucas Diniz', assinatura: new Date('2026-10-01T12:00:00Z'), virada: new Date('2026-10-12T12:00:00Z'), validacao: new Date('2026-10-20T12:00:00Z'),
  decisor: 'Ana Souza', contato: 'Bruno · 27999990000',
  etapas: [{ nome: 'Instalação e configuração', feitos: 14, total: 14 }],
  testes: [{ item: 'Produtos', resultado: 'OK' }, { item: 'Estoque', resultado: 'DIVERGENTE', observacao: 'ajustado' }],
  treinamento: [{ ordem: 1, nome: 'Caixa e PDV', realizada_em: new Date('2026-10-13T12:00:00Z'), participantes: ['Bruno', 'Carla'], confirmado_por: 'Ana Souza' }],
  assistida: { feitos: 5, total: 5 }, correcoes: [{ titulo: 'Estoque negativo', situacao: 'RESOLVIDA' }],
  equipamentos: [{ tipo: 'Caixa (PDV)', descricao: 'Caixa 1' }], horas: 18, suporte: { telefone: '27 99779-8103' },
};

describe('PDFs da implantação', () => {
  it('gera o relatório final e o termo de aceite como PDF válido', async () => {
    for (const termo of [false, true]) {
      const pdf = await gerarPdfImplantacao(dados, termo);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(2000);
    }
  }, 30000);
});
