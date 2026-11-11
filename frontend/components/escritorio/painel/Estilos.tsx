// Estilos do escritório (10/11/2026, revisão): abas de setores no topo, faixa de saúde compacta, a sala com o
// painel "Agora no escritório" ao lado, detalhe do agente escolhido e quadros. No celular tudo vira uma coluna.
export default function EstilosEscritorio() {
  return <style>{`
        .esc-topo{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}
        .esc-topo h1{font-size:24px;font-weight:800;letter-spacing:-.01em;color:var(--t-text-primary)}
        .esc-topo p{font-size:13px;color:var(--t-text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .esc-ao-vivo{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;background:#16a34a14;color:#15803d;font-weight:700;font-size:12px}
        .esc-ao-vivo::before{content:"";width:7px;height:7px;border-radius:50%;background:#16a34a;animation:esc-pulso 1.6s ease-in-out infinite}
        @keyframes esc-pulso{50%{opacity:.3}}
        .esc-faixa{display:flex;flex-wrap:wrap;gap:8px}
        .esc-faixa>*{flex:1 1 200px}
        .esc-grade{display:grid;gap:14px}
        .esc-menu{display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none;padding:4px;border-radius:14px;background:var(--t-card-bg);border:1px solid var(--t-card-border)}
        .esc-menu-titulo{display:none}
        .esc-menu-sep{flex:0 0 1px;align-self:stretch;margin:6px 4px;background:var(--t-card-border)}
        .esc-menu-item{flex:0 0 auto;display:flex;align-items:center;gap:7px;min-height:36px;padding:0 12px;border-radius:10px;border:none;background:none;color:var(--t-text-secondary);font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}
        .esc-menu-item:hover{background:var(--t-content-bg);color:var(--t-text-primary)}
        .esc-menu-item.ativo{background:#2563eb;color:#fff}
        .esc-menu-item.ativo .esc-menu-num{color:#dbeafe}
        .esc-menu-item:focus-visible,.esc-btn:focus-visible,.esc-aba:focus-visible,.feed-item:focus-visible,.feed-esperando:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
        .esc-menu-num{font-size:12px;color:var(--t-text-muted);font-variant-numeric:tabular-nums}
        .esc-menu-badge{min-width:22px;height:20px;padding:0 6px;border-radius:999px;background:#f59e0b;color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center}
        .esc-palco{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
        .esc-dica{font-size:12px;color:var(--t-text-muted);margin-top:6px}
        .esc-feed{display:grid;gap:6px;align-content:start;max-height:calc(100vh - 140px);overflow-y:auto;position:sticky;top:12px;padding:12px;border-radius:16px;background:var(--t-card-bg);border:1px solid var(--t-card-border)}
        .esc-feed h3{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--t-text-muted);margin:8px 4px 2px}
        .feed-vazio{font-size:12px;color:var(--t-text-muted);padding:0 4px}
        .feed-item{display:flex;gap:9px;align-items:flex-start;padding:8px;border-radius:10px;border:none;background:none;text-align:left;cursor:pointer;font:inherit;font-size:12.5px;line-height:1.35;color:var(--t-text-secondary);animation:esc-entra .35s ease both}
        .feed-item:hover{background:var(--t-content-bg)}
        .feed-item b{color:var(--t-text-primary)}
        .feed-item small{display:block;font-size:11px;color:var(--t-text-muted);margin-top:2px}
        .feed-erro{background:#dc26260d;box-shadow:inset 3px 0 0 #dc2626}
        .feed-erro small{color:#b91c1c}
        .feed-av{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:12px}
        .feed-esperando{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:none;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;text-align:left;cursor:pointer;font:inherit}
        .feed-esperando b{font-size:26px;line-height:1;font-variant-numeric:tabular-nums}
        .feed-esperando span{font-weight:700;font-size:14px}
        .feed-esperando small{display:block;font-weight:500;font-size:11.5px;opacity:.9}
        @keyframes esc-entra{from{opacity:0;transform:translateY(4px)}}
        .esc-detalhe{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start;animation:esc-entra .3s ease both}
        .esc-linha-tempo{list-style:none;display:grid;gap:0;max-height:300px;overflow-y:auto}
        .esc-linha-tempo li{display:grid;grid-template-columns:86px 1fr;gap:10px;padding:6px 0 6px 12px;border-left:2px solid var(--t-card-border);font-size:12.5px;color:var(--t-text-secondary);position:relative}
        .esc-linha-tempo li::before{content:"";position:absolute;left:-5px;top:11px;width:8px;height:8px;border-radius:50%;background:#2563eb}
        .esc-linha-tempo time{color:var(--t-text-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
        .esc-sub{font-size:16px;font-weight:800;color:var(--t-text-primary);margin-top:6px}
        .esc-quadros{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;align-items:start}
        .esc-quadro{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:16px;background:var(--t-card-bg);border:1px solid var(--t-card-border);transition:box-shadow .2s,transform .2s}
        .esc-quadro:hover{box-shadow:0 6px 18px rgba(15,23,42,.08);transform:translateY(-1px)}
        .esc-quadro-numeros{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .esc-quadro-numeros span{display:grid;padding:6px 8px;border-radius:10px;background:var(--t-content-bg)}
        .esc-quadro-numeros b{font-size:17px;color:var(--t-text-primary);font-variant-numeric:tabular-nums}
        .esc-quadro-numeros small{font-size:11px;color:var(--t-text-muted)}
        .esc-btn{min-height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--t-card-border);background:var(--t-card-bg);color:var(--t-text-primary);font-size:13px;font-weight:700;cursor:pointer}
        .esc-btn:hover{background:var(--t-content-bg)}
        .esc-btn.primario{border:none;color:#fff}
        .esc-btn.primario:hover{filter:brightness(1.08)}
        .esc-btn:disabled{opacity:.5;cursor:default}
        .esc-aba{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--t-card-border);background:var(--t-card-bg);color:var(--t-text-primary);font-size:13px;cursor:pointer}
        .esc-aba.ativa{background:#2563eb;border-color:#2563eb;color:#fff}
        .esc-cartao{padding:14px;border-radius:16px;background:var(--t-card-bg);border:1px solid var(--t-card-border)}
        .esc-tabela{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;color:var(--t-text-secondary)}
        .esc-tabela th{text-align:left;font-size:11px;font-weight:700;color:var(--t-text-muted);padding:4px 6px;border-bottom:1px solid var(--t-card-border)}
        .esc-tabela td{padding:6px;border-bottom:1px solid var(--t-card-border);font-variant-numeric:tabular-nums}
        @media (max-width:1100px){
          .esc-palco{grid-template-columns:minmax(0,1fr)}
          .esc-feed{position:static;max-height:none}
        }
        @media (max-width:760px){
          .esc-detalhe{grid-template-columns:minmax(0,1fr)}
          .esc-topo h1{font-size:20px}
        }
        @media (prefers-reduced-motion:reduce){.esc-ao-vivo::before,.feed-item,.esc-detalhe{animation:none}}
      `}</style>;
}
