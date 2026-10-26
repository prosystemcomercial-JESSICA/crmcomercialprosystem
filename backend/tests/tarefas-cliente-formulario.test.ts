import { describe, it, expect } from 'vitest';
import { TAREFAS_CLIENTE_PADRAO, TAREFA_LISTA_USUARIOS, formularioDaTarefa, respostaDoFormulario } from '../src/lib/implantacao/portal';

describe('tarefas do cliente com formulário (26/10/2026)', () => {
  it('pedido inicial: certificado, CSC, contador, regime e inscrição; sem XMLs nem lista de usuários', () => {
    expect(TAREFAS_CLIENTE_PADRAO.join(' ')).not.toMatch(/XML|Lista de quem/);
    expect(TAREFAS_CLIENTE_PADRAO).toHaveLength(5);
    for (const t of TAREFAS_CLIENTE_PADRAO) expect(formularioDaTarefa(t)).not.toBeNull();
    expect(formularioDaTarefa(TAREFAS_CLIENTE_PADRAO[0])!.exige_arquivo).toBe(true);
  });
  it('dados do contador: confere campo a campo e preenche a ficha', () => {
    const f = formularioDaTarefa('Dados do contador')!;
    expect(respostaDoFormulario(f, { nome: 'Ana', documento: '123', crc: 'ES-1' })).toEqual({ erro: 'Preencha: E-mail.' });
    const r = respostaDoFormulario(f, { nome: 'Ana', documento: '123', crc: 'ES-1', email: 'ana@x.com' }) as any;
    expect(r.texto).toContain('CRC: ES-1');
    expect(r.coleta.contabilidade_email).toBe('ana@x.com');
  });
  it('regime só aceita as opções da lista', () => {
    const f = formularioDaTarefa('Regime tributário')!;
    expect('erro' in respostaDoFormulario(f, { regime: 'qualquer' })).toBe(true);
    expect((respostaDoFormulario(f, { regime: 'Lucro Real' }) as any).coleta.regime_tributario).toBe('Lucro Real');
  });
  it('lista de usuários: uma pessoa por linha, ignora linhas vazias', () => {
    const f = formularioDaTarefa(TAREFA_LISTA_USUARIOS)!;
    const r = respostaDoFormulario(f, {}, [{ nome: 'Maria', funcao: 'Caixa' }, {}, { nome: 'João', funcao: 'Gerente' }]) as any;
    expect(r.texto).toBe('1. Maria · Caixa\n2. João · Gerente');
    expect(r.coleta.usuarios).toBe(2);
    expect('erro' in respostaDoFormulario(f, {}, [{ nome: 'Maria' }])).toBe(true);
  });
});
