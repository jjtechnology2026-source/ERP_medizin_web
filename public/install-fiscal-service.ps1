# ============================================================
# Instalador del Servicio Fiscal (1 clic, autocontenido)
#
# No necesita git, no necesita la carpeta del proyecto,
# no necesita Python. Descarga el binario FiscalService.exe
# del servidor de updates y genera los scripts auxiliares
# automaticamente.
#
# Uso: doble clic en el archivo (o: powershell -ExecutionPolicy Bypass -File este.ps1)
# ============================================================

$ErrorActionPreference = "Stop"

# Auto-elevacion: registrar tareas en el Programador y el protocolo HKLM requiere
# privilegios de administrador. Si este proceso no es admin, se relanza elevado
# (UAC) y se sale.
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Solicitando permisos de administrador (UAC)..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList (
        "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    )
    exit 0
}

$Dest = Join-Path $env:LOCALAPPDATA "Medizin\fiscal_service"
$UpdateBaseUrl = "https://updates.medizins.com/fiscal-service"
$ExePath = Join-Path $Dest "FiscalService.exe"
$LogFile = Join-Path $Dest "install.log"
function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    $msg" -ForegroundColor Red }
function Write-Log($msg) { "$(Get-Date -Format o) $msg" | Out-File -FilePath $LogFile -Append -Encoding utf8 }

try {
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $Dest "logs") | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Write-Log "=== Inicio de instalacion ==="

    # 1. Descargar el binario del servidor de updates.
    Write-Step "Descargando el Servicio Fiscal..."
    $manifest = Invoke-RestMethod "$UpdateBaseUrl/latest.json" -TimeoutSec 30
    $tmp = Join-Path $env:TEMP "FiscalService.download.exe"
    Invoke-WebRequest $manifest.url -OutFile $tmp -TimeoutSec 600
    $hash = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
    if ($hash -ne ([string]$manifest.sha256).ToLower()) {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        throw "La descarga esta corrupta (sha256 no coincide)."
    }
    Move-Item -Force $tmp $ExePath
    Set-Content -Path (Join-Path $Dest "version.txt") -Value $manifest.version -Encoding utf8
    Write-Ok "Version $($manifest.version) descargada correctamente."
    Write-Log "Binario descargado: version $($manifest.version)"

    # 2. Crear los scripts auxiliares.
    Write-Step "Creando scripts de arranque y actualizacion..."

    $startScript = @'
$ErrorActionPreference = "Continue"

Add-Type -Name WindowHelper -Namespace Win32 -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();'
$win = [Win32.WindowHelper]::GetConsoleWindow()
if ($win -ne [IntPtr]::Zero) { [Win32.WindowHelper]::ShowWindow($win, 0) | Out-Null }

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "fiscal_service.log"
$ServiceLogFile = Join-Path $LogDir "service_output.log"
$ExePath = Join-Path $ProjectDir "FiscalService.exe"
$VersionFile = Join-Path $ProjectDir "version.txt"

$env:HKA_SERIAL_PORT = "COM5"
$env:HKA_BAUDRATE = "9600"
$env:HKA_REPORT_Z_DELAY_SECONDS = "25"
$env:HKA_REPORT_Z_COMMAND = "I0Z"
$env:HKA_ENABLE_INVOICE_COMMANDS = "true"
$env:BEMATECH_SERIAL_PORT = "COM7"
$env:BEMATECH_USE_DLL = "true"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $ProjectDir

function Write-Log($msg) {
    try {
        $stream = [System.IO.File]::Open($LogFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        try {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("$(Get-Date -Format o) $msg`r`n")
            $stream.Write($bytes, 0, $bytes.Length)
        } finally {
            $stream.Close()
        }
    } catch {
        Write-Host "$(Get-Date -Format o) $msg"
    }
}

$localVersion = "0.0.0"
if (Test-Path $VersionFile) { $localVersion = (Get-Content $VersionFile -Raw).Trim() }

$runningVersion = $null
try {
    $health = Invoke-RestMethod "http://127.0.0.1:8000/health" -TimeoutSec 3
    if ($health.status -eq "ok") { $runningVersion = [string]$health.version }
} catch {
}

if ($runningVersion) {
    if ([version]$runningVersion -ge [version]$localVersion) {
        Write-Log "Service already running v$runningVersion (>= installed $localVersion), skip start"
        exit 0
    }
    Write-Log "Running v$runningVersion is older than installed $localVersion, restarting with newer"
    Stop-Process -Name FiscalService -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

& (Join-Path $ProjectDir "update.ps1")

Write-Log "Starting fiscal service on $env:HKA_SERIAL_PORT (installed $localVersion)"
if (Test-Path $ExePath) {
    & $ExePath *>> $ServiceLogFile
} else {
    Write-Log "FiscalService.exe no encontrado"
}
'@
    Set-Content -Path (Join-Path $Dest "start_fiscal_service.ps1") -Value $startScript -Encoding utf8

    $updateScript = @'
param([switch]$Restart)

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "fiscal_service.log"
$ExePath = Join-Path $ProjectDir "FiscalService.exe"
$VersionFile = Join-Path $ProjectDir "version.txt"
$UpdateBaseUrl = if ($env:FISCAL_UPDATE_URL) { $env:FISCAL_UPDATE_URL } else { "https://updates.medizins.com/fiscal-service" }
$NotifyUrl = $env:FISCAL_NOTIFY_URL

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log($msg) {
    try {
        $stream = [System.IO.File]::Open($LogFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        try {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("$(Get-Date -Format o) $msg`r`n")
            $stream.Write($bytes, 0, $bytes.Length)
        } finally {
            $stream.Close()
        }
    } catch {
        Write-Host "$(Get-Date -Format o) $msg"
    }
}

$local = "0.0.0"
if (Test-Path $VersionFile) { $local = (Get-Content $VersionFile -Raw).Trim() }

try {
    $manifest = Invoke-RestMethod "$UpdateBaseUrl/latest.json" -TimeoutSec 30
    $remote = [string]$manifest.version
    if ([version]$remote -le [version]$local) {
        Write-Log "Update check: up to date ($local)"
        exit 0
    }

    Write-Log "Update available: $local -> $remote"
    $tmp = Join-Path $ProjectDir "FiscalService.update.exe"
    Invoke-WebRequest $manifest.url -OutFile $tmp -TimeoutSec 600
    $hash = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
    if ($hash -ne ([string]$manifest.sha256).ToLower()) {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        throw "sha256 mismatch"
    }

    if ($NotifyUrl) {
        try {
            $body = @{ version = $remote; service = "fiscal" } | ConvertTo-Json
            Invoke-RestMethod -Method Post -Uri $NotifyUrl -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null
        } catch {
            Write-Log "Notification failed: $($_.Exception.Message)"
        }
    }

    $busy = $false
    try {
        $busy = (Invoke-RestMethod "http://127.0.0.1:8000/busy" -TimeoutSec 5).busy
    } catch {
        $busy = $false
    }
    if ($busy) {
        Write-Log "Service busy, deferring update to next check"
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        exit 0
    }

    Stop-Process -Name FiscalService -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Move-Item -Force $tmp $ExePath
    Set-Content -Path $VersionFile -Value $remote -Encoding utf8
    Write-Log "Updated to $remote"

    if ($Restart) {
        if (Test-Path $ExePath) {
            Start-Process -FilePath $ExePath -WorkingDirectory $ProjectDir -WindowStyle Hidden
        }
        Write-Log "Service restarted with $remote"
    }
} catch {
    Write-Log "Update check failed (continuing): $($_.Exception.Message)"
    exit 1
}
'@
    Set-Content -Path (Join-Path $Dest "update.ps1") -Value $updateScript -Encoding utf8

    $launcherScript = @'
$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "fiscal_service.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log($msg) {
    try {
        $stream = [System.IO.File]::Open($LogFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        try {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("$(Get-Date -Format o) $msg`r`n")
            $stream.Write($bytes, 0, $bytes.Length)
        } finally {
            $stream.Close()
        }
    } catch {
        Write-Host "$(Get-Date -Format o) $msg"
    }
}

function Test-Health {
    try {
        $h = Invoke-RestMethod "http://127.0.0.1:8000/health" -TimeoutSec 3
        return ($h.status -eq "ok")
    } catch {
        return $false
    }
}

Write-Log "Launcher triggered via medizin-fiscal://install"

& (Join-Path $ProjectDir "update.ps1") -Restart 2>&1 | Out-Null

Start-Sleep -Seconds 3
if (-not (Test-Health)) {
    Write-Log "Service not running after update check, starting it"
    Start-Process powershell.exe -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $ProjectDir "start_fiscal_service.ps1") -WindowStyle Hidden
    Start-Sleep -Seconds 8
}

if (Test-Health) {
    Write-Log "Service is up: http://127.0.0.1:8000/health"
} else {
    Write-Log "Service did not come up after launch"
}
'@
    Set-Content -Path (Join-Path $Dest "fiscal_launcher.ps1") -Value $launcherScript -Encoding utf8

    Write-Ok "Scripts creados."

    # 3. Registrar tareas en el Programador de tareas.
    # RunLevel Highest: el servicio corre ELEVADO (admin) al iniciar sesion. Es
    # necesario para que la DLL Bematech pueda escribir BemaFI32.ini en System32
    # (la DLL lo lee de ahi). Sin elevacion, un proceso con token limitado no
    # puede escribir en C:\Windows\System32 aunque el usuario sea admin (UAC).
    # Se registra con el usuario actual (Interactive) y nivel mas alto.
    Write-Step "Registrando tareas en el Programador de tareas..."
    $StartPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    $StartAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $Dest 'start_fiscal_service.ps1')`""
    $StartTrigger = New-ScheduledTaskTrigger -AtLogOn
    Register-ScheduledTask -TaskName "Medizin Fiscal Service" -Action $StartAction -Trigger $StartTrigger -Principal $StartPrincipal -Description "Arranca el servicio fiscal al iniciar sesion (elevado para la DLL Bematech)" -Force | Out-Null

    $UpdatePrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    $UpdateAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $Dest 'update.ps1')`" -Restart"
    $UpdateTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 9999)
    Register-ScheduledTask -TaskName "Medizin Fiscal Update" -Action $UpdateAction -Trigger $UpdateTrigger -Principal $UpdatePrincipal -Description "Verifica actualizaciones del servicio fiscal cada 30 min" -Force | Out-Null
    Write-Ok "Tareas creadas: 'Medizin Fiscal Service' y 'Medizin Fiscal Update' (elevadas, cada 30 min)."
    Write-Log "Tareas programadas registradas (RunLevel Highest)"

    # 4. Registrar el protocolo medizin-fiscal://.
    Write-Step "Registrando protocolo medizin-fiscal:// ..."
    $LauncherPath = Join-Path $Dest "fiscal_launcher.ps1"
    $ProtocolCmd = "`"powershell.exe`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPath`""
    foreach ($Root in @("HKCU:\Software\Classes", "HKLM:\Software\Classes")) {
        New-Item -Path (Join-Path $Root "medizin-fiscal") -Force | Out-Null
        Set-ItemProperty -Path (Join-Path $Root "medizin-fiscal") -Name "(default)" -Value "URL:Medizin Fiscal Protocol" -Force
        Set-ItemProperty -Path (Join-Path $Root "medizin-fiscal") -Name "URL Protocol" -Value "" -Force
        New-Item -Path (Join-Path $Root "medizin-fiscal\shell\open\command") -Force | Out-Null
        Set-ItemProperty -Path (Join-Path $Root "medizin-fiscal\shell\open\command") -Name "(default)" -Value $ProtocolCmd -Force
    }
    Write-Ok "Protocolo medizin-fiscal:// registrado."
    Write-Log "Protocolo registrado (HKCU + HKLM)"

    # 5. Arrancar el servicio.
    Write-Step "Arrancando el servicio..."
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $Dest "start_fiscal_service.ps1") -WindowStyle Hidden

    Write-Step "Verificando servicio en http://127.0.0.1:8000/health"
    $health = $null
    for ($i = 0; $i -lt 12; $i++) {
        Start-Sleep -Seconds 5
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:8000/health" -TimeoutSec 5
            break
        } catch {
            Write-Host "    Esperando al servicio... ($((($i+1)*5))s)" -ForegroundColor DarkYellow
        }
    }
    if ($health) {
        Write-Ok "Servicio instalado y corriendo: puerto $($health.serial_port)"
        Write-Log "Servicio verificado: $($health.serial_port)"
        Write-Host "`n=============================================" -ForegroundColor Green
        Write-Host "  INSTALACION COMPLETA. Listo para facturar." -ForegroundColor Green
        Write-Host "  Desde ahora, usa el boton del ERP: instala solo." -ForegroundColor Green
        Write-Host "=============================================" -ForegroundColor Green
        exit 0
    } else {
        Write-Fail "El servicio no respondio en /health. Revisa:"
        Write-Fail "  - La impresora fiscal esta conectada en el puerto serial correcto"
        Write-Fail "  - El log: $LogFile"
        Write-Log "Servicio no respondio en /health"
        exit 1
    }
} catch {
    Write-Fail "ERROR: $($_.Exception.Message)"
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}
