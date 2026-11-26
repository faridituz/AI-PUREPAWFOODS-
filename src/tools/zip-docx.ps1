Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = Join-Path $PSScriptRoot '..\..\data\work\build'
$dst = Join-Path $PSScriptRoot '..\..\outputs\packaging-word'
if (-not (Test-Path -LiteralPath $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
$counter = 0
foreach ($dir in (Get-ChildItem -LiteralPath $src -Directory)) {
  $sku = $dir.Name
  $counter++
  $out = Join-Path $dst ('PurePaw_{0}_包装背面_四语V2.docx' -f $sku)
  if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
  $rootLen = $dir.FullName.TrimEnd('\').Length + 1
  $zip = $null
  try {
    $zip = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
    foreach ($f in (Get-ChildItem -LiteralPath $dir.FullName -Recurse -File)) {
      $rel = $f.FullName.Substring($rootLen).Replace('\', '/')
      $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
      $es = $entry.Open()
      $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
      $es.Write($bytes, 0, $bytes.Length)
      $es.Dispose()
    }
  } catch {
    Write-Output ('FAIL ' + $sku + ' ' + $_.Exception.Message)
  } finally {
    if ($zip) { $zip.Dispose() }
  }
  $size = (Get-Item -LiteralPath $out).Length
  Write-Output ('OK ' + $counter + ' ' + $sku + ' ' + $size)
}
