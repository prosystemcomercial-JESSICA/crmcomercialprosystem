// Rastro da proposta no navegador do cliente (pedido da Jessica, 23/10/2026): tempo por tela,
// caminho e cliques de cada abertura, enviados a cada 15 s e ao sair para POST /p/:token/rastro.
// Quem tem login do CRM neste navegador (accessToken) é equipe e não é gravado.
// A página informa a tela atual em window.__rastroTela() e se o rastro vale em window.__rastroAtivo()
// (no deck: só no link do cliente, ?modo=cliente). Leitura do lado do CRM: backend/src/lib/proposta-visitas.ts.

const SCRIPT = String.raw`
(function () {
  try { if (localStorage.getItem('accessToken')) return; } catch (e) {}
  var API = __API__, TK = __TK__, ORIGEM = __ORIGEM__;
  var s, telas, caminho, eventos, seg, ultimaTela, mudou, escondidoDesde = null;
  function nova() {
    s = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    telas = {}; caminho = []; eventos = []; seg = 0; ultimaTela = null; mudou = false;
  }
  nova();
  var disp = (window.innerWidth < 769 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) ? 'celular' : 'computador';
  function tela() { try { return window.__rastroTela ? window.__rastroTela() : (ORIGEM === 'express' ? 100 : 0); } catch (e) { return 0; } }
  function ativo() { try { return window.__rastroAtivo ? !!window.__rastroAtivo() : true; } catch (e) { return true; } }
  function versao() { try { return window.__rastroVersao ? window.__rastroVersao() : null; } catch (e) { return null; } }
  setInterval(function () {
    if (document.hidden || !ativo()) return;
    var t = tela();
    seg++; telas[t] = (telas[t] || 0) + 1;
    if (t !== ultimaTela) { caminho.push(t); ultimaTela = t; if (caminho.length > 300) caminho.shift(); }
    mudou = true;
  }, 1000);
  function enviar(saindo) {
    if (!mudou || seg < 1) return;
    mudou = false;
    var corpo = JSON.stringify({ sessao: s, origem: ORIGEM, versao: versao(), dispositivo: disp, segundos: seg, telas: telas, caminho: caminho, eventos: eventos });
    var url = API + '/p/' + TK + '/rastro';
    if (saindo && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(url, new Blob([corpo], { type: 'text/plain' }))) return; } catch (e) {}
    }
    try { fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: corpo, keepalive: true }).catch(function () {}); } catch (e) {}
  }
  setInterval(function () { enviar(false); }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { escondidoDesde = Date.now(); enviar(true); return; }
    // Voltou depois de 30 min com a aba aberta: conta como nova abertura.
    if (escondidoDesde && Date.now() - escondidoDesde > 30 * 60 * 1000) nova();
    escondidoDesde = null;
  });
  window.addEventListener('pagehide', function () { enviar(true); });
  document.addEventListener('click', function (ev) {
    if (!ativo()) return;
    var el = ev.target && ev.target.closest ? ev.target.closest('button, a, [onclick], .planc') : null;
    if (!el || el.id === 'nav-prev' || el.id === 'nav-next') return;
    var nome = (el.getAttribute('aria-label') || el.innerText || el.id || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!nome) return;
    if (eventos.length < 200) eventos.push({ s: seg, t: tela(), a: nome });
    mudou = true;
  }, true);
})();
`;

/** Script pronto para ir dentro de <script>…</script> da proposta pública. */
export function scriptRastro(apiUrl: string, token: string, origem: 'cliente' | 'express'): string {
  const js = (v: string) => JSON.stringify(v).replace(/</g, '\\u003c');
  return SCRIPT.replace('__API__', js(apiUrl)).replace('__TK__', js(token)).replace('__ORIGEM__', js(origem));
}
