import { describe, it, expect } from 'vitest';
import { montarHistorico, grupoDaAtividade } from '../src/lib/implantacao/historico';

describe('histórico do card (06/10/2026)', () => {
  it('cronômetro vira execução, pausa ou espera', () => {
    expect(grupoDaAtividade('CRONOMETRO', '▶ Lucas começou a trabalhar (Instalação)')).toBe('EXECUCAO');
    expect(grupoDaAtividade('CRONOMETRO', '⏸ Lucas pausou: Intervalo / almoço')).toBe('PAUSA');
    expect(grupoDaAtividade('CRONOMETRO', '⏳ Aguardando cliente: certificado')).toBe('ESPERA');
    expect(grupoDaAtividade('CRONOMETRO', '✅ Fim da espera (Aguardando cliente), 3h parada')).toBe('ESPERA');
    expect(grupoDaAtividade('ARQUIVO', '📎 Arquivo anexado')).toBe('SISTEMA');
  });

  const base = {
    atividades: [{ id: 'a1', tipo: 'CRONOMETRO', descricao: '▶ Lucas começou', autor_nome: 'Lucas', created_at: '2026-10-06T12:00:00Z' }],
    registros: [
      { id: 'r1', tipo: 'PRINT', categoria: 'SUPORTE', texto: null, imagem_caminho: '/x.jpg', autor_id: 'lucas', autor_nome: 'Lucas', editado_em: null, created_at: '2026-10-06T13:00:00Z' },
      { id: 'r2', tipo: 'OBS', categoria: null, texto: 'Cliente pediu para remarcar', imagem_caminho: null, autor_id: 'jessica', autor_nome: 'Jessica', editado_em: '2026-10-06T15:00:00Z', created_at: '2026-10-06T14:00:00Z' },
    ],
    observacoes: [
      { id: 'o1', texto: 'compartilhada', privada: false, autor_id: 'jessica', autor_nome: 'Jessica', created_at: '2026-10-06T11:00:00Z' },
      { id: 'o2', texto: 'pessoal da Jessica', privada: true, autor_id: 'jessica', autor_nome: 'Jessica', created_at: '2026-10-06T11:30:00Z' },
    ],
    recados: [
      { id: 'v1', texto: 'Ligar para o dono', de_nome: 'Jessica', para_nome: 'Lucas', lido_em: null, origem: 'GESTAO', created_at: '2026-10-06T10:00:00Z' },
      { id: 'v2', texto: 'SLA estourando', de_nome: null, para_nome: 'Lucas', lido_em: null, origem: 'SISTEMA', created_at: '2026-10-06T10:30:00Z' },
    ],
  };

  it('junta tudo do mais recente para o mais antigo', () => {
    const ev = montarHistorico({ ator: { id: 'lucas', gestao: false }, ...base });
    expect(ev.map(e => e.id)).toEqual(['r-r2', 'r-r1', 'a-a1', 'o-o1', 'v-v1']);
  });

  it('observação pessoal só para quem escreveu; recado automático fica de fora', () => {
    const lucas = montarHistorico({ ator: { id: 'lucas', gestao: false }, ...base });
    expect(lucas.some(e => e.id === 'o-o2')).toBe(false);
    expect(lucas.some(e => e.id === 'v-v2')).toBe(false);
    const jessica = montarHistorico({ ator: { id: 'jessica', gestao: true }, ...base });
    expect(jessica.find(e => e.id === 'o-o2')?.pessoal).toBe(true);
  });

  it('quem pode editar e excluir: autor ou gestão', () => {
    const lucas = montarHistorico({ ator: { id: 'lucas', gestao: false }, ...base });
    expect(lucas.find(e => e.id === 'r-r1')?.registro?.pode_mexer).toBe(true);
    expect(lucas.find(e => e.id === 'r-r2')?.registro?.pode_mexer).toBe(false);
    const gestao = montarHistorico({ ator: { id: 'outra', gestao: true }, ...base });
    expect(gestao.find(e => e.id === 'r-r2')?.registro?.pode_mexer).toBe(true);
    expect(lucas.find(e => e.id === 'r-r1')?.texto).toBe('Print (print do suporte)');
    expect(lucas.find(e => e.id === 'r-r1')?.registro?.texto).toBeNull();
  });
});
