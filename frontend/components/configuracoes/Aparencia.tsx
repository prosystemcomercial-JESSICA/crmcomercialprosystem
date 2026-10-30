'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeColor, type ThemeMode } from '@/lib/theme-context';
import './aparencia.css';

const THEMES: { id: ThemeColor; name: string; description: string }[] = [
  { id: 'champagne', name: 'Champagne', description: 'Areia, marfim e detalhes em bronze.' },
  { id: 'gelo', name: 'Branco gelo', description: 'Branco suave, cinza frio e detalhes em ardósia.' },
  { id: 'azul', name: 'Azul Prosystem', description: 'Superfícies neutras com o azul da marca.' },
  { id: 'azul-intenso', name: 'Azul intenso', description: 'Menu azul profundo e detalhes mais marcantes.' },
  { id: 'laranja', name: 'Laranja', description: 'Tons de pedra com detalhes em terracota.' },
  { id: 'verde', name: 'Verde', description: 'Cinza suave com detalhes em verde sóbrio.' },
];

export default function Aparencia() {
  const { color, mode, automatico, setColor, setMode, usarAutomatico } = useTheme();
  return (
    <section className="aparencia" aria-labelledby="aparencia-titulo">
      <header className="aparencia-cab">
        <h2 id="aparencia-titulo">Aparência</h2>
        <p>Personalize fundos, painéis e controles. Sua escolha é salva neste navegador.</p>
      </header>
      <div className="aparencia-conteudo">
        <fieldset className="aparencia-modo">
          <legend>Modo</legend>
          {([{ id: 'claro', name: 'Claro', Icon: Sun }, { id: 'escuro', name: 'Escuro', Icon: Moon }] as const).map(({ id, name, Icon }) => (
            <button key={id} type="button" aria-pressed={!automatico && mode === id} onClick={() => setMode(id as ThemeMode)}>
              <Icon size={16} aria-hidden="true" />{name}{!automatico && mode === id && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
          <button type="button" aria-pressed={automatico} onClick={usarAutomatico} title="Segue o modo claro/escuro do Windows ou do celular">
            <Monitor size={16} aria-hidden="true" />Automático{automatico && <Check size={14} aria-hidden="true" />}
          </button>
        </fieldset>
        {automatico && <p className="aparencia-nota" style={{ marginTop: -12, marginBottom: 20 }}>Seguindo o sistema: agora está no modo {mode === 'escuro' ? 'escuro' : 'claro'}.</p>}
        <fieldset>
          <legend>Paleta</legend>
          <div className="aparencia-paletas">
            {THEMES.map(theme => (
              <button key={theme.id} type="button" className="aparencia-opcao" aria-label={theme.name} aria-pressed={color === theme.id} onClick={() => setColor(theme.id)}>
                <span className={'aparencia-previa' + (mode === 'escuro' ? ' dark' : '')} data-theme={theme.id} aria-hidden="true">
                  <span className="aparencia-mini-menu"><i /><i /><i /></span>
                  <span className="aparencia-mini-pagina">
                    <span className="aparencia-mini-topo"><i /><b /></span>
                    <span className="aparencia-mini-cards"><i /><i /></span>
                    <span className="aparencia-mini-lista"><i /><i /></span>
                  </span>
                </span>
                <span className="aparencia-nome">{theme.name}{color === theme.id && <Check size={16} aria-hidden="true" />}</span>
                <span className="aparencia-descricao">{theme.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="aparencia-nota">Todas as paletas têm versão clara e escura. Alertas mantêm suas cores de significado.</p>
      </div>
    </section>
  );
}
