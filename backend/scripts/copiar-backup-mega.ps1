# Copia os backups do CRM Comercial (baixados da VPS) para a pasta do MEGA, que o MEGAsync sobe
# para a nuvem. Mantém os últimos 90 dias no MEGA (~46 MB por backup, 2 por dia ≈ 8 GB).
# Chamado pelo backup-diario.bat depois do sync com a VPS.
$origem  = 'C:\Users\prosy\backups-crm-comercial'
$destino = 'C:\Users\prosy\MEGA\backup-crm-comercial'
$dias    = 90

New-Item -ItemType Directory -Force -Path $destino | Out-Null
# /E copia subpastas; /XO não regrava o que já está lá; sem /MIR para nunca apagar no MEGA por engano.
robocopy $origem $destino /E /XO /R:2 /W:5 /NP /NFL /NDL | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Output "[MEGA] ERRO na cópia (robocopy $LASTEXITCODE)"; exit 1 }

$limite = (Get-Date).AddDays(-$dias)
$apagadas = 0
# A data vem do nome da pasta (ex.: 2026-10-01T17-00-02), não da data da cópia.
Get-ChildItem $destino -Directory | Where-Object {
  $_.Name -match '^(\d{4}-\d{2}-\d{2})' -and ([datetime]::ParseExact($Matches[1], 'yyyy-MM-dd', $null) -lt $limite)
} | ForEach-Object {
  Remove-Item $_.FullName -Recurse -Force; $apagadas++
}
$qtd = (Get-ChildItem $destino -Directory).Count
Write-Output ("[MEGA] OK - {0} backups na pasta do MEGA ({1} antigos removidos) em {2}" -f $qtd, $apagadas, (Get-Date -Format 'dd/MM/yyyy HH:mm'))
