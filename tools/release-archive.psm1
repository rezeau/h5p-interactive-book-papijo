Set-StrictMode -Version Latest

function Test-H5PArchiveEntryPath {
  param(
    [Parameter(Mandatory)] [string]$EntryPath,
    [Parameter(Mandatory)] [string[]]$AllowedExtensions,
    [Parameter(Mandatory)] [string[]]$ForbiddenPatterns
  )

  if ([string]::IsNullOrWhiteSpace($EntryPath)) {
    throw 'Archive entry path is empty.'
  }
  if ($EntryPath.Contains('\')) {
    throw "Archive entry path must use forward slashes: $EntryPath"
  }
  if ($EntryPath.EndsWith('/')) {
    throw "Explicit directory entries are not allowed: $EntryPath"
  }

  $baseName = @($EntryPath.Split('/'))[-1]
  if ([string]::IsNullOrWhiteSpace($baseName)) {
    throw "Archive entry has an empty basename: $EntryPath"
  }
  if ($EntryPath -match '(^/)|(^[A-Za-z]:)|(^|/)\.\.(/|$)') {
    throw "Unsafe archive entry: $EntryPath"
  }

  foreach ($pattern in $ForbiddenPatterns) {
    if ($EntryPath -match $pattern) {
      throw "Forbidden development file selected for packaging: $EntryPath"
    }
  }

  $extension = [System.IO.Path]::GetExtension($baseName).TrimStart('.').ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($extension)) {
    throw "Extensionless archive entries are not allowed: $EntryPath"
  }
  if ($extension -notin $AllowedExtensions) {
    throw "File extension is not approved for this release package: $EntryPath"
  }
}

function New-H5PFileOnlyArchive {
  param(
    [Parameter(Mandatory)] [string]$SourceDirectory,
    [Parameter(Mandatory)] [string]$DestinationPath,
    [Parameter(Mandatory)] [string[]]$AllowedExtensions,
    [Parameter(Mandatory)] [string[]]$ForbiddenPatterns
  )

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $sourceRoot = [System.IO.Path]::GetFullPath($SourceDirectory).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "Archive source directory does not exist: $sourceRoot"
  }
  if (Test-Path -LiteralPath $DestinationPath) {
    throw "Archive destination already exists: $DestinationPath"
  }

  $files = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | Sort-Object FullName)
  $entryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $archiveStream = $null
  $archive = $null
  try {
    $archiveStream = [System.IO.File]::Open(
      $DestinationPath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
    $archive = [System.IO.Compression.ZipArchive]::new(
      $archiveStream,
      [System.IO.Compression.ZipArchiveMode]::Create,
      $false
    )

    foreach ($file in $files) {
      $relativePath = $file.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
      Test-H5PArchiveEntryPath `
        -EntryPath $relativePath `
        -AllowedExtensions $AllowedExtensions `
        -ForbiddenPatterns $ForbiddenPatterns
      if (-not $entryNames.Add($relativePath)) {
        throw "Duplicate archive entry: $relativePath"
      }

      $entry = $archive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $file.LastWriteTime
      $inputStream = $null
      $entryStream = $null
      try {
        $inputStream = [System.IO.File]::OpenRead($file.FullName)
        $entryStream = $entry.Open()
        $inputStream.CopyTo($entryStream)
      }
      finally {
        if ($null -ne $entryStream) {
          $entryStream.Dispose()
        }
        if ($null -ne $inputStream) {
          $inputStream.Dispose()
        }
      }
    }
  }
  finally {
    if ($null -ne $archive) {
      $archive.Dispose()
    }
    if ($null -ne $archiveStream) {
      $archiveStream.Dispose()
    }
  }
}

function Test-H5PArchive {
  param(
    [Parameter(Mandatory)] [string]$ArchivePath,
    [Parameter(Mandatory)] [string[]]$AllowedExtensions,
    [Parameter(Mandatory)] [string[]]$ForbiddenPatterns
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    $entryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $archive.Entries) {
      $entryPath = $entry.FullName
      Test-H5PArchiveEntryPath `
        -EntryPath $entryPath `
        -AllowedExtensions $AllowedExtensions `
        -ForbiddenPatterns $ForbiddenPatterns
      if ([string]::IsNullOrWhiteSpace($entry.Name)) {
        throw "Archive entry has an empty basename: $entryPath"
      }
      if (-not $entryNames.Add($entryPath)) {
        throw "Duplicate archive entry: $entryPath"
      }

      $stream = $null
      try {
        $stream = $entry.Open()
        $buffer = New-Object byte[] 8192
        while ($stream.Read($buffer, 0, $buffer.Length) -gt 0) {}
      }
      finally {
        if ($null -ne $stream) {
          $stream.Dispose()
        }
      }
    }

    return [PSCustomObject]@{
      EntryCount = $archive.Entries.Count
      RegularFileCount = $entryNames.Count
    }
  }
  finally {
    $archive.Dispose()
  }
}

Export-ModuleMember -Function New-H5PFileOnlyArchive, Test-H5PArchive
