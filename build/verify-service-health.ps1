param(
  [string]$ConfigPath = (Join-Path $env:ProgramData "TextJellyfin\server.json"),
  [switch]$Rescan
)

$ErrorActionPreference = "Stop"
$configuration = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$token = [Convert]::ToBase64String(
  [Text.Encoding]::UTF8.GetBytes("$($configuration.auth.username):$($configuration.auth.password)")
)
$headers = @{ Authorization = "Basic $token" }
$deadline = (Get-Date).AddSeconds(45)
$health = $null

while ((Get-Date) -lt $deadline) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Headers $headers -TimeoutSec 3
    if ($health.status -eq "ok") { break }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

if (-not $health -or $health.status -ne "ok") {
  throw "Text Jellyfin did not pass its authenticated health check on fixed port 3000."
}
if ($health.version -ne "0.10.0" -or $health.serviceMode -ne $true) {
  throw "Unexpected server identity: version=$($health.version), serviceMode=$($health.serviceMode)."
}

if ($Rescan) {
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/scan" -Headers $headers -TimeoutSec 1800 | Out-Null
}

Write-Host "Text Jellyfin service v$($health.version) is healthy (service mode: $($health.serviceMode))."
