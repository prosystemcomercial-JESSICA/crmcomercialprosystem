import { describe, it, expect } from 'vitest';
import {
  perfilDe, onboardingItensDoPerfil, itemPelaFicha, camposDoItemOnboarding, dadosDaFicha, rotuloCampoColeta,
  ONBOARDING_PELA_FICHA, ONBOARDING_ITENS, ITEM_PERGUNTAS, CAMPOS_COLETA,
} from '../src/lib/implantacao/portal';

// Roteiro do onboarding marcado pela ficha de coleta (pedido da Jessica, 29/10/2026).
describe('roteiro do onboarding pela ficha', () => {
  const farmacia = perfilDe('Farmácia', 'CONVERSAO');
  const varejoZerado = perfilDe('Varejo', 'BANCO_ZERADO');

  it('todo item automático existe no roteiro e só usa campos da ficha', () => {
    const chaves = new Set([...CAMPOS_COLETA.map(c => c.key), 'contato_email']);
    for (const [titulo, campos] of Object.entries(ONBOARDING_PELA_FICHA)) {
      expect(ONBOARDING_ITENS).toContain(titulo);
      for (const k of campos) expect(chaves.has(k)).toBe(true);
    }
  });

  it('ações do técnico continuam à mão', () => {
    expect(camposDoItemOnboarding('Apresentar-se ao cliente como técnico responsável pela implantação', farmacia)).toBeNull();
    expect(camposDoItemOnboarding('Diagnóstico aprovado pelo cliente', farmacia)).toBeNull();
    expect(camposDoItemOnboarding('Computadores ligados, Windows atualizado e acesso de administrador', farmacia)).toBeNull();
  });

  it('marca quando os campos estão preenchidos e lista o que falta', () => {
    const t = 'Contador responsável e contato da contabilidade';
    expect(itemPelaFicha(t, farmacia, { contabilidade_nome: 'Escritório X' })).toEqual({ campos: ['contabilidade_nome', 'contabilidade_contato'], faltam: ['contabilidade_contato'] });
    expect(itemPelaFicha(t, farmacia, { contabilidade_nome: 'Escritório X', contabilidade_contato: '27 99999-0000' })!.faltam).toEqual([]);
    expect(itemPelaFicha(t, farmacia, { contabilidade_nome: '   ', contabilidade_contato: 'a' })!.faltam).toEqual(['contabilidade_nome']);
  });

  it('o e-mail do contato vem de fora da coleta', () => {
    const dados = dadosDaFicha({ coleta: { contato_nome: 'Ana', contato_telefone: '27999990000' }, contato_email: 'ana@loja.com' });
    expect(itemPelaFicha('Confirmar o contato principal (nome, telefone e e-mail) e o canal de comunicação', farmacia, dados)!.faltam).toEqual([]);
    expect(rotuloCampoColeta('contato_email')).toBe('E-mail para avisos e boletos');
  });

  it('acompanha o perfil: títulos trocados e campos que não cabem', () => {
    const itens = onboardingItensDoPerfil(varejoZerado);
    const volume = itens.find(t => /Volume aproximado/.test(t))!;
    expect(camposDoItemOnboarding(volume, varejoZerado)).toEqual(['volume_produtos']); // banco zerado: sem sistema anterior
    const lote = itens.find(t => /Controle de lote/.test(t))!;
    expect(camposDoItemOnboarding(lote, varejoZerado)).toEqual(['controle_lote']);
    expect(camposDoItemOnboarding(ITEM_PERGUNTAS, varejoZerado)).not.toContain('pbms');
    // Todo item do roteiro do perfil que confirma dado tem campos (nenhum fica órfão ao trocar o texto).
    const automaticos = itens.filter(t => camposDoItemOnboarding(t, varejoZerado));
    expect(automaticos.length).toBe(Object.keys(ONBOARDING_PELA_FICHA).length + 1);
  });
});
