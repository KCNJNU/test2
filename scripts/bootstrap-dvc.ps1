[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $repositoryRoot '.venv-dvc'
$pythonPath = Join-Path $venvPath 'Scripts\python.exe'
$dvcPath = Join-Path $venvPath 'Scripts\dvc.exe'
$requirementsPath = Join-Path $repositoryRoot 'infra\dvc\requirements.txt'
$envPath = Join-Path $repositoryRoot '.env'

if (-not (Test-Path -LiteralPath $pythonPath)) {
  python -m venv $venvPath
}
& $pythonPath -m pip install --disable-pip-version-check --requirement $requirementsPath

$defaults = [ordered]@{
  DVC_COMMAND = $dvcPath.Replace('\', '/')
  DVC_REMOTE_NAME = 'robot-dvc'
  DVC_REMOTE_ENDPOINT = 'localhost'
  DVC_REMOTE_PORT = '9000'
  DVC_REMOTE_USE_SSL = 'false'
  DVC_REMOTE_BUCKET = 'robot-dvc-store'
  DVC_REMOTE_ACCESS_KEY = 'minioadmin'
  DVC_REMOTE_SECRET_KEY = 'minioadmin'
  DATASET_PUBLISH_GIT_AUTHOR_NAME = 'Cleaning Robot Dataset Publisher'
  DATASET_PUBLISH_GIT_AUTHOR_EMAIL = 'dataset-publisher@example.invalid'
}
$existing = if (Test-Path -LiteralPath $envPath) { Get-Content -LiteralPath $envPath } else { @() }
$additions = @()
foreach ($entry in $defaults.GetEnumerator()) {
  if (-not ($existing -match "^$([regex]::Escape($entry.Key))=")) {
    $additions += "$($entry.Key)=$($entry.Value)"
  }
}
if ($additions.Count -gt 0) {
  Add-Content -LiteralPath $envPath -Value @('', '# DVC project environment (added by scripts/bootstrap-dvc.ps1)')
  Add-Content -LiteralPath $envPath -Value $additions
}
Write-Host "DVC ready at $dvcPath"
