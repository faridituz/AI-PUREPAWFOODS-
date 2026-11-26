$list = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\..\data\work\xmllist.txt') -Encoding UTF8
$bad = 0
foreach ($p in $list) {
  if (-not (Test-Path -LiteralPath $p)) { Write-Output "MISSING $p"; $bad++; continue }
  try { [xml]$x = Get-Content -LiteralPath $p -Encoding UTF8 -Raw | Out-String; $n = $x.GetElementsByTagName('*').Count } catch { Write-Output ("XMLFAIL " + $p + " " + $_.Exception.Message); $bad++ }
}
Write-Output ("checked " + $list.Count + " parts, failures " + $bad)
