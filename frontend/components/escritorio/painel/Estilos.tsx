// Estilos do escritório por setores (10/11/2026): menu, faixa de saúde, quadros, abas, tabelas e o menu em abas no celular.
export default function EstilosEscritorio() {
  return <style>{`
        .esc-faixa{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
        .esc-grade{display:grid;grid-template-columns:210px minmax(0,1fr);gap:16px;align-items:start}
        .esc-menu{position:sticky;top:12px;display:grid;gap:2px;padding:10px;border-radius:14px;background:var(--t-card-bg);border:1px solid var(--t-card-border)}
        .esc-menu-titulo{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--t-text-muted);padding:4px 8px}
        .esc-menu-item{display:flex;align-items:center;gap:8px;min-height:38px;padding:0 10px;border-radius:10px;border:none;background:none;color:var(--t-text-primary);font-size:14px;cursor:pointer;text-align:left}
        .esc-menu-item:hover{background:var(--t-content-bg)}
        .esc-menu-item.ativo{background:#2563eb14;color:#1d4ed8;font-weight:700;box-shadow:inset 3px 0 0 #2563eb}
        .esc-menu-item:focus-visible,.esc-btn:focus-visible,.esc-aba:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
        .esc-menu-num{font-size:12px;color:var(--t-text-muted);font-variant-numeric:tabular-nums}
        .esc-menu-badge{min-width:22px;height:20px;padding:0 6px;border-radius:999px;background:#f59e0b;color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center}
        .esc-quadros{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;align-items:start}
        .esc-quadro{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:14px;background:var(--t-card-bg);border:1px solid var(--t-card-border)}
        .esc-quadro-numeros{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .esc-quadro-numeros span{display:grid;padding:6px 8px;border-radius:10px;background:var(--t-content-bg)}
        .esc-quadro-numeros b{font-size:17px;color:var(--t-text-primary);font-variant-numeric:tabular-nums}
        .esc-quadro-numeros small{font-size:11px;color:var(--t-text-muted)}
        .esc-btn{min-height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--t-card-border);background:var(--t-card-bg);color:var(--t-text-primary);font-size:13px;font-weight:700;cursor:pointer}
        .esc-btn.primario{border:none;color:#fff}
        .esc-btn:disabled{opacity:.5;cursor:default}
        .esc-aba{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--t-card-border);background:var(--t-card-bg);color:var(--t-text-primary);font-size:13px;cursor:pointer}
        .esc-aba.ativa{background:#2563eb;border-color:#2563eb;color:#fff}
        .esc-cartao{padding:14px;border-radius:14px;background:var(--t-card-bg);border:1px solid var(--t-card-border)}
        .esc-tabela{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;color:var(--t-text-secondary)}
        .esc-tabela th{text-align:left;font-size:11px;font-weight:700;color:var(--t-text-muted);padding:4px 6px;border-bottom:1px solid var(--t-card-border)}
        .esc-tabela td{padding:6px;border-bottom:1px solid var(--t-card-border);font-variant-numeric:tabular-nums}
        @media (max-width:900px){
          .esc-grade{grid-template-columns:minmax(0,1fr)}
          .esc-menu{position:static;display:flex;overflow-x:auto;gap:6px;padding:6px;scrollbar-width:none}
          .esc-menu-titulo{display:none}
          .esc-menu-item{flex:0 0 auto;white-space:nowrap;border:1px solid var(--t-card-border);border-radius:999px}
          .esc-menu-item.ativo{box-shadow:none;border-color:#2563eb}
        }
      `}</style>;
}
