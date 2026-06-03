// Utilitário de exportação de relatórios (CSV compatível com Excel BR + impressão/PDF).
// Usado pelo ExportButton — disponível apenas para CEO/Supervisão.

export type Coluna<T> = { header: string; value: (row: T) => string | number | null | undefined };

const escapeCsv = (v: any): string => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // remove quebras de linha internas para não bagunçar o CSV
  s = s.replace(/\r?\n/g, ' ').trim();
  if (/[";]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};

/** Gera e baixa um CSV (separador ; e UTF-8 com BOM — abre certo no Excel BR). */
export function exportarCSV<T>(nomeArquivo: string, colunas: Coluna<T>[], linhas: T[]) {
  const head = colunas.map(c => escapeCsv(c.header)).join(';');
  const body = linhas.map(row => colunas.map(c => escapeCsv(c.value(row))).join(';')).join('\r\n');
  const conteudo = '﻿' + head + '\r\n' + body;   // BOM p/ acentuação no Excel
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const data = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${nomeArquivo}-${data}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Abre uma janela de impressão (o usuário escolhe imprimir ou "Salvar como PDF").
 * Monta uma tabela limpa com título, data e os mesmos dados/colunas do CSV.
 */
export function imprimirRelatorio<T>(titulo: string, colunas: Coluna<T>[], linhas: T[]) {
  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) return;
  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ths = colunas.map(c => `<th>${esc(c.header)}</th>`).join('');
  const trs = linhas.map(row =>
    '<tr>' + colunas.map(c => `<td>${esc(c.value(row))}</td>`).join('') + '</tr>'
  ).join('');
  const dataHora = new Date().toLocaleString('pt-BR');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>
      *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
      body{padding:28px;color:#0D2238}
      h1{font-size:18px;margin:0 0 4px}
      .sub{font-size:12px;color:#5A6B7B;margin:0 0 18px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #d6e0ea;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#eef4fb;color:#0D2238;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
      tr:nth-child(even) td{background:#f8fbff}
      @media print{ .noprint{display:none} }
    </style></head><body>
    <h1>${esc(titulo)}</h1>
    <p class="sub">ProSystem CRM · ${linhas.length} registro(s) · gerado em ${esc(dataHora)}</p>
    <button class="noprint" onclick="window.print()" style="margin-bottom:14px;padding:8px 16px;border:none;border-radius:6px;background:#2E6EAB;color:#fff;font-weight:700;cursor:pointer">Imprimir / Salvar PDF</button>
    <table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
    </body></html>`);
  w.document.close();
}
