import { describe, it, expect } from 'vitest';
import { lerEnv, aplicarEnv } from '../src/lib/env-arquivo';

describe('.env manda sobre a foto do PM2 (caso de 22-23/10/2026)', () => {
  it('lê o .env como o ecosystem.config.js', () => {
    const env = lerEnv('# comentário\nEVOLUTION_API_URL=https://prosystemnet.uazapi.com\nA="com aspas"\n\nB=x=y\nlixo\n');
    expect(env).toEqual({ EVOLUTION_API_URL: 'https://prosystemnet.uazapi.com', A: 'com aspas', B: 'x=y' });
  });

  it('sobrescreve o endereço antigo da UAZAPI e devolve só o nome da variável', () => {
    const processo: NodeJS.ProcessEnv = { EVOLUTION_API_URL: 'https://advleticiabarros.uazapi.com', IGUAL: '1', SO_PM2: 'fica' };
    const corrigidas = aplicarEnv({ EVOLUTION_API_URL: 'https://prosystemnet.uazapi.com', IGUAL: '1', NOVA: 'n' }, processo);
    expect(corrigidas).toEqual(['EVOLUTION_API_URL']);
    expect(processo).toEqual({ EVOLUTION_API_URL: 'https://prosystemnet.uazapi.com', IGUAL: '1', SO_PM2: 'fica', NOVA: 'n' });
  });
});
