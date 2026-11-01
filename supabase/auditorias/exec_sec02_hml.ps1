<#
.SYNOPSIS
  Script de Execucao Controlada para Homologacao SEC-02 (Local e Descartavel).
.DESCRIPTION
  Wrapper de seguranca restrito estritamente ao container local Docker 'supabase_db_sec02_hml'.
  Executa verificacoes previas de isolamento fisico e logico antes de despachar qualquer SQL:
    1. Verifica status do Docker Desktop e Docker Engine.
    2. Valida nome, ID (SHA256 64-hex), imagem e estado 'running' do container supabase_db_sec02_hml.
    3. Valida conectividade interna via socket Unix no banco 'postgres' usando 'psql -X -v ON_ERROR_STOP=1'.
    4. Valida ausencia total de tabelas operacionais reais do ERP ORBE (exige estritamente resultado 'f').
    5. Executa os scripts SQL oficiais exclusivamente via 'docker exec -i' com 'psql -X -v ON_ERROR_STOP=1'
       utilizando leitura assincrona de streams (.NET) para prevencao contra deadlock de buffer.
    6. Rejeita terminantemente parametros externos de conexao, URLs, senhas ou hosts remotos.
.PARAMETER Script
  Identificador do script a executar: '00', '01', '02', '03', '04', '05' ou aliases.
.PARAMETER ValidateOnly
  Se especificado, executa apenas as verificacoes previas de isolamento sem rodar scripts SQL.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\supabase\auditorias\exec_sec02_hml.ps1 -ValidateOnly
  powershell -ExecutionPolicy Bypass -File .\supabase\auditorias\exec_sec02_hml.ps1 -Script 01
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false, Position = 0)]
    [ValidateSet('00', '00b', '01', '02', '03', '04', '05', '16_9', 'check', 'schema', 'audit_log', 'diagnostico_pre', 'migration', 'testes', 'rollback', 'auditoria_pos', 'concorrencia')]
    [string]$Script,

    [Parameter(Mandatory = $false)]
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ==============================================================================
# CONSTANTES RIGIDAS DE ISOLAMENTO (IMUTAVEIS)
# ==============================================================================
$TARGET_CONTAINER = "supabase_db_sec02_hml"
$TARGET_DB = "postgres"
$TARGET_USER = "postgres"
$EXPECTED_IMAGE_TAG = "supabase/postgres"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " ERP ORBE - SEC-02 | EXECUTOR CONTROLADO DE HOMOLOGACAO LOCAL" -ForegroundColor Cyan
Write-Host " Target Container: $TARGET_CONTAINER" -ForegroundColor Cyan
Write-Host " Target Database:  $TARGET_DB (Socket Unix Local)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Helper robusto para invocacao de comandos Docker
# Evita que avisos/warnings no stderr (ex: DOCKER_INSECURE_NO_IPTABLES_RAW)
# causem NativeCommandError sob $ErrorActionPreference = 'Stop' no Windows PowerShell 5.1.
# Utiliza ReadToEndAsync() do .NET sem event handlers do PowerShell, prevenindo deadlocks e terminacoes silenciosas.
function Invoke-DockerCmd {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Arguments
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = $Arguments
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    if ($null -eq $proc) {
        throw "FATAL / FAIL-CLOSED: Nao foi possivel iniciar processo 'docker $Arguments'!"
    }

    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()

    $proc.WaitForExit()
    [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)

    $resExitCode = $proc.ExitCode
    $resStdout = $stdoutTask.Result
    $resStderr = $stderrTask.Result

    return [PSCustomObject]@{
        ExitCode = $resExitCode
        Stdout   = $resStdout
        Stderr   = $resStderr
    }
}

# ------------------------------------------------------------------------------
# 1. VERIFICACAO DO DOCKER CLI E DAEMON
# ------------------------------------------------------------------------------
Write-Host "[1/5] Verificando Docker CLI e status do Docker daemon..." -NoNewline
try {
    $null = Get-Command docker -ErrorAction Stop
} catch {
    Write-Host " [FALHA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: O comando 'docker' nao esta disponivel no PATH do sistema!"
}

$infoResult = Invoke-DockerCmd -Arguments "info"
if ($infoResult.ExitCode -ne 0) {
    Write-Host " [FALHA]" -ForegroundColor Red
    $errDetail = if (-not [string]::IsNullOrWhiteSpace($infoResult.Stderr)) { $infoResult.Stderr.Trim() } else { $infoResult.Stdout.Trim() }
    throw "FATAL / FAIL-CLOSED: O Docker daemon nao esta operacional! (ExitCode: $($infoResult.ExitCode), Erro: $errDetail)"
}
Write-Host " [OK]" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 2. VALIDACAO FISICA DO CONTAINER supabase_db_sec02_hml (FIX 03: IDENTIDADE ESTRITA)
# ------------------------------------------------------------------------------
Write-Host "[2/5] Validando identidade, ID SHA256, imagem e estado do container $TARGET_CONTAINER..." -NoNewline

$inspectResult = Invoke-DockerCmd -Arguments "inspect $TARGET_CONTAINER"
if ($inspectResult.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($inspectResult.Stdout)) {
    Write-Host " [FALHA]" -ForegroundColor Red
    $errDetail = $inspectResult.Stderr.Trim()
    throw "FATAL / FAIL-CLOSED: Container '$TARGET_CONTAINER' nao encontrado no Docker local! (ExitCode: $($inspectResult.ExitCode), Erro: $errDetail)"
}

try {
    $containerObj = ($inspectResult.Stdout | ConvertFrom-Json)[0]
} catch {
    Write-Host " [FALHA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: Erro ao decodificar JSON do docker inspect: $_"
}

# 2.1 Validacao do ID do Container (Hash SHA256 de 64 caracteres hexadecimais)
if ([string]::IsNullOrWhiteSpace($containerObj.Id) -or $containerObj.Id -notmatch '^[0-9a-fA-F]{64}$') {
    Write-Host " [FALHA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: ID do container invalido ou em formato inesperado ('$($containerObj.Id)')! Esperado hash SHA256 de 64 caracteres."
}

# 2.2 Nome Exato do Container
if ($containerObj.Name -ne "/$TARGET_CONTAINER") {
    Write-Host " [FALHA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: Nome do container divergente! Esperado '/$TARGET_CONTAINER', obtido '$($containerObj.Name)'"
}

# 2.3 Estado Operacional Estrito
if ($containerObj.State.Running -ne $true -or $containerObj.State.Status -ne "running") {
    Write-Host " [FALHA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: Container '$TARGET_CONTAINER' nao esta no estado 'running' (Status: $($containerObj.State.Status))!"
}

# 2.4 Imagem Oficial Supabase
if ($containerObj.Config.Image -notlike "*$EXPECTED_IMAGE_TAG*") {
    Write-Host " [FALHA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: Imagem do container '$($containerObj.Config.Image)' nao corresponde a '$EXPECTED_IMAGE_TAG'!"
}

$containerIdShort = $containerObj.Id.Substring(0, 12)
Write-Host " [OK] ($containerIdShort | Image: $($containerObj.Config.Image) | Status: Running)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. VALIDACAO DE CONECTIVIDADE INTERNA (FIX 01: psql -X -v ON_ERROR_STOP=1)
# ------------------------------------------------------------------------------
Write-Host "[3/5] Validando conectividade interna ao PostgreSQL via socket Unix..." -NoNewline

$testQuery = "SELECT current_database() || '|' || COALESCE(inet_server_addr()::text, 'SOCKET_UNIX');"
$connResult = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TARGET_DB -t -A -c `"$testQuery`""

if ($connResult.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($connResult.Stdout)) {
    Write-Host " [FALHA]" -ForegroundColor Red
    $errDetail = if (-not [string]::IsNullOrWhiteSpace($connResult.Stderr)) { $connResult.Stderr.Trim() } else { $connResult.Stdout.Trim() }
    throw "FATAL / FAIL-CLOSED: Falha de conectividade interna ao PostgreSQL via docker exec (ExitCode: $($connResult.ExitCode), Erro: $errDetail)!"
}

$connCheck = $connResult.Stdout.Trim()
$connParts = $connCheck.Split('|')

if ($connParts.Length -lt 2 -or $connParts[0] -ne "postgres") {
    Write-Host " [FALHA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: Resposta de conectividade invalida ('$connCheck')! Banco esperado: 'postgres'."
}
Write-Host " [OK] (DB: postgres | Conexao: $($connParts[1]))" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. VALIDACAO ESTRITA DO CATALOGO ANTI-PRODUCAO (FIX 01: ACEITA APENAS 'f')
# ------------------------------------------------------------------------------
Write-Host "[4/5] Inspecionando catalogo para garantia absoluta anti-producao..." -NoNewline

$checkErpSql = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('colaboradores', 'empresas', 'operacoes', 'lancamentos_diaristas', 'registros_ponto', 'clientes', 'fornecedores', 'transportadoras', 'veiculos', 'regras_operacionais'));"
$erpResultObj = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TARGET_DB -t -A -c `"$checkErpSql`""

if ($erpResultObj.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($erpResultObj.Stdout)) {
    Write-Host " [FALHA]" -ForegroundColor Red
    $errDetail = if (-not [string]::IsNullOrWhiteSpace($erpResultObj.Stderr)) { $erpResultObj.Stderr.Trim() } else { $erpResultObj.Stdout.Trim() }
    throw "FATAL / FAIL-CLOSED: Falha ao consultar catalogo de tabelas operacionais (ExitCode: $($erpResultObj.ExitCode), Erro: $errDetail)!"
}

$erpResult = $erpResultObj.Stdout.Trim()

# REGRA ESTRITA: aceitar exclusivamente resultado 'f'. Qualquer outro valor ('t', vazio, erro) aborta imediatamente.
if ($erpResult -ne "f") {
    Write-Host " [FALHA CRITICA]" -ForegroundColor Red
    throw "FATAL / FAIL-CLOSED: O catalogo retornou '$erpResult' (esperado estritamente 'f')! Tabelas operacionais reais do ERP detectadas ou resposta inesperada. Abortando imediatamente!"
}
Write-Host " [OK] (Resultado: 'f' - Zero tabelas operacionais reais)" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 5. MAPEAMENTO E RESOLUCAO DO SCRIPT SQL
# ------------------------------------------------------------------------------
if ($ValidateOnly -or [string]::IsNullOrWhiteSpace($Script) -or $Script -eq "check") {
    Write-Host "`n==================================================================" -ForegroundColor Green
    Write-Host " DIAGNOSTICO DE ISOLAMENTO APROVADO COM SUCESSO!" -ForegroundColor Green
    Write-Host " Container: $TARGET_CONTAINER ($containerIdShort)" -ForegroundColor Green
    Write-Host " Banco:     $TARGET_DB (Socket Unix)" -ForegroundColor Green
    Write-Host " Status:    Ambiente descartavel homologado e pronto para execucao." -ForegroundColor Green
    Write-Host "==================================================================" -ForegroundColor Green
    exit 0
}

if ($Script -in @('16_9', 'concorrencia')) {
    $concurrencyScript = Join-Path (Get-Location).Path "supabase/auditorias/exec_sec16_9_concorrencia.ps1"
    $proc = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$concurrencyScript`"" -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) {
        Write-Host "`n==================================================================" -ForegroundColor Red
        Write-Host " RESULTADO: FAIL - EXECUTOR DE CONCORRENCIA ENCERROU COM ERRO!" -ForegroundColor Red
        Write-Host " ExitCode: $($proc.ExitCode)" -ForegroundColor Red
        Write-Host "==================================================================" -ForegroundColor Red
        exit $proc.ExitCode
    }
    exit 0
}

$scriptMap = @{
    '00'              = "supabase/auditorias/sec_02_script_00_schema_minimo_local.sql"
    'schema'          = "supabase/auditorias/sec_02_script_00_schema_minimo_local.sql"
    '00b'             = "supabase/auditorias/sec_02_script_00b_audit_log_local.sql"
    'audit_log'       = "supabase/auditorias/sec_02_script_00b_audit_log_local.sql"
    '01'              = "supabase/auditorias/sec_02_script_01_diagnostico_pre.sql"
    'diagnostico_pre' = "supabase/auditorias/sec_02_script_01_diagnostico_pre.sql"
    '02'              = "supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql"
    'migration'       = "supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql"
    '03'              = "supabase/auditorias/sec_02_script_03_testes_seguranca.sql"
    'testes'          = "supabase/auditorias/sec_02_script_03_testes_seguranca.sql"
    '04'              = "supabase/migrations/rollback/20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql"
    'rollback'        = "supabase/migrations/rollback/20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql"
    '05'              = "supabase/auditorias/sec_02_script_05_auditoria_pos.sql"
    'auditoria_pos'   = "supabase/auditorias/sec_02_script_05_auditoria_pos.sql"
}

$resolvedRelativePath = $scriptMap[$Script]
$workspaceRoot = (Get-Location).Path
$targetSqlFile = Join-Path $workspaceRoot $resolvedRelativePath

if (-not (Test-Path $targetSqlFile)) {
    throw "FATAL / FAIL-CLOSED: Arquivo SQL mapeado nao encontrado no disco: $targetSqlFile"
}

Write-Host "[5/5] Preparado para executar script oficial:" -ForegroundColor Cyan
Write-Host "      Arquivo: $resolvedRelativePath" -ForegroundColor Yellow

# ------------------------------------------------------------------------------
# 6. EXECUCAO CONTROLADA VIA PIPE SEGURO (.NET READTOENDASYNC SEM EVENT HANDLERS)
# ------------------------------------------------------------------------------
Write-Host "`n------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " DISPARANDO EXECUCAO CONTROLADA VIA DOCKER EXEC..." -ForegroundColor Cyan
Write-Host " Comando: docker exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TARGET_DB" -ForegroundColor DarkGray
Write-Host "------------------------------------------------------------------`n" -ForegroundColor Cyan

# Adicionar --single-transaction para SCRIPT 00b, migration (Script 02) e rollback (Script 04), garantindo atomicidade total
$psqlExtraArgs = ""
if ($Script -in @('00b', 'audit_log', '02', 'migration', '04', 'rollback')) {
    $psqlExtraArgs = " --single-transaction"
    Write-Host " [TRANSACAO ATOMICA ATIVADA: --single-transaction]" -ForegroundColor Magenta
}

$processStartInfo = New-Object System.Diagnostics.ProcessStartInfo
$processStartInfo.FileName = "docker"
$processStartInfo.Arguments = "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1$psqlExtraArgs -U $TARGET_USER -d $TARGET_DB"
$processStartInfo.UseShellExecute = $false
$processStartInfo.RedirectStandardInput = $true
$processStartInfo.RedirectStandardOutput = $true
$processStartInfo.RedirectStandardError = $true
$processStartInfo.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($processStartInfo)
if ($null -eq $process) {
    throw "FATAL / FAIL-CLOSED: Nao foi possivel iniciar o processo docker exec!"
}

# Iniciar leitura assincrona das saidas antes de escrever no StandardInput (prevencao de deadlock de buffer)
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()

# Transmitir bytes UTF-8 brutos do arquivo diretamente pelo BaseStream do processo.
# Isso elimina qualquer conversao ou corrupcao de caracteres acentuados pela pagina de codigo OEM/CP850 do PowerShell 5.1.
$sqlBytes = [System.IO.File]::ReadAllBytes($targetSqlFile)
$rawStream = $process.StandardInput.BaseStream
$rawStream.Write($sqlBytes, 0, $sqlBytes.Length)
$rawStream.Flush()
$rawStream.Close()

# Aguardar conclusao do processo e das tasks de leitura assincrona
$process.WaitForExit()
[System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)

$exitCode = $process.ExitCode
$stdoutStr = $stdoutTask.Result
$stderrStr = $stderrTask.Result

# Renderizar saida do stdout
if (-not [string]::IsNullOrWhiteSpace($stdoutStr)) {
    Write-Host $stdoutStr.TrimEnd()
}

# Renderizar notices e eventuais erros de stderr
if (-not [string]::IsNullOrWhiteSpace($stderrStr)) {
    $stderrLines = $stderrStr.Split(@("`r`n", "`n"), [System.StringSplitOptions]::None)
    foreach ($line in $stderrLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line -match '^NOTICE:') {
            Write-Host $line -ForegroundColor DarkYellow
        } elseif ($line -match '^WARNING:') {
            Write-Host $line -ForegroundColor Yellow
        } elseif ($line -match '^ERROR:') {
            Write-Host $line -ForegroundColor Red
        } else {
            Write-Host $line -ForegroundColor Gray
        }
    }
}

if ($exitCode -ne 0) {
    Write-Host "`n==================================================================" -ForegroundColor Red
    Write-Host " RESULTADO: FAIL (ExitCode: $exitCode)" -ForegroundColor Red
    Write-Host "==================================================================" -ForegroundColor Red
    throw "FATAL: Execucao de '$resolvedRelativePath' falhou com ExitCode $exitCode!"
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host " RESULTADO: SUCCESS (ExitCode: 0)" -ForegroundColor Green
Write-Host " SCRIPT '$resolvedRelativePath' EXECUTADO COM SUCESSO!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
