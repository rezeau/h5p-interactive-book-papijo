$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\..\tools\release-archive.psm1') -Force
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$allowedExtensions = @('css')
$forbiddenPatterns = @('(^|/)node_modules(/|$)')
$workspace = Join-Path ([System.IO.Path]::GetTempPath()) "interactive-book-archive-test-$([guid]::NewGuid().ToString('N'))"
$stage = Join-Path $workspace 'stage'
$validArchive = Join-Path $workspace 'valid.zip'
$invalidArchive = Join-Path $workspace 'invalid.zip'

try {
  $cssDirectory = Join-Path $stage 'styles\css'
  New-Item -ItemType Directory -Path $cssDirectory -Force | Out-Null
  $expectedBytes = [System.Text.Encoding]::UTF8.GetBytes(".vertical-tabs { display: block; }`n")
  [System.IO.File]::WriteAllBytes((Join-Path $cssDirectory 'vertical-tabs.css'), $expectedBytes)

  New-H5PFileOnlyArchive `
    -SourceDirectory $stage `
    -DestinationPath $validArchive `
    -AllowedExtensions $allowedExtensions `
    -ForbiddenPatterns $forbiddenPatterns
  $validation = Test-H5PArchive `
    -ArchivePath $validArchive `
    -AllowedExtensions $allowedExtensions `
    -ForbiddenPatterns $forbiddenPatterns

  $archive = [System.IO.Compression.ZipFile]::OpenRead($validArchive)
  try {
    $entryNames = @($archive.Entries | ForEach-Object FullName)
    if ($entryNames.Count -ne 1) {
      throw "Expected one regular-file entry, found $($entryNames.Count)."
    }
    if ($entryNames[0] -ne 'styles/css/vertical-tabs.css') {
      throw "Unexpected nested archive entry: $($entryNames[0])"
    }
    if ($entryNames -contains 'styles/' -or $entryNames -contains 'styles/css/') {
      throw 'The valid archive contains an explicit directory entry.'
    }
    $stream = $null
    $memory = $null
    try {
      $stream = $archive.Entries[0].Open()
      $memory = [System.IO.MemoryStream]::new()
      $stream.CopyTo($memory)
      if ([Convert]::ToBase64String($expectedBytes) -ne [Convert]::ToBase64String($memory.ToArray())) {
        throw 'The nested CSS file bytes changed during archiving.'
      }
    }
    finally {
      if ($null -ne $memory) {
        $memory.Dispose()
      }
      if ($null -ne $stream) {
        $stream.Dispose()
      }
    }
  }
  finally {
    $archive.Dispose()
  }

  $invalidStream = $null
  $invalidZip = $null
  try {
    $invalidStream = [System.IO.File]::Open(
      $invalidArchive,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
    $invalidZip = [System.IO.Compression.ZipArchive]::new(
      $invalidStream,
      [System.IO.Compression.ZipArchiveMode]::Create,
      $false
    )
    $invalidZip.CreateEntry('styles/') | Out-Null
  }
  finally {
    if ($null -ne $invalidZip) {
      $invalidZip.Dispose()
    }
    if ($null -ne $invalidStream) {
      $invalidStream.Dispose()
    }
  }

  $directoryRejected = $false
  try {
    Test-H5PArchive `
      -ArchivePath $invalidArchive `
      -AllowedExtensions $allowedExtensions `
      -ForbiddenPatterns $forbiddenPatterns | Out-Null
  }
  catch {
    if ($_.Exception.Message -notmatch 'Explicit directory entries are not allowed') {
      throw
    }
    $directoryRejected = $true
  }
  if (-not $directoryRejected) {
    throw 'The archive validator accepted an explicit directory entry.'
  }

  Write-Output "Release archive regression passed: $($validation.RegularFileCount) nested file, zero directory entries, explicit directory rejected."
}
finally {
  if (Test-Path -LiteralPath $workspace) {
    $resolvedWorkspace = [System.IO.Path]::GetFullPath($workspace)
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if (-not $resolvedWorkspace.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to clean unsafe test workspace: $resolvedWorkspace"
    }
    Remove-Item -LiteralPath $resolvedWorkspace -Recurse -Force
  }
}
