param(
  [string]$AppRoot = (Join-Path $PSScriptRoot '..\app')
)

$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PSScriptRoot '..\scene-packages.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$resolvedAppRoot = [System.IO.Path]::GetFullPath($AppRoot)
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\scene-assets'))

foreach ($package in $manifest.packages) {
  $source = [System.IO.Path]::GetFullPath((Join-Path $assetRoot $package.name))
  $sourceMarker = Join-Path $source '.jarvis-source.json'
  $target = [System.IO.Path]::GetFullPath((Join-Path $resolvedAppRoot $package.runtimePath))
  if (-not $target.StartsWith($resolvedAppRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Invalid runtime path: $($package.runtimePath)"
  }

  if (-not (Test-Path -LiteralPath $sourceMarker)) {
    throw "Missing vendored package or provenance marker: $source"
  }
  $sourceInfo = Get-Content -LiteralPath $sourceMarker -Raw | ConvertFrom-Json
  if ($sourceInfo.commit -ne $package.commit) {
    throw "Vendored package does not match manifest: $($package.name)"
  }

  if (Test-Path -LiteralPath $target) {
    $targetMarker = Join-Path $target '.jarvis-source.json'
    if (-not (Test-Path -LiteralPath $targetMarker)) {
      throw "Existing runtime package is not Jarvis-vendored: $target"
    }
    $targetInfo = Get-Content -LiteralPath $targetMarker -Raw | ConvertFrom-Json
    if ($targetInfo.commit -ne $package.commit) {
      throw "Existing runtime package does not match the pinned commit: $target"
    }
    Write-Output "Verified $($package.name)@$($package.commit)"
    continue
  }

  robocopy $source $target /E | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Copy failed: $($package.name)" }
  Write-Output "Materialized $($package.name)@$($package.commit)"
}
