# ============================================================
# Instalador del Servicio Fiscal (1 clic, autocontenido)
#
# Que hace:
#   1. Busca el proyecto service_fiscal (carpeta hermana del instalador,
#      Desktop, Documents, o clona del repositorio si falta).
#   2. Copia el proyecto a %LOCALAPPDATA%\Medizin\fiscal_service.
#   3. Crea el entorno virtual e instala requirements.
#   4. Registra 2 tareas en el Programador de tareas:
#        - "Medizin Fiscal Service": al iniciar sesion -> start_fiscal_service.ps1
#        - "Medizin Fiscal Update": cada 30 min -> update.ps1 -Restart
#   5. Ejecuta el check de update una vez (baja el exe si hay release).
#   6. Arranca el servicio y verifica http://127.0.0.1:8000/health
#
# Uso: doble clic en el archivo (o: powershell -ExecutionPolicy Bypass -File este.ps1)
# ============================================================

$ErrorActionPreference = "Stop"

$InstallerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dest = Join-Path $env:LOCALAPPDATA "Medizin\fiscal_service"
$RepoUrl = "https://github.com/jjtechnology2026-source/service_fiscal.git"
$LogFile = Join-Path $Dest "install.log"

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
    Add-Content -Path $LogFile -Value "$(Get-Date -Format o) $msg" -Encoding utf8
}
function Write-Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    $msg" -ForegroundColor Red }

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

Write-Step "Buscando el proyecto service_fiscal..."

$Candidates = @(
    (Join-Path $InstallerDir "service_fiscal"),
    (Join-Path (Split-Path $InstallerDir -Parent) "service_fiscal"),
    (Join-Path $env:USERPROFILE "Desktop\service_fiscal"),
    (Join-Path $env:USERPROFILE "Documents\service_fiscal"),
    (Join-Path $env:USERPROFILE "Downloads\service_fiscal")
)
$Source = $Candidates | Where-Object { Test-Path (Join-Path $_ "run.py") } | Select-Object -First 1

if (-not $Source) {
    Write-Step "Proyecto no encontrado en rutas locales. Intentando clonar del repositorio..."
    $Source = Join-Path $env:TEMP "service_fiscal_clone"
    if (Test-Path $Source) { Remove-Item $Source -Recurse -Force }
    try {
        git clone --depth 1 $RepoUrl $Source 2>&1 | Out-Host
    } catch {
        Write-Fail "No se pudo clonar (git no esta instalado o sin red)."
        Write-Fail "Coloca la carpeta service_fiscal junto a este instalador y volve a ejecutarlo."
        exit 1
    }
    if (-not (Test-Path (Join-Path $Source "run.py"))) {
        Write-Fail "El clon no trajo el proyecto (sin red o repositorio inaccesible)."
        Write-Fail "Coloca la carpeta service_fiscal junto a este instalador y volve a ejecutarlo."
        exit 1
    }
}
Write-Ok "Origen: $Source"

Write-Step "Copiando proyecto a $Dest"
$Exclude = @(".git", ".venv", "__pycache__", "build", "dist", "logs", "Biblioteca de integracion nueva 02-20260814T150250Z-1-001")
Get-ChildItem -Path $Source -Force | Where-Object { $Exclude -notcontains $_.Name } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $Dest -Recurse -Force
}
Write-Ok "Proyecto copiado."

Write-Step "Creando entorno virtual e instalando dependencias..."
$VenvPython = Join-Path $Dest ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    py -3 -m venv (Join-Path $Dest ".venv") 2>&1 | Out-Host
}
if (-not (Test-Path $VenvPython)) {
    python -m venv (Join-Path $Dest ".venv") 2>&1 | Out-Host
}
& $VenvPython -m pip install --disable-pip-version-check -q -r (Join-Path $Dest "requirements.txt") 2>&1 | Out-Host
Write-Ok "Dependencias instaladas."

Write-Step "Registrando tareas en el Programador de tareas..."
$StartAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Dest 'start_fiscal_service.ps1')`""
$StartTrigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "Medizin Fiscal Service" -Action $StartAction -Trigger $StartTrigger -Description "Arranca el servicio fiscal al iniciar sesion" -Force | Out-Null

$UpdateAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $Dest 'update.ps1')`" -Restart"
$UpdateTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 9999)
Register-ScheduledTask -TaskName "Medizin Fiscal Update" -Action $UpdateAction -Trigger $UpdateTrigger -Description "Verifica actualizaciones del servicio fiscal cada 30 min" -Force | Out-Null
Write-Ok "Tareas creadas: 'Medizin Fiscal Service' y 'Medizin Fiscal Update' (cada 30 min)."

Write-Step "Ejecutando check de actualizacion (una vez)..."
& (Join-Path $Dest "update.ps1") 2>&1 | Out-Host
Write-Ok "Check de actualizacion ejecutado. De ahora en mas es automatico (tarea cada 30 min)."

Write-Step "Registrando protocolo medizin-fiscal:// (instalacion directa desde el ERP)..."
$LauncherPath = Join-Path $Dest "fiscal_launcher.ps1"
if (-not (Test-Path $LauncherPath)) {
    $LauncherSource = Join-Path $Source "fiscal_launcher.ps1"
    if (Test-Path $LauncherSource) {
        Copy-Item -Path $LauncherSource -Destination $LauncherPath -Force
    } else {
        Write-Fail "fiscal_launcher.ps1 no encontrado en el proyecto. El boton del ERP no podra instalar directo."
        exit 1
    }
}
$ProtocolCmd = "`"powershell.exe`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPath`""
New-Item -Path "HKCU:\Software\Classes\medizin-fiscal" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\medizin-fiscal" -Name "(default)" -Value "URL:Medizin Fiscal Protocol" -Force
Set-ItemProperty -Path "HKCU:\Software\Classes\medizin-fiscal" -Name "URL Protocol" -Value "" -Force
New-Item -Path "HKCU:\Software\Classes\medizin-fiscal\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\medizin-fiscal\shell\open\command" -Name "(default)" -Value $ProtocolCmd -Force
Write-Ok "Protocolo medizin-fiscal:// registrado. El boton del ERP ahora instala directo."

Write-Step "Arrancando el servicio..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $Dest "start_fiscal_service.ps1") -WindowStyle Hidden
Start-Sleep -Seconds 8

Write-Step "Verificando servicio en http://127.0.0.1:8000/health"
try {
    $health = Invoke-RestMethod "http://127.0.0.1:8000/health" -TimeoutSec 10
    Write-Ok "Servicio instalado y corriendo: puerto $($health.serial_port)"
    Write-Host "`n=============================================" -ForegroundColor Green
    Write-Host "  INSTALACION COMPLETA. Listo para facturar." -ForegroundColor Green
    Write-Host "  Desde ahora, usa el boton del ERP: instala solo." -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
} catch {
    Write-Fail "El servicio no respondio en /health. Revisa:"
    Write-Fail "  - La impresora fiscal esta conectada en el puerto serial correcto"
    Write-Fail "  - El log: $LogFile"
    Write-Fail "  - Tareas: Panel de control > Programador de tareas > Medizin Fiscal Service"
    exit 1
}