param(
  [string]$ProgramDataRoot = (Join-Path $env:ProgramData "TextJellyfin")
)

$ErrorActionPreference = "Stop"
$service = Get-Service -Name "TextJellyfin" -ErrorAction SilentlyContinue

if ($service) {
  if ($service.Status -ne "Stopped") {
    Stop-Service -Name "TextJellyfin" -Force
    (Get-Service -Name "TextJellyfin").WaitForStatus("Stopped", [TimeSpan]::FromSeconds(30))
  }

  $database = Join-Path $ProgramDataRoot "data\catalog.db"
  if (Test-Path $database) {
    $backup = Join-Path $ProgramDataRoot ("backups\{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    foreach ($suffix in @("", "-wal", "-shm")) {
      $source = "$database$suffix"
      if (Test-Path $source) {
        Copy-Item $source $backup -Force
      }
    }
  }
} else {
  $oldProcess = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -in @("Text Jellyfin", "electron") -and $_.MainWindowTitle -like "*Text Jellyfin*" }
  if ($oldProcess) {
    throw "Quit the v0.9.0 Text Jellyfin desktop app before starting the machine migration."
  }
}

$listener = $null
try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 3000)
  $listener.Start()
} catch {
  throw "Port 3000 is already in use. Text Jellyfin service mode requires this fixed port."
} finally {
  if ($listener) { $listener.Stop() }
}
