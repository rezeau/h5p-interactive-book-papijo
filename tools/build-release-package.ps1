[CmdletBinding()]
param(
  [string]$LibraryRoot = 'C:\my_first_h5p_environment\libraries',
  [string]$OutputDirectory,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = $root
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$mainManifest = Get-Content -Raw -LiteralPath (Join-Path $root 'library.json') | ConvertFrom-Json
$packageMetadata = Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json
$version = "$($mainManifest.majorVersion).$($mainManifest.minorVersion).$($mainManifest.patchVersion)"
$mainFolderName = "$($mainManifest.machineName)-$($mainManifest.majorVersion).$($mainManifest.minorVersion)"
$outputPath = Join-Path $OutputDirectory "$($mainManifest.machineName)-$version.h5p"
$zipPath = [System.IO.Path]::ChangeExtension($outputPath, '.zip')
$workspace = Join-Path ([System.IO.Path]::GetTempPath()) "interactive-book-papijo-release-$([guid]::NewGuid().ToString('N'))"
$buildRoot = Join-Path $workspace 'build'
$mainSource = Join-Path $workspace 'main-source'
$stage = Join-Path $workspace 'package'
$extract = Join-Path $workspace 'extract'

$dependencySections = @('preloadedDependencies', 'editorDependencies', 'dynamicDependencies')
$forbiddenPatterns = @(
  '(^|/)\.[^/]+',
  '(^|/)(crowdin\.yml|package\.json|package-lock\.json|\.gitignore|\.eslintrc(?:\.json)?|\.h5pignore)$',
  '(^|/)(\.github|\.git|node_modules|tests|tools|src|source)(/|$)',
  '\.(?:map|ts|tsx|scss|sass)$'
)
$allowedExtensions = @(
  'css', 'eot', 'gif', 'jpeg', 'jpg', 'js', 'json', 'otf', 'png', 'svg', 'ttf', 'txt', 'woff', 'woff2'
)
$cssReferenceWarnings = [System.Collections.Generic.List[string]]::new()

function Get-DependencyKey {
  param([Parameter(Mandatory)] $Dependency)
  return "$($Dependency.machineName)-$($Dependency.majorVersion).$($Dependency.minorVersion)"
}

function Copy-AllowlistedFile {
  param(
    [Parameter(Mandatory)] [string]$SourceRoot,
    [Parameter(Mandatory)] [string]$RelativePath,
    [Parameter(Mandatory)] [string]$DestinationRoot
  )

  $platformPath = $RelativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar
  $source = Join-Path $SourceRoot $platformPath
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Required runtime file is missing: $source"
  }
  $destination = Join-Path $DestinationRoot $platformPath
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}

function Get-LibraryPayload {
  param([Parameter(Mandatory)] [string]$SourceRoot)

  $manifest = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot 'library.json') | ConvertFrom-Json
  $files = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $files.Add('library.json') | Out-Null

  foreach ($optionalFile in @('semantics.json', 'icon.svg', 'upgrades.js', 'presave.js')) {
    if (Test-Path -LiteralPath (Join-Path $SourceRoot $optionalFile) -PathType Leaf) {
      $files.Add($optionalFile) | Out-Null
    }
  }

  $cssQueue = [System.Collections.Generic.Queue[string]]::new()
  foreach ($asset in @($manifest.preloadedJs) + @($manifest.preloadedCss)) {
    if ($null -eq $asset) {
      continue
    }
    $relativePath = $asset.path.Replace('\', '/')
    $files.Add($relativePath) | Out-Null
    if ($relativePath.EndsWith('.css', [System.StringComparison]::OrdinalIgnoreCase)) {
      $cssQueue.Enqueue($relativePath)
    }
    if ($relativePath.EndsWith('.js', [System.StringComparison]::OrdinalIgnoreCase)) {
      $licensePath = "$relativePath.LICENSE.txt"
      if (Test-Path -LiteralPath (Join-Path $SourceRoot ($licensePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)) -PathType Leaf) {
        $files.Add($licensePath) | Out-Null
      }
    }
  }

  $languageRoot = Join-Path $SourceRoot 'language'
  if (Test-Path -LiteralPath $languageRoot -PathType Container) {
    foreach ($languageFile in Get-ChildItem -LiteralPath $languageRoot -File -Filter '*.json' | Sort-Object Name) {
      if ($languageFile.Name -match '^[a-z]{2}(?:-[A-Z]{2})?\.json$') {
        $files.Add("language/$($languageFile.Name)") | Out-Null
      }
    }
  }

  $processedCss = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  while ($cssQueue.Count -gt 0) {
    $cssPath = $cssQueue.Dequeue()
    if (-not $processedCss.Add($cssPath)) {
      continue
    }
    $cssFullPath = Join-Path $SourceRoot ($cssPath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $cssFullPath -PathType Leaf)) {
      throw "Declared CSS asset is missing: $cssFullPath"
    }
    $css = Get-Content -Raw -LiteralPath $cssFullPath
    $css = [regex]::Replace($css, '/\*[\s\S]*?\*/', '')
    foreach ($match in [regex]::Matches($css, 'url\(\s*[''"]?([^''")]+)[''"]?\s*\)')) {
      $reference = $match.Groups[1].Value.Trim()
      if ($reference -match '^(?:data:|https?:|#)') {
        continue
      }
      $reference = ($reference -replace '[?#].*$', '')
      if ([string]::IsNullOrWhiteSpace($reference)) {
        continue
      }
      $assetFullPath = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $cssFullPath) ($reference -replace '/', [System.IO.Path]::DirectorySeparatorChar)))
      $sourcePrefix = [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
      if (-not $assetFullPath.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "CSS reference leaves the library root: $cssPath -> $reference"
      }
      if (-not (Test-Path -LiteralPath $assetFullPath -PathType Leaf)) {
        $referenceDirectory = Split-Path -Parent $reference
        $fallbackDirectory = if ([string]::IsNullOrWhiteSpace($referenceDirectory)) {
          Split-Path -Parent $cssFullPath
        }
        else {
          [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $cssFullPath) ($referenceDirectory -replace '/', [System.IO.Path]::DirectorySeparatorChar)))
        }
        if (-not (Test-Path -LiteralPath $fallbackDirectory -PathType Container)) {
          throw "CSS reference is missing: $cssPath -> $reference"
        }
        foreach ($fallbackAsset in Get-ChildItem -LiteralPath $fallbackDirectory -File | Sort-Object Name) {
          $fallbackRelativePath = $fallbackAsset.FullName.Substring($sourcePrefix.Length).Replace('\', '/')
          $files.Add($fallbackRelativePath) | Out-Null
        }
        $cssReferenceWarnings.Add("$($manifest.machineName): $cssPath -> $reference")
        continue
      }
      $assetRelativePath = $assetFullPath.Substring($sourcePrefix.Length).Replace('\', '/')
      $files.Add($assetRelativePath) | Out-Null
      if ($assetRelativePath.EndsWith('.css', [System.StringComparison]::OrdinalIgnoreCase)) {
        $cssQueue.Enqueue($assetRelativePath)
      }
    }
  }

  return [PSCustomObject]@{
    Manifest = $manifest
    Files = @($files | Sort-Object)
  }
}

function Test-ForbiddenPath {
  param([Parameter(Mandatory)] [string]$RelativePath)

  foreach ($pattern in $forbiddenPatterns) {
    if ($RelativePath -match $pattern) {
      throw "Forbidden development file selected for packaging: $RelativePath"
    }
  }
  $extension = [System.IO.Path]::GetExtension($RelativePath).TrimStart('.').ToLowerInvariant()
  if (-not [string]::IsNullOrWhiteSpace($extension) -and $extension -notin $allowedExtensions) {
    throw "File extension is not approved for this release package: $RelativePath"
  }
}

try {
  foreach ($directory in @($workspace, $buildRoot, $mainSource, $stage, $extract)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $previousNodeEnv = $env:NODE_ENV
  $previousPackageName = $env:npm_package_name
  try {
    $env:NODE_ENV = 'production'
    $env:npm_package_name = $packageMetadata.name
    & node (Join-Path $root 'node_modules/webpack/bin/webpack.js') --config (Join-Path $root 'webpack.config.js') --output-path $buildRoot
    if ($LASTEXITCODE -ne 0) {
      throw "Production webpack build failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    $env:NODE_ENV = $previousNodeEnv
    $env:npm_package_name = $previousPackageName
  }

  foreach ($relativePath in @('library.json', 'semantics.json', 'icon.svg')) {
    Copy-AllowlistedFile -SourceRoot $root -RelativePath $relativePath -DestinationRoot $mainSource
  }
  if (Test-Path -LiteralPath (Join-Path $root 'language') -PathType Container) {
    Copy-Item -LiteralPath (Join-Path $root 'language') -Destination $mainSource -Recurse
  }
  Copy-Item -LiteralPath $buildRoot -Destination (Join-Path $mainSource 'dist') -Recurse

  $queue = [System.Collections.Generic.Queue[object]]::new()
  $queue.Enqueue([PSCustomObject]@{ Key = $mainFolderName; Source = $mainSource })
  $libraries = @{}

  while ($queue.Count -gt 0) {
    $candidate = $queue.Dequeue()
    if ($libraries.ContainsKey($candidate.Key)) {
      continue
    }
    $payload = Get-LibraryPayload -SourceRoot $candidate.Source
    $actualKey = "$($payload.Manifest.machineName)-$($payload.Manifest.majorVersion).$($payload.Manifest.minorVersion)"
    if ($actualKey -ne $candidate.Key) {
      throw "Library folder identity mismatch: expected $($candidate.Key), found $actualKey."
    }
    $libraries[$candidate.Key] = [PSCustomObject]@{
      Source = $candidate.Source
      Payload = $payload
    }

    foreach ($section in $dependencySections) {
      foreach ($dependency in @($payload.Manifest.$section)) {
        if ($null -eq $dependency) {
          continue
        }
        $dependencyKey = Get-DependencyKey -Dependency $dependency
        $dependencyPath = Join-Path $LibraryRoot $dependencyKey
        if (-not (Test-Path -LiteralPath (Join-Path $dependencyPath 'library.json') -PathType Leaf)) {
          throw "Dependency closure is incomplete: $dependencyKey is missing from $LibraryRoot."
        }
        $queue.Enqueue([PSCustomObject]@{ Key = $dependencyKey; Source = $dependencyPath })
      }
    }
  }

  foreach ($libraryKey in @($libraries.Keys | Sort-Object)) {
    $library = $libraries[$libraryKey]
    $destination = Join-Path $stage $libraryKey
    foreach ($relativePath in $library.Payload.Files) {
      Test-ForbiddenPath -RelativePath "$libraryKey/$relativePath"
      Copy-AllowlistedFile -SourceRoot $library.Source -RelativePath $relativePath -DestinationRoot $destination
    }
  }

  $stagedFiles = @(Get-ChildItem -Recurse -File -LiteralPath $stage)
  foreach ($file in $stagedFiles) {
    $relativePath = $file.FullName.Substring($stage.Length + 1).Replace('\', '/')
    Test-ForbiddenPath -RelativePath $relativePath
    if ($file.Extension -eq '.json') {
      Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json | Out-Null
    }
  }

  foreach ($libraryKey in @($libraries.Keys)) {
    $manifest = $libraries[$libraryKey].Payload.Manifest
    foreach ($section in $dependencySections) {
      foreach ($dependency in @($manifest.$section)) {
        if ($null -eq $dependency) {
          continue
        }
        $dependencyKey = Get-DependencyKey -Dependency $dependency
        if (-not $libraries.ContainsKey($dependencyKey)) {
          throw "Packaged dependency closure is incomplete: $libraryKey requires $dependencyKey."
        }
      }
    }
  }

  if ((Test-Path -LiteralPath $outputPath) -and -not $Force) {
    throw "Release package already exists: $outputPath. Use -Force to replace it."
  }
  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
  }

  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -CompressionLevel Optimal
  Move-Item -LiteralPath $zipPath -Destination $outputPath

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($outputPath)
  try {
    $entryNames = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    $duplicateEntries = @($entryNames | Group-Object | Where-Object Count -gt 1)
    if ($duplicateEntries.Count -gt 0) {
      throw "Duplicate archive entries: $($duplicateEntries.Name -join ', ')"
    }
    foreach ($entry in $archive.Entries) {
      $normalized = $entry.FullName.Replace('\', '/')
      if ($normalized -match '(^/)|(^[A-Za-z]:)|(^|/)\.\.(/|$)') {
        throw "Unsafe archive entry: $normalized"
      }
      if (-not $normalized.EndsWith('/')) {
        Test-ForbiddenPath -RelativePath $normalized
        $stream = $entry.Open()
        try {
          $buffer = New-Object byte[] 8192
          while ($stream.Read($buffer, 0, $buffer.Length) -gt 0) {}
        }
        finally {
          $stream.Dispose()
        }
      }
    }
  }
  finally {
    $archive.Dispose()
  }

  [System.IO.Compression.ZipFile]::ExtractToDirectory($outputPath, $extract)
  $stageHashes = @(Get-ChildItem -Recurse -File -LiteralPath $stage | ForEach-Object {
    [PSCustomObject]@{
      Path = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
      Length = $_.Length
      Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  })
  $extractHashes = @(Get-ChildItem -Recurse -File -LiteralPath $extract | ForEach-Object {
    [PSCustomObject]@{
      Path = $_.FullName.Substring($extract.Length + 1).Replace('\', '/')
      Length = $_.Length
      Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  })
  $roundTripDifference = Compare-Object $stageHashes $extractHashes -Property Path, Length, Hash
  if ($roundTripDifference) {
    throw 'Archive extraction does not match the staged allowlisted payload.'
  }

  $package = Get-Item -LiteralPath $outputPath
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $outputPath
  $bundledLibraries = @($libraries.Keys | Sort-Object | ForEach-Object {
    $manifest = $libraries[$_].Payload.Manifest
    "$_.$($manifest.patchVersion)"
  })
  Write-Output "Built $($package.FullName)"
  Write-Output "Version: $version"
  Write-Output "Size: $($package.Length) bytes"
  Write-Output "SHA-256: $($hash.Hash)"
  Write-Output "Archive files: $($stagedFiles.Count)"
  Write-Output "Bundled libraries ($($bundledLibraries.Count)): $($bundledLibraries -join ', ')"
  Write-Output 'Dependency closure: complete'
  Write-Output 'Archive extraction round trip: exact'
  Write-Output 'Forbidden development files: none'
  if ($cssReferenceWarnings.Count -gt 0) {
    Write-Output "Inherited CSS references without exact source assets ($($cssReferenceWarnings.Count)): $($cssReferenceWarnings -join '; ')"
  }
}
finally {
  if (Test-Path -LiteralPath $workspace) {
    $resolvedWorkspace = [System.IO.Path]::GetFullPath($workspace)
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if (-not $resolvedWorkspace.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to clean unsafe temporary workspace: $resolvedWorkspace"
    }
    Remove-Item -LiteralPath $resolvedWorkspace -Recurse -Force
  }
}
