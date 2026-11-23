import { describe, it, expect } from 'vitest';
import { analisarStatusBackup } from '../src/services/backup-monitor.service';

const horasAtras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const chaves = (s: any, pc: any = null) => analisarStatusBackup(s, pc).map(p => p.chave).sort();

const bom = () => ({
  em: horasAtras(2), ultimo_ok_em: horasAtras(2), ok: true, erros: [], disco_pct: 52,
  sql: { bytes: 500_000_000, tabelas: 113, tabelas_banco: 113 },
  restauracao: { em: horasAtras(10), ok: true },
  nuvem: { ultimo_ok_em: horasAtras(2), ok: true, livre_bytes: 12 * 1024 ** 3 },
});

describe('vigia dos backups', () => {
  it('tudo em dia: nenhum aviso', () => {
    expect(chaves(bom(), { pc_em: horasAtras(30) })).toEqual([]);
  });

  it('sem o arquivo de situação: avisa', () => {
    expect(chaves(null)).toEqual(['vps_sem_status']);
  });

  it('última execução falhou e o último backup bom ficou velho', () => {
    const s = { ...bom(), ok: false, erros: ['json: exportação com erro'], ultimo_ok_em: horasAtras(20) };
    expect(chaves(s)).toEqual(['vps_atrasado', 'vps_falhou']);
    expect(analisarStatusBackup(s, null).find(p => p.chave === 'vps_falhou')!.texto).toContain('json: exportação com erro');
  });

  it('teste de restauração reprovado ou parado', () => {
    expect(chaves({ ...bom(), restauracao: { em: horasAtras(5), ok: false } })).toEqual(['restauracao_falhou']);
    expect(chaves({ ...bom(), restauracao: { em: horasAtras(40), ok: true } })).toEqual(['restauracao_atrasada']);
    expect(chaves({ ...bom(), restauracao: null })).toEqual(['restauracao_atrasada']);
  });

  it('nuvem desligada, atrasada ou quase cheia', () => {
    expect(chaves({ ...bom(), nuvem: { configurada: false } })).toEqual(['nuvem_desligada']);
    expect(chaves({ ...bom(), nuvem: { ultimo_ok_em: horasAtras(48), livre_bytes: 12 * 1024 ** 3 } })).toEqual(['nuvem_atrasada']);
    expect(chaves({ ...bom(), nuvem: { ultimo_ok_em: horasAtras(1), livre_bytes: 1024 ** 3 } })).toEqual(['nuvem_cheia']);
  });

  it('disco do servidor perto de lotar', () => {
    expect(chaves({ ...bom(), disco_pct: 90 })).toEqual(['disco_cheio']);
  });

  it('cópia do computador só avisa depois de 7 dias parada', () => {
    expect(chaves(bom(), { pc_em: horasAtras(24 * 4) })).toEqual([]);
    expect(chaves(bom(), { pc_em: horasAtras(24 * 8) })).toEqual(['pc_atrasado']);
  });
});
