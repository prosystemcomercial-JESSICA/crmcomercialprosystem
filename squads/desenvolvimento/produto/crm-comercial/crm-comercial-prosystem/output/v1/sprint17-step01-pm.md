# Sprint 17 — Step 01 — André Vieira (PM)
# Arquivos e Anexos

## Contexto

Vendedores precisam anexar documentos aos leads (propostas em PDF enviadas, contratos assinados, prints de conversas, planilhas de levantamento). O módulo gerencia upload, listagem, download e exclusão de arquivos vinculados a leads e propostas.

## User Stories

**US-1701:** Como Vendedor, quero anexar arquivos (PDF, DOCX, XLSX, imagens) à ficha de um lead, para manter toda a documentação do cliente em um lugar só.

**US-1702:** Como Vendedor, quero ver a lista de arquivos anexados ao lead (nome, tipo, tamanho, quem enviou, data) e fazer o download de qualquer arquivo.

**US-1703:** Como Vendedor, quero excluir um arquivo que enviei por engano (somente o próprio arquivo).

**US-1704:** Como Supervisora/Admin, quero excluir qualquer arquivo de qualquer lead.

**US-1705:** Como Vendedor, quero vincular um arquivo também a uma proposta específica (além do lead), para organizar documentos por proposta.

**US-1706:** Como sistema, quero que arquivos sejam armazenados no sistema de arquivos local do servidor (sem dependência de S3/cloud), com path organizado por data e leadId.

## Critérios de aceite

- **US-1701:** Aba "Arquivos" na ficha do lead. Zona de drag-and-drop ou botão "Anexar arquivo". Formatos aceitos: PDF, DOCX, DOC, XLSX, XLS, PNG, JPG, JPEG, GIF. Tamanho máximo: 10MB por arquivo.
- **US-1702:** Lista com: ícone por tipo, nome do arquivo, tamanho formatado (KB/MB), quem enviou, data relativa. Botão de download em cada item.
- **US-1703/1704:** Botão excluir com confirmação. Arquivo removido do disco e do banco.
- **US-1705:** Select opcional "Vincular a proposta" no modal de upload; se não selecionado, fica só no lead.
- **US-1706:** Path: `uploads/leads/{leadId}/{ano}/{mes}/{uuid}-{nomeoriginal}`. Diretório criado automaticamente.

## Regras

- Arquivo não substituível: novo upload sempre cria nova entrada
- Sem versionamento: cada arquivo é independente
- Histórico do lead: registrar evento 'campo_alterado' tipo 'arquivo_adicionado'/'arquivo_removido'
- VENDEDOR vê arquivos de todos os leads que tem acesso; Supervisão/CEO veem todos

## Acesso por perfil

| Perfil | Upload | Download | Excluir próprios | Excluir todos |
|--------|--------|----------|-----------------|---------------|
| VENDEDOR | ✅ | ✅ | ✅ | ❌ |
| SUPERVISAO | ✅ | ✅ | ✅ | ✅ |
| CEO | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |
