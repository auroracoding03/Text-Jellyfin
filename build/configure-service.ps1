param(
  [Parameter(Mandatory = $true)][string]$LibraryPath,
  [string]$ProgramDataRoot = (Join-Path $env:ProgramData "TextJellyfin")
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $ProgramDataRoot "server.json"
$dataPath = Join-Path $ProgramDataRoot "data"
$isMigration = -not (Test-Path $configPath)

New-Item -ItemType Directory -Path $ProgramDataRoot -Force | Out-Null
New-Item -ItemType Directory -Path $LibraryPath -Force | Out-Null

if ($isMigration) {
  if (Test-Path $dataPath) {
    Remove-Item $dataPath -Recurse -Force
  }
  New-Item -ItemType Directory -Path $dataPath -Force | Out-Null

  $passwordBytes = [byte[]]::new(24)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
  $password = [Convert]::ToBase64String($passwordBytes)
  $configuration = [ordered]@{
    libraryPath = [IO.Path]::GetFullPath($LibraryPath)
    dataPath = [IO.Path]::GetFullPath($dataPath)
    port = 3000
    auth = [ordered]@{
      username = "textjellyfin"
      password = $password
    }
  }
  $configuration | ConvertTo-Json -Depth 4 | Set-Content -Path $configPath -Encoding UTF8
} else {
  $configuration = Get-Content $configPath -Raw | ConvertFrom-Json
  if ($configuration.port -ne 3000) {
    throw "Existing server.json does not use the required fixed port 3000."
  }
  if ($configuration.auth.username -eq "admin" -and $configuration.auth.password -eq "admin") {
    throw "Existing server.json uses forbidden default admin/admin credentials."
  }
  New-Item -ItemType Directory -Path $configuration.libraryPath -Force | Out-Null
  New-Item -ItemType Directory -Path $configuration.dataPath -Force | Out-Null
  $LibraryPath = $configuration.libraryPath
  $dataPath = $configuration.dataPath
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$installingUserSid = $identity.User.Value
$localServiceSid = "*S-1-5-19"
$administratorsSid = "*S-1-5-32-544"
$systemSid = "*S-1-5-18"

& icacls.exe $ProgramDataRoot /inheritance:e /grant "${localServiceSid}:(OI)(CI)M" "${administratorsSid}:(OI)(CI)F" "${systemSid}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Unable to grant LocalService access to $ProgramDataRoot." }

& icacls.exe $LibraryPath /grant "${localServiceSid}:(OI)(CI)M" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Unable to grant LocalService Modify access to $LibraryPath." }

& icacls.exe $configPath /inheritance:r /grant:r "${localServiceSid}:R" "${administratorsSid}:F" "${systemSid}:F" "*${installingUserSid}:R" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Unable to protect $configPath." }

& netsh.exe advfirewall firewall delete rule name="Text Jellyfin Library Server" | Out-Null
& netsh.exe advfirewall firewall add rule name="Text Jellyfin Library Server" dir=in action=allow protocol=TCP localport=3000 profile=private program=any | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Unable to create the Private-network firewall rule." }

Write-Host "Configured Text Jellyfin service library: $LibraryPath"
Write-Host "Disposable service data: $dataPath"
