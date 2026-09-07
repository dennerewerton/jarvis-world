param(
    [string]$OutputPath = (Join-Path ([System.IO.Path]::GetTempPath()) (
        "jarvis-webaverse-bootstrap-{0}.zip" -f ([guid]::NewGuid().ToString('N'))
    ))
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$webaverseRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot '..'))
$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $webaverseRoot 'deploy\squarecloud-bootstrap'))
$cityAssetsRoot = [System.IO.Path]::GetFullPath((Join-Path $webaverseRoot '..\activity3d\public\assets\jarvis-world\3d'))
$cosmeticAssetsRoot = [System.IO.Path]::GetFullPath((Join-Path $sourceRoot 'cosmetic-assets'))
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$stageRoot = [System.IO.Path]::GetFullPath((Join-Path $tempRoot (
    "jarvis-webaverse-bootstrap-stage-{0}" -f ([guid]::NewGuid().ToString('N'))
)))
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)

if (-not $stageRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Unexpected bootstrap staging path.'
}
if (Test-Path -LiteralPath $resolvedOutput) {
    throw "Output already exists: $resolvedOutput"
}
if (-not (Test-Path -LiteralPath $cityAssetsRoot)) {
    throw "Local Jarvis city assets are missing: $cityAssetsRoot"
}
if (-not (Test-Path -LiteralPath $cosmeticAssetsRoot)) {
    throw "Local Jarvis cosmetic assets are missing: $cosmeticAssetsRoot"
}

New-Item -ItemType Directory -Path $stageRoot | Out-Null
try {
    $stageDeploy = New-Item -ItemType Directory -Path (Join-Path $stageRoot 'deploy\squarecloud-bootstrap') -Force
    Copy-Item -LiteralPath (Join-Path $sourceRoot 'bootstrap.mjs') -Destination $stageDeploy.FullName
    Copy-Item -LiteralPath (Join-Path $webaverseRoot 'deploy\https-gateway.mjs') -Destination (Join-Path $stageRoot 'deploy')
    Copy-Item -LiteralPath (Join-Path $webaverseRoot 'deploy\squarecloud-start.mjs') -Destination (Join-Path $stageRoot 'deploy')
    Copy-Item -LiteralPath (Join-Path $webaverseRoot 'patches') -Destination $stageRoot -Recurse
    Copy-Item -LiteralPath $cityAssetsRoot -Destination (Join-Path $stageRoot 'city-assets') -Recurse
    Copy-Item -LiteralPath $cosmeticAssetsRoot -Destination (Join-Path $stageRoot 'cosmetic-assets') -Recurse
    Copy-Item -LiteralPath (Join-Path $webaverseRoot 'package.json') -Destination $stageRoot
    Copy-Item -LiteralPath (Join-Path $webaverseRoot 'squarecloud.app') -Destination $stageRoot
    Copy-Item -LiteralPath (Join-Path $sourceRoot 'public.env') -Destination (Join-Path $stageRoot '.env')
    Push-Location $stageRoot
    try {
        tar.exe -a -c -f $resolvedOutput deploy patches city-assets cosmetic-assets package.json squarecloud.app .env
    } finally {
        Pop-Location
    }
    Write-Output $resolvedOutput
} finally {
    if (Test-Path -LiteralPath $stageRoot) {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force
    }
}
