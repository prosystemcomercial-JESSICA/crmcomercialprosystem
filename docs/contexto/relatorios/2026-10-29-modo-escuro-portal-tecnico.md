# 29/10/2026 — Modo escuro no Portal Técnico

## Pedido
Jessica: "coloque o mesmo modulo escuro tambem no portal de implantação".

## Feito
- `frontend/app/portal-tecnico/page.tsx`: botão lua/sol no cabeçalho do portal (entre o sino de avisos e o botão de fechar), no estilo dos outros botões dessa barra (30px, borda fina). Usa `useTheme()` de `lib/theme-context.tsx`, o mesmo do botão do CRM (`DashboardLayout`), então a preferência é única (`ps-theme-mode` no navegador).
- Etapa concluída do Onboarding técnico: fundo `#f0fdf4` e borda `#bbf7d0` (fixos, claros) trocados por verde translúcido (`rgba(22,163,74,…)`), que funciona nos dois modos.
- Documentos: linha "Modo escuro no Portal Técnico" nos seis `docs/produto/`, seção no manual e em `docs/comercial/novidades-crm.html`; ESTADO.md.

## Verificado
- `npx tsc --noEmit -p .` no frontend: limpo.
- Playwright com API simulada (`/portal-tecnico?tab=suporte`, 1440px): o botão aparece, o clique põe `dark` no `<html>`, grava `ps-theme-mode=escuro`, e o portal inteiro (menu, cabeçalho, cartões, filtros) fica escuro e legível. Arquivos de teste temporários apagados.

## Decisões e porquês
- Reaproveitar o `ThemeProvider` do CRM em vez de um modo próprio do portal: o portal já está dentro do mesmo layout raiz e usa as variáveis `--t-*`, então só faltava o botão.
- Selos de status com fundo claro e texto colorido (Aguardando, SLA, prioridades) mantidos: seguem a regra de Aparência ("alertas mantêm suas cores de significado") e continuam legíveis.

## Pendente
- O logo Prosystem (azul-escuro) fica apagado no fundo escuro, no portal e no CRM principal. Se a Jessica quiser, usar uma versão clara do logo no modo escuro.

## Próxima sessão
Conferir em produção, depois do deploy, as abas Início e Quadro no escuro com dados reais.
