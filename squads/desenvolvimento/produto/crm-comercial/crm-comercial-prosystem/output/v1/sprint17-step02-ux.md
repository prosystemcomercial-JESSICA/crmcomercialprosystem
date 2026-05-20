# Sprint 17 — Step 02 — Patrícia Moura (UX)
# Arquivos e Anexos — Wireframes

## Aba "Arquivos" na ficha do lead

```
┌─ Ficha do Lead: Farmácia Exemplo ──────────────────────────────┐
│  [Dados]  [Atividades]  [Propostas]  [Histórico]  [Arquivos]   │
│                                                                  │
│  ARQUIVOS (3)                           [+ Anexar arquivo]      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📄 proposta-farmacia-exemplo.pdf                         │  │
│  │    320 KB · Proposta #0042 · Ana Lima · há 2 dias        │  │
│  │                                           [↓] [🗑]      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 📊 levantamento-sistemas.xlsx                            │  │
│  │    48 KB · (sem proposta) · Ana Lima · há 5 dias         │  │
│  │                                           [↓] [🗑]      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 🖼 foto-fachada.jpg                                      │  │
│  │    1.2 MB · (sem proposta) · Carlos Neto · há 1 semana   │  │
│  │                                           [↓] [🗑]      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Modal de upload (ao clicar "+ Anexar arquivo")

```
┌─ Anexar Arquivo ────────────────────────────────────────────────┐
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   📎 Arraste o arquivo aqui ou clique para selecionar   │   │
│  │   PDF, DOCX, XLSX, PNG, JPG · máx. 10MB               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Arquivo: proposta-final.pdf (245 KB) ✓                        │
│                                                                  │
│  Vincular a proposta (opcional):                                │
│  [Proposta #0042 — R$890/mês          ▾]                       │
│                                                                  │
│  [Cancelar]                              [Enviar arquivo]       │
└─────────────────────────────────────────────────────────────────┘
```

## Ícones por tipo de arquivo

| Extensão | Ícone |
|----------|-------|
| pdf | 📄 vermelho |
| doc/docx | 📝 azul |
| xls/xlsx | 📊 verde |
| png/jpg/jpeg/gif | 🖼 roxo |
| outros | 📎 cinza |

## UX decisions

- Aba "Arquivos" adicionada à ficha do lead (5ª aba, após Histórico)
- Lista compacta: uma linha por arquivo com ícone, nome truncado, metadata e botões de ação
- Botão [↓] faz download direto (a href download)
- Botão [🗑] abre confirm dialog; VENDEDOR vê apenas o botão em arquivos próprios
- Modal de upload: drag-and-drop (react-dropzone) + select de proposta opcional
- Feedback de progresso: spinner no botão "Enviar arquivo" durante upload
- Sem pré-visualização inline (fora de escopo; usuário baixa para ver)
- Tamanho formatado: < 1MB → "XYZ KB"; >= 1MB → "X.X MB"
